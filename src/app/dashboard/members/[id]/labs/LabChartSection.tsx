'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LabResult } from '@/types'

const LabTrendChart = dynamic(() => import('@/components/LabTrendChart'), { ssr: false })

interface Props {
  labs: LabResult[]
  testNames: string[]
}

export default function LabChartSection({ labs, testNames }: Props) {
  const [selected, setSelected] = useState(testNames[0] ?? '')

  return (
    <div>
      <div className="mb-3">
        <label className="label">Select test</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="select max-w-xs"
        >
          {testNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {selected && <LabTrendChart results={labs} testName={selected} />}
    </div>
  )
}
