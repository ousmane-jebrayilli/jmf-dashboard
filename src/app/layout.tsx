import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'JMF Health Dashboard',
  description: 'Private family health tracking — for informational use only.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
