# Framework7 UI

Framework7 owns the look. Your job is to compose its components, not to restyle them.

## Components arrive by resolver

`Framework7VueResolver` (in `vite.config.ts`, implemented in
`src/shared/utils/resolvers/resolvers.ts`) imports each `f7-*` component where it is used. So:

- Never write `import { f7Page } from "framework7-vue"`.
- Never call `registerComponents`.
- Use PascalCase tags: `<F7Page>`, `<F7ListItem>`, `<F7BlockTitle>`.

If a component renders as an unknown element, its kebab name is missing from the resolver's list —
add it there. Do not add a name the installed `framework7-vue` does not export: `f7-toolbar-pane`
is a Framework7 9 CSS class with no Vue component in framework7-vue 8, and resolving it fails as a
runtime `SyntaxError`, not a warning. Check the package's exports before adding.

`f7`, `f7ready` and `theme` are auto-imported. `f7route` and `f7router` are **not** — Framework7
passes them to a route component as props:

```ts
const props = defineProps<{ f7route: Router.Route; f7router: Router.Router }>();
```

## Write no CSS

No backgrounds, no heights, no safe-area padding, no font sizes for body text. Framework7's theme
provides all of it for both iOS and Material, light and dark. `app.css` is one line.

Tailwind is available for layout and spacing inside a component — flex, grid, gaps, a text size on
a number. The moment you reach for a colour or a background, stop: use a Framework7 component or a
theme variable.

## Lists

`F7ListItem` renders `subtitle`, `text` and `#media` **only in a media list**. Outside one they are
dropped silently — the quantity line on the order detail vanished exactly this way.

- Short label + value: a plain `F7List` with `title` and `after`.
- Anything with a description: `F7List media-list`, value in `subtitle`, prose in `#text`.
- `item-footer` is sized for a few words. Long text in it overlaps the title, and a long `after`
  squeezes the text into a one-word-per-line column.

## Icons

framework7-icons is a **ligature font**: a wrong name renders nothing at all — no warning, no
fallback, no console message. This template has shipped invisible icons twice.

- Verify against the font, never from memory, another icon set, or a filename in the package. The
  React components in `framework7-icons/react` are SVG wrappers whose names do **not** match the
  ligatures — trusting them broke four working icons.
- The name keeps the underscore before a digit: `arrow_2_circlepath`, `square_grid_2x2_fill`.
- SF Symbols names are not F7 names. It is `search`, not `magnifyingglass`.
- `tests/icons.test.ts` checks every name in the app against the ttf. It is the authority.

Per-theme icons where the platform look matters: `icon-ios="f7:house_fill"` beside
`icon-md="material:home"`. Material glyphs need the bundled font in `assets/css/icons.css`, or they
render as the literal word.

## Gestures

Swipeout inside swipeable tabs claims the same horizontal drag as the tabs. Put
`swiper-no-swiping` on the list, or one gesture does both.

## Navigation

- Tabs are data in `src/app/tabs.ts`. Each tab is a view with its own history.
- A pushed page calls `useHiddenTabbar()`. The tab bar belongs to the tab roots; on a detail screen
  it is navigation to somewhere you are not.
- A route's `async` is Framework7's hook, not an async function — resolve from a promise, `await`
  inside it does not compile.
- Actions on a detail screen belong in an `F7Toolbar bottom`, which spaces links evenly and clears
  the safe area. A hand-built fixed bar does neither.

## Proof obligations

State that `vp test` passes (it includes the icon check), and say plainly whether you have seen the
screen render. A screen that type-checks can still be an empty box.
