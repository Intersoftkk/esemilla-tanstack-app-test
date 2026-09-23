export const planKeys = {
  all: ['plans'] as const,
  list: () => [...planKeys.all, 'list'] as const,
  detail: (slug: string) => [...planKeys.all, 'detail', slug] as const,
}

export const featureKeys = {
  all: ['features'] as const,
  list: () => [...featureKeys.all, 'list'] as const,
  detail: (slug: string) => [...featureKeys.all, 'detail', slug] as const,
}
