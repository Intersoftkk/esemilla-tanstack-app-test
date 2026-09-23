import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { unwrapData } from '#/lib/api/types'
import type { Feature, Plan } from '../types/plans.types'
import { getFeatureFn, getFeaturesFn, getPlanFn, getPlansFn } from '../utils/plans.functions'
import { featureKeys, planKeys } from './plans.keys'

// SERVER-SIDE (server function) — used by route loaders for SSR.
export const plansQueryOptions = () =>
  queryOptions({
    queryKey: planKeys.list(),
    queryFn: () => getPlansFn(),
    staleTime: 10 * 60 * 1000,
  })

export const planQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: planKeys.detail(slug),
    queryFn: () => getPlanFn({ data: { slug } }),
    staleTime: 10 * 60 * 1000,
  })

export const featuresQueryOptions = () =>
  queryOptions({
    queryKey: featureKeys.list(),
    queryFn: () => getFeaturesFn(),
    staleTime: 10 * 60 * 1000,
  })

// CLIENT-SIDE (browser -> /api proxy -> Laravel) — fetched on demand.
export const featureQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: featureKeys.detail(slug),
    queryFn: async () =>
      typeof window === 'undefined'
        ? getFeatureFn({ data: { slug } })
        : unwrapData<Feature>(await api.get(`v1/features/${encodeURIComponent(slug)}`)),
    staleTime: 10 * 60 * 1000,
  })

export type { Feature, Plan }
