'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveDocument } from '@/app/actions/documents'
import { DocumentType } from '@/types'

interface Props {
  memberId: string
  onSuccess?: () => void
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'bloodwork', label: 'Bloodwork' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'specialist_report', label: 'Specialist Report' },
  { value: 'surgery_report', label: 'Surgery Report' },
  { value: 'vaccination', label: 'Vaccination Record' },
  { value: 'other', label: 'Other' },
]

export default function DocumentUpload({ memberId, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<DocumentType>('bloodwork')
  const [title, setTitle] = useState('')
  const [docDate, setDocDate] = useState('')
  const [summary, setSummary] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ext = file.name.split('.').pop()
      const filePath = `${memberId}/${crypto.randomUUID()}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('health-documents')
        .upload(filePath, file, { upsert: false })

      if (storageError) throw storageError

      await saveDocument({
        memberId,
        uploadedBy: user.id,
        documentType: docType,
        title: title || file.name,
        filePath,
        documentDate: docDate || null,
        summary: summary || null,
      })

      setSuccess(true)
      setFile(null)
      setTitle('')
      setDocDate('')
      setSummary('')
      if (fileRef.current) fileRef.current.value = ''
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">File *</label>
        <input
          ref={fileRef}
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.heic,.doc,.docx"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Document type *</label>
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as DocumentType)}
            className="select"
          >
            {DOCUMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Document date</label>
          <input
            type="date"
            value={docDate}
            onChange={e => setDocDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={file?.name ?? 'e.g. CBC Panel — March 2025'}
          className="input"
        />
      </div>

      <div>
        <label className="label">Summary / notes (optional)</label>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          rows={3}
          className="input"
          placeholder="Brief description or key findings…"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
          Document uploaded successfully.
        </p>
      )}

      <button type="submit" disabled={uploading || !file} className="btn-primary">
        {uploading ? 'Uploading…' : 'Upload document'}
      </button>
    </form>
  )
}
