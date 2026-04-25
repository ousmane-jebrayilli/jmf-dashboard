'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createLabResult } from '@/app/actions/labs'
import { TestCategory } from '@/types'

const CATEGORIES: TestCategory[] = [
  'CBC', 'Lipids', 'Kidney', 'Liver', 'Diabetes',
  'Thyroid', 'Vitamins', 'Hormones', 'Inflammation', 'Other',
]

interface Document {
  id: string
  title: string
  document_date: string | null
}

interface Props {
  memberId: string
  documents: Document[]
}

export default function LabEntryForm({ memberId, documents }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const formData = new FormData(e.currentTarget)
      formData.set('member_id', memberId)
      await createLabResult(formData)
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save lab result')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Test name *</label>
          <input name="test_name" required className="input" placeholder="e.g. Hemoglobin" />
        </div>

        <div className="col-span-2">
          <label className="label">Category *</label>
          <select name="test_category" required className="select">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Result value *</label>
          <input name="result_value" type="number" step="any" required className="input" placeholder="0.00" />
        </div>

        <div>
          <label className="label">Unit *</label>
          <input name="unit" required className="input" placeholder="g/dL" />
        </div>

        <div>
          <label className="label">Reference low</label>
          <input name="reference_low" type="number" step="any" className="input" placeholder="—" />
        </div>

        <div>
          <label className="label">Reference high</label>
          <input name="reference_high" type="number" step="any" className="input" placeholder="—" />
        </div>

        <div className="col-span-2">
          <label className="label">Result date *</label>
          <input name="result_date" type="date" required className="input" />
        </div>

        {documents.length > 0 && (
          <div className="col-span-2">
            <label className="label">Link to document (optional)</label>
            <select name="document_id" className="select">
              <option value="">— none —</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title}{d.document_date ? ` (${d.document_date})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" placeholder="Optional context…" />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Lab result saved.
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
        {saving ? 'Saving…' : 'Save result'}
      </button>

      <p className="text-xs text-gray-400 leading-snug">
        Values outside reference range will be flagged for follow-up discussion with a healthcare professional.
      </p>
    </form>
  )
}
