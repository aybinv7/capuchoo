---
name: f7-design
description: Framework7 UI work in this app. Use whenever the task is to build or change a screen, view, page, component, layout, navbar, tabbar, toolbar, list, sheet, popup, panel, FAB, card, chip, searchbar, swipeout, or any mobile UI. Covers the component-first rule, the resolver allowlist you must update before using a new component, the icon ligature trap, and why this app writes no CSS.
---

# Framework7 UI workflow

Mobile-first, Android-first, native-feeling on both themes. Reach for a Framework7 component before
building anything by hand — it already handles the theme, dark mode, safe areas and the gestures.

## Before building a screen

1. Check whether Framework7 has the component: https://framework7.io/vue/. The catalogue wired into
   this app is [components.md](components.md).
2. In the allowlist → use `<F7Xxx>` directly. **No import** — `Framework7VueResolver` resolves it.
3. Not in the allowlist → add the kebab name to `framework7Components` in
   `src/shared/utils/resolvers/resolvers.ts` **first**. Skip this and the component silently fails
   to resolve.
4. Before adding a name, confirm the installed `framework7-vue` actually exports it. `f7-toolbar-pane`
   is a Framework7 9 CSS class with no Vue component in framework7-vue 8 — resolving it throws a
   runtime `SyntaxError`, not a warning. Use the class on a plain `div` in that case.
5. Hand-build only when Framework7 has nothing suitable.

## Layout idiom

```
F7Page > F7Navbar > [F7NavRight, F7Subnavbar]
         F7BlockTitle          section heading
         F7Block strong inset  prose or a stat surface
         F7List strong inset dividers   rows
```

- Rounded surfaces: `class="rounded-2xl!"`. The `!` matters — Tailwind loads after the F7 bundle.
- `F7ListItem` renders `subtitle`, `text` and `#media` **only in a media list**. Outside one they
  are dropped with no warning.
- Long descriptive text goes in `#text` in a media list, never `#footer` — footers are sized for a
  few words and long text overlaps the title.
- Detail-screen actions go in `F7Toolbar bottom`, which spaces links evenly and clears the safe
  area. A hand-built fixed bar does neither.

## Write no CSS

No backgrounds, heights, safe-area padding or body font sizes. The theme owns them, for iOS and
Material, light and dark. `assets/css/app.css` is one line.

Tailwind is for layout inside a component — flex, grid, gaps, a size on a number. The moment you
reach for a colour, use a Framework7 component or a theme variable instead. Theme colour is set once
via `colors.primary` in `src/plugins/framework7.plugin.ts`, never as a CSS override: Framework7
derives tints, shades, ripples and the dark variants from that value.

## Icons

Read [icons.md](icons.md) before typing an icon name. framework7-icons is a **ligature font**: a
wrong name renders nothing at all, with no warning. This app has shipped invisible icons twice.

## Navigation and gestures

- Tabs are data in `src/app/tabs.ts`; each is a view with its own history.
- A pushed page calls `useHiddenTabbar()`.
- Swipeout inside swipeable tabs needs `swiper-no-swiping` on the list, or one drag does both.
- A route's `async` is Framework7's hook, not an async function — resolve from a promise.
- `f7route` / `f7router` are props: `defineProps<{ f7route: Router.Route }>()`.

## Before saying it works

`vp test` (includes the icon check) and `pnpm type-check`. Then say whether you have actually seen
the screen. A screen that compiles can still be an empty box.
