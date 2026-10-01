---
name: m3-expressive
description:
  Material 3 Expressive in Doba - shapes, springs, motion, component sizes and the messaging
  patterns (bubbles, tapbacks, stickers, voice notes, composer). Use for ANY UI or UX work - a new
  screen, a component, an animation, a transition, onboarding, a sheet, a list, a button, a loading
  state, a chat surface - before writing markup. Covers the shape library and character engine
  ported from proxima, the exact M3 tokens (from androidx), which Framework7 pieces to use, and the
  mistakes already made once.
---

# Material 3 Expressive in Doba

Doba is Android-first and pinned to Framework7's Material theme. "Expressive" is not decoration: it
is shape, springy motion and tonal colour used to say _what is happening_. Every screen follows this
skill; the numbers are Google's own (androidx Compose tokens, see [sources.md](sources.md)).

## Before building anything

1. **Look at a reference first.** Google Messages (2025 Expressive redesign), Google Photos, Pixel
   launcher, iMessage for tapbacks. Decide what the screen does in one sentence.
2. **Pick the M3 component** and read its numbers in [components.md](components.md). Framework7 has
   most of them; build by hand only what it lacks (and say why in the component's doc).
3. **Pick the shape** ([shapes.md](shapes.md)) and **the motion** ([motion.md](motion.md)).
4. Chat surfaces: [messaging.md](messaging.md) is binding - it records decisions the user made.
5. Verify live in the built-in browser against the user's running dev server, at 412x915 and a
   360-wide check, probing rects rather than trusting screenshots (the pane lags and reports
   `document.hidden`, which freezes CSS animations and the character loop).

## What Doba already has - reuse, never re-invent

| Need                                                  | Use                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Any expressive shape (cookie, clover, burst, pill...) | `<MaterialShape shape="cookie9">` - `shared/components/shape/`                          |
| Shape outlines, morphing, the loading loop            | `shared/utils/shapes/{materialShapes,morph,loadingIndicator}.ts`                        |
| Springs (Compose's closed form)                       | `shared/utils/motion/spring.ts` - `springAt(t, damping, stiffness)`                     |
| A layout change that must animate                     | `useFlip` (transform only, never animate layout)                                        |
| The living character                                  | `modules/chat/engine/character/*` + `ChatCharacter.vue` (poses, blinks, reactions)      |
| Page transitions from a side                          | `transition: "doba-start" \| "doba-end"` (`assets/css/layout/transitions.css`)          |
| Colour                                                | M3 roles from one seed: `bg-primary-container`, `text-muted-foreground`, `bg-tone-5`... |
| Haptics                                               | `tick()` for small moments, `bump()` for arrivals - `shared/utils/native/haptics.ts`    |
| A floating layer the app draws itself                 | `data-back-layer` + `@layer:back` so Android back closes it                             |
| Confetti                                              | `ChatConfetti.vue` (theme colours, reduced-motion aware)                                |

## Hard rules (each one broke once)

- **Popovers are for menus of words, never for a row of icons.** A Framework7 popover forced the
  tapback emoji into a tall vertical oval on a wide background. Icon rows are custom pills.
- **Surfaces carrying text are near-solid.** 90-94% of the surface colour plus blur; only a short
  strip (24-28px) fades. A 70% bar let titles sit on top of the thread.
- **One field holds every composer action**, trailing side; send is a filled primary circle that
  appears only when there is something to send, swapped with the mic by a spring.
- **Short threads sit against the composer** (`justify-content: flex-end`), and new messages keep
  the view pinned to the end unless the reader scrolled back.
- **Pages open from the side of their control**; back returns the same way.
- **No stock filler.** No canned "AI" lines, no lorem, no placeholder personas. Empty states explain
  and offer the one action that fills them.
- **Visual before verbal.** Onboarding and empty states lead with a scene (shapes, the character,
  motion) and one line of text, never a paragraph.
- **Reduced motion keeps meaning, drops travel:** morphs and colour stay, rotation, parallax and
  bounce go (`@media (prefers-reduced-motion: reduce)`).
- **Compositor only:** animate `transform`, `opacity`, `filter` - never width, height, top, or a
  repainted gradient.
- **Media never leaves the phone.** UI that shows a picture or a clip to the model says so.
