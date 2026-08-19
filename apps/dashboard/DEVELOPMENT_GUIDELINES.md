# Jawbli-Front Development Guidelines

This document serves as a comprehensive reference for development practices and standards for the jawbli-front project. It provides guidelines for maintaining consistency, scalability, and quality across the development team.

## 1. Project Architecture Overview

### Technology Stack

- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite
- **State Management**: Pinia with persisted state plugin
- **Routing**: Vue Router with automatic route generation
- **Styling**: Tailwind CSS v4 with CSS variables and custom theme
- **UI Components**: Custom UI library based on shadcn/vue patterns
- **Icons**: Unplugin-icons with Lucide icon library
- **Internationalization**: Vue I18n with automatic loading
- **Type Safety**: TypeScript
- **Database**: Supabase
- **HTTP Client**: Axios
- **Utility Libraries**: VueUse, Class Variance Authority, clsx, tailwind-merge

### Architecture Layers

The application follows a layered architecture pattern:

- **Presentation Layer**: Components, Pages, Layouts
- **Business Logic Layer**: Stores, Services, Composables
- **Data Layer**: API clients, database interactions
- **Infrastructure Layer**: Plugins, Utilities, Configuration

## 2. Vite Configuration and Plugin Rules

### Core Plugins

- **Vue Router**: Uses `unplugin-vue-router` for automatic route generation from file structure
- **Vue DevTools**: Included for development debugging
- **Layouts**: Uses `vite-plugin-vue-layouts` for layout system
- **Tailwind CSS**: Integrated via `@tailwindcss/vite` plugin
- **Auto Import**: Uses `unplugin-auto-import` for automatic imports of Vue APIs, Pinia, VueUse, and custom functions
- **Components**: Uses `unplugin-vue-components` for automatic component registration
- **Icons**: Uses `unplugin-icons` for icon imports with prefix 'i'
- **I18n**: Uses `@intlify/unplugin-vue-i18n` for internationalization
- **Image Optimization**: Uses `unplugin-imagemin` for image compression and WebP conversion

### Configuration Rules

- All aliases must be defined in the `resolve.alias` section
- Auto-imports should be configured to scan all relevant directories: utils, layouts, lib, services, types, composables, stores, and components
- Component directories must be properly configured for deep scanning and namespace usage
- Image optimization should include quality settings and conversion formats (PNG/JPG to WebP)

## 3. Component Development Rules

### Naming Conventions

- Use PascalCase for component names (e.g., `Button`, `SidebarMenuButton`)
- Use kebab-case for file names (e.g., `Button.vue`, `sidebar-menu-button.vue`)
- Use descriptive names that reflect component purpose
- Use consistent suffixes: `*Button`, `*Card`, `*Dialog`, etc.

### Component Structure

- Use `<script setup>` for all components
- Define props with TypeScript interfaces
- Use default values for optional props
- Follow the order: script setup, template, style
- Use `withDefaults` for props with default values

### Example Component Structure

```vue
<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import type { ButtonVariants } from '.'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '.'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: HTMLAttributes['class']
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
})
</script>

<template>
  <Primitive
    data-slot="button"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
```

### Component Patterns

- Use Reka UI for primitive components
- Implement class merging with `cn()` utility
- Define variants using `cva` (Class Variance Authority)
- Export components and types from index files
- Use consistent prop interfaces across component families

## 4. State Management Rules (Pinia with Composition API)

### Store Structure

- Define stores using the composition API syntax
- Use `defineStore` with arrow function syntax
- Define state in the arrow function return
- Use refs for reactive state properties
- Use computed properties for derived state
- Define actions as functions in the return object

### Example Store Structure

```typescript
import type { User } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authService } from '../services/auth.service'

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<User | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const isAuthenticated = computed(() => !!user.value)

    async function login(credentials: { email: string; password: string }) {
      loading.value = true
      error.value = null

      try {
        const response = await authService.login(credentials)
        user.value = response.user
      } catch (err: any) {
        error.value = err.message || 'Login failed'
        throw err
      } finally {
        loading.value = false
      }
    }

    return {
      user,
      loading,
      error,
      isAuthenticated,
      login,
    }
  },
  {
    persist: {
      key: 'auth',
      storage: localStorage,
      pick: ['user'], // persists only user, not loading/error
    },
  },
)
```

### State Management Best Practices

- Use descriptive store names with domain prefixes (e.g., `useAuthStore`, `useProductStore`)
- Separate concerns by creating specific stores for different domains
- Use persisted state for important user data
- Define TypeScript interfaces for state properties
- Handle errors appropriately in async actions
- Use computed properties for derived state calculations
- Implement loading states for async operations

## 5. Service Layer Development Patterns

### Service Structure

- Create services as objects with methods
- Use async/await for API operations
- Define TypeScript interfaces for request/response data
- Handle errors consistently with try/catch blocks
- Use environment variables for configuration

### Example Service Structure

