import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MemberCard from '@/components/MemberCard'
import HealthDisclaimerBanner from '@/components/HealthDisclaimerBanner'
import { isDueSoon, isOverdue } from '@/lib/reminders'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Admin: show all 6 members with stats
  if (profile.role === 'admin') {
    const { data: members } = await supabase
      .from('family_members')
      .select('*')
      .order('full_name')

    const { data: openFlags } = await supabase
      .from('risk_flags')
      .select('member_id')
      .eq('status', 'open')

    const { data: reminders } = await supabase
      .from('reminders')
      .select('member_id, due_date')
      .eq('status', 'pending')

    const flagsByMember: Record<string, number> = {}
    openFlags?.forEach(f => {
      flagsByMember[f.member_id] = (flagsByMember[f.member_id] ?? 0) + 1
    })

    const remindersByMember: Record<string, number> = {}
    reminders?.forEach(r => {
      if (isDueSoon(r.due_date) || isOverdue(r.due_date)) {
        remindersByMember[r.member_id] = (remindersByMember[r.member_id] ?? 0) + 1
      }
    })

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Family Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">All JMF members</p>
          </div>
          <a href="/dashboard/admin" className="btn-secondary text-sm">
            Admin overview →
          </a>
        </div>

        <HealthDisclaimerBanner />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members?.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              openFlagsCount={flagsByMember[member.id] ?? 0}
              upcomingRemindersCount={remindersByMember[member.id] ?? 0}
            />
          ))}
        </div>
      </div>
    )
  }

  // Member: redirect to own profile
  if (profile.member_id) {
    redirect(`/dashboard/members/${profile.member_id}`)
  }

  return (
    <div className="text-center py-16">
      <p className="text-gray-500">Your profile is not linked to a family member record.</p>
      <p className="text-sm text-gray-400 mt-1">Contact your administrator.</p>
    </div>
  )
}
