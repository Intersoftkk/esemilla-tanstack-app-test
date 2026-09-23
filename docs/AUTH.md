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
| Server (SSR, loaders, anything sensitive) | server functions + `context.api` | `src/lib/api/server-fn.ts` |
| Browser (interactive UI) | `api.get/post/...` → `/api/*` proxy | `src/lib/api/client.ts` |

Why: no CORS setup for every tenant or custom domain, an XSS bug can't steal tokens, and the tenant is always taken from the Host header on the server, so the browser can't spoof it.

---

## 1. Request lifecycle

1. The request arrives at `https://shop.acme.com/dashboard`.
2. The root route's `beforeLoad` calls `getSessionFn` (a server function):
   - `GET v1/tenants/check?domain=shop.acme.com`. The result is cached in memory for 5 minutes, unknown hosts for 30 seconds, and concurrent lookups for the same host share one request.
   - If the tenant is unknown or suspended, the page renders a 404 or "unavailable" screen.
   - The server decrypts the `__Host-tenant_auth` cookie and checks that `tenantId` matches the current tenant. It then calls `GET v1/user/me` with `Authorization: Bearer …` and `X-Tenant: <id>`.
3. The `_authed` layout redirects to `/login?redirect=/dashboard` when there is no user.
4. The result is stored in React Query, so client-side navigation doesn't repeat the checks.

## 2. File map

```
src/
├── start.ts                         CSRF middleware + ApiError serializer
├── env.ts                           typed env (t3-env)
├── server/                          server-only (*.server.ts can't reach the client bundle)
│   ├── config.server.ts             settings
│   ├── laravel.server.ts            fetch wrapper → Laravel (headers, timeout, errors)
│   ├── tenant.server.ts             v1/tenants/check + cache
│   ├── cookie.server.ts             AES-GCM encrypted HttpOnly token cookie
│   ├── session.server.ts            requireTenant / getApi / requireAuthApi / getCurrentUser
│   ├── request.server.ts            host, IP, UA, same-origin check
│   └── social.server.ts             Socialite redirect/callback flow
├── lib/
│   ├── api/errors.ts                ApiError (status, 422 field errors) — isomorphic
│   ├── api/types.ts                 Tenant/User types + tolerant response normalizers
│   ├── api/client.ts                browser client → /api proxy
│   ├── api/server-fn.ts             tenantServerFn / authedServerFn / userServerFn
│   └── auth/
│       ├── functions.ts             one server function per v1/user/* endpoint
│       ├── middleware.ts            tenant / api / auth / user middleware
│       ├── hooks.ts                 useAuth, useLogin, useLogout, useSessions, …
│       ├── queries.ts               queryOptions + keys
│       ├── guards.ts                requireUser / requireGuest for beforeLoad
│       └── schemas.ts               zod schemas + safeRedirect
├── routes/
│   ├── __root.tsx                   tenant + user bootstrap, tenant error screens
│   ├── _guest.tsx                   guests only → login, register, forgot/reset-password
│   ├── _authed.tsx                  login required → dashboard, settings
│   ├── api/$.ts                     /api/* → Laravel proxy for client-side calls
│   └── auth/{redirect,callback}.$provider.ts   social login
└── features/example/api.ts          example server-side + client-side calls
```

## 3. Endpoint mapping

| Laravel | TanStack | Hook |
| --- | --- | --- |
| `GET v1/tenants/check` | `resolveTenant()` (+ `getSessionFn`) | `useTenant()` |
| `POST register` | `registerFn` | `useRegister()` |
| `POST login` | `loginFn` | `useLogin()` |
| `POST forgot-password` | `forgotPasswordFn` | `useForgotPassword()` |
| `POST reset-password` | `resetPasswordFn` | `useResetPassword()` |
| `GET auth/{provider}` | `/auth/redirect/:provider` | `<SocialButtons/>` |
| `GET auth/{provider}/callback` | `/auth/callback/:provider` | — |
| `POST auth/{provider}/token` | `socialTokenLoginFn` | `useSocialTokenLogin()` |
| `GET me` | `getMeFn`, `getCurrentUser()` | `useAuth()`, `useUser()` |
| `PUT / PATCH me` | `updateProfileFn` / `patchProfileFn` | `useUpdateProfile({ partial })` |
| `DELETE me` | `deleteAccountFn` | `useDeleteAccount()` |
| `POST me/delete/confirm` | `confirmDeleteAccountFn` | `useConfirmDeleteAccount()` |
| `POST logout` | `logoutFn` | `useLogout()` |
| `POST logout-all` | `logoutAllFn` | `useLogoutAll()` |
| `POST refresh-token` | `refreshTokenFn` + automatic `maybeRefreshToken()` | — |
| `GET sessions` | `listSessionsFn` | `useSessions()` |
| `DELETE sessions/{id}` | `revokeSessionFn` | `useRevokeSession()` |
| `DELETE sessions` | `revokeOtherSessionsFn` | `useRevokeOtherSessions()` |
| `POST change-password` | `changePasswordFn` | `useChangePassword()` |
| `POST password/confirm` | `confirmPasswordFn` | `useConfirmPassword()` |
| `GET password/status` | `passwordStatusFn` | — |
| `GET/PUT notifications/preferences` | `get/updateNotificationPreferencesFn` | `useNotificationPreferences()` … |

