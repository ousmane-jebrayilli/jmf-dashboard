'use client'

import { useState } from 'react'
import { Reminder } from '@/types'
import { completeReminder, snoozeReminder } from '@/app/actions/reminders'
import { isOverdue, isDueSoon, formatDueDate } from '@/lib/reminders'

interface Props {
  reminder: Reminder
}

export default function ReminderCard({ reminder }: Props) {
  const [status, setStatus] = useState(reminder.status)
  const [saving, setSaving] = useState(false)

  const overdue = isOverdue(reminder.due_date)
  const dueSoon = isDueSoon(reminder.due_date)

  async function handleComplete() {
    setSaving(true)
    await completeReminder(reminder.id, reminder.member_id, reminder.due_date, reminder.interval_months)
    setStatus('completed')
    setSaving(false)
  }

  async function handleSnooze() {
    setSaving(true)
    await snoozeReminder(reminder.id, reminder.member_id)
    setStatus('snoozed')
    setSaving(false)
  }

  const borderColor =
    status === 'completed'
      ? 'border-green-200 bg-green-50'
      : overdue
      ? 'border-red-200 bg-red-50'
      : dueSoon
      ? 'border-amber-200 bg-amber-50'
      : 'border-gray-200 bg-white'

  return (
    <div className={`rounded-md border p-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {status === 'completed' && (
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                Completed
              </span>
            )}
            {status === 'snoozed' && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                Snoozed
              </span>
            )}
            {status === 'pending' && overdue && (
              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">
                Overdue
              </span>
            )}
            {status === 'pending' && !overdue && dueSoon && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Due soon
              </span>
            )}
            <span className="text-xs text-gray-400 capitalize">
              {reminder.reminder_type.replace('_', ' ')}
            </span>
          </div>

          <p className="font-medium text-sm text-gray-900">{reminder.title}</p>
          {reminder.description && (
            <p className="mt-0.5 text-xs text-gray-500">{reminder.description}</p>
          )}
          <p className="mt-1.5 text-xs text-gray-400">Due: {formatDueDate(reminder.due_date)}</p>
        </div>

        {status === 'pending' && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={handleComplete}
              disabled={saving}
              className="text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Done
            </button>
            <button
              onClick={handleSnooze}
              disabled={saving}
              className="text-xs px-3 py-1 rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Snooze
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
