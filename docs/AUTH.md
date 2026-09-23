# Multi-tenant auth: TanStack Start + Laravel Sanctum

```
 acme.example.com ─┐                                     ┌──────────────────────┐
 shop.acme.com   ──┼──►  TanStack Start server (Nitro) ──►  api.laravel.dev/api   │
 globex.example.com┘     • resolves tenant from Host     │  (Sanctum tokens,    │
                         • keeps token in HttpOnly cookie │   single backend)    │
                         • adds Bearer + X-Tenant headers └──────────────────────┘
```

**The browser never calls `api.laravel.dev` and never sees the Sanctum token.**
Every call goes through the TanStack Start server on the tenant's own domain:

| Where the call happens | Use | Path |
| --- | --- | --- |
| Server (SSR, loaders, anything sensitive) | `tenantServerFn` / `authedServerFn` + `context.api` | `src/features/auth/utils/auth.functions.ts` |
| Browser (interactive UI) | `api.get/post/...` → `/api/*` proxy | `src/lib/api/client.ts` |

Why: no CORS setup for every tenant or custom domain, an XSS bug can't steal tokens, and the tenant is always taken from the Host header on the server, so the browser can't spoof it.

---

## 1. Request lifecycle

1. The request arrives at `https://shop.acme.com/dashboard`.
2. The root route's `beforeLoad` calls `getSessionFn` (a server function):
   - `GET v1/tenants/check?domain=shop.acme.com`. The result is cached in memory for 5 minutes, unknown hosts for 30 seconds, and concurrent lookups for the same host share one request.
   - If the tenant is unknown or suspended, the page renders a 404 or "unavailable" screen.
   - The server decrypts the `__Host-tenant_auth` cookie and checks that `tenantId` matches the current tenant. It then calls `GET v1/user/me` with `Authorization: Bearer …` and `X-Tenant: <id>`.
3. The `_authed` layout redirects to `/sign-in?redirect=/dashboard` when there is no user.
4. The result is stored in React Query, so client-side navigation doesn't repeat the checks.

## 2. File map

```
src/
├── start.ts                          CSRF middleware + ApiError serializer
├── env.ts                            typed env (t3-env)
├── server/                           server-only infrastructure (*.server.ts never reach the client)
│   ├── config.server.ts              settings
│   ├── laravel.server.ts             fetch wrapper → Laravel (headers, timeout, errors)
│   ├── tenant.server.ts              v1/tenants/check + cache
│   ├── cookie.server.ts              AES-GCM sealed HttpOnly cookies
│   └── request.server.ts             host, IP, UA, same-origin check
├── lib/api/
│   ├── errors.ts                     ApiError (status, 422 field errors) — isomorphic
│   ├── types.ts                      Tenant/User types + tolerant response normalizers
│   └── client.ts                     browser client → /api proxy
├── components/
│   ├── app-header.tsx, tenant-status.tsx, locale-switcher.tsx
│   ├── form/                         form-field.tsx, form-alert.tsx, submit-button.tsx
│   └── ui/                           shadcn primitives (input-otp.tsx, button.tsx, …)
├── features/
│   ├── auth/
│   │   ├── components/               forgot-password-form, otp-form, reset-password-form,
│   │   │                             sign-in-form, sign-up-form, social-buttons (.tsx)
│   │   ├── hooks/use-auth.ts         useSession, useAuth, useTenant, useUser
│   │   ├── queries/
│   │   │   ├── auth.keys.ts          query keys
│   │   │   ├── auth.queries.ts       queryOptions + requireUser / requireGuest guards
│   │   │   └── auth.mutations.ts     useSignInMutation, useSignOutMutation, …
│   │   ├── schema/                   forgot-password, otp, reset-password, sign-in, sign-up (.schema.ts)
│   │   ├── types/auth.types.ts
│   │   ├── utils/
│   │   │   ├── auth.ts               isomorphic helpers (safeRedirect, server-error → form)
│   │   │   ├── auth.server.ts        server-only: tenant, token cookie, ServerApi, pending reset, Socialite
│   │   │   └── auth.functions.ts     middleware, tenantServerFn/authedServerFn, one server fn per endpoint
│   │   ├── auth-layout.tsx           shared card layout for auth pages
│   │   ├── sign-in.tsx, sign-up.tsx, forgot-password.tsx, otp.tsx, reset-password.tsx   pages
│   │   └── index.ts                  public API (barrel; excludes auth.server.ts)
│   ├── settings/                     change password, password confirm/status, notification prefs
│   ├── plans/                        v1/plans + v1/features (public, SSR + client example)
│   └── dashboard/                    server-side vs client-side call example
└── routes/                           thin: search params, loaders, guards → feature pages
    ├── __root.tsx                    tenant + user bootstrap, tenant error screens
    ├── _guest.tsx                    guests only
    │   └── _guest/{sign-in,sign-up,forgot-password,otp,reset-password}.tsx
    ├── _authed.tsx                   sign-in required
    │   └── _authed/{dashboard,settings}.tsx
    ├── plans/{index,$slug}.tsx       public
    ├── api/$.ts                      /api/* → Laravel proxy for client-side calls
    └── auth/{redirect,callback}.$provider.ts   Socialite flow
```

