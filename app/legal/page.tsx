import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { tx } from "@/lib/i18n/translate"
import { getT } from "@/lib/i18n/get-language"

const sections = [
  [tx("FTC AI Disclosure"), tx("Troy Team may use AI-assisted tools to suggest training content and program adjustments. Coach Ahmed Aly reviews and approves programs before publication. AI output is not medical advice and should not replace a qualified healthcare professional.")],
  [tx("Privacy Policy"), tx("[PLACEHOLDER: Insert legal entity name, contact email, operating country, data retention periods, service providers, health-data handling, selfie retention, and deletion request process.] Troy Team collects account, training, measurement, health, feedback, and uploaded media data only to provide and improve the service.")],
  [tx("Terms and Conditions"), tx("[PLACEHOLDER: Insert governing law, arbitration seat, language, and arbitrator count.] Disputes will be resolved by binding arbitration administered under the rules of the International Chamber of Commerce (ICC), subject to the completed jurisdictional terms and applicable law.")],
  [tx("Privacy Nutrition Label"), tx("Data linked to the user may include contact information, identifiers, health and fitness information, training activity, payment-plan status, feedback, and user-uploaded images. Data is used for account access, coaching, program delivery, safety review, support, and service administration. Required retention periods and third-party disclosures must be completed before launch.")],
  [tx("UGC Liability"), tx("Users are responsible for the legality, accuracy, and permissions associated with notes, feedback, images, and other content they submit. Troy Team may review, restrict, remove, or retain user content when necessary for safety, moderation, legal compliance, or service operation. Do not upload another person’s image without authorization.")],
] as const

export default async function LegalPage() {
  const t = await getT()
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 md:px-8"><header className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">{t("Troy Team compliance center")}</p><h1 className="text-3xl font-bold text-balance">{t("Legal and privacy information")}</h1><p className="text-muted-foreground">{t("These drafts contain marked placeholders and must be reviewed by qualified counsel before production launch.")}</p></header><div className="grid gap-4">{sections.map(([title, body]) => <Card key={title}><CardHeader><CardTitle>{t(title)}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap leading-6 text-muted-foreground">{t(body)}</p></CardContent></Card>)}</div></main>
}
