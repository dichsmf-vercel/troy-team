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
            <div className="flex size-24 items-center justify-center rounded-xl bg-card p-2 ring-1 ring-border">
              <Image
                src="/minilogo-removebg-preview.png"
                alt="Troy Team"
                width={80}
                height={80}
                className="hidden size-20 object-contain dark:block"
                priority
              />
              <Image
                src="/minilogo-removebg-preview.png"
                alt="Troy Team"
                width={80}
                height={80}
                className="block size-20 object-contain dark:hidden"
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