```typescript
import { createClient, type User } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface LoginCredentials {
  email: string
  password: string
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<{ user: User | null; session: any }> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials)

    if (error) {
      throw new Error(error.message)
    }

    return { user: data.user, session: data.session }
  },

  // Additional methods...
}
```

### Service Best Practices

- Use consistent error handling across all services
- Define clear interfaces for request/response types
- Keep services focused on specific domains
- Separate API client configuration from business logic
- Use dependency injection patterns where appropriate
- Implement authentication headers automatically

## 6. Composable Development Best Practices

### Composable Structure

- Use descriptive names starting with 'use' (e.g., `useToast`, `useApi`)
- Return an object with reactive properties and methods
- Use refs for reactive state
- Implement proper cleanup when needed
- Follow the Vue Composition API patterns

### Example Composable Structure

```typescript
import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

export function useToast() {
  const toasts = ref<Toast[]>([])

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    duration = 3000,
  ) => {
    const id = Date.now()
    toasts.value.push({ id, message, type, duration })

    // Auto remove toast after duration
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts: toasts.value,
    showToast,
    removeToast,
  }
}
```

### Composable Best Practices

- Keep composables focused on a single responsibility
- Use reactive references for state management
- Implement proper cleanup mechanisms
- Provide clear return objects with descriptive names
- Use TypeScript for type safety
- Document usage and return values

## 7. TanStack Query Implementation Pattern

### Overview

The application uses TanStack Query (formerly React Query) for server state management. The implementation follows a composable-based pattern organized by API endpoints, replacing the previous hooks-based approach. This provides better modularity, reusability, and maintainability across the application.

### Generic API Composables

The foundational API composable functions are located in [`src/composables/api/config/useApiQuery.ts`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/config/useApiQuery.ts:1). This file contains generic functions that handle common API operations:

- `useApiQuery<TData>`: For data fetching queries with configurable query keys and URLs
- `useApiMutation<TData, TVariables>`: For create, update, and delete operations with configurable HTTP methods
- `useAuthenticatedQuery<TData>`: For queries that require authentication with automatic redirect on 401 errors

These generic functions handle common concerns like error handling, caching, and request/response transformation, providing a consistent base for entity-specific composables.

### Entity-Specific Composables Structure

Entity-specific query and mutation composables are organized in dedicated folders under [`src/composables/api/`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/). Each entity has its own directory containing all related API operations:

```
src/composables/api/
├── auth/
│   └── useAuthQuery.ts
├── products/
│   └── useProductsQuery.ts
└── config/
    └── useApiQuery.ts
```

Each entity folder contains specific query and mutation composables for that domain. For example, the products entity includes composables like `useProductsQuery`, `useProductQuery`, `useCreateProductMutation`, `useUpdateProductMutation`, and `useDeleteProductMutation`.

### Error Handling Pattern

Error handling is implemented through the [`src/composables/api/error/query-error-handler.ts`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/error/query-error-handler.ts:1) file, which provides a centralized error handling mechanism. The `queryErrorHandler` function handles different error types and displays appropriate toast notifications using the `useToast` composable. The `QueryError` class provides a consistent error format with status codes and additional data when available.

### Export Pattern

All API-related composables are exported through the index file at [`src/composables/api/index.ts`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/index.ts:1), which provides a single entry point for importing all API composables, the Vue Query client and plugin, and error handling utilities. This makes it easy to import everything needed for API operations in a single statement.

### Vue Query Configuration

Vue Query is configured in [`src/plugins/vue-query.plugin.ts`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/plugins/vue-query.plugin.ts:1) with default options for both queries and mutations. The configuration includes cache time, stale time, retry logic, and other settings that apply globally unless overridden in individual composables.

### Creating New Entity-Specific Composables

To create new entity-specific composables following this pattern:

