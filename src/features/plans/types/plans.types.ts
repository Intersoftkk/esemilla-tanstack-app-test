import type { Json } from '#/lib/api/types'

export interface Plan {
  id: string | number
  slug: string
  name: string
  description?: string | null
  price?: number | string | null
  currency?: string | null
  interval?: string | null
  features?: Array<PlanFeatureRef | string>
  is_popular?: boolean
  [key: string]: Json | undefined | Array<PlanFeatureRef | string>
}

export interface PlanFeatureRef {
  slug?: string
  name: string
  value?: Json
}

export interface Feature {
  id: string | number
  slug: string
  name: string
  description?: string | null
  [key: string]: Json | undefined
}
