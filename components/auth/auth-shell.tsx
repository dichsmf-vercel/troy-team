import Image from "next/image"
import { LanguageSwitchButton } from "@/components/language-switch-button"

export function AuthShell({
  appName,
  tagline,
  children,
}: {
  appName: string
  tagline: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh w-full flex-col bg-background">
      <div className="flex justify-end p-4">
        <LanguageSwitchButton />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/main-logo.png" />
              <Image
                src="/main-logo.png"
                alt="Troy Team"
                width={240}
                height={240}
                className="size-48 object-contain"
                priority
              />
            </picture>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-balance">{appName}</h1>
              <p className="text-sm text-muted-foreground">{tagline}</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
