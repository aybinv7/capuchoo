# Capacitor and native behaviour

Every native call is guarded with `Capacitor.isNativePlatform()` or
`Capacitor.getPlatform() === "web"`. `vp dev` in a browser must keep working — it is how the app is
inspected — so a handler that assumes a device breaks the fastest feedback loop you have.

Native wiring that needs the Framework7 instance runs inside `f7ready`, not at module load.
`src/plugins/capacitor/index.ts` is the single entry point.

## What is already handled, and why it is not simple

- **Back button** (`useAndroidBackButton`) closes the topmost layer before it navigates, in order:
  actions, dialog, sheet, popover, popup, login screen, panel. Then a popup's own view history, then
  the router, then it minimises rather than exits. The order matters: an actions sheet over a popup
  must close first or back dismisses the popup underneath and orphans the sheet.
- **Keyboard** (`useKeyboard`) scrolls the focused input into view on _every_ phase of the
  transition, not once — the layout is still settling at `keyboardWillShow` and only
  `keyboardDidShow` sees the final height. It also hides the tab bar, which otherwise steals a row
  from the field being typed into, and leaves a message bar's accessory row alone.
- **Status bar** overlays the web view; the page owns the inset.
- **Splash** stays up until `hideSplashScreen()`, called on a frame boundary so there is no flash of
  an unpainted shell.

Do not simplify these into a single listener. Each branch is there because of a specific device
behaviour, and the comments say which.

## The bootstrap must never fail silently

`main.ts` opens the database before mounting, inside a `try`, and renders the failure on the page if
it throws. An earlier version awaited it at module top level: a rejection produced an empty `#app`
and a completely silent console, which is the worst possible failure for whoever generates from this
template. The timeout exists so a hang cannot masquerade as a blank screen either.

Anything else added to the bootstrap follows the same shape: guarded, and loud when it fails.

## Fixed elements and the shell

The tab bar lives in the shell, outside every page, inside `.views.tabs`. So:

- A page already ends above it — do not add a bottom offset to a FAB to "clear" it. That counts it
  twice.
- FAB buttons open upward (`position="top"`), or they land behind it.

## Proof obligations

Say which platform you tested on. "Type-checks" is not a claim about a device, and neither is a
browser. If you have not run it on Android, say so.
