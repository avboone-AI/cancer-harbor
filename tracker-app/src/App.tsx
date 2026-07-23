import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Activity, AlertCircle, BarChart3, BookOpen, CalendarRange, CheckCircle2, ChevronRight,
  ClipboardList, Database, Dna, Download, FileClock, FileText, FlaskConical, HeartPulse,
  LayoutDashboard, Menu, Plus, RefreshCcw, ScanLine, Search, ShieldCheck, Trash2, Upload, UserPlus, X,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DataTable, { type Column } from './components/DataTable'
import UploadPanel from './components/UploadPanel'
import ReviewModal from './components/ReviewModal'
import { exportCsv, exportExcel } from './lib/export'
import { deleteDocumentFiles, getDocumentFile } from './lib/documentStore'
import { deletePatientData, getActivePatientId, loadData, loadPatients, resetData, saveData, savePatients, setActivePatientId, upsertById } from './lib/storage'
import type { Biomarker, ClinicalNote, ExtractedDraft, LesionMeasurement, RecistAssessment, SourceDocument, TimelineEvent, TrackerData, Treatment } from './types'

type View = 'dashboard' | 'upload' | 'timeline' | 'treatments' | 'lesions' | 'recist' | 'biomarkers' | 'notes' | 'documents'
const NAV: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard }, { id: 'upload', label: 'Add document', icon: Upload },
  { id: 'timeline', label: 'Master timeline', icon: CalendarRange }, { id: 'treatments', label: 'Treatment timeline', icon: HeartPulse },
  { id: 'lesions', label: 'Lesion tracker', icon: ScanLine }, { id: 'recist', label: 'RECIST response', icon: BarChart3 },
  { id: 'biomarkers', label: 'Biomarkers', icon: Dna }, { id: 'notes', label: 'Labs / symptoms', icon: FlaskConical },
  { id: 'documents', label: 'Source documents', icon: FileText },
]

const formatDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Ongoing'
const statusClass = (status: string) => /progress/i.test(status) ? 'danger' : /partial|shrink|response/i.test(status) ? 'positive' : /stable/i.test(status) ? 'stable' : 'neutral'
const slug = (value: unknown) => String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) { return <span className={`badge ${tone || statusClass(String(children))}`}>{children}</span> }
function SourceLink({ documentId, data }: { documentId: string; data: TrackerData }) {
  const doc = data.documents.find((item) => item.id === documentId)
  const [storedUrl, setStoredUrl] = useState('')
  useEffect(() => {
    let objectUrl = ''
    let active = true
    if (doc?.hasStoredFile) getDocumentFile(doc.id).then((file) => {
      if (!file || !active) return
      objectUrl = URL.createObjectURL(file)
      setStoredUrl(objectUrl)
    }).catch(() => setStoredUrl(''))
    else setStoredUrl(doc?.sourceUrl || '')
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [doc?.id, doc?.hasStoredFile, doc?.sourceUrl])
  if (!doc) return <span className="muted">—</span>
  return storedUrl ? <a className="source-link" href={storedUrl} target="_blank" rel="noreferrer"><FileText size={14}/>{doc.fileName}</a> : <span className="source-link"><FileText size={14}/>{doc.fileName}</span>
}

function App() {
  const [patients, setPatients] = useState(() => loadPatients())
  const [activePatient, setActivePatient] = useState(() => getActivePatientId())
  const [data, setDataState] = useState<TrackerData>(() => loadData(getActivePatientId()))
  const [view, setView] = useState<View>('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [draft, setDraft] = useState<ExtractedDraft | null>(null)
  const [toast, setToast] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [patientOpen, setPatientOpen] = useState(false)
  const [patientDeleteOpen, setPatientDeleteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const patient = patients.find((item) => item.id === activePatient) || patients[0]
  const setData = (next: TrackerData) => { setDataState(next); saveData(activePatient, next) }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200) }
  const documentsById = useMemo(() => new Map(data.documents.map((doc) => [doc.id, doc])), [data.documents])

  const switchPatient = (id: string) => {
    setActivePatient(id)
    setActivePatientId(id)
    setDataState(loadData(id))
    setView('dashboard')
  }

  const addPatient = (patientName: string) => {
    const name = patientName.trim()
    if (!name) return
    const id = `${slug(name)}-${Date.now().toString(36)}`
    const nextPatients = [...patients, { id, name, createdAt: new Date().toISOString() }]
    setPatients(nextPatients)
    savePatients(nextPatients)
    switchPatient(id)
    setPatientOpen(false)
    notify(`${name} is ready for records.`)
  }

  const removePatient = () => {
    if (!patient || patient.seeded) return
    const nextPatients = patients.filter((item) => item.id !== patient.id)
    void deleteDocumentFiles(data.documents.map((document) => document.id))
    deletePatientData(patient.id)
    setPatients(nextPatients)
    savePatients(nextPatients)
    switchPatient(nextPatients[0].id)
    setPatientDeleteOpen(false)
    notify(`${patient.name} was removed from this browser.`)
  }

  const resetTracker = () => {
    void deleteDocumentFiles(data.documents.filter((document) => document.hasStoredFile).map((document) => document.id))
    setDataState(resetData(activePatient))
    setResetOpen(false)
    notify(patient?.seeded ? 'Example patient was reset to the bundled dataset.' : 'Patient tracker cleared.')
  }

  const latestScan = [...data.timeline].filter((row) => /CT|PET/i.test(row.documentType)).sort((a, b) => b.date.localeCompare(a.date))[0]
  const activeTreatment = [...data.treatments].filter((row) => !row.endDate && !/planned/i.test(row.category)).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  const latestRecist = [...data.recist].sort((a, b) => b.date.localeCompare(a.date))[0]
  const currentTrialRecist = data.recist.filter((row) => row.trial === latestRecist?.trial).sort((a, b) => a.date.localeCompare(b.date))
  const targetChart = currentTrialRecist.map((row) => ({ date: row.date.slice(5).replace('-', '/'), sum: row.sumMm, baseline: row.baselineMm }))
  const lesionChart = data.measurements.filter((m) => m.lesionId === 'bladder-dome').sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ date: m.date.slice(2, 7), mm: m.longMm }))

  const saveDraft = (verified: ExtractedDraft) => {
    const existing = data.timeline.find((row) => row.date === verified.event.date && row.documentType === verified.event.documentType && row.facility === verified.event.facility)
    const document = existing ? documentsById.get(existing.documentId) : undefined
    const documentId = document?.id || verified.document.id
    const event = { ...verified.event, id: existing?.id || verified.event.id, documentId }
    const recist = verified.recist ? { ...verified.recist, documentId } : undefined
    const measurements = verified.measurements.map((row) => ({ ...row, id: `measurement-${row.lesionId}-${row.date}`, documentId }))
    setData({
      ...data,
      documents: upsertById(data.documents, [{ ...verified.document, id: documentId }]),
      timeline: upsertById(data.timeline, [event]),
      recist: recist ? upsertById(data.recist, [recist]) : data.recist,
      measurements: upsertById(data.measurements, measurements),
    })
    setDraft(null); setView('timeline'); notify(existing ? 'Existing record updated — no duplicate created.' : 'Verified record saved and linked to its source.')
  }

  const importWorkbook = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const timelineSheet = wb.Sheets['Master Timeline']
      const treatmentSheet = wb.Sheets['Treatment Timeline']
      if (!timelineSheet) throw new Error('No “Master Timeline” sheet found')
      const timelineRows = XLSX.utils.sheet_to_json<Record<string, string>>(timelineSheet, { defval: '' })
      const treatmentRows = treatmentSheet ? XLSX.utils.sheet_to_json<Record<string, string>>(treatmentSheet, { defval: '' }) : []
      const incomingDocs: SourceDocument[] = []
      const incomingEvents: TimelineEvent[] = timelineRows.map((row) => {
        const date = String(row.Date || '').slice(0, 10)
        const source = row['Source File'] || file.name
        const documentId = `doc-${slug(source)}`
        const documentType = row['Document Type'] || ''
        const facility = row.Facility || ''
        const existing = data.timeline.find((event) => event.date === date && event.documentType === documentType && event.facility === facility)
        incomingDocs.push({ id: documentId, fileName: source, documentType: row['Document Type'] || 'Imported record', documentDate: date, facility: row.Facility || '', confidence: 'high', importedAt: new Date().toISOString(), status: 'reviewed' })
        return { id: existing?.id || `event-${slug(`${date}-${documentType}-${facility}-${source}`)}`, date, facility, documentType, diseasePhase: row['Disease Phase'] || '', findings: row['Primary / Dominant Findings'] || '', keyMeasurements: row['Key Measurements'] || '', status: row['Disease Status'] || '', treatment: row['Treatment Active'] || '', lineTrial: row['Line / Trial'] || '', notes: row['Major Event / Notes'] || '', documentId, confidence: 'high' }
      })
      const incomingTreatments: Treatment[] = treatmentRows.map((row) => {
        const startDate = String(row['Start Date']).slice(0, 10)
        const regimen = row['Regimen / Procedure'] || ''
        const existing = data.treatments.find((treatment) => treatment.startDate === startDate && treatment.regimen === regimen)
        return { id: existing?.id || `treatment-${slug(`${startDate}-${regimen}`)}`, startDate, endDate: String(row['End Date']).slice(0, 10), category: row.Category || '', regimen, center: row.Center || '', context: row['Purpose / Context'] || '', documentId: `doc-${slug(String(row['Source File'] || file.name).split('; ')[0])}` }
      })
      setData({ ...data, documents: upsertById(data.documents, incomingDocs), timeline: upsertById(data.timeline, incomingEvents), treatments: upsertById(data.treatments, incomingTreatments) })
      notify(`Imported ${incomingEvents.length} timeline rows and ${incomingTreatments.length} treatments.`)
    } catch (error) { notify(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`) }
  }

  const addNote = (note: ClinicalNote) => { setData({ ...data, notes: upsertById(data.notes, [note]) }); setNoteOpen(false); notify('Entry added.') }

  const timelineColumns: Column<TimelineEvent>[] = [
    { key: 'date', label: 'Date', width: '120px', render: (r) => <strong>{formatDate(r.date)}</strong> },
    { key: 'documentType', label: 'Event / document', width: '190px', render: (r) => <div><strong>{r.documentType}</strong><small>{r.facility}</small></div> },
    { key: 'findings', label: 'Dominant findings', width: '340px' }, { key: 'keyMeasurements', label: 'Key measurements', width: '280px' },
    { key: 'status', label: 'Disease status', width: '150px', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'treatment', label: 'Treatment active', width: '190px' }, { key: 'documentId', label: 'Source', width: '220px', render: (r) => <SourceLink documentId={r.documentId} data={data}/> },
  ]
  const treatmentColumns: Column<Treatment>[] = [
    { key: 'startDate', label: 'Start', width: '115px', render: (r) => formatDate(r.startDate) }, { key: 'endDate', label: 'End', width: '115px', render: (r) => formatDate(r.endDate) },
    { key: 'category', label: 'Category', width: '150px' }, { key: 'regimen', label: 'Regimen / procedure', width: '260px', render: (r) => <strong>{r.regimen}</strong> },
    { key: 'center', label: 'Center', width: '160px' }, { key: 'context', label: 'Purpose / context', width: '320px' }, { key: 'documentId', label: 'Source', width: '220px', render: (r) => <SourceLink documentId={r.documentId} data={data}/> },
  ]
  const measurementRows = data.measurements.map((row) => ({ ...row, lesionName: data.lesions.find((l) => l.id === row.lesionId)?.name || row.lesionId }))
  const lesionColumns: Column<typeof measurementRows[number]>[] = [
    { key: 'date', label: 'Date', width: '115px', render: (r) => formatDate(r.date) }, { key: 'lesionName', label: 'Lesion', width: '230px', render: (r) => <strong>{r.lesionName}</strong> },
    { key: 'longMm', label: 'Long (mm)', width: '100px' }, { key: 'shortMm', label: 'Short (mm)', width: '100px' }, { key: 'trend', label: 'Trend', width: '170px', render: (r) => <Badge>{r.trend}</Badge> },
    { key: 'treatment', label: 'Treatment', width: '190px' }, { key: 'notes', label: 'Notes', width: '330px' }, { key: 'documentId', label: 'Source', width: '220px', render: (r) => <SourceLink documentId={r.documentId} data={data}/> },
  ]
  const recistColumns: Column<RecistAssessment>[] = [
    { key: 'date', label: 'Assessment', width: '125px', render: (r) => <strong>{formatDate(r.date)}</strong> }, { key: 'trial', label: 'Trial / regimen', width: '150px' },
    { key: 'sumMm', label: 'Target sum', width: '110px', render: (r) => r.sumMm === null ? '—' : `${r.sumMm} mm` }, { key: 'changePct', label: 'vs baseline', width: '110px', render: (r) => r.changePct === null ? '—' : `${r.changePct > 0 ? '+' : ''}${r.changePct}%` },
    { key: 'targetResponse', label: 'Target response', width: '150px' }, { key: 'nonTargetResponse', label: 'Non-target', width: '170px' }, { key: 'newLesions', label: 'New lesions', width: '110px' },
    { key: 'overallResponse', label: 'Overall', width: '150px', render: (r) => <Badge>{r.overallResponse}</Badge> }, { key: 'documentId', label: 'Source', width: '220px', render: (r) => <SourceLink documentId={r.documentId} data={data}/> },
  ]
  const biomarkerColumns: Column<Biomarker>[] = [
    { key: 'reportDate', label: 'Report date', width: '125px', render: (r) => formatDate(r.reportDate) }, { key: 'marker', label: 'Biomarker', width: '190px', render: (r) => <strong>{r.marker}</strong> },
    { key: 'method', label: 'Method', width: '120px' }, { key: 'result', label: 'Result', width: '260px' }, { key: 'interpretation', label: 'Classification / note', width: '280px' },
    { key: 'documentId', label: 'Source', width: '220px', render: (r) => <SourceLink documentId={r.documentId} data={data}/> },
  ]
  const noteColumns: Column<ClinicalNote>[] = [
    { key: 'date', label: 'Date', width: '120px', render: (r) => formatDate(r.date) }, { key: 'type', label: 'Type', width: '110px' }, { key: 'name', label: 'Name', width: '180px', render: (r) => <strong>{r.name}</strong> },
    { key: 'value', label: 'Value', width: '110px' }, { key: 'unit', label: 'Unit', width: '100px' }, { key: 'detail', label: 'Detail', width: '360px' }, { key: 'documentId', label: 'Source', width: '220px', render: (r) => <SourceLink documentId={r.documentId} data={data}/> },
  ]
  const documentColumns: Column<SourceDocument>[] = [
    { key: 'documentDate', label: 'Date', width: '120px', render: (r) => formatDate(r.documentDate) }, { key: 'fileName', label: 'Source document', width: '330px', render: (r) => <SourceLink documentId={r.id} data={data}/> },
    { key: 'documentType', label: 'Type', width: '210px' }, { key: 'facility', label: 'Facility', width: '200px' }, { key: 'confidence', label: 'Confidence', width: '120px', render: (r) => <span className={`confidence ${r.confidence}`}>{r.confidence}</span> },
    { key: 'status', label: 'Review status', width: '130px', render: (r) => <Badge tone={r.status === 'reviewed' ? 'positive' : 'neutral'}>{r.status}</Badge> },
  ]

  const headers: Record<View, { eyebrow: string; title: string; subtitle: string }> = {
    dashboard: { eyebrow: 'PRIVATE ONCOLOGY ORGANIZER', title: 'Treatment overview', subtitle: 'A source-linked view of treatment, response, and measurable disease.' },
    upload: { eyebrow: 'LOCAL DOCUMENT INTAKE', title: 'Add a medical document', subtitle: 'Extract locally, review every field, then merge it into the tracker.' },
    timeline: { eyebrow: 'CHRONOLOGY', title: 'Master timeline', subtitle: 'Scans, treatments, pathology, procedures, and major clinical events.' },
    treatments: { eyebrow: 'THERAPY HISTORY', title: 'Treatment timeline', subtitle: 'Regimens, procedures, trials, and treatment context over time.' },
    lesions: { eyebrow: 'MEASURABLE DISEASE', title: 'Lesion tracker', subtitle: 'Longitudinal measurements kept separate by lesion family.' },
    recist: { eyebrow: 'RESPONSE ASSESSMENT', title: 'RECIST response tracker', subtitle: 'Formal and trial-reported target, non-target, and overall responses.' },
    biomarkers: { eyebrow: 'MOLECULAR PROFILE', title: 'Biomarkers', subtitle: 'Source-linked IHC, genomic signatures, and reported alterations.' },
    notes: { eyebrow: 'DAY-TO-DAY TRACKING', title: 'Labs, symptoms & notes', subtitle: 'Add structured observations without mixing them into scan response data.' },
    documents: { eyebrow: 'AUDIT TRAIL', title: 'Source documents', subtitle: 'Every extracted record retains its document identity and confidence.' },
  }

  const current = headers[view]
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={22}/></div><div><strong>Cancer Harbor</strong><span>Health Tracker</span></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={20}/></button></div>
      <nav>{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setMobileNav(false) }}><Icon size={18}/><span>{label}</span>{view === id && <ChevronRight size={15}/>}</button>)}</nav>
      <div className="privacy-card"><ShieldCheck size={20}/><div><strong>Local & private</strong><span>Each patient has a separate browser record.</span></div></div>
      <div className="sidebar-foot"><span>Personal organization only</span><span>Not medical advice</span></div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)}/>} 
    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu size={21}/></button><a className="resource-home" href="../index.html">Cancer resources</a><div className="patient-switcher"><select aria-label="Active patient" value={activePatient} onChange={(event) => switchPatient(event.target.value)}>{patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" onClick={() => setPatientOpen(true)} title="Add patient" aria-label="Add patient"><UserPlus size={17}/></button>{patient && !patient.seeded && <button className="delete-patient" type="button" onClick={() => setPatientDeleteOpen(true)} title="Delete patient" aria-label="Delete patient"><Trash2 size={16}/></button>}</div><button className="export-button" onClick={() => exportExcel(data, patient?.name || 'Patient')}><Download size={16}/>Export Excel</button></header>
      <div className="content">
        <div className="page-head"><div><span className="eyebrow">{current.eyebrow} · {(patient?.name || 'PATIENT').toUpperCase()}</span><h1>{current.title}</h1><p>{current.subtitle}</p></div>{view !== 'upload' && <button className="primary" onClick={() => setView('upload')}><Plus size={17}/>Add document</button>}</div>

        {view === 'dashboard' && <Dashboard data={data} latestScan={latestScan} activeTreatment={activeTreatment} latestRecist={latestRecist} targetChart={targetChart} lesionChart={lesionChart} setView={setView}/>} 
        {view === 'upload' && <><div className="local-banner"><ShieldCheck size={19}/><span><strong>Private processing:</strong> PDF parsing and image OCR run in your browser. Nothing is sent to a server by this app.</span></div><UploadPanel onDraft={setDraft} onWorkbook={importWorkbook}/><div className="workflow"><div><span>1</span><strong>Extract</strong><p>Dates, findings, measurements, treatment, and response.</p></div><ChevronRight/><div><span>2</span><strong>Verify</strong><p>Edit every field against the original source.</p></div><ChevronRight/><div><span>3</span><strong>Merge</strong><p>Stable IDs update matching records without duplicates.</p></div></div></>}
        {view === 'timeline' && <TableView rows={data.timeline} columns={timelineColumns} onCsv={() => exportCsv(data.timeline as unknown as Record<string, unknown>[], 'master_timeline')}/>} 
        {view === 'treatments' && <TableView rows={data.treatments} columns={treatmentColumns} onCsv={() => exportCsv(data.treatments as unknown as Record<string, unknown>[], 'treatment_timeline')}/>} 
        {view === 'lesions' && <><div className="inline-chart"><div><span className="eyebrow">DOMINANT TARGET TREND</span><h3>Bladder dome / mesenteric mass</h3></div><ResponsiveContainer width="100%" height={190}><AreaChart data={lesionChart}><defs><linearGradient id="lesionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c16a45" stopOpacity={.28}/><stop offset="1" stopColor="#c16a45" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ddd5b3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis unit=" mm" tickLine={false} axisLine={false}/><Tooltip/><Area type="monotone" dataKey="mm" stroke="#ad5b3b" strokeWidth={2.5} fill="url(#lesionFill)"/></AreaChart></ResponsiveContainer></div><TableView rows={measurementRows} columns={lesionColumns} onCsv={() => exportCsv(measurementRows as unknown as Record<string, unknown>[], 'lesion_measurements')}/></>}
        {view === 'recist' && <><div className="recist-summary"><div className="recist-chart"><span className="eyebrow">CURRENT TRIAL</span><h3>Target lesion sum</h3><ResponsiveContainer width="100%" height={220}><LineChart data={targetChart}><CartesianGrid stroke="#ddd5b3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis domain={['dataMin - 5','dataMax + 5']} unit=" mm" tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="baseline" stroke="#aaa47f" strokeDasharray="5 5" dot={false}/><Line type="monotone" dataKey="sum" stroke="#4f7158" strokeWidth={3} dot={{ fill: '#4f7158', r: 4 }}/></LineChart></ResponsiveContainer></div><div className="response-card"><Badge>{latestRecist?.overallResponse || '—'}</Badge><strong>{latestRecist?.changePct ?? '—'}%</strong><span>from trial baseline</span><p>Target sum {latestRecist?.sumMm ?? '—'} mm • No new lesions reported</p></div></div><TableView rows={data.recist} columns={recistColumns} onCsv={() => exportCsv(data.recist as unknown as Record<string, unknown>[], 'recist_response')}/></>}
        {view === 'biomarkers' && <TableView rows={data.biomarkers} columns={biomarkerColumns} onCsv={() => exportCsv(data.biomarkers as unknown as Record<string, unknown>[], 'biomarkers')}/>} 
        {view === 'notes' && <><div className="section-actions"><button className="primary" onClick={() => setNoteOpen(true)}><Plus size={17}/>Add lab, symptom, or note</button></div><DataTable rows={data.notes} columns={noteColumns} empty="No day-to-day entries yet. Add a lab, symptom, or note when you’re ready."/></>}
        {view === 'documents' && <><div className="audit-cards"><div><FileText/><strong>{data.documents.length}</strong><span>source documents</span></div><div><CheckCircle2/><strong>{data.documents.filter((d) => d.status === 'reviewed').length}</strong><span>reviewed</span></div><div><Database/><strong>{data.timeline.length + data.measurements.length + data.recist.length}</strong><span>linked records</span></div></div><TableView rows={data.documents} columns={documentColumns} onCsv={() => exportCsv(data.documents as unknown as Record<string, unknown>[], 'source_documents')}/><button className="reset-link" onClick={() => setResetOpen(true)}><RefreshCcw size={14}/>{patient?.seeded ? 'Reset to bundled dataset' : 'Clear patient tracker'}</button></>}

        <footer><AlertCircle size={15}/><span>This private tracker is for personal organization only. It does not provide medical advice, diagnosis, RECIST adjudication, or treatment recommendations. Confirm all information with the treating clinical team.</span></footer>
      </div>
    </main>
    {draft && <ReviewModal draft={draft} onClose={() => setDraft(null)} onSave={saveDraft}/>} 
    {noteOpen && <NoteModal documents={data.documents} onClose={() => setNoteOpen(false)} onSave={addNote}/>} 
    {patientOpen && <PatientModal onClose={() => setPatientOpen(false)} onSave={addPatient}/>} 
    {patientDeleteOpen && patient && <DeletePatientModal name={patient.name} onClose={() => setPatientDeleteOpen(false)} onDelete={removePatient}/>} 
    {resetOpen && patient && <ResetTrackerModal name={patient.name} seeded={Boolean(patient.seeded)} onClose={() => setResetOpen(false)} onReset={resetTracker}/>} 
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
  </div>
}

function PatientModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  return <div className="modal-backdrop"><div className="modal small patient-modal"><div className="modal-head"><div><span className="eyebrow">NEW PATIENT</span><h2>Create a separate tracker</h2><p>This starts an empty local record. Patient data stays separate in this browser.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div><div className="form-grid"><label className="form-field wide"><span>Patient name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) onSave(name) }} placeholder="Name or preferred label"/></label></div><div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!name.trim()} onClick={() => onSave(name)}><UserPlus size={17}/>Create tracker</button></div></div></div>
}

function DeletePatientModal({ name, onClose, onDelete }: { name: string; onClose: () => void; onDelete: () => void }) {
  return <div className="modal-backdrop"><div className="modal small patient-modal"><div className="modal-head"><div><span className="eyebrow">DELETE LOCAL RECORD</span><h2>Remove {name}?</h2><p>This permanently deletes this patient’s tracker data from this browser. It does not affect any source documents outside the app.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div><div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="delete-confirm" onClick={onDelete}><Trash2 size={17}/>Delete patient</button></div></div></div>
}

function ResetTrackerModal({ name, seeded, onClose, onReset }: { name: string; seeded: boolean; onClose: () => void; onReset: () => void }) {
  return <div className="modal-backdrop"><div className="modal small patient-modal"><div className="modal-head"><div><span className="eyebrow">RESET LOCAL DATA</span><h2>{seeded ? `Restore ${name}?` : `Clear ${name}’s tracker?`}</h2><p>{seeded ? 'This discards local edits and restores the bundled June 2026 dataset.' : 'This removes all locally saved tracker records and uploaded source files for this patient.'}</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button></div><div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="delete-confirm" onClick={onReset}><RefreshCcw size={17}/>{seeded ? 'Restore bundled data' : 'Clear tracker'}</button></div></div></div>
}

function TableView<T extends { id: string }>({ rows, columns, onCsv }: { rows: T[]; columns: Column<T>[]; onCsv: () => void }) { return <><div className="section-actions"><button className="secondary compact" onClick={onCsv}><Download size={15}/>Export CSV</button></div><DataTable rows={rows} columns={columns}/></> }

function Dashboard({ data, latestScan, activeTreatment, latestRecist, targetChart, lesionChart, setView }: { data: TrackerData; latestScan?: TimelineEvent; activeTreatment?: Treatment; latestRecist?: RecistAssessment; targetChart: unknown[]; lesionChart: unknown[]; setView: (view: View) => void }) {
  const keyWindows = [...data.timeline]
    .filter((event) => /stable|response|shrink|progress/i.test(event.status))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)
  return <>
    <div className="hero-card"><div><span className="hero-kicker"><span className="pulse-dot"/>CURRENT TREATMENT</span><h2>{activeTreatment?.regimen || 'No active treatment entered'}</h2><p>{activeTreatment ? `${activeTreatment.center} • Started ${formatDate(activeTreatment.startDate)}` : 'Add a treatment period or import an existing workbook.'}</p></div><div className="hero-response"><span>Latest response</span><Badge>{latestRecist?.overallResponse || 'Not entered'}</Badge><small>{latestRecist ? formatDate(latestRecist.date) : 'No assessment yet'}</small></div></div>
    <div className="stat-grid">
      <div className="stat-card"><div className="stat-icon teal"><ScanLine/></div><span>Latest scan</span><strong>{latestScan ? formatDate(latestScan.date) : '—'}</strong><p>{latestScan?.status}</p></div>
      <div className="stat-card"><div className="stat-icon rust"><Activity/></div><span>Target lesion sum</span><strong>{latestRecist?.sumMm ?? '—'} <small>mm</small></strong><p>{latestRecist?.changePct ?? '—'}% from baseline</p></div>
      <div className="stat-card"><div className="stat-icon blue"><FileClock/></div><span>Tracked history</span><strong>{data.timeline.length} <small>events</small></strong><p>{data.treatments.length} treatment periods</p></div>
      <div className="stat-card"><div className="stat-icon amber"><Dna/></div><span>Molecular profile</span><strong>{data.biomarkers.length} <small>results</small></strong><p>{data.biomarkers.length ? `Latest ${formatDate([...data.biomarkers].sort((a,b) => b.reportDate.localeCompare(a.reportDate))[0]?.reportDate || '')}` : 'No reports yet'}</p></div>
    </div>
    <div className="dashboard-grid">
      <section className="chart-card"><div className="card-head"><div><span className="eyebrow">RECIST TREND</span><h3>Target lesion sum over time</h3></div><button onClick={() => setView('recist')}>View tracker <ChevronRight size={15}/></button></div><ResponsiveContainer width="100%" height={240}><LineChart data={targetChart}><CartesianGrid stroke="#ddd5b3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis unit=" mm" tickLine={false} axisLine={false}/><Tooltip/><Line type="monotone" dataKey="sum" stroke="#4f7158" strokeWidth={3} dot={{ fill: '#4f7158', r: 4 }}/></LineChart></ResponsiveContainer></section>
      <section className="latest-card">{latestScan ? <><div className="card-head"><div><span className="eyebrow">LATEST IMAGING</span><h3>{latestScan.documentType}</h3></div><Badge>{latestScan.status || '—'}</Badge></div><time>{formatDate(latestScan.date)} • {latestScan.facility}</time><p>{latestScan.findings}</p><div className="measurement-callout"><ScanLine size={17}/><span>{latestScan.keyMeasurements || 'No measurements entered.'}</span></div><button onClick={() => setView('timeline')}>Open timeline <ChevronRight size={15}/></button></> : <div className="empty-imaging"><span className="eyebrow">LATEST IMAGING</span><ScanLine size={28}/><h3>No imaging report yet</h3><p>Upload a scan report to start tracking measurable disease and response.</p><button onClick={() => setView('upload')}>Add a document <ChevronRight size={15}/></button></div>}</section>
    </div>
    <div className="dashboard-grid lower">
      <section className="windows-card"><div className="card-head"><div><span className="eyebrow">KEY WINDOWS</span><h3>Response and progression</h3></div></div>
        <div className="window-list">{keyWindows.length ? keyWindows.map((event) => <div key={event.id}><span className={`window-line ${/progress/i.test(event.status) ? 'red' : /stable/i.test(event.status) ? 'teal' : 'green'}`}/><time>{formatDate(event.date)}</time><p><strong>{event.status}</strong>{event.findings}</p></div>) : <div className="empty-window"><span className="window-line teal"/><time>GET STARTED</time><p><strong>No response windows yet</strong>Add a scan or import a workbook to begin the timeline.</p></div>}</div>
      </section>
      <section className="mini-chart-card"><div className="card-head"><div><span className="eyebrow">DOMINANT LESION</span><h3>Bladder dome lesion</h3></div><button onClick={() => setView('lesions')}>Details <ChevronRight size={15}/></button></div><ResponsiveContainer width="100%" height={215}><AreaChart data={lesionChart}><defs><linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c16a45" stopOpacity={.25}/><stop offset="1" stopColor="#c16a45" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ddd5b3" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false}/><YAxis unit=" mm" tickLine={false} axisLine={false}/><Tooltip/><Area type="monotone" dataKey="mm" stroke="#ad5b3b" strokeWidth={2.5} fill="url(#dashFill)"/></AreaChart></ResponsiveContainer></section>
    </div>
  </>
}

function NoteModal({ documents, onClose, onSave }: { documents: SourceDocument[]; onClose: () => void; onSave: (note: ClinicalNote) => void }) {
  const [note, setNote] = useState<ClinicalNote>({ id: `note-${Date.now()}`, date: new Date().toISOString().slice(0,10), type: 'Note', name: '', value: '', unit: '', detail: '', documentId: '' })
  return <div className="modal-backdrop"><div className="modal small"><div className="modal-head"><div><span className="eyebrow">MANUAL ENTRY</span><h2>Add a structured entry</h2></div><button className="icon-button" onClick={onClose}><X size={20}/></button></div><div className="form-grid">
    <label className="form-field"><span>Date</span><input type="date" value={note.date} onChange={(e) => setNote({...note,date:e.target.value})}/></label>
    <label className="form-field"><span>Type</span><select value={note.type} onChange={(e) => setNote({...note,type:e.target.value as ClinicalNote['type']})}><option>Lab</option><option>Symptom</option><option>Note</option></select></label>
    <label className="form-field"><span>Name</span><input value={note.name} onChange={(e) => setNote({...note,name:e.target.value})} placeholder="e.g. Hemoglobin or fatigue"/></label>
    <label className="form-field"><span>Value</span><input value={note.value} onChange={(e) => setNote({...note,value:e.target.value})}/></label>
    <label className="form-field"><span>Unit</span><input value={note.unit} onChange={(e) => setNote({...note,unit:e.target.value})} placeholder="g/dL, 0–10…"/></label>
    <label className="form-field"><span>Source document</span><select value={note.documentId} onChange={(e) => setNote({...note,documentId:e.target.value})}><option value="">No linked document</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.fileName}</option>)}</select></label>
    <label className="form-field wide"><span>Detail</span><textarea value={note.detail} onChange={(e) => setNote({...note,detail:e.target.value})}/></label>
  </div><div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!note.name} onClick={() => onSave(note)}><Plus size={17}/>Add entry</button></div></div></div>
}

export default App
