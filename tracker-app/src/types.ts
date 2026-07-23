export type Confidence = 'high' | 'medium' | 'low' | 'manual'

export interface SourceDocument {
  id: string
  fileName: string
  documentType: string
  documentDate: string
  facility: string
  sourceUrl?: string
  hasStoredFile?: boolean
  confidence: Confidence
  importedAt: string
  status: 'reviewed' | 'pending'
}

export interface TimelineEvent {
  id: string
  date: string
  facility: string
  documentType: string
  diseasePhase: string
  findings: string
  keyMeasurements: string
  status: string
  treatment: string
  lineTrial: string
  notes: string
  documentId: string
  confidence: Confidence
}

export interface Treatment {
  id: string
  startDate: string
  endDate: string
  category: string
  regimen: string
  center: string
  context: string
  documentId: string
}

export interface Lesion {
  id: string
  name: string
  organ: string
  target: boolean
}

export interface LesionMeasurement {
  id: string
  lesionId: string
  date: string
  longMm: number | null
  shortMm: number | null
  treatment: string
  trend: string
  notes: string
  documentId: string
}

export interface RecistAssessment {
  id: string
  date: string
  trial: string
  sumMm: number | null
  baselineMm: number | null
  changePct: number | null
  targetResponse: string
  nonTargetResponse: string
  newLesions: string
  overallResponse: string
  documentId: string
  confidence: Confidence
}

export interface Biomarker {
  id: string
  reportDate: string
  marker: string
  method: string
  result: string
  interpretation: string
  documentId: string
}

export interface ClinicalNote {
  id: string
  date: string
  type: 'Lab' | 'Symptom' | 'Note'
  name: string
  value: string
  unit: string
  detail: string
  documentId: string
}

export interface TrackerData {
  version: number
  documents: SourceDocument[]
  timeline: TimelineEvent[]
  treatments: Treatment[]
  lesions: Lesion[]
  measurements: LesionMeasurement[]
  recist: RecistAssessment[]
  biomarkers: Biomarker[]
  notes: ClinicalNote[]
}

export interface ExtractedDraft {
  document: SourceDocument
  event: TimelineEvent
  recist?: RecistAssessment
  measurements: Array<Omit<LesionMeasurement, 'id' | 'documentId'>>
  rawText: string
}
