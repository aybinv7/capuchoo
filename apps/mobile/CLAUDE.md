# App instructions

An offline-first mobile app: Vue 3 + Framework7 + Capacitor over a local SQLite database that
screens read reactively. Generated from `@cavulsqa/template-f7-app`.

**SQLite is the source of truth.** There is no server in this template. A screen reads the local
database and a write to the local database refreshes it. If you add a backend, it syncs _into_
SQLite — it does not become the thing screens read.

## Stack

Vue 3.5 `<script setup lang="ts">` · Framework7 9 (+ framework7-vue 8) · Capacitor 8 (Android
first) · Kysely over SQLite in an OPFS worker · vue-i18n · Tailwind 4 · Vite+ (`vp`).

Data layer comes from three published packages, not from this repo:

| Package                  | What it gives you                                             |
| ------------------------ | ------------------------------------------------------------- |
| `@cavulsqa/mobile-db`    | The OPFS worker dialect, migrations, transaction-aware writes |
| `@cavulsqa/reactive-db`  | Change bus, result cache, visibility gate, query metrics      |
| `@cavulsqa/reactive-vue` | `useReactiveQuery` and the Framework7 page-visibility adapter |

Do not vendor or fork them. If one is wrong, fix it there and bump the version.

## Layout

```
src/
├── app/            tabs.ts — the tab bar as data
├── router/         index.ts aggregates module routes; global/ holds the catch-all
├── domains/        <domain>/<domain>.repository.ts — SQL, no Vue
├── modules/        <feature>/{router/routes,views,components,composables}
├── shared/         database/, composables/, components/, utils/
├── plugins/        framework7, capacitor/, i18n, sqlite bootstrap
└── locales/        en.json, fr.json
```

A module owns its routes, views, components and composables. A `domain` owns SQL and nothing else —
no `ref`, no lifecycle, no Framework7. `shared` is for things two modules genuinely both need;
"might need later" is not a reason to put something there.

## Hard rules

Detailed rules live in `.claude/rules/`, and `.claude/skills/` holds the workflows:

| Skill                 | Reach for it when                                                      |
| --------------------- | ---------------------------------------------------------------------- |
| `f7-design`           | Building or changing any screen, component or layout                   |
| `reactive-data`       | Any query, mutation, repository, migration, or a screen not refreshing |
| `module-architecture` | Adding a feature, or deciding where a file belongs                     |

The short version of the rules, each earned by a real bug:

- **Never import an `f7-*` component.** `Framework7VueResolver` imports it where it is used. A
  manual import is a merge conflict with the resolver and a sign you did not read
  `.claude/rules/framework7-ui.md`.
- **Never write a CSS background, height or safe-area rule.** Framework7's theme owns those.
  `assets/css/app.css` is one line — the Tailwind import — and `icons.css` is font wiring. If a
  screen looks wrong, you are fighting the theme, not missing CSS.
- **An icon name is verified against the font, never guessed.** framework7-icons is a ligature
  font: a wrong name renders _nothing at all_, silently. `tests/icons.test.ts` checks every name in
  the app against the ttf. Run it.
- **A reactive query's `tables` must list exactly what its function reads.** Under-list and the
  screen goes stale with no error. See `.claude/rules/data-fetching.md`.
- **Every write goes through `rdb`**, never `getDatabase().db`. `rdb` announces the tables it
  touched; a raw write is invisible to every query watching them.
- **`queryKey` is an identity built from arguments**, not a label: `["demo:order", orderId]`.
  Refs in the key are tracked, so a filter belongs in it rather than in a manual `refetch()`.
- **An inserted id comes from `insertId`, never `.returning(...)`.** Inside a transaction the
  SQLite plugin executes the statement and drops its RETURNING rows, so the insert succeeds and
  kysely reports `no result`. See `.claude/rules/database.md`.
- **Money is integer cents.** A float total is a rounding bug waiting to happen.
- **`f7route` and `f7router` are props**, not imports: `defineProps<{ f7route: Router.Route }>()`.
- **A route loads its component through `lazyRoute`**, never a bare `import().then(resolve)`.
  Framework7 locks the router before calling the hook and only unlocks it from `resolve` or
  `reject`; a hook that settles neither — one failed chunk — freezes that view for the session.
- **In locale files, `@` and `|` are message syntax.** `@` starts a linked message and `|` a plural
  branch. A literal `@` must be `{'@'}` or the whole locale file fails to compile.
- **No comments that narrate.** A comment explains a non-obvious _why_ — a platform quirk, an
  invariant, a measured trade-off. Never what the next line does, never a task reference.

## Verification

```bash
vp check          # format, lint, type-check the workspace
vp test           # the repository and icon tests
pnpm type-check   # vue-tsc, the gate for anything touching .vue
```

`vp check` is the type gate for `vite.config.ts`; `vue-tsc` covers `src`. Both must pass.

There is deliberately no `tsconfig.node.json`. A `tsc` project over `vite.config.ts` cannot be
clean either way: with `skipLibCheck` on, Vite's deeply recursive `PluginOption` union blows the
comparison depth limit on the plugin array; with it off, vite-plus-core's own declarations fail on
optional peers it does not ship. Nothing in this repository runs `tsc`, and an editor with no
project reports the file clean - so the config only ever added a red squiggle and a wrong
explanation. `vp check` resolves it correctly and is the authority.

**Type-checking is not verification for UI.** A screen that compiles can still render an empty
box — that is how seven invisible icons and a blank-page bootstrap both shipped. If you changed
something visual, say plainly that you have not seen it run.

## What not to do

- Do not add a state library. Two composables and the change bus cover this app; Pinia earns its
  place when there is cross-module state that outlives a screen, not before.
- Do not add a data-fetching library. If you need a shared cache across screens, read the note in
  `@cavulsqa/reactive-vue`'s README about driving TanStack Query from the bus rather than growing
  `useReactiveQuery`.
- Do not assume the toolchain. Capacitor 8 compiles against **JDK 21** - an older default JDK
  fails with `invalid source release: 21` from inside capacitor-android, which reads as a
  Capacitor bug and is not one.
- Do not build for the web. `vp dev` in a browser runs sql.js in memory so the app is inspectable;
  the target is a device, and anything that only works in a browser is not done.