Rule of thumb: routes stay thin (search validation, loaders, guards); UI and data live in `features/*`.

## 3. Endpoint mapping

| Laravel | Server function | Hook / page |
| --- | --- | --- |
| `GET v1/tenants/check` | `resolveTenant()` via `getSessionFn` | `useTenant()` |
| `POST v1/user/register` | `signUpFn` | `useSignUpMutation()` · `/sign-up` |
| `POST v1/user/login` | `signInFn` | `useSignInMutation()` · `/sign-in` |
| `POST v1/user/forgot-password` | `forgotPasswordFn` | `useForgotPasswordMutation()` · `/forgot-password` |
| — (OTP entry, stored in cookie) | `submitOtpFn`, `getPendingResetFn` | `useSubmitOtpMutation()` · `/otp` |
| `POST v1/user/reset-password` | `resetPasswordFn` | `useResetPasswordMutation()` · `/reset-password` |
| `GET v1/user/auth/{provider}` | `/auth/redirect/:provider` → `startSocialSignIn` | `<SocialButtons/>` |
| `GET v1/user/auth/{provider}/callback` | `/auth/callback/:provider` → `finishSocialSignIn` | — |
| `POST v1/user/auth/{provider}/token` | `socialTokenSignInFn` | `useSocialTokenSignInMutation()` |
| `GET v1/user/me` | `getMeFn`, `getCurrentUser()` | `useAuth()`, `useUser()` |
| `POST v1/user/logout` | `signOutFn` | `useSignOutMutation()` |
| `POST v1/user/change-password` | `changePasswordFn` | `useChangePasswordMutation()` · `/settings` |
| `POST v1/user/password/confirm` | `confirmPasswordFn` | `useConfirmPasswordMutation()` · `/settings` |
| `GET v1/user/password/status` | `getPasswordStatusFn` | `passwordStatusQueryOptions()` |
| `GET/PUT v1/user/notifications/preferences` | `get/updateNotificationPreferencesFn` | `useUpdateNotificationPreferencesMutation()` (optimistic) |
| `GET v1/plans`, `GET v1/plans/{slug}` | `getPlansFn`, `getPlanFn` | `/plans`, `/plans/$slug` |
| `GET v1/features`, `GET v1/features/{slug}` | `getFeaturesFn`; slug via `/api` proxy (client) | `<FeatureDetails/>` |

Endpoints that issue or revoke tokens (`login`, `register`, `auth/*`, `logout`) and `tenants/*` are **blocked in the `/api` proxy**. They must go through server functions so the token is saved to the HttpOnly cookie and never reaches the browser.

### Password reset flow

`VITE_PASSWORD_RESET_MODE` selects the flow:

- **`otp`** (default): `/forgot-password` → `POST forgot-password` and an encrypted 15-minute `__Host-pw_reset` cookie holding the email → `/otp` (6-digit code, stored in the same cookie; the email is never taken from the client) → `/reset-password` → `POST reset-password` with `email`, `token`, `otp`, `code` (all the same value, so either Laravel implementation works) → `/sign-in?reset=true`. If Laravel rejects the code (422 on `token`/`otp`/`code`), the user is sent back to `/otp?error=…`.
- **`link`**: Laravel's default e-mail link `https://<tenant-domain>/reset-password?token=…&email=…` (see §6.4).

## 4. Calling your own API endpoints

### Server-side (SSR / loader)

