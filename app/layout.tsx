import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { LanguageProvider } from "@/components/providers/language-provider"
import { Toaster } from "@/components/ui/sonner"
import { getLanguage } from "@/lib/i18n/get-language"
import { BRAND } from "@/lib/brand"
import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-fraunces",
  display: "swap",
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
})

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
})

export const metadata: Metadata = {
  title: BRAND.siteName,
  description: `${BRAND.siteName} training, attendance, and performance with ${BRAND.coachName}.`,
  generator: "v0.app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/minilogo-removebg-preview.png", media: "(prefers-color-scheme: light)" },
      { url: "/minilogo-removebg-preview.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/minilogo-removebg-preview.png",
  },
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#111112" },
  ],
  userScalable: false,
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const language = await getLanguage()
  const dir = language === "ar" ? "rtl" : "ltr"

  return (
    <html
      lang={language}
      dir={dir}
      className={`${fraunces.variable} ${ibmPlexSans.variable} ${ibmPlexSansArabic.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <LanguageProvider language={language}>
            {children}
            <Toaster position="top-center" />
          </LanguageProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