1. Create a new folder under [`src/composables/api/`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/) with the entity name (e.g., `users`, `orders`, `categories`)
2. Create a TypeScript file in the folder (e.g., `useUsersQuery.ts`, `useOrdersQuery.ts`)
3. Import the generic API composables from [`src/composables/api/config/useApiQuery.ts`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/config/useApiQuery.ts:1)
4. Create specific query and mutation composables for the entity, using appropriate TypeScript types
5. Export all composables from the file
6. Add export statements to the main index file at [`src/composables/api/index.ts`](file:///c:/Users/PC/code/ayb/jawbli/jawbli-front/src/composables/api/index.ts:1)

Example of creating a new entity composable file structure:

```typescript
// src/composables/api/users/useUsersQuery.ts
import { useApiQuery, useApiMutation } from '@/composables/api/config/useApiQuery'
import type { User } from '@/types/user.types'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/vue-query'

export function useUsersQuery(
  options?: Omit<UseQueryOptions<User[], Error>, 'queryKey' | 'queryFn'>,
) {
  return useApiQuery<User[]>(['users'], '/users', {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

export function useUserQuery(
  id: string | number,
  options?: Omit<UseQueryOptions<User, Error>, 'queryKey' | 'queryFn'>,
) {
  return useApiQuery<User>(['users', id], `/users/${id}`, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

export function useCreateUserMutation(
  options?: Omit<UseMutationOptions<User, Error, Partial<User>>, 'mutationFn'>,
) {
  return useApiMutation<User, Partial<User>>('/users', 'post', {
    ...options,
  })
}

// Additional mutation composables...
```

This pattern ensures consistency across all API operations while maintaining the modularity and reusability required for a scalable application architecture.

## 8. Styling Rules with Tailwind CSS

### CSS Structure

- Use Tailwind CSS v4 with CSS variables
- Define custom theme in `main.css` using `@theme` directive
- Implement dark mode support with `.dark` class
- Use consistent color naming based on semantic roles
- Implement custom scrollbar styling

### Color System

- Use semantic color names: `primary`, `secondary`, `destructive`, `muted`, etc.
- Define colors using OKLCH color space for better accessibility
- Support both light and dark modes with appropriate contrast
- Use CSS variables for consistent theming

### Example CSS Structure

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* Additional color mappings... */
}
```

### Styling Best Practices

- Use `cn()` utility for class merging with Tailwind classes
- Apply consistent spacing and sizing using Tailwind utilities
- Use semantic color names instead of literal colors
- Implement responsive design with Tailwind's responsive prefixes
- Use `cva` for component variant definitions
- Follow accessibility best practices with proper contrast ratios

## 8. UI Component Development Following shadcn Patterns

### Component Architecture

- Use Reka UI for primitive components
- Implement variants with `cva` (Class Variance Authority)
- Follow the folder structure with component files and index files
- Export components and types from index files
- Use consistent prop interfaces across component families

### Example Button Component

```typescript
// index.ts
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-white shadow-xs hover:bg-destructive/90',
        // Additional variants...
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        // Additional sizes...
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
```

### UI Component Best Practices

- Use consistent naming for variants and sizes
- Implement proper accessibility attributes
- Follow shadcn/vue design patterns
- Use proper TypeScript typing for all components
- Implement proper focus management
- Ensure components are fully customizable through props

## 9. Code Quality Standards

### TypeScript Usage

- Use strict TypeScript with proper type definitions
- Define interfaces for all complex data structures
- Use type guards for runtime type checking
- Implement proper error handling with typed errors
- Use generic types where appropriate

### ESLint and Code Formatting

- Use ESLint with Vue and TypeScript configurations
- Apply Prettier for consistent code formatting
- Follow the Oxlint rules for correctness
- Maintain consistent import ordering
- Use proper component naming conventions

### Code Organization

- Keep files focused on single responsibilities
- Use proper directory structure (components, composables, stores, services)
- Follow consistent file naming conventions
- Maintain clean separation of concerns
- Use proper module exports and imports

## 10. File Structure and Organization Guidelines

### Directory Structure

```
src/
├── assets/                 # Static assets and styles
│   └── styles/
│       └── main.css        # Main CSS file
├── components/            # Reusable UI components
│   ├── ui/               # shadcn-style components
│   └── theme/            # Theme-related components
├── composables/          # Vue composition functions
├── layouts/              # Page layouts
├── lib/                  # Utility functions
│   └── utils.ts          # Utility functions
├── locales/              # Internationalization files
├── pages/                # Route components
├── plugins/              # Vue plugins
├── router/               # Routing configuration
├── services/             # API service layers
├── stores/               # Pinia stores
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

### File Organization Rules

- Group related functionality in appropriate directories
- Use index files to export components and utilities
- Maintain consistent naming across all directories
- Separate business logic from presentation components
- Use proper TypeScript declaration files

## 11. Layer Architecture Rules

### Presentation Layer

- Components and pages that handle UI rendering
- Should not contain business logic
- Communicate with stores and composables
- Use props and events for data flow

### Business Logic Layer

- Stores for state management
- Services for API communication
- Composables for reusable logic
- Should contain domain-specific business rules

### Data Layer

- API clients and database interactions
- Should abstract away implementation details
- Handle data transformation and validation
- Implement proper error handling

### Infrastructure Layer

- Plugins, utilities, and configuration
- Should not contain business logic
- Provide common functionality to other layers
- Handle cross-cutting concerns

## 12. Internationalization Practices

### Implementation

- Use Vue I18n for internationalization
- Automatic loading of locale files via plugin
- Support for Arabic, English, and French
- Use `@intlify/unplugin-vue-i18n` for efficient loading

### Locale Files

- Store translations in `src/locales/` directory
- Use consistent key naming conventions
- Support for RTL languages (like Arabic)
- Maintain consistency across all languages

### Best Practices

- Use descriptive translation keys
- Support pluralization when needed
- Handle date and number formatting appropriately
- Consider RTL layout requirements for Arabic
- Test all languages during development

This comprehensive guide provides the foundation for consistent, maintainable, and scalable development in the jawbli-front project. All developers should follow these guidelines to ensure code quality and team productivity.
