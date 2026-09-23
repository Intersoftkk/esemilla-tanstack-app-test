import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '#/lib/api/errors'
import { authKeys } from '#/features/auth/queries/auth.keys'

export function getContext() {
  const onError = (error: unknown) => {
    // Token expired/revoked while the app was open -> refresh session state,
    // which makes `_authed` routes redirect to /sign-in.
    if (
      typeof window !== 'undefined' &&
      isApiError(error) &&
      error.status === 401
    ) {
      void queryClient.invalidateQueries({ queryKey: authKeys.session() })
    }
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) {
            return false
          }
          return failureCount < 2
        },
      },
    },
  })

  return {
    queryClient,
  }
}
