import { useRef, useState } from 'react'
import { FileSpreadsheet, FileText, Image, LoaderCircle, Sparkles, UploadCloud } from 'lucide-react'
import { extractDraft, textFromFile } from '../lib/extract'
import { storeDocumentFile } from '../lib/documentStore'
import type { ExtractedDraft } from '../types'

export default function UploadPanel({ onDraft, onWorkbook }: { onDraft: (draft: ExtractedDraft) => void; onWorkbook: (file: File) => void }) {
  const [text, setText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const process = async (file: File) => {
    if (/\.xlsx?$/i.test(file.name)) { onWorkbook(file); return }
    try {
      setProgress('Preparing document…')
      const raw = await textFromFile(file, setProgress)
      const draft = extractDraft(raw, file.name)
      await storeDocumentFile(draft.document.id, file)
      draft.document.hasStoredFile = true
      onDraft(draft)
    } catch (error) {
      setProgress(`Could not extract this file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return
    }
    setProgress('')
  }

  return <div className="upload-grid">
    <section className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) process(file) }}>
      <div className="upload-mark"><UploadCloud size={28}/></div>
      <h3>Drop a new medical document</h3>
      <p>PDFs are read locally. Images use private in-browser OCR. Excel files merge by stable IDs.</p>
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.xlsx,.xls" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) process(file); e.currentTarget.value = '' }}/>
      <button className="primary" onClick={() => input.current?.click()}><UploadCloud size={16}/>Choose document</button>
      <div className="file-kinds"><span><FileText size={15}/> PDF / text</span><span><Image size={15}/> Image</span><span><FileSpreadsheet size={15}/> Excel</span></div>
      {progress && <div className="progress"><LoaderCircle className={progress.startsWith('Could') ? '' : 'spin'} size={16}/>{progress}</div>}
    </section>
    <section className="paste-card">
      <div><span className="eyebrow">PASTE REPORT TEXT</span><h3>Extract a structured draft</h3></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a CT impression, pathology report, lab result, or oncology note…"/>
      <button className="secondary" disabled={!text.trim()} onClick={() => onDraft(extractDraft(text))}><Sparkles size={16}/>Review extracted data</button>
    </section>
  </div>
}