```ts
// src/features/orders/utils/orders.functions.ts
import { z } from 'zod'
import { authedServerFn } from '#/features/auth/utils/auth.functions'

export const getOrdersFn = authedServerFn({ method: 'GET' })
  .validator(z.object({ page: z.number().default(1) }))
  .handler(({ context, data }) => context.api.get('v1/orders', { page: data.page }))

// src/features/orders/queries/orders.queries.ts
export const ordersQuery = (page: number) =>
  queryOptions({ queryKey: ['orders', page], queryFn: () => getOrdersFn({ data: { page } }) })

// src/routes/_authed/orders.tsx
export const Route = createFileRoute('/_authed/orders')({
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery(1)),
  component: Orders, // from #/features/orders
})
```

`context.api` supports `get/post/put/patch/delete/request`. It adds the Bearer token, the `X-Tenant` and `X-Tenant-Domain` headers, and `X-Forwarded-For` and `User-Agent` for the real client. If Laravel returns 401, it clears the cookie.

Use `tenantServerFn` for public, tenant-scoped data such as plans (the Bearer token is still sent if present), and `authedServerFn` when a signed-in user is required. See `features/plans` and `features/dashboard` for working examples.

> Keep server-fn factories as **module-level constants** (`export const x = authedServerFn(...)`). Wrapping them in functions breaks the compiler's server/client split.

### Client-side (browser)

```ts
import { api } from '#/lib/api/client'

const { data } = useQuery({
  queryKey: ['products', search],
  queryFn: () => api.get('v1/products', { search }),
})

useMutation({ mutationFn: (body) => api.post('v1/cart', body) })
```

Requests go to `/api/v1/...` on the same origin, and the proxy adds the auth and tenant headers. A 401 anywhere invalidates the session, and the `_authed` routes then redirect to `/sign-in`.

### Errors

Both paths throw `ApiError`. It survives the server-function boundary through a serialization adapter in `src/start.ts`.

```ts
if (isApiError(err)) {
  err.status          // 401, 403, 422, 423, 429…
  err.fieldErrors()   // { email: 'The email has already been taken.' }
}
```

In forms, `applyServerErrors(form, err)` (from `features/auth/utils/auth.ts`) maps Laravel 422 errors onto TanStack Form fields.

## 5. Security notes

- **Token storage:** the token is AES-256-GCM encrypted with `SESSION_SECRET` and stored in an `HttpOnly; Secure; SameSite=Lax` cookie with the `__Host-` prefix. The prefix forbids a `Domain` attribute, so each tenant sub-domain and alias domain gets its own isolated cookie.
- **Tenant binding:** the cookie stores `tenantId`. If a cookie shows up on a host that belongs to a different tenant, the server rejects and deletes it.
- **CSRF:** TanStack's `createCsrfMiddleware` protects server functions. The `/api` proxy rejects cross-site requests with a method other than GET, using `Sec-Fetch-Site`, `Origin` and `Referer`.
- **Open redirects:** `?redirect=` values must be relative paths (`safeRedirect`).
- **OAuth:** the `state` value is tied to a short-lived HttpOnly cookie.
- **Proxy allow-list:** only a fixed list of request and response headers is forwarded, and paths must match `v{n}/…`.
- Enable `TRUST_PROXY=true` only behind a load balancer you control.

## 6. What Laravel needs

### 6.1 `TenantController@check`

The frontend calls `GET /api/v1/tenants/check?domain=<host>` and accepts any of these shapes:

```jsonc
{ "data": { "id": "uuid", "name": "Acme", "domain": "shop.acme.com", "is_active": true,
            "logo_url": null, "locale": "en", "settings": { /* public only */ } } }
// 404 → not a tenant.   is_active:false / status:"suspended" / 403 → unavailable.
```

```php
public function check(Request $request)
{
    $host = strtolower($request->query('domain', ''));
    $tenant = Tenant::query()
        ->whereHas('domains', fn ($q) => $q->where('domain', $host)) // sub-domains AND aliases
        ->first();

    abort_unless($tenant, 404, 'Tenant not found.');

    return response()->json(['data' => [
        'id' => $tenant->id,
        'name' => $tenant->name,
        'domain' => $host,
        'is_active' => $tenant->is_active,
        'logo_url' => $tenant->logo_url,
        'settings' => $tenant->public_settings ?? (object) [],
    ]]);
}
```

Rate-limit this route, because it's public.

