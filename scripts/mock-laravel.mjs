#!/usr/bin/env node
/**
 * Tiny mock of the Laravel API for local development / testing.
 *
 *   node scripts/mock-laravel.mjs            # listens on :8000
 *   LARAVEL_API_URL=http://localhost:8000/api
 *
 * Tenants: acme.example.com, globex.example.com, shop.acme.com (alias of acme),
 *          suspended.example.com (inactive)
 * Users:   demo@acme.test / password   (tenant acme)
 *          demo@globex.test / password (tenant globex)
 */
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'

const PORT = Number(process.env.MOCK_PORT ?? 8000)

const tenants = [
  { id: 't_acme', name: 'Acme Inc', domains: ['acme.example.com', 'shop.acme.com'], active: true },
  { id: 't_globex', name: 'Globex', domains: ['globex.example.com'], active: true },
  { id: 't_susp', name: 'Suspended Co', domains: ['suspended.example.com'], active: false },
]

let nextUserId = 3
const users = [
  { id: 1, tenant_id: 't_acme', name: 'Acme Demo', email: 'demo@acme.test', password: 'password' },
  { id: 2, tenant_id: 't_globex', name: 'Globex Demo', email: 'demo@globex.test', password: 'password' },
]
/** token -> { id, userId, tenantId, name, ip, ua, created, lastUsed } */
const tokens = new Map()

const features = [
  { id: 1, slug: 'projects', name: 'Unlimited projects', description: 'Create as many projects as you need.' },
  { id: 2, slug: 'sso', name: 'Single sign-on', description: 'SAML / OIDC SSO for your whole team.' },
  { id: 3, slug: 'audit-log', name: 'Audit log', description: 'Every change, who made it and when.' },
  { id: 4, slug: 'priority-support', name: 'Priority support', description: '24/7 support with a 1h response SLA.' },
]
const plans = [
  { id: 1, slug: 'free', name: 'Free', price: 0, currency: 'USD', interval: 'month', description: 'For individuals getting started.', features: [{ slug: 'projects', name: 'Unlimited projects' }] },
  { id: 2, slug: 'pro', name: 'Pro', price: 19, currency: 'USD', interval: 'month', is_popular: true, description: 'For growing teams.', features: [{ slug: 'projects', name: 'Unlimited projects' }, { slug: 'audit-log', name: 'Audit log' }] },
  { id: 3, slug: 'enterprise', name: 'Enterprise', price: null, currency: 'USD', interval: null, description: 'Security and support at scale.', features: features.map(({ slug, name }) => ({ slug, name })) },
]
const prefs = new Map()

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, email_verified_at: null })

