'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createReminder } from '@/app/actions/reminders'
import { REMINDER_DEFAULTS } from '@/lib/reminders'
import { ReminderType } from '@/types'

const REMINDER_TYPES: { value: ReminderType; label: string }[] = [
  { value: 'annual_physical', label: 'Annual Physical' },
  { value: 'bloodwork', label: 'Bloodwork' },
  { value: 'dental', label: 'Dental Cleaning' },
  { value: 'eye_exam', label: 'Eye Exam' },
  { value: 'medication_review', label: 'Medication Review' },
  { value: 'specialist_followup', label: 'Specialist Follow-Up' },
  { value: 'custom', label: 'Custom' },
]

interface Props {
  memberId: string
}

export default function ReminderForm({ memberId }: Props) {
  const router = useRouter()
  const [type, setType] = useState<ReminderType>('bloodwork')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const defaults = REMINDER_DEFAULTS[type]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const formData = new FormData(e.currentTarget)
      formData.set('member_id', memberId)
      await createReminder(formData)
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
      setType('bloodwork')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">Type *</label>
        <select
          name="reminder_type"
          value={type}
          onChange={e => setType(e.target.value as ReminderType)}
          className="select"
        >
          {REMINDER_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Title *</label>
        <input
          name="title"
          required
          defaultValue={defaults.title}
          key={type}
          className="input"
        />
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={defaults.description}
          key={`desc-${type}`}
          className="input"
        />
      </div>

      <div>
        <label className="label">Due date *</label>
        <input name="due_date" type="date" required className="input" />
      </div>

      <div>
        <label className="label">Repeat every (months)</label>
        <input
          name="interval_months"
          type="number"
          min="1"
          max="60"
          defaultValue={defaults.interval_months}
          key={`interval-${type}`}
          className="input"
          placeholder="Leave blank for one-time"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Reminder created.
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
        {saving ? 'Saving…' : 'Create reminder'}
      </button>
    </form>
  )
}
