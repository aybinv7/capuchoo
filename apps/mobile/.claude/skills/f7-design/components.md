# Component catalogue

The allowlist is the `framework7Components` array in
`src/shared/utils/resolvers/resolvers.ts`. Only names in it resolve; anything else renders as an
unknown element.

## Wired

Shell and navigation
: `f7-app`, `f7-view`, `f7-views`, `f7-page`, `f7-page-content`, `f7-navbar`, `f7-nav-left`,
`f7-nav-right`, `f7-nav-title`, `f7-nav-title-large`, `f7-toolbar`, `f7-subnavbar`, `f7-link`,
`f7-tabs`, `f7-tab`, `f7-panel`, `f7-searchbar`

Lists and inputs
: `f7-list`, `f7-list-group`, `f7-list-item`, `f7-list-item-row`, `f7-list-item-cell`,
`f7-list-item-content`, `f7-list-button`, `f7-list-input`, `f7-checkbox`, `f7-toggle`,
`f7-stepper`

Actions and surfaces
: `f7-button`, `f7-segmented`, `f7-fab`, `f7-fab-button`, `f7-fab-buttons`, `f7-card`,
`f7-card-header`, `f7-card-content`, `f7-card-footer`, `f7-popup`, `f7-popover`, `f7-actions`,
`f7-actions-group`, `f7-actions-button`, `f7-actions-label`, `f7-sheet`, `f7-login-screen`

Content
: `f7-block`, `f7-block-title`, `f7-block-header`, `f7-block-footer`, `f7-icon`, `f7-chip`,
`f7-badge`, `f7-preloader`, `f7-progressbar`, `f7-skeleton-block`, `f7-skeleton-text`,
`f7-accordion*`, `f7-swipeout*`, `f7-messages*`, `f7-messagebar*`, `f7-photo-browser`,
`f7-virtual-list`, `f7-list-index`, `f7-row`, `f7-col`

## Deliberately absent

`f7-toolbar-pane`
: Framework7 9 ships the CSS class; framework7-vue 8 exports no component. Resolving it fails as a
runtime `SyntaxError`. Use `<div class="toolbar-pane">`.

## Adding one

1. Confirm the installed `framework7-vue` exports it — check its entry, not the docs, since the Vue
   bindings lag the core.
2. Add the kebab name to the array.
3. Use the PascalCase tag with no import.

## Programmatic APIs

`f7` is auto-imported. `f7.dialog.*`, `f7.toast.*`, `f7.sheet.*`, `f7.actions.*`, `f7.fab.*`,
`f7.tab.show()`.

Check the option names against `framework7/components/<name>/<name>.d.ts` rather than from memory —
an action-sheet heading is `{ text, label: true }`, and emphasis is `strong`, not `bold`.
