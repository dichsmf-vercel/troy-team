import { part1 } from "@/lib/i18n/ar/part1"
import { part2 } from "@/lib/i18n/ar/part2"
import { part3 } from "@/lib/i18n/ar/part3"
import { part4 } from "@/lib/i18n/ar/part4"
import { part5 } from "@/lib/i18n/ar/part5"

/**
 * Arabic translations keyed by the exact English source text used in t('…').
 * Split into parts only to keep the files readable; they are merged here.
 */
export const arabic: Record<string, string> = { ...part1, ...part2, ...part3, ...part4, ...part5 }
