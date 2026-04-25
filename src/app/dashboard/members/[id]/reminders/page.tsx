import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ReminderCard from '@/components/ReminderCard'
import HealthDisclaimerBanner from '@/components/HealthDisclaimerBanner'
import ReminderForm from './ReminderForm'

interface Props {
  params: { id: string }
}

export default async function RemindersPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, member_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role === 'member' && profile.member_id !== params.id) {
    redirect(`/dashboard/members/${profile.member_id}/reminders`)
  }

  const { data: member } = await supabase
    .from('family_members')
    .select('full_name')
    .eq('id', params.id)
    .single()

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*')
    .eq('member_id', params.id)
    .order('due_date')

  const pending = reminders?.filter(r => r.status === 'pending') ?? []
  const snoozed = reminders?.filter(r => r.status === 'snoozed') ?? []
  const completed = reminders?.filter(r => r.status === 'completed') ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/dashboard/members/${params.id}`} className="hover:text-gray-900">
          {member?.full_name}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Reminders</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900">Health Reminders</h1>

      <HealthDisclaimerBanner />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Create form — admin only */}
        {profile.role === 'admin' && (
          <div className="lg:col-span-2">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Create reminder</h2>
              <ReminderForm memberId={params.id} />
            </div>
          </div>
        )}

        {/* Reminder lists */}
        <div className={`space-y-6 ${profile.role === 'admin' ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Pending ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">No pending reminders.</p>
            ) : (
              <div className="space-y-2">
                {pending.map(r => <ReminderCard key={r.id} reminder={r} />)}
              </div>
            )}
          </section>

          {snoozed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Snoozed ({snoozed.length})
              </h2>
              <div className="space-y-2">
                {snoozed.map(r => <ReminderCard key={r.id} reminder={r} />)}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Completed ({completed.length})
              </h2>
              <div className="space-y-2">
                {completed.slice(0, 5).map(r => <ReminderCard key={r.id} reminder={r} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
