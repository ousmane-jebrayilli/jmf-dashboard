'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { LabResult } from '@/types'

interface Props {
  results: LabResult[]
  testName: string
}

export default function LabTrendChart({ results, testName }: Props) {
  const filtered = results
    .filter(r => r.test_name === testName)
    .sort((a, b) => new Date(a.result_date).getTime() - new Date(b.result_date).getTime())

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No data available for this test.</p>
  }

  const data = filtered.map(r => ({
    date: new Date(r.result_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    value: r.result_value,
  }))

  const lastResult = filtered[filtered.length - 1]
  const refLow = lastResult.reference_low
  const refHigh = lastResult.reference_high

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-3">{testName} — trend over time</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={48} unit={` ${lastResult.unit}`} />
          <Tooltip
            formatter={(value: number) => [`${value} ${lastResult.unit}`, testName]}
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 4, fill: '#0ea5e9' }}
            activeDot={{ r: 6 }}
            name={testName}
          />
          {refLow !== null && (
            <ReferenceLine
              y={refLow}
              stroke="#f59e0b"
              strokeDasharray="5 3"
              label={{ value: 'Ref Low', position: 'insideTopRight', fontSize: 10, fill: '#d97706' }}
            />
          )}
          {refHigh !== null && (
            <ReferenceLine
              y={refHigh}
              stroke="#f87171"
              strokeDasharray="5 3"
              label={{ value: 'Ref High', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-gray-400 text-center">
        Values outside reference lines may be worth discussing with a doctor.
      </p>
    </div>
  )
}
