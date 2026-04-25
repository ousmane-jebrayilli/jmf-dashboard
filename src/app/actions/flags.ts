'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { FlagStatus } from '@/types'

export async function updateFlagStatus(flagId: string, memberId: string, status: FlagStatus) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('risk_flags')
    .update({ status })
    .eq('id', flagId)

  if (error) throw error

  await logAudit(supabase, {
    action: status,
    entity_type: 'risk_flag',
    entity_id: flagId,
  })

  revalidatePath(`/dashboard/members/${memberId}`)
  revalidatePath('/dashboard/admin')
}
