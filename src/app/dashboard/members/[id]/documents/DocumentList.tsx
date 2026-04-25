'use client'

import { useState } from 'react'
import { HealthDocument } from '@/types'
import { deleteDocument, getSignedUrl } from '@/app/actions/documents'

interface Props {
  documents: HealthDocument[]
  memberId: string
}

export default function DocumentList({ documents: initialDocs, memberId }: Props) {
  const [docs, setDocs] = useState(initialDocs)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleView(doc: HealthDocument) {
    setLoadingId(doc.id)
    try {
      const url = await getSignedUrl(doc.file_path)
      window.open(url, '_blank', 'noopener noreferrer')
    } catch {
      alert('Could not generate document link. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleDelete(doc: HealthDocument) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    setLoadingId(doc.id)
    try {
      await deleteDocument(doc.id, memberId, doc.file_path)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch {
      alert('Delete failed. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  if (docs.length === 0) {
    return <p className="text-sm text-gray-500">No documents uploaded yet.</p>
  }

  return (
    <div className="space-y-3">
      {docs.map(doc => (
        <div key={doc.id} className="border border-gray-200 rounded-md px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 capitalize">
                  {doc.document_type.replace('_', ' ')}
                </span>
                {doc.document_date && (
                  <span className="text-xs text-gray-400">
                    {new Date(doc.document_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </span>
                )}
              </div>
              {doc.summary && (
                <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{doc.summary}</p>
              )}
              <p className="mt-1 text-xs text-gray-300">
                Uploaded {new Date(doc.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => handleView(doc)}
                disabled={loadingId === doc.id}
                className="text-xs px-2.5 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors disabled:opacity-50"
              >
                {loadingId === doc.id ? '…' : 'View'}
              </button>
              <button
                onClick={() => handleDelete(doc)}
                disabled={loadingId === doc.id}
                className="text-xs px-2.5 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
