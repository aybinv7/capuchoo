# Modules, domains and shared

```
modules/<feature>/router/routes/<feature>.routes.ts   default export, Router.RouteParameters[]
modules/<feature>/views/<Name>View.vue                thin, presentational
modules/<feature>/components/*.vue                    props in, emits out
modules/<feature>/composables/use*.ts                 the feature's state and actions
domains/<domain>/<domain>.repository.ts               SQL only
shared/…                                              what two modules genuinely both need
```

## The seam

A **view** wires a composable to components. If it holds business logic, that logic belongs in the
composable; if it holds SQL, that belongs in a repository.

A **composable** owns state, queries and actions for one feature. It may import repositories and
the reactive query helpers. It returns refs and functions, never markup.

A **repository** is plain functions over Kysely. No `ref`, no lifecycle, no Framework7, no imports
from `modules/`. It takes the database as a parameter — that is what makes it testable, and reaching
for the singleton instead is what made the first version of this template untestable.

A **component** takes props and emits events. It does not query the database.

## Direction of dependencies

`modules → domains → shared → packages`. Never backwards. A repository importing from a module, or
`shared` importing from `modules`, means something is in the wrong place.

## Adding a feature

1. `modules/<feature>/` with the four folders.
2. Its routes in `router/routes/<feature>.routes.ts`, registered in `src/router/index.ts` before the
   global catch-all.
3. A tab in `src/app/tabs.ts` only if it is a top-level section. Otherwise it is a pushed page, and
   pushed pages call `useHiddenTabbar()`.
4. Strings in **both** `locales/en.json` and `locales/fr.json`. A missing key renders the key.

## shared/ is not a junk drawer

Something goes in `shared/` when two modules import it today. Not when one module might later. The
test is: can you name the second caller? If not, it lives in the module that uses it.
