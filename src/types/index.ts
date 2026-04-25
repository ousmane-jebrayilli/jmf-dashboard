export type Role = 'admin' | 'member'

export type DocumentType =
  | 'bloodwork'
  | 'imaging'
  | 'prescription'
  | 'specialist_report'
  | 'surgery_report'
  | 'vaccination'
  | 'other'

export type LabStatus = 'low' | 'normal' | 'high' | 'critical' | 'unknown'

export type TestCategory =
  | 'CBC'
  | 'Lipids'
  | 'Kidney'
  | 'Liver'
  | 'Diabetes'
  | 'Thyroid'
  | 'Vitamins'
  | 'Hormones'
  | 'Inflammation'
  | 'Other'

export type ReminderType =
  | 'annual_physical'
  | 'bloodwork'
  | 'dental'
  | 'eye_exam'
  | 'medication_review'
  | 'specialist_followup'
  | 'custom'

export type ReminderStatus = 'pending' | 'completed' | 'snoozed'

export type FlagSeverity = 'low' | 'medium' | 'high'

export type FlagStatus = 'open' | 'reviewed' | 'dismissed'

export interface Profile {
  id: string
  user_id: string
  full_name: string
  role: Role
  member_id: string | null
  created_at: string
}

export interface FamilyMember {
  id: string
  full_name: string
  date_of_birth: string | null
  sex: string | null
  height_cm: number | null
  weight_kg: number | null
  notes: string | null
  created_at: string
}

export interface HealthDocument {
  id: string
  member_id: string
  uploaded_by: string | null
  document_type: DocumentType
  title: string
  file_path: string
  document_date: string | null
  summary: string | null
  created_at: string
}

export interface LabResult {
  id: string
  member_id: string
  document_id: string | null
  test_name: string
  test_category: TestCategory
  result_value: number
  unit: string
  reference_low: number | null
  reference_high: number | null
  result_date: string
  status: LabStatus
  notes: string | null
  created_at: string
}

export interface Reminder {
  id: string
  member_id: string
  title: string
  description: string | null
  reminder_type: ReminderType
  due_date: string
  interval_months: number | null
  status: ReminderStatus
  created_by: string | null
  created_at: string
}

export interface RiskFlag {
  id: string
  member_id: string
  lab_result_id: string | null
  severity: FlagSeverity
  category: string
  message: string
  recommendation: string
  status: FlagStatus
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}
