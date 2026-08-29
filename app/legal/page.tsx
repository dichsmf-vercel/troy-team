import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const sections = [
  ["FTC AI Disclosure", "Troy Team may use AI-assisted tools to suggest training content and program adjustments. Coach Ahmed Aly reviews and approves programs before publication. AI output is not medical advice and should not replace a qualified healthcare professional."],
  ["Privacy Policy", "[PLACEHOLDER: Insert legal entity name, contact email, operating country, data retention periods, service providers, health-data handling, selfie retention, and deletion request process.] Troy Team collects account, training, measurement, health, feedback, and uploaded media data only to provide and improve the service."],
  ["Terms and Conditions", "[PLACEHOLDER: Insert governing law, arbitration seat, language, and arbitrator count.] Disputes will be resolved by binding arbitration administered under the rules of the International Chamber of Commerce (ICC), subject to the completed jurisdictional terms and applicable law."],
  ["Privacy Nutrition Label", "Data linked to the user may include contact information, identifiers, health and fitness information, training activity, payment-plan status, feedback, and user-uploaded images. Data is used for account access, coaching, program delivery, safety review, support, and service administration. Required retention periods and third-party disclosures must be completed before launch."],
  ["UGC Liability", "Users are responsible for the legality, accuracy, and permissions associated with notes, feedback, images, and other content they submit. Troy Team may review, restrict, remove, or retain user content when necessary for safety, moderation, legal compliance, or service operation. Do not upload another person’s image without authorization."],
] as const

export default function LegalPage() {
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 md:px-8"><header className="flex flex-col gap-2"><p className="text-sm text-muted-foreground">Troy Team compliance center</p><h1 className="text-3xl font-bold text-balance">Legal and privacy information</h1><p className="text-muted-foreground">These drafts contain marked placeholders and must be reviewed by qualified counsel before production launch.</p></header><div className="grid gap-4">{sections.map(([title, body]) => <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap leading-6 text-muted-foreground">{body}</p></CardContent></Card>)}</div></main>
}
