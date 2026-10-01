# Icons

Three systems. Pick by context.

## 1. Framework7 icon font — chrome and list media

```vue
<F7Icon f7="checkmark_seal_fill" color="green" />
<F7Icon ios="f7:house_fill" md="material:home" />
<!-- per-theme, for the tab bar -->
```

**The trap.** framework7-icons is a ligature font. A name it does not carry renders _nothing_ — no
warning, no fallback, no console message. Invisible in review, invisible in a screenshot you did not
look closely at.

Rules that came from getting this wrong twice:

- **Verify against the font, never from memory.** `tests/icons.test.ts` checks every name used in
  the app against `Framework7Icons-Regular.ttf`. It is the authority; run it.
- The name **keeps the underscore before a digit**: `arrow_2_circlepath`, `square_grid_2x2_fill`,
  `square_stack_3d_down_right_fill`, `rectangle_3_offgrid_fill`.
- **Do not derive names from `framework7-icons/react/*`.** Those files are SVG wrappers whose names
  do not match the ligatures. Trusting them turned four working icons into fragments of other
  glyphs.
- **SF Symbols names are not Framework7 names.** It is `search`, not `magnifyingglass`.
- Browse real names at https://framework7.io/icons/.

## 2. Material icons — the `md` theme

`icon-md="material:home"` needs the Material font, which is bundled in `src/assets/css/icons.css`
with a `font-feature-settings: "liga"` rule. Without it the icon renders as the literal word
"home". The font is self-hosted, not from a CDN, because an offline-first app should not lose its
icons with the network.

## 3. unplugin-icons SVGs — feature UI

```vue
<ILucideZap class="text-yellow-500" />
```

Resolved by `IconsResolver` with the `framework7`, `material-symbols` and `lucide` collections
enabled, and `autoInstall: true`. Unlike the font, a wrong name here **fails at build time**, which
makes it the safer choice for anything decorative or one-off.

## Choosing

| Context                        | Use                          |
| ------------------------------ | ---------------------------- |
| Tab bar, navbar, native chrome | `F7Icon` with `ios=` / `md=` |
| List row media, status glyphs  | `F7Icon f7="…" color="…"`    |
| Feature illustration, one-offs | `<ILucide… />`               |
