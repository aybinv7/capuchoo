# Motion

## Springs - the M3 Expressive tokens

From `ExpressiveMotionTokens.kt` / `StandardMotionTokens.kt` (damping / stiffness). Spatial springs
move position, size and shape; effects springs move colour and opacity and never overshoot.

| Spec            | Expressive | Standard   |
| --------------- | ---------- | ---------- |
| Fast spatial    | 0.6 / 800  | 0.9 / 1400 |
| Default spatial | 0.8 / 380  | 0.9 / 700  |
| Slow spatial    | 0.8 / 200  | 0.9 / 300  |
| Fast effects    | 1.0 / 3800 | same       |
| Default effects | 1.0 / 1600 | same       |
| Slow effects    | 1.0 / 800  | same       |

In JS: `springAt(seconds, damping, stiffness)` (`shared/utils/motion/spring.ts`), the same closed
form Compose uses - the character engine and the loading indicator run on it.

In CSS there are no springs; use these curves, chosen to match the springs above:

| Use                                                                  | CSS                                           |
| -------------------------------------------------------------------- | --------------------------------------------- |
| Pop / spring-in with a little overshoot (chips, badges, send button) | `cubic-bezier(0.34, 1.56, 0.64, 1)` 300-420ms |
| Emphasized decelerate - something arriving (pages, sheets)           | `cubic-bezier(0.05, 0.7, 0.1, 1)` 400-500ms   |
| Emphasized accelerate - something leaving                            | `cubic-bezier(0.3, 0, 0.8, 0.15)` 200-320ms   |
| Standard                                                             | `cubic-bezier(0.2, 0, 0, 1)` 200-300ms        |
| Colour / opacity (effects)                                           | linear or standard, 150-200ms                 |

Exit is always shorter than entry.

## Patterns in the codebase

- **Page transitions** - `doba-start` / `doba-end` in `transitions.css`: slide in from the
  control's side with emphasized decelerate, the page under it drifts 30% and dims to 0.82.
  Framework7 replays the same transition on back. Mirrored under `dir="rtl"`.
- **Layout changes** - `useFlip({ target, trigger, enabled })`: measure, change, play the inverse
  as one transform (460ms emphasized decelerate). Used when the character moves from hero to the
  top bar.
- **The character** - poses (`idle`, `thinking`, `speaking`, `listening`, `entering`, `exiting`,
  `gate`) with per-pose springs; `thinking` runs the loading-indicator shape loop; reactions
  (`happy`, `spin`, `squash`) play over any pose. Drive it with props, never by poking the SVG.
- **Stagger** - lists of small things (tapback options, chips) enter 22-30ms apart.
- **Scroll-driven** - onboarding parallax uses `view-timeline` behind
  `@supports (animation-timeline: view())`, like proxima's onboarding.
- **Haptics accompany motion** that confirms something the finger did (a reaction lands, a hold
  opens a menu). Never on scroll.

## Loading

Never a spinner. The M3 loading indicator is the shape loop (SoftBurst → Cookie9 → Pentagon → Pill
→ Sunny → Cookie4 → Oval, 650ms per morph, full turn 4666ms, spring 0.6/200), 48dp container with
a 38dp shape; contained version = primary on primary-container. `loadingIndicator.ts` implements
it; the character's `thinking` pose is the same loop.
