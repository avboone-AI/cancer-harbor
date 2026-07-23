import * as XLSX from 'xlsx'
import type { TrackerData } from '../types'

const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const rowsWithSource = <T extends { documentId: string }>(rows: T[], data: TrackerData) => rows.map((row) => ({
  ...row,
  sourceFile: data.documents.find((doc) => doc.id === row.documentId)?.fileName || '',
}))

export function exportExcel(data: TrackerData, patientName = 'Patient') {
  const wb = XLSX.utils.book_new()
  const add = (name: string, rows: unknown[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name)
  add('Master Timeline', rowsWithSource(data.timeline, data))
  add('Treatment Timeline', rowsWithSource(data.treatments, data))
  add('Lesion Measurements', rowsWithSource(data.measurements, data).map((row) => ({ ...row, lesion: data.lesions.find((l) => l.id === row.lesionId)?.name || row.lesionId })))
  add('RECIST Tracker', rowsWithSource(data.recist, data))
  add('Biomarkers', rowsWithSource(data.biomarkers, data))
  add('Labs Symptoms Notes', rowsWithSource(data.notes, data))
  add('Source Documents', data.documents)
  const safeName = patientName.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'Patient'
  XLSX.writeFile(wb, `${safeName}_Health_Tracker_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportCsv(rows: Record<string, unknown>[], name: string) {
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows))
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${name}.csv`)
}
