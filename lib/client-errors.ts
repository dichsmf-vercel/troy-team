/** Helpers for turning errors caught around server-action calls into user-facing messages. */

/** True when the browser still runs an old build whose server action ids no longer exist. */
export function isStaleActionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("Server Action") || message.includes("UnrecognizedActionError") || (error instanceof Error && error.name === "UnrecognizedActionError")
}

export const REFRESH_HINT = "The app was recently updated on the server. Please refresh the page (Ctrl + F5) to load the latest version."

export function actionErrorMessage(error: unknown, fallback: string): string {
  if (isStaleActionError(error)) return REFRESH_HINT
  return error instanceof Error && error.message ? error.message : fallback
}
