export function getSiteUrl(): string {
  // Prefer an explicit canonical URL (recommended to set in production).
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  // Vercel sets VERCEL_URL without protocol.
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  // Local/dev fallback.
  return 'http://localhost:3000'
}

export function toAbsoluteUrl(url: string): string {
  if (!url) return url
  try {
    return new URL(url).toString()
  } catch {
    // Likely a relative URL.
    return new URL(url, getSiteUrl()).toString()
  }
}
