import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Navigation } from "@/components/navigation"

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
})
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "DAF Tool - Amazon FBA",
  description:
    "Outil de pilotage financier temps reel pour resellers Amazon FBA",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Navigation />
        <main className="ml-64 min-h-screen p-8">{children}</main>
      </body>
    </html>
  )
}
