import { Button } from '#/components/ui/button'

const LABELS: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  microsoft: 'Microsoft',
  apple: 'Apple',
  linkedin: 'LinkedIn',
  twitter: 'X',
  gitlab: 'GitLab',
}

export function getSocialProviders(): Array<string> {
  return String(import.meta.env.VITE_SOCIAL_PROVIDERS ?? '')
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Full-page navigation to the server route that starts the OAuth flow
 * (src/routes/auth/redirect.$provider.ts).
 */
export function SocialButtons({ redirect }: { redirect?: string }) {
  const providers = getSocialProviders()
  if (providers.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((provider) => (
          <Button key={provider} variant="outline" size="lg" asChild>
            <a
              href={`/auth/redirect/${provider}${
                redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
              }`}
            >
              {LABELS[provider] ?? provider}
            </a>
          </Button>
        ))}
      </div>
    </div>
  )
}
