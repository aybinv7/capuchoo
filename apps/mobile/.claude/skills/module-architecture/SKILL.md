---
name: module-architecture
description: Where code goes in this app and how to add a feature end to end. Use when creating a new screen, module, route, domain, repository, composable, or when deciding whether something belongs in modules, domains or shared. Covers the dependency direction, the file layout of a module, and the checklist for wiring a feature into the shell.
---

# Module architecture

```
src/
├── app/tabs.ts                        the tab bar, as data
├── router/index.ts                    aggregates module routes, catch-all last
├── domains/<domain>/<x>.repository.ts SQL only
├── modules/<feature>/
│   ├── router/routes/<feature>.routes.ts
│   ├── views/<Name>View.vue
│   ├── components/*.vue
│   └── composables/use*.ts
└── shared/                            what two modules genuinely both need
```

## The seam

| Layer      | Owns                                    | Never contains                               |
| ---------- | --------------------------------------- | -------------------------------------------- |
| View       | Wiring a composable to components       | Business logic, SQL                          |
| Composable | State, queries, actions for one feature | Markup                                       |
| Repository | Plain functions over Kysely             | `ref`, lifecycle, Framework7, module imports |
| Component  | Props in, emits out                     | Database access                              |

Dependencies run **modules → domains → shared → packages**, never backwards. A repository importing
from a module, or `shared` importing from `modules`, means something is in the wrong place.

## Adding a feature

1. `modules/<feature>/` with the four folders. Templates: [file-templates.md](file-templates.md).
2. SQL in `domains/<domain>/<domain>.repository.ts`, taking the database as its first parameter.
3. Routes in `modules/<feature>/router/routes/<feature>.routes.ts`, default-exported, registered in
   `src/router/index.ts` **before** the global catch-all.
4. A tab in `src/app/tabs.ts` only if it is a top-level section — with both `iconIos` and `iconMd`.
   Otherwise it is a pushed page, and pushed pages call `useHiddenTabbar()`.
5. Strings in **both** `locales/en.json` and `locales/fr.json`. A missing key renders as the key.
   Remember `@` and `|` are message syntax.
6. A test in `tests/` for anything with SQL.
7. `vp check`, `vp test`, `pnpm type-check`.

## shared/ is not a junk drawer

Something moves to `shared/` when a second module imports it **today**. The test: name the second
caller. If you cannot, it lives in the module that uses it.

## Auto-imports

`ref`, `computed`, `watch`, lifecycle hooks, `useI18n`, `@vueuse/core`, `f7`, `f7ready` and
everything under `shared/composables`, `shared/utils`, `plugins` and `modules/**/composables` are
auto-imported — no import line. Components under `shared/components` and `modules/**/{views,components}`
resolve the same way.

Two things are **not** auto-imported and must be declared:

- `f7route` / `f7router` — Framework7 passes them to a route component as props.
- Repositories and anything under `domains/` — imported explicitly, because a domain is a boundary
  you should see being crossed.

`auto-imports.d.ts` and `components.d.ts` are generated. Never hand-edit them; if the editor
disagrees with the build, run the dev server once to regenerate.