function issueToken(user, req, deviceName) {
  const id = tokens.size + 1 + Math.floor(Math.random() * 1e6)
  const plain = `${id}|${randomBytes(20).toString('hex')}`
  tokens.set(plain, {
    id,
    userId: user.id,
    tenantId: user.tenant_id,
    name: deviceName || 'unknown',
    ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress,
    ua: req.headers['user-agent'],
    created: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
  })
  return plain
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString()
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const validation = (res, errors) =>
  send(res, 422, { message: Object.values(errors)[0][0], errors })

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname.replace(/^\/api\//, '')
  const method = req.method
  const tenantId = req.headers['x-tenant']
  console.log(`${method} ${url.pathname}${url.search}  tenant=${tenantId ?? '-'}`)

  // ---- tenants/check ------------------------------------------------------
  if (method === 'GET' && path === 'v1/tenants/check') {
    const domain = url.searchParams.get('domain')
    const t = tenants.find((x) => x.domains.includes(domain))
    if (!t) return send(res, 404, { message: 'Tenant not found.' })
    return send(res, 200, {
      data: { id: t.id, name: t.name, domain, is_active: t.active, settings: { theme: 'green' } },
    })
  }

  const tenant = tenants.find((t) => t.id === tenantId)
  if (!tenant) return send(res, 400, { message: 'Missing or invalid X-Tenant header.' })

  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? await readBody(req) : {}

  // ---- guest --------------------------------------------------------------
  if (method === 'POST' && path === 'v1/user/login') {
    const u = users.find((x) => x.tenant_id === tenant.id && x.email === body.email)
    if (!u || u.password !== body.password) {
      return validation(res, { email: ['These credentials do not match our records.'] })
    }
    return send(res, 200, { data: { user: publicUser(u), token: issueToken(u, req, body.device_name) } })
  }
  if (method === 'POST' && path === 'v1/user/register') {
    const errors = {}
    if (!body.name) errors.name = ['The name field is required.']
    if (!body.email) errors.email = ['The email field is required.']
    if (users.some((x) => x.tenant_id === tenant.id && x.email === body.email)) {
      errors.email = ['The email has already been taken.']
    }
    if (Object.keys(errors).length) return validation(res, errors)
    const u = { id: nextUserId++, tenant_id: tenant.id, name: body.name, email: body.email, password: body.password }
    users.push(u)
    return send(res, 201, { user: publicUser(u), token: issueToken(u, req, body.device_name) })
  }
  if (method === 'POST' && path === 'v1/user/forgot-password') {
    return send(res, 200, { message: 'We have emailed your password reset code (mock: 123456).' })
  }
  if (method === 'POST' && path === 'v1/user/reset-password') {
    // Link mode: token 'valid'. OTP mode: code 123456 (sent as token/otp/code).
    const code = body.otp ?? body.code ?? body.token
    if (code !== 'valid' && code !== '123456') {
      return validation(res, { otp: ['The code is invalid or has expired.'] })
    }
    const u = users.find((x) => x.tenant_id === tenant.id && x.email === body.email)
    if (!u) return validation(res, { email: ["We can't find a user with that email address."] })
    if (body.password !== body.password_confirmation) {
      return validation(res, { password: ['The password field confirmation does not match.'] })
    }
    u.password = body.password
    return send(res, 200, { message: 'Your password has been reset.' })
  }
  const social = path.match(/^v1\/user\/auth\/([a-z]+)$/)
  if (method === 'GET' && social) {
    const cb = url.searchParams.get('redirect_uri')
    const state = url.searchParams.get('state')
    // Pretend the provider immediately calls back with a code.
    return send(res, 200, { url: `https://provider.example/oauth?redirect_uri=${encodeURIComponent(cb)}&state=${state}` })
  }

  const socialCb = path.match(/^v1\/user\/auth\/([a-z]+)\/callback$/)
  if (method === 'GET' && socialCb) {
    if (!url.searchParams.get('code')) return send(res, 422, { message: 'Missing code.' })
    const u = users.find((x) => x.tenant_id === tenant.id)
    return send(res, 200, { user: publicUser(u), token: issueToken(u, req, url.searchParams.get('device_name')) })
  }

  const socialTok = path.match(/^v1\/user\/auth\/([a-z]+)\/token$/)
  if (method === 'POST' && socialTok) {
    if (!body.access_token && !body.token) return validation(res, { access_token: ['The access token field is required.'] })
    const u = users.find((x) => x.tenant_id === tenant.id)
    return send(res, 200, { user: publicUser(u), token: issueToken(u, req, body.device_name) })
  }

  // ---- public catalogue ---------------------------------------------------
  if (method === 'GET' && path === 'v1/plans') return send(res, 200, { data: plans })
  if (method === 'GET' && path === 'v1/features') return send(res, 200, { data: features })
  const planSlug = path.match(/^v1\/plans\/([\w-]+)$/)
  if (method === 'GET' && planSlug) {
    const p = plans.find((x) => x.slug === planSlug[1])
    return p ? send(res, 200, { data: p }) : send(res, 404, { message: 'Plan not found.' })
  }
  const featureSlug = path.match(/^v1\/features\/([\w-]+)$/)
  if (method === 'GET' && featureSlug) {
    const f = features.find((x) => x.slug === featureSlug[1])
    return f ? send(res, 200, { data: f }) : send(res, 404, { message: 'Feature not found.' })
  }

  // ---- authenticated ------------------------------------------------------
  const auth = req.headers.authorization?.replace(/^Bearer /, '')
  const tok = auth && tokens.get(auth)
  if (!tok || tok.tenantId !== tenant.id) return send(res, 401, { message: 'Unauthenticated.' })
  tok.lastUsed = new Date().toISOString()
  const user = users.find((u) => u.id === tok.userId)

  if (method === 'GET' && path === 'v1/user/me') return send(res, 200, { data: publicUser(user) })
  if (method === 'POST' && path === 'v1/user/logout') {
    tokens.delete(auth)
    return send(res, 200, { message: 'Logged out.' })
  }
  if (method === 'POST' && path === 'v1/user/change-password') {
    if (body.current_password !== user.password) {
      return validation(res, { current_password: ['The password is incorrect.'] })
    }
    user.password = body.password
    return send(res, 200, { message: 'Password changed.' })
  }
  if (method === 'POST' && path === 'v1/user/password/confirm') {
    if (body.password !== user.password) return validation(res, { password: ['The password is incorrect.'] })
    tok.confirmedAt = Date.now()
    return send(res, 200, { message: 'Password confirmed.' })
  }
  if (method === 'GET' && path === 'v1/user/password/status') {
    return send(res, 200, {
      data: { has_password: true, confirmed_recently: Date.now() - (tok.confirmedAt ?? 0) < 3 * 60 * 60 * 1000 },
    })
  }
  if (path === 'v1/user/notifications/preferences') {
    const current = prefs.get(user.id) ?? { email_marketing: false, email_security: true, push: true }
    if (method === 'GET') return send(res, 200, { data: current })
    if (method === 'PUT') {
      prefs.set(user.id, { ...current, ...body })
      return send(res, 200, { message: 'Preferences saved.' })
    }
  }

  send(res, 404, { message: `Mock: no route for ${method} ${path}` })
}).listen(PORT, () => console.log(`Mock Laravel API on http://localhost:${PORT}/api`))

