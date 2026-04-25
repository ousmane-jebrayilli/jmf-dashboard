import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import HealthDisclaimerBanner from '@/components/HealthDisclaimerBanner'
import LabResultTable from '@/components/LabResultTable'
import RiskFlagCard from '@/components/RiskFlagCard'
import ReminderCard from '@/components/ReminderCard'

interface Props {
  params: { id: string }
}

export default async function MemberProfilePage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, member_id')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Members can only view their own profile
  if (profile.role === 'member' && profile.member_id !== params.id) {
    redirect(`/dashboard/members/${profile.member_id}`)
  }

  const [
    { data: member },
    { data: recentLabs },
    { data: openFlags },
    { data: upcomingReminders },
    { data: recentDocs },
  ] = await Promise.all([
    supabase.from('family_members').select('*').eq('id', params.id).single(),
    supabase
      .from('lab_results')
      .select('*')
      .eq('member_id', params.id)
      .order('result_date', { ascending: false })
      .limit(10),
    supabase
      .from('risk_flags')
      .select('*')
      .eq('member_id', params.id)
      .eq('status', 'open')
      .order('created_at', { ascending: false }),
    supabase
      .from('reminders')
      .select('*')
      .eq('member_id', params.id)
      .eq('status', 'pending')
      .order('due_date')
      .limit(5),
    supabase
      .from('health_documents')
      .select('*')
      .eq('member_id', params.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!member) notFound()

  const age = member.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(member.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{member.full_name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            {age !== null && <span>{age} years old</span>}
            {member.sex && <span className="capitalize">{member.sex}</span>}
            {member.height_cm && <span>{member.height_cm} cm</span>}
            {member.weight_kg && <span>{member.weight_kg} kg</span>}
          </div>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/dashboard/members/${params.id}/labs`} className="btn-secondary">
            Labs
          </Link>
          <Link href={`/dashboard/members/${params.id}/documents`} className="btn-secondary">
            Documents
          </Link>
          <Link href={`/dashboard/members/${params.id}/reminders`} className="btn-secondary">
            Reminders
          </Link>
        </nav>
      </div>

      <HealthDisclaimerBanner />

      {member.notes && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Notes</h2>
          <p className="text-sm text-gray-600">{member.notes}</p>
        </div>
      )}

      {/* Open risk flags */}
      {openFlags && openFlags.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Open Risk Flags
            <span className="ml-2 text-xs font-normal text-gray-400">
              — values outside reference ranges
            </span>
          </h2>
          <div className="space-y-2">
            {openFlags.map(flag => (
              <RiskFlagCard key={flag.id} flag={flag} memberId={params.id} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming reminders */}
      {upcomingReminders && upcomingReminders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Upcoming Reminders</h2>
            <Link href={`/dashboard/members/${params.id}/reminders`} className="text-sm text-brand-600 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {upcomingReminders.map(r => (
              <ReminderCard key={r.id} reminder={r} />
            ))}
          </div>
        </section>
      )}

      {/* Recent lab results */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent Lab Results</h2>
          <Link href={`/dashboard/members/${params.id}/labs`} className="text-sm text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="card p-4">
          <LabResultTable results={recentLabs ?? []} />
        </div>
      </section>

      {/* Recent documents */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent Documents</h2>
          <Link href={`/dashboard/members/${params.id}/documents`} className="text-sm text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="space-y-2">
          {recentDocs && recentDocs.length > 0 ? (
            recentDocs.map(doc => (
              <div key={doc.id} className="card px-4 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {doc.document_type.replace('_', ' ')}
                    {doc.document_date &&
                      ` · ${new Date(doc.document_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
          )}
        </div>
      </section>
    </div>
  )
}
