import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'
import type { ExtractedDraft, SourceDocument, TimelineEvent, RecistAssessment, Confidence } from '../types'

GlobalWorkerOptions.workerSrc = workerUrl

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const clean = (value = '') => value.replace(/\s+/g, ' ').trim()
const section = (text: string, heading: string, stops: string[]) => {
  const stopPattern = stops.join('|')
  const match = text.match(new RegExp(`${heading}\\s*:?\\s*([\\s\\S]{0,1800}?)(?=\\n\\s*(?:${stopPattern})\\s*:|$)`, 'i'))
  return clean(match?.[1] || '')
}

export async function textFromFile(file: File, onProgress?: (message: string) => void): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    onProgress?.('Reading PDF text…')
    const bytes = await file.arrayBuffer()
    const pdf = await getDocument({ data: bytes }).promise
    let text = ''
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      text += '\n' + content.items.map((item) => 'str' in item ? item.str : '').join(' ')
    }
    return text
  }
  if (file.type.startsWith('image/')) {
    onProgress?.('Running private in-browser OCR…')
    const worker = await createWorker('eng')
    const result = await worker.recognize(file)
    await worker.terminate()
    return result.data.text
  }
  return file.text()
}

function detectDate(text: string, fileName: string) {
  const isoFromName = fileName.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/)
  const assessment = text.match(/(?:Date of assessment|Electronically signed.*?on|Signed by.*?)(?:\s|:)*(\d{1,2})\/(\d{1,2})\/(20\d{2})/i)
  const any = text.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/)
  const match = assessment || any
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
  return isoFromName ? `${isoFromName[1]}-${isoFromName[2]}-${isoFromName[3]}` : new Date().toISOString().slice(0, 10)
}

function detectFacility(text: string) {
  if (/UCLA ONCOLOGY/i.test(text)) return 'UCLA / AstraZeneca Trial'
  if (/CARIS LIFE SCIENCES/i.test(text)) return 'Caris Life Sciences'
  if (/CITY OF HOPE/i.test(text)) return 'City of Hope'
  if (/MISSION HOSPITAL/i.test(text)) return 'Mission Hospital'
  if (/PROVIDENCE|ST\.?s*JUDE/i.test(text)) return 'Providence St Jude'
  return ''
}

function detectType(text: string) {
  if (/CT CHEST|COMPUTED TOMOGRAPHY|RECIST/i.test(text)) return 'CT Chest/Abdomen/Pelvis'
  if (/MOLECULAR|BIOMARKER|GENOMIC|CARIS/i.test(text)) return 'Molecular profile'
  if (/PATHOLOGY|SPECIMEN/i.test(text)) return 'Pathology'
  if (/LAB RESULTS|HEMOGLOBIN|CBC/i.test(text)) return 'Labs'
  return 'Oncology note'
}

function detectTreatment(text: string) {
  return ['AZD4360', 'TORL-2-307', 'EO-3021', 'FOLFIRI + nivolumab', 'paclitaxel + ramucirumab', 'FOLFOX + bevacizumab']
    .find((term) => text.toLowerCase().includes(term.toLowerCase())) || ''
}

function response(text: string) {
  const explicit = text.match(/OVERALL (?:RADIOLOGIC )?RESPONSE\s*=\s*([^\n.]+)/i)?.[1]
  if (explicit) return clean(explicit)
  if (/overall progression|progressive disease/i.test(text)) return 'Progression'
  if (/stable disease/i.test(text)) return 'Stable Disease'
  if (/partial response/i.test(text)) return 'Partial Response'
  return 'Not stated'
}

export function extractDraft(rawText: string, fileName = 'Pasted text'): ExtractedDraft {
  const text = rawText.replace(/\r/g, '')
  const date = detectDate(text, fileName)
  const facility = detectFacility(text)
  const documentType = detectType(text)
  const treatment = detectTreatment(text)
  const impression = section(text, 'IMPRESSION', ['RECIST', 'Electronically signed', 'Signed by', 'ASSESSMENT', 'PLAN']) || clean(text.slice(0, 600))
  const measurementsText = section(text, 'TARGET LESIONS?', ['SUM OF DIAMETERS', 'NON-TARGET DISEASE', 'NEW LESIONS', 'IMPRESSION'])
  const status = response(text)
  const sumMatch = text.match(/SUM OF DIAMETERS[\s\S]{0,300}?(\d{1,2}\/\d{1,2}\/20\d{2})?\s*=\s*(\d+(?:\.\d+)?)\s*(?:\((-?\d+(?:\.\d+)?)%\))?/i)
  const baselineMatch = text.match(/(\d+(?:\.\d+)?)\s*\(BASELINE\)/i)
  const target = clean(text.match(/Target Response\s*:\s*([^\n.]+)/i)?.[1] || '')
  const nonTarget = clean(text.match(/Non-Target Response\s*:\s*([^\n.]+)/i)?.[1] || section(text, 'NON-TARGET DISEASE', ['NEW LESIONS', 'ADDITIONAL FINDINGS', 'IMPRESSION']).slice(0, 180))
  const newLesions = clean(text.match(/NEW LESIONS\s*:\s*([^\n.]+)/i)?.[1] || 'Not stated')
  const confidence: Confidence = [date, facility, documentType, impression, status].filter(Boolean).length >= 5 ? 'high' : 'medium'
  const documentId = uid('doc')
  const document: SourceDocument = { id: documentId, fileName, documentType, documentDate: date, facility, confidence, importedAt: new Date().toISOString(), status: 'pending' }
  const event: TimelineEvent = {
    id: `event-${date}-${documentId.slice(-5)}`, date, facility, documentType, diseasePhase: treatment ? `On ${treatment}` : '',
    findings: impression, keyMeasurements: measurementsText, status, treatment, lineTrial: '', notes: 'Extracted draft — verify against source before saving.', documentId, confidence,
  }
  const recist: RecistAssessment | undefined = /RECIST|SUM OF DIAMETERS|Target Response/i.test(text) ? {
    id: `recist-${date}-${documentId.slice(-5)}`, date, trial: treatment, sumMm: sumMatch ? Number(sumMatch[2]) : null,
    baselineMm: baselineMatch ? Number(baselineMatch[1]) : null, changePct: sumMatch?.[3] ? Number(sumMatch[3]) : null,
    targetResponse: target || status, nonTargetResponse: nonTarget || 'Not stated', newLesions, overallResponse: status, documentId, confidence,
  } : undefined

  const measurements: ExtractedDraft['measurements'] = []
  const lesionPatterns = [
    ['lung', /(?:Right middle lobe|pulmonary) nodule[\s\S]{0,180}?(\d+)\s*x\s*(\d+)\s*mm/i],
    ['bladder-dome', /(?:Peritoneal lesion along bladder dome|Bladder Dome\/mesenteric)[\s\S]{0,180}?(\d+)\s*x\s*(\d+)\s*mm/i],
  ] as const
  lesionPatterns.forEach(([lesionId, pattern]) => {
    const match = text.match(pattern)
    if (match) measurements.push({ lesionId, date, longMm: Number(match[1]), shortMm: Number(match[2]), treatment, trend: status, notes: 'Extracted from target lesion section.' })
  })
  return { document, event, recist, measurements, rawText }
}