Endpoints that issue tokens (`login`, `register`, `refresh-token`, `auth/*`, `logout*`) are **blocked in the `/api` proxy**. They must go through server functions so the token is saved to the HttpOnly cookie and never reaches the browser.

## 4. Calling your own API endpoints

### Server-side (SSR / loader)

```ts
// src/features/orders/api.ts
import { z } from 'zod'
import { queryOptions } from '@tanstack/react-query'
import { authedServerFn } from '#/lib/api/server-fn'

export const getOrdersFn = authedServerFn({ method: 'GET' })
  .validator(z.object({ page: z.number().default(1) }))
  .handler(({ context, data }) =>
    context.api.get<{ data: Order[] }>('v1/orders', { page: data.page }),
  )

export const ordersQuery = (page: number) =>
  queryOptions({ queryKey: ['orders', page], queryFn: () => getOrdersFn({ data: { page } }) })

// src/routes/_authed/orders.tsx
export const Route = createFileRoute('/_authed/orders')({
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersQuery(1)),
  component: () => {
    const { data } = useSuspenseQuery(ordersQuery(1))
    …
  },
})
```

`context.api` supports `get/post/put/patch/delete/request`. It adds the Bearer token, the `X-Tenant` and `X-Tenant-Domain` headers, and `X-Forwarded-For` and `User-Agent` for the real client. If Laravel returns 401, it clears the cookie.

Use `tenantServerFn` for public, tenant-scoped data (no login needed), and `userServerFn` when you also want `context.user`.

### Client-side (browser)

```ts
import { api } from '#/lib/api/client'

const { data } = useQuery({
  queryKey: ['products', search],
  queryFn: () => api.get('v1/products', { search }),
})

useMutation({ mutationFn: (body) => api.post('v1/cart', body) })
```

Requests go to `/api/v1/...` on the same origin, and the proxy adds the auth and tenant headers. A 401 anywhere invalidates the session, and the `_authed` routes then redirect to `/login`.

### Errors

Both paths throw `ApiError`. It survives the server-function boundary through a serialization adapter in `src/start.ts`.

```ts
if (isApiError(err)) {
  err.status          // 401, 403, 422, 423, 429…
  err.fieldErrors()   // { email: 'The email has already been taken.' }
  err.isPasswordConfirmationRequired // 423
}
```

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

`login`, `register`, `auth/{provider}/callback`, `auth/{provider}/token` and `refresh-token` should return the plain-text token in any of these shapes:

```jsonc
{ "token": "1|abc…", "user": { … } }
{ "data": { "token": "1|abc…", "user": { … } } }
{ "access_token": "1|abc…", "expires_at": "2026-10-23T00:00:00Z" }  // expiry optional
```

If you return `expires_at` or `expires_in`, the frontend rotates the token automatically through `refresh-token` when fewer than `TOKEN_REFRESH_THRESHOLD` seconds remain.

The frontend sends `device_name` (for example "Chrome on macOS") on login and register. Use it as the Sanctum token name, and it will appear in the sessions list.

### 6.4 Password reset links must point to the tenant domain

```php
// AppServiceProvider::boot()
ResetPassword::createUrlUsing(function ($user, string $token) {
    $domain = request()->header('X-Tenant-Domain') ?? $user->tenant->primary_domain;
    return "https://{$domain}/reset-password?token={$token}&email=".urlencode($user->email);
});
```

Do the same for email verification links if you use them.

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

Laravel sees the TanStack server's IP. The server forwards the browser IP in `X-Forwarded-For`, so add the TanStack server's IP or network to `TrustProxies` so that rate limiting and the sessions list show the real client IP.

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
