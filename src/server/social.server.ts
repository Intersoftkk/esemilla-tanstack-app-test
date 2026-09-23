/**
 * Social login (Laravel Socialite, stateless) for multi-domain tenants.
 *
 * Flow:
 *  1. Browser -> GET  /auth/redirect/google?redirect=/dashboard       (this app)
 *  2. App     -> GET  api/v1/user/auth/google?redirect_uri=...&state=...
 *                Laravel returns `{ url }` (or a 302) to the provider.
 *  3. Browser -> provider consent screen
 *  4. Provider-> GET  https://<tenant-domain>/auth/callback/google?code=...&state=...
 *  5. App     -> GET  api/v1/user/auth/google/callback?code=...&redirect_uri=...
 *                Laravel returns `{ token, user }`  -> stored in HttpOnly cookie
 *  6. Browser -> 302 /dashboard
 *
 * `state` is bound to the browser with a short-lived HttpOnly cookie
 * (CSRF protection for the OAuth flow).
 */
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { isApiError } from '#/lib/api/errors'
import { isObject } from '#/lib/api/types'
import { safeRedirect, socialProviderSchema } from '#/lib/auth/schemas'
import { config } from './config.server'
import { laravelRequest } from './laravel.server'
import { getDeviceName, getPublicOrigin } from './request.server'
import { requireTenant, storeToken } from './session.server'

const STATE_COOKIE = config.cookie.secure ? '__Host-oauth_state' : 'oauth_state'

interface OAuthState {
  state: string
  provider: string
  redirect: string
}

function redirectTo(location: string) {
  return new Response(null, { status: 302, headers: { location } })
}

function loginError(message: string) {
  return redirectTo(`/login?error=${encodeURIComponent(message)}`)
}

function callbackUrl(request: Request, provider: string) {
  return `${getPublicOrigin(request)}/auth/callback/${provider}`
}

export async function startSocialLogin(
  request: Request,
  rawProvider: string,
): Promise<Response> {
  const parsed = socialProviderSchema.safeParse(rawProvider)
  if (!parsed.success) return loginError('Unsupported login provider.')
  const provider = parsed.data

  try {
    const tenant = await requireTenant()
    const url = new URL(request.url)
    const state: OAuthState = {
      state: crypto.randomUUID(),
      provider,
      redirect: safeRedirect(url.searchParams.get('redirect')),
    }

    setCookie(STATE_COOKIE, JSON.stringify(state), {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: 'lax', // must survive the top-level redirect back from provider
      path: '/',
      maxAge: 600,
    })

    const res = await laravelRequest(`v1/user/auth/${provider}`, {
      tenant,
      query: {
        redirect_uri: callbackUrl(request, provider),
        state: state.state,
      },
    })

    const location =
      res.headers.get('location') ??
      (isObject(res.data)
        ? ((res.data.url ?? res.data.redirect_url ?? res.data.target_url) as
            | string
            | undefined) ??
          (isObject(res.data.data) ? (res.data.data.url as string | undefined) : undefined)
        : undefined)

    if (!location || !/^https:\/\//.test(location)) {
      return loginError('Could not start social login.')
    }
    return redirectTo(location)
  } catch (error) {
    console.error('[social] redirect failed', error)
    return loginError(isApiError(error) ? error.message : 'Could not start social login.')
  }
}

export async function finishSocialLogin(
  request: Request,
  rawProvider: string,
): Promise<Response> {
  const parsed = socialProviderSchema.safeParse(rawProvider)
  if (!parsed.success) return loginError('Unsupported login provider.')
  const provider = parsed.data

  const url = new URL(request.url)
  const raw = getCookie(STATE_COOKIE)
  deleteCookie(STATE_COOKIE, { path: '/', secure: config.cookie.secure })

  let saved: OAuthState | null = null
  try {
    saved = raw ? (JSON.parse(raw) as OAuthState) : null
  } catch {
    saved = null
  }

  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (providerError) return loginError(providerError)

  if (!saved || saved.provider !== provider || saved.state !== url.searchParams.get('state')) {
    return loginError('Login session expired. Please try again.')
  }

  try {
    const tenant = await requireTenant()
    const query: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      query[key] = value
    })
    query.redirect_uri = callbackUrl(request, provider)
    query.device_name = getDeviceName()

    const res = await laravelRequest(`v1/user/auth/${provider}/callback`, {
      tenant,
      query,
    })
    await storeToken(res.data, { remember: true })
    return redirectTo(safeRedirect(saved.redirect))
  } catch (error) {
    console.error('[social] callback failed', error)
    return loginError(isApiError(error) ? error.message : 'Social login failed.')
  }
}
