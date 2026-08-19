# Capgo-Updater Frontend Project Documentation

## Project Overview

This project is a Vue 3 frontend application that serves as a management interface for Capgo updates and bundles. It's designed to be a scalable and maintainable solution following modern Vue 3 patterns.

## Architecture

### Tech Stack

- Vue 3.5+ with Composition API
- TypeScript strict mode
- Vite as build tool
- Pinia for state management
- Tailwind CSS 4 with custom shadcn-style components
- TanStack Query (Vue Query) for server state management
- Vue Router with automatic routing
- Unplugin ecosystem for auto-imports and components

### Project Structure

```
src/
├── assets/                 # Static assets
├── components/             # Reusable UI components
│   └── ui/                 # shadcn-style components
├── composables/            # Vue composition functions
│   └── api/                # API query/mutation composables
├── layouts/                # Page layouts
├── lib/                    # Utility functions
├── locales/                # Internationalization files
├── modules/                # Feature modules (organized by domain)
│   └── updates-bundles/    # Updates and bundles feature module
├── pages/                  # Route components
├── plugins/                # Vue plugins
├── router/                 # Routing configuration
├── services/               # API service layers
├── stores/                 # Pinia stores
└── types/                  # TypeScript type definitions
```

### Module Architecture

Each feature module follows this pattern:

```
module-name/
├── components/         # Module-specific components
├── composables/        # Module-specific composables
├── config/             # Module-specific configuration
├── stores/             # Module-specific stores
├── types/              # Module-specific types
└── index.ts            # Module exports
```

## Key Implementation Patterns

### API Composables

- Named with `useCapgo` prefix to avoid conflicts
- Follow the pattern: `useCapgo{FeatureName}Query` for queries and `useCapgo{FeatureName}Mutation` for mutations
- Use the centralized `useApiQuery` and `useApiMutation` functions from the config

### Component Architecture

- Use the `h` function for creating dynamic components in table definitions
- Implement advanced features like filtering, sorting, pagination in the table components
- Keep components generic and reusable via props

### State Management

- Use Pinia stores with the `defineStore` function
- Follow the pattern of keeping related state, getters, and actions in one store
- Use TypeScript for strong typing of state

### Routing

- Use automatic routing via `unplugin-vue-router`
- Route components in the `pages/` directory are automatically registered
- Use route meta for page metadata

## Updates & Bundles Module Specifics

### Pages

- `/updates-bundles` - Main page showing both bundles and native updates with filtering
- `/updates-bundles/new` - Page for adding new updates/bundles
- `/bundles/upload` - Upload form for bundles
- `/native-updates/upload` - Upload form for native updates

### Filtering

- Type filter (bundle/native)
- Channel filter (prod/staging/dev)
- Platform filter (android/ios/web)
- Environment filter (prod/staging/dev)

### Components

- `UpdatesBundlesTable` - Main table component with advanced features
- `UpdatesBundlesHeader` - Page header component
- Bulk operation components (edit, delete, export)

### Naming Convention

- All composables prefixed with `useCapgo`
- Components follow PascalCase with module prefix where appropriate
- Table columns and data structures are strongly typed

## Best Practices Applied

1. **Modularity**: Each feature organized in its own module
2. **Type Safety**: Strong TypeScript typing throughout
3. **Reusability**: Generic components that can be used across features
4. **Maintainability**: Clear separation of concerns
5. **Scalability**: Architecture that supports adding new features easily
6. **Performance**: Efficient state management and component rendering
7. **Consistency**: Following established patterns across the codebase

## Development Guidelines

### Adding New Features

1. Create a new module directory under `src/modules/`
2. Follow the same subdirectory structure (components, composables, config, stores, types)
3. Create a central index.ts file to export all module functionality
4. Add routing via file-based routing in the `pages/` directory
5. Update navigation in the sidebar as needed

### Component Development

1. Use existing shadcn-vue registry components before creating new ones
2. Implement proper error handling
3. Use storeToRefs when accessing store properties in components
4. Check existing auto-imports before adding manual imports
5. Follow accessibility best practices

### API Integration

1. Use TanStack Query for server state management
2. Implement generic API composables for common operations
3. Follow centralized error handling patterns
4. Use proper loading states for async operations

This documentation captures the approach used for building the Capgo-Updater frontend with a focus on scalability, maintainability, and modularity.
