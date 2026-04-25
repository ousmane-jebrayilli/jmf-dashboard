import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DocumentUpload from '@/components/DocumentUpload'
import HealthDisclaimerBanner from '@/components/HealthDisclaimerBanner'
import DocumentList from './DocumentList'

interface Props {
  params: { id: string }
}

export default async function DocumentsPage({ params }: Props) {
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
    redirect(`/dashboard/members/${profile.member_id}/documents`)
  }

  const { data: member } = await supabase
    .from('family_members')
    .select('full_name')
    .eq('id', params.id)
    .single()

  const { data: documents } = await supabase
    .from('health_documents')
    .select('*')
    .eq('member_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/dashboard/members/${params.id}`} className="hover:text-gray-900">
          {member?.full_name}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Documents</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900">Health Documents</h1>

      <HealthDisclaimerBanner />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upload form */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Upload document</h2>
            <DocumentUpload memberId={params.id} />
          </div>
        </div>

        {/* Document list */}
        <div className="lg:col-span-3">
          <div className="card p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              All documents
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({documents?.length ?? 0})
              </span>
            </h2>
            <DocumentList documents={documents ?? []} memberId={params.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
