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
            <div className="flex size-16 items-center justify-center rounded-md bg-card ring-1 ring-border">
              <Image
                src="/logo-dark-2.jpg"
                alt=""
                width={40}
                height={40}
                className="hidden dark:block rounded-sm"
                priority
              />
              <Image
                src="/logo-light-2.jpg"
                alt=""
                width={40}
                height={40}
                className="block dark:hidden rounded-sm"
                priority
              />
            </div>
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
