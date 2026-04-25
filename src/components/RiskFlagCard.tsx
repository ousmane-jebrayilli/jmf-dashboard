'use client'

import { useState } from 'react'
import { RiskFlag } from '@/types'
import { updateFlagStatus } from '@/app/actions/flags'

interface Props {
  flag: RiskFlag
  memberId: string
}

const severityStyles: Record<string, string> = {
  low: 'bg-amber-50 border-amber-200',
  medium: 'bg-orange-50 border-orange-200',
  high: 'bg-red-50 border-red-200',
}

const severityBadge: Record<string, string> = {
  low: 'bg-amber-100 text-amber-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
}

export default function RiskFlagCard({ flag, memberId }: Props) {
  const [status, setStatus] = useState(flag.status)
  const [saving, setSaving] = useState(false)

  async function markAs(newStatus: 'reviewed' | 'dismissed') {
    setSaving(true)
    await updateFlagStatus(flag.id, memberId, newStatus)
    setStatus(newStatus)
    setSaving(false)
  }

  if (status === 'dismissed') return null

  return (
    <div className={`rounded-md border p-4 ${severityStyles[flag.severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${severityBadge[flag.severity]}`}>
              {flag.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500">{flag.category}</span>
            {status === 'reviewed' && (
              <span className="text-xs text-gray-400 font-medium">Reviewed</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900">{flag.message}</p>
          <p className="mt-1 text-sm text-gray-600 italic">{flag.recommendation}</p>
          <p className="mt-1.5 text-xs text-gray-400">
            {new Date(flag.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        </div>

        {status === 'open' && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => markAs('reviewed')}
              disabled={saving}
              className="text-xs px-3 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Reviewed
            </button>
            <button
              onClick={() => markAs('dismissed')}
              disabled={saving}
              className="text-xs px-3 py-1 rounded bg-white border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
