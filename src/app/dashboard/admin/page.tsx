import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminOverview from '@/components/AdminOverview'
import HealthDisclaimerBanner from '@/components/HealthDisclaimerBanner'
import { isDueSoon, isOverdue } from '@/lib/reminders'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const [
    { data: members },
    { data: openFlags },
    { data: pendingReminders },
    { data: recentDocuments },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from('family_members').select('*').order('full_name'),
    supabase
      .from('risk_flags')
      .select('*, family_members(full_name)')
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('reminders')
      .select('*, family_members(full_name)')
      .eq('status', 'pending')
      .order('due_date'),
    supabase
      .from('health_documents')
      .select('*, family_members(full_name)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const upcomingReminders = pendingReminders?.filter(
    r => isDueSoon(r.due_date, 60) || isOverdue(r.due_date)
  ) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">All members · All flags · All activity</p>
      </div>

      <HealthDisclaimerBanner />

      <AdminOverview
        members={members ?? []}
        openFlags={(openFlags as any) ?? []}
        upcomingReminders={(upcomingReminders as any) ?? []}
        recentDocuments={(recentDocuments as any) ?? []}
      />

      {/* Audit log */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Activity (Audit Log)</h2>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Time</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Action</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Entity</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs?.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(log.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2 px-4 font-medium text-gray-700 capitalize">{log.action}</td>
                    <td className="py-2 px-4 text-gray-500 capitalize">{log.entity_type.replace('_', ' ')}</td>
                    <td className="py-2 px-4 text-gray-400 text-xs max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
                {(!auditLogs || auditLogs.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-6 px-4 text-center text-gray-400 text-sm">
                      No activity recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
