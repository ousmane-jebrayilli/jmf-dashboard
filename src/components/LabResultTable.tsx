import { LabResult, LabStatus } from '@/types'

interface Props {
  results: LabResult[]
}

const statusStyle: Record<LabStatus, string> = {
  normal: 'bg-green-100 text-green-800',
  low: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
  critical: 'bg-red-200 text-red-900 font-bold',
  unknown: 'bg-gray-100 text-gray-600',
}

const statusLabel: Record<LabStatus, string> = {
  normal: 'Normal',
  low: 'Low',
  high: 'High',
  critical: 'Critical',
  unknown: 'Unknown',
}

export default function LabResultTable({ results }: Props) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500">No lab results recorded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Date</th>
            <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Test</th>
            <th className="text-left py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Category</th>
            <th className="text-right py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Result</th>
            <th className="text-right py-2 pr-4 font-medium text-gray-500 whitespace-nowrap">Reference</th>
            <th className="text-center py-2 font-medium text-gray-500 whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {results.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                {new Date(r.result_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </td>
              <td className="py-2.5 pr-4 font-medium text-gray-900 whitespace-nowrap">{r.test_name}</td>
              <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{r.test_category}</td>
              <td className="py-2.5 pr-4 text-right font-mono text-gray-900 whitespace-nowrap">
                {r.result_value} {r.unit}
              </td>
              <td className="py-2.5 pr-4 text-right text-gray-400 text-xs whitespace-nowrap">
                {r.reference_low !== null || r.reference_high !== null
                  ? `${r.reference_low ?? '—'} – ${r.reference_high ?? '—'} ${r.unit}`
                  : '—'}
              </td>
              <td className="py-2.5 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${statusStyle[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
