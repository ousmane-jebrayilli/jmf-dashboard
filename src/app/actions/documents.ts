'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { DocumentType } from '@/types'

interface SaveDocumentParams {
  memberId: string
  uploadedBy: string
  documentType: DocumentType
  title: string
  filePath: string
  documentDate: string | null
  summary: string | null
}

export async function saveDocument(params: SaveDocumentParams) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: doc, error } = await supabase
    .from('health_documents')
    .insert({
      member_id: params.memberId,
      uploaded_by: params.uploadedBy,
      document_type: params.documentType,
      title: params.title,
      file_path: params.filePath,
      document_date: params.documentDate,
      summary: params.summary,
    })
    .select()
    .single()

  if (error) throw error

  await logAudit(supabase, {
    action: 'upload',
    entity_type: 'health_document',
    entity_id: doc.id,
    details: { title: params.title, document_type: params.documentType },
  })

  revalidatePath(`/dashboard/members/${params.memberId}/documents`)
  revalidatePath(`/dashboard/members/${params.memberId}`)
  revalidatePath('/dashboard/admin')
}

export async function deleteDocument(docId: string, memberId: string, filePath: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await supabase.storage.from('health-documents').remove([filePath])

  const { error } = await supabase.from('health_documents').delete().eq('id', docId)
  if (error) throw error

  await logAudit(supabase, {
    action: 'delete',
    entity_type: 'health_document',
    entity_id: docId,
    details: { file_path: filePath },
  })

  revalidatePath(`/dashboard/members/${memberId}/documents`)
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('health-documents')
    .createSignedUrl(filePath, 3600)
  if (error) throw error
  return data.signedUrl
}
