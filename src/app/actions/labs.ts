'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { computeLabStatus, shouldCreateFlag, buildRiskFlagPayload } from '@/lib/risk-flags'
import { TestCategory } from '@/types'

export async function createLabResult(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const memberId = formData.get('member_id') as string
  const testName = formData.get('test_name') as string
  const testCategory = formData.get('test_category') as TestCategory
  const resultValue = parseFloat(formData.get('result_value') as string)
  const unit = formData.get('unit') as string
  const referenceLow = formData.get('reference_low')
    ? parseFloat(formData.get('reference_low') as string)
    : null
  const referenceHigh = formData.get('reference_high')
    ? parseFloat(formData.get('reference_high') as string)
    : null
  const resultDate = formData.get('result_date') as string
  const notes = (formData.get('notes') as string) || null
  const documentId = (formData.get('document_id') as string) || null

  const status = computeLabStatus(resultValue, referenceLow, referenceHigh)

  const { data: lab, error } = await supabase
    .from('lab_results')
    .insert({
      member_id: memberId,
      document_id: documentId,
      test_name: testName,
      test_category: testCategory,
      result_value: resultValue,
      unit,
      reference_low: referenceLow,
      reference_high: referenceHigh,
      result_date: resultDate,
      status,
      notes,
    })
    .select()
    .single()

  if (error) throw error

  if (shouldCreateFlag(status)) {
    await supabase.from('risk_flags').insert(buildRiskFlagPayload(lab))
  }

  await logAudit(supabase, {
    action: 'create',
    entity_type: 'lab_result',
    entity_id: lab.id,
    details: { test_name: testName, result_value: resultValue, status },
  })

  revalidatePath(`/dashboard/members/${memberId}/labs`)
  revalidatePath(`/dashboard/members/${memberId}`)
  revalidatePath('/dashboard/admin')
}
