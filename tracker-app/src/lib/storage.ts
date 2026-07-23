import seed from '../data/seed.json'
import type { TrackerData } from '../types'

export interface PatientProfile {
  id: string
  name: string
  createdAt: string
  seeded?: boolean
}

const PATIENTS_KEY = 'cancer-harbor-patients-v1'
const ACTIVE_PATIENT_KEY = 'cancer-harbor-active-patient-v1'
const DATA_PREFIX = 'cancer-harbor-tracker-v1:'
const DEMO_PATIENT_ID = 'example-patient'

const defaultPatients: PatientProfile[] = [{
  id: DEMO_PATIENT_ID,
  name: 'Example Patient',
  createdAt: '2026-06-29T12:00:00.000Z',
  seeded: true,
}]

export function createEmptyData(): TrackerData {
  const source = seed as TrackerData
  return {
    version: source.version,
    documents: [], timeline: [], treatments: [],
    lesions: structuredClone(source.lesions), measurements: [],
    recist: [], biomarkers: [], notes: [],
  }
}

export function loadPatients(): PatientProfile[] {
  try {
    const saved = localStorage.getItem(PATIENTS_KEY)
    return saved ? JSON.parse(saved) : structuredClone(defaultPatients)
  } catch {
    return structuredClone(defaultPatients)
  }
}

export function savePatients(patients: PatientProfile[]) {
  localStorage.setItem(PATIENTS_KEY, JSON.stringify(patients))
}

export function getActivePatientId() {
  return localStorage.getItem(ACTIVE_PATIENT_KEY) || DEMO_PATIENT_ID
}

export function setActivePatientId(id: string) {
  localStorage.setItem(ACTIVE_PATIENT_KEY, id)
}

export function loadData(patientId: string): TrackerData {
  try {
    const saved = localStorage.getItem(`${DATA_PREFIX}${patientId}`)
    if (saved) return JSON.parse(saved)
    return patientId === DEMO_PATIENT_ID ? structuredClone(seed as TrackerData) : createEmptyData()
  } catch {
    return patientId === DEMO_PATIENT_ID ? structuredClone(seed as TrackerData) : createEmptyData()
  }
}

export function saveData(patientId: string, data: TrackerData) {
  localStorage.setItem(`${DATA_PREFIX}${patientId}`, JSON.stringify(data))
}

export function deletePatientData(patientId: string) {
  localStorage.removeItem(`${DATA_PREFIX}${patientId}`)
}

export function resetData(patientId: string): TrackerData {
  localStorage.removeItem(`${DATA_PREFIX}${patientId}`)
  return patientId === DEMO_PATIENT_ID ? structuredClone(seed as TrackerData) : createEmptyData()
}

export function upsertById<T extends { id: string }>(rows: T[], incoming: T[]): T[] {
  const map = new Map(rows.map((row) => [row.id, row]))
  incoming.forEach((row) => map.set(row.id, { ...map.get(row.id), ...row }))
  return [...map.values()]
}
