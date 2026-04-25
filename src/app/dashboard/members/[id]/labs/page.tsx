import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LabResultTable from '@/components/LabResultTable'
import HealthDisclaimerBanner from '@/components/HealthDisclaimerBanner'
import LabEntryForm from './LabEntryForm'
import LabChartSection from './LabChartSection'

interface Props {
  params: { id: string }
}

export default async function LabsPage({ params }: Props) {
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
    redirect(`/dashboard/members/${profile.member_id}/labs`)
  }

  const { data: member } = await supabase
    .from('family_members')
    .select('full_name')
    .eq('id', params.id)
    .single()

  const { data: labs } = await supabase
    .from('lab_results')
    .select('*')
    .eq('member_id', params.id)
    .order('result_date', { ascending: false })

  const { data: documents } = await supabase
    .from('health_documents')
    .select('id, title, document_date')
    .eq('member_id', params.id)
    .order('created_at', { ascending: false })

  // Unique test names for trend chart selector
  const testNames = Array.from(new Set((labs ?? []).map(l => l.test_name))).sort()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/dashboard/members/${params.id}`} className="hover:text-gray-900">
          {member?.full_name}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Lab Results</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900">Lab Results</h1>

      <HealthDisclaimerBanner />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Entry form — admin only */}
        {profile.role === 'admin' && (
          <div className="lg:col-span-2">
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Enter lab result</h2>
              <LabEntryForm
                memberId={params.id}
                documents={documents ?? []}
              />
            </div>
          </div>
        )}

        {/* Results table */}
        <div className={profile.role === 'admin' ? 'lg:col-span-3' : 'lg:col-span-5'}>
          <div className="card p-5 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                All results
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({labs?.length ?? 0})
                </span>
              </h2>
              <LabResultTable results={labs ?? []} />
            </div>

            {testNames.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Trend chart</h2>
                <LabChartSection labs={labs ?? []} testNames={testNames} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
