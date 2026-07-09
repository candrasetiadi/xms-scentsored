import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const chatime = localFont({
  src: '../../public/fonts/chatime.otf',
  variable: '--font-chatime',
  display: 'swap',
  weight: '400',
})

const interTight = localFont({
  src: [
    {
      path: '../../public/fonts/InterTight-VariableFont_wght.ttf',
      style: 'normal',
    },
    {
      path: '../../public/fonts/InterTight-Italic-VariableFont_wght.ttf',
      style: 'italic',
    },
  ],
  variable: '--font-inter-tight',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Scentsored',
  description: 'Sistem operasional internal Scentsored',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${chatime.variable} ${interTight.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-sand-50 text-ink-900">
        {children}
      </body>
    </html>
  )
}
