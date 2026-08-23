import { OctagonAlert } from "lucide-react"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getDictionary } from "@/lib/i18n/get-language"

export default async function AuthErrorPage() {
  const { dict } = await getDictionary()

  return (
    <AuthShell appName={dict.app.name} tagline={dict.app.tagline}>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15">
            <OctagonAlert className="size-6 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{dict.auth.errorTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{dict.auth.errorBody}</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/auth/login">{dict.auth.backToLogin}</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
