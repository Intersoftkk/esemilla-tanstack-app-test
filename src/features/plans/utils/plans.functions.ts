/**
 * SERVER-SIDE calls for the public catalogue endpoints:
 *   GET v1/plans, GET v1/plans/{slug}, GET v1/features, GET v1/features/{slug}
 *
 * Run on the TanStack Start server (SSR + route loaders). `context.api`
 * adds the tenant headers (and the Bearer token if the visitor is signed in,
 * so Laravel can personalise the response if it wants).
 */
import { z } from 'zod'
import { tenantServerFn } from '#/features/auth/utils/auth.functions'
import { toJson, unwrapData } from '#/lib/api/types'
import type { Feature, Plan } from '../types/plans.types'

const slug = z.object({ slug: z.string().min(1).max(191) })

const asList = <T,>(body: unknown) => {
  const data = unwrapData(body)
  return (Array.isArray(data) ? toJson(data) : []) as unknown as Array<T>
}

export const getPlansFn = tenantServerFn({ method: 'GET' }).handler(
  async ({ context }) => asList<Plan>(await context.api.get('v1/plans')),
)

export const getPlanFn = tenantServerFn({ method: 'GET' })
  .validator(slug)
  .handler(
    async ({ context, data }) =>
      toJson(unwrapData(await context.api.get(`v1/plans/${encodeURIComponent(data.slug)}`))) as unknown as Plan,
  )

export const getFeaturesFn = tenantServerFn({ method: 'GET' }).handler(
  async ({ context }) => asList<Feature>(await context.api.get('v1/features')),
)

export const getFeatureFn = tenantServerFn({ method: 'GET' })
  .validator(slug)
  .handler(
    async ({ context, data }) =>
      toJson(
        unwrapData(await context.api.get(`v1/features/${encodeURIComponent(data.slug)}`)),
      ) as unknown as Feature,
  )
