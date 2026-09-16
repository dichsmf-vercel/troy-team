import { MailCheck } from "lucide-react"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getDictionary } from "@/lib/i18n/get-language"

export default async function SignUpSuccessPage() {
  const { dict } = await getDictionary()

  return (
    <AuthShell appName={dict.app.name} tagline={dict.app.tagline}>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-accent/15">
            <MailCheck className="size-6 text-accent" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{dict.auth.signUpSuccessTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{dict.auth.signUpSuccessBody}</p>
          </div>
          <Link href="/auth/login" className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">{dict.auth.backToLogin}</Link>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
