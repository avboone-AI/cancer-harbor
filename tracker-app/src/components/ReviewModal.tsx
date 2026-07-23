import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ExtractedDraft } from '../types'

const Field = ({ label, value, onChange, area = false }: { label: string; value: string | number | null; onChange: (value: string) => void; area?: boolean }) => <label className={`form-field ${area ? 'wide' : ''}`}>
  <span>{label}</span>{area ? <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)}/> : <input value={value ?? ''} onChange={(e) => onChange(e.target.value)}/>}</label>

export default function ReviewModal({ draft: initial, onClose, onSave }: { draft: ExtractedDraft; onClose: () => void; onSave: (draft: ExtractedDraft) => void }) {
  const [draft, setDraft] = useState(initial)
  const event = draft.event
  const setEvent = (key: keyof typeof event, value: string) => setDraft({ ...draft, event: { ...event, [key]: value }, document: ['date','facility','documentType'].includes(key) ? { ...draft.document, ...(key === 'date' ? { documentDate: value } : { [key]: value }) } : draft.document })
  const setRecist = (key: string, value: string) => draft.recist && setDraft({ ...draft, recist: { ...draft.recist, [key]: ['sumMm','baselineMm','changePct'].includes(key) ? (value === '' ? null : Number(value)) : value } })
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="modal">
      <div className="modal-head"><div><span className="eyebrow">VERIFY BEFORE SAVING</span><h2>Review extracted data</h2><p>The source remains linked. Correct anything the extractor misunderstood.</p></div><button className="icon-button" onClick={onClose}><X size={20}/></button></div>
      <div className="confidence-row"><span className={`confidence ${draft.document.confidence}`}>{draft.document.confidence} confidence</span><span>{draft.document.fileName}</span></div>
      <div className="form-grid">
        <Field label="Date" value={event.date} onChange={(v) => setEvent('date', v)}/><Field label="Facility" value={event.facility} onChange={(v) => setEvent('facility', v)}/>
        <Field label="Document type" value={event.documentType} onChange={(v) => setEvent('documentType', v)}/><Field label="Treatment active" value={event.treatment} onChange={(v) => setEvent('treatment', v)}/>
        <Field label="Disease / RECIST status" value={event.status} onChange={(v) => setEvent('status', v)}/><Field label="Line / trial" value={event.lineTrial} onChange={(v) => setEvent('lineTrial', v)}/>
        <Field area label="Impression / dominant findings" value={event.findings} onChange={(v) => setEvent('findings', v)}/>
        <Field area label="Key measurements" value={event.keyMeasurements} onChange={(v) => setEvent('keyMeasurements', v)}/>
      </div>
      {draft.recist && <div className="recist-review"><h3>RECIST assessment</h3><div className="form-grid">
        <Field label="Target lesion sum (mm)" value={draft.recist.sumMm} onChange={(v) => setRecist('sumMm', v)}/><Field label="Change from baseline (%)" value={draft.recist.changePct} onChange={(v) => setRecist('changePct', v)}/>
        <Field label="Target response" value={draft.recist.targetResponse} onChange={(v) => setRecist('targetResponse', v)}/><Field label="New lesions" value={draft.recist.newLesions} onChange={(v) => setRecist('newLesions', v)}/>
      </div></div>}
      {draft.measurements.length > 0 && <div className="measurement-review"><h3>Detected target measurements</h3>{draft.measurements.map((m, index) => <div key={`${m.lesionId}-${index}`} className="measurement-line"><strong>{m.lesionId === 'lung' ? 'Right middle lobe nodule' : 'Bladder dome lesion'}</strong><span>{m.longMm} × {m.shortMm} mm</span></div>)}</div>}
      <div className="modal-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={() => onSave({ ...draft, document: { ...draft.document, status: 'reviewed' } })}><Check size={17}/>Save verified record</button></div>
    </div>
  </div>
}
