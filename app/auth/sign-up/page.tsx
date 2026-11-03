import { notFound } from "next/navigation"

// Self-registration is disabled. Athletes are created by admins via the admin panel.
export default function SignUpPage() {
  notFound()
}
