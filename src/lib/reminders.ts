import { ReminderType } from '@/types'

export const REMINDER_DEFAULTS: Record<
  ReminderType,
  { interval_months: number; title: string; description: string }
> = {
  annual_physical: {
    interval_months: 12,
    title: 'Annual Physical Exam',
    description: 'Yearly comprehensive check-up with primary care physician.',
  },
  bloodwork: {
    interval_months: 6,
    title: 'Routine Bloodwork',
    description: 'Routine lab panel to monitor general health markers.',
  },
  dental: {
    interval_months: 6,
    title: 'Dental Cleaning',
    description: 'Bi-annual professional cleaning and oral health check.',
  },
  eye_exam: {
    interval_months: 12,
    title: 'Eye Exam',
    description: 'Annual vision and eye health examination.',
  },
  medication_review: {
    interval_months: 6,
    title: 'Medication Review',
    description: 'Review current medications with prescribing physician.',
  },
  specialist_followup: {
    interval_months: 3,
    title: 'Specialist Follow-Up',
    description: 'Follow-up appointment with specialist. Discuss this result with your doctor.',
  },
  custom: {
    interval_months: 12,
    title: 'Custom Reminder',
    description: '',
  },
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function nextReminderDate(currentDue: string, intervalMonths: number): string {
  const next = addMonths(new Date(currentDue), intervalMonths)
  return next.toISOString().split('T')[0]
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date()
}

export function isDueSoon(dueDate: string, withinDays = 30): boolean {
  const due = new Date(dueDate)
  const now = new Date()
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= withinDays
}

export function formatDueDate(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
