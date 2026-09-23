import { Button } from '#/components/ui/button'
import { getSocialProviders, SOCIAL_LABELS } from '../utils/auth'

/**
 * Full-page navigation to `/auth/redirect/:provider`, which calls
 * `GET v1/user/auth/{provider}` and forwards to the provider.
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
          <Button key={provider} variant="outline" size="lg" className="h-9" asChild>
            <a
              href={`/auth/redirect/${provider}${
                redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
              }`}
            >
              {SOCIAL_LABELS[provider] ?? provider}
            </a>
          </Button>
        ))}
      </div>
    </div>
  )
}
