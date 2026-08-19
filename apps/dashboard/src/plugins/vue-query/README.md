# Vue Query Integration

This project uses Vue Query (TanStack Query) for server state management, data fetching, caching, and synchronization.

## Setup

Vue Query is configured in `src/plugins/vue-query.plugin.ts` and is automatically registered in `src/main.ts`. The configuration includes:

- Default cache time: 5 minutes
- Default stale time: 1 minute
- Retry failed queries/mutations up to 3 times
- Exponential backoff retry delay (max 30 seconds)
- Disabled refetch on window focus/reconnect by default
- Custom error handling with toast notifications

## Usage

### Basic Queries

Use the generic `useApiQuery` hook for simple API calls:

```typescript
import { useApiQuery } from '@/hooks'

const { data, isLoading, error } = useApiQuery<Product[]>(['products'], '/products')
```

### Specific Entity Queries

For specific entities like products, use the pre-built hooks:

```typescript
import { useProductsQuery, useProductQuery } from '@/hooks'

// Get all products
const productsQuery = useProductsQuery()

// Get specific product
const productQuery = useProductQuery('123')
```

### Mutations

Use the generic `useApiMutation` hook for API mutations:

```typescript
import { useApiMutation } from '@/hooks'

const createProductMutation = useApiMutation<Product, Partial<Product>>('/products', 'post')

// Execute mutation
createProductMutation.mutate(
  { name: 'New Product', price: 19.99 },
  {
    onSuccess: (data) => {
      console.log('Product created:', data)
      // Optionally invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error) => {
      console.error('Failed to create product:', error)
    },
  },
)
```

### Pre-built Mutations

Use specific mutation hooks for common operations:

```typescript
import {
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from '@/hooks'

const createMutation = useCreateProductMutation({
  onSuccess: (data) => {
    // Handle success
    queryClient.invalidateQueries({ queryKey: ['products'] })
  },
})
```

### Authentication

For authenticated API calls, use the `useAuthenticatedQuery` hook which handles 401 errors automatically:

```typescript
import { useAuthenticatedQuery } from '@/hooks'

const profileQuery = useAuthenticatedQuery<User>(['profile'], '/profile')
```

## Error Handling

Errors are handled through the centralized `queryErrorHandler` utility which:

- Logs errors to the console
- Shows toast notifications via the useToast composable
- Handles specific error types (like 401 Unauthorized)
- Provides custom error types for better error handling

## TypeScript Support

All hooks are fully typed with proper TypeScript support. The hooks use the project's existing type definitions from `src/types/` directory.

## Best Practices

1. Use specific entity hooks (like `useProductsQuery`) when possible for consistency
2. Use the generic hooks (`useApiQuery`, `useApiMutation`) for one-off queries
3. Always handle success and error cases in mutations
4. Use `queryClient.invalidateQueries` after mutations to refresh data
5. Leverage the built-in caching and refetching mechanisms
6. Use the `enabled` option to conditionally execute queries
