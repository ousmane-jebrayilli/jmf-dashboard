import { SupabaseClient } from '@supabase/supabase-js'

interface AuditParams {
  action: string
  entity_type: string
  entity_id?: string
  details?: Record<string, unknown>
}

export async function logAudit(supabase: SupabaseClient, params: AuditParams) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    details: params.details ?? null,
  })
}