### 6.2 Initialise tenancy from the header

Every call after the tenant check sends `X-Tenant: <id>` and `X-Tenant-Domain: <host>`. With **stancl/tenancy**:

```php
// routes/api.php (tenant-aware routes)
Route::middleware([InitializeTenancyByRequestData::class])->group(function () {
    // the v1/user/* routes
});
// InitializeTenancyByRequestData::$header = 'X-Tenant';  (default)
```

If you use another header name, set `TENANT_HEADER` in `.env`.

> The tenant header comes **only** from the TanStack server, which takes it from the Host header. If you also want to stop other clients calling Laravel with an arbitrary `X-Tenant`, make sure the user's token belongs to that tenant. For example, check `$request->user()->tenant_id === tenant('id')` in a middleware on the `auth:sanctum` group.

### 6.3 Token response

`login`, `register`, `auth/{provider}/callback` and `auth/{provider}/token` should return the plain-text token in any of these shapes:

```jsonc
{ "token": "1|abc…", "user": { … } }
{ "data": { "token": "1|abc…", "user": { … } } }
{ "access_token": "1|abc…", "expires_at": "2026-10-23T00:00:00Z" }  // expiry optional
```

If you return `expires_at` or `expires_in`, the auth cookie expires at the same time (otherwise it uses the configured max age with *Remember me*).

The frontend sends `device_name` (for example "Chrome on macOS") on login and register. Use it as the Sanctum token name.

### 6.4 Password reset links must point to the tenant domain

```php
// AppServiceProvider::boot()
ResetPassword::createUrlUsing(function ($user, string $token) {
    $domain = request()->header('X-Tenant-Domain') ?? $user->tenant->primary_domain;
    return "https://{$domain}/reset-password?token={$token}&email=".urlencode($user->email);
});
```

Do the same for email verification links if you use them.

For the default **OTP** mode instead, e-mail a 6-digit code on `POST forgot-password` and accept it on `POST reset-password` as `token`, `otp` or `code` (the frontend sends all three), together with `email`, `password` and `password_confirmation`. Return 422 with an error on `token`/`otp`/`code` when it's wrong or expired.

### 6.5 Socialite (stateless)

The frontend passes its own callback URL and `state`:

```
GET  v1/user/auth/google?redirect_uri=https://shop.acme.com/auth/callback/google&state=…
  → return ['url' => Socialite::driver('google')->stateless()
                ->redirectUrl($request->redirect_uri)
                ->with(['state' => $request->state])->redirect()->getTargetUrl()]

GET  v1/user/auth/google/callback?code=…&redirect_uri=…&device_name=…
  → $social = Socialite::driver('google')->stateless()
                ->redirectUrl($request->redirect_uri)->user();
    … find/create user in the current tenant …
    return ['token' => $user->createToken($request->device_name)->plainTextToken, 'user' => $user];
```

Validate `redirect_uri` against the tenant's domains, and register each callback URL with the provider. For many custom domains, one option is a single central callback that forwards back to the tenant.

### 6.6 Real client IP

Laravel sees the TanStack server's IP. The server forwards the browser IP in `X-Forwarded-For`, so add the TanStack server's IP or network to `TrustProxies` so that rate limiting sees the real client IP.

### 6.7 CORS

Not needed, because the browser never calls Laravel directly.

## 7. Local development

```bash
cp .env.example .env         # set LARAVEL_API_URL + SESSION_SECRET
npm run mock:api             # optional: fake Laravel on :8000 (see scripts/mock-laravel.mjs)
npm run dev
```

On `localhost` there is no tenant domain, so set `DEV_TENANT_DOMAIN=acme.example.com`. It is ignored in production. To test real multi-domain behaviour, add hosts entries (`127.0.0.1 acme.example.com shop.acme.com globex.example.com`) and remove `DEV_TENANT_DOMAIN`.

Mock users: `demo@acme.test` / `password` (Acme) and `demo@globex.test` / `password` (Globex).

## 8. Deployment

- Point `*.example.com` and every custom domain at the Nitro server, with TLS for each domain (for example Caddy on-demand TLS or Cloudflare for SaaS).
- Set the `.env` values as real environment variables. `SESSION_SECRET` must be the same on every instance.
- The tenant cache is per instance and in memory. That's fine for a small TTL; use Redis if you need to purge it instantly when a tenant's domain changes.
