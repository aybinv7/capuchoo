# Shapes

## Corner scale (`ShapeTokens.kt`, dp)

none 0 · extraSmall 4 · small 8 · medium 12 · large 16 · largeIncreased 20 · extraLarge 28 ·
extraLargeIncreased 32 · extraExtraLarge 48 · full (pill). Tailwind: `rounded-[4px]`, `rounded-lg`
(8), `rounded-xl` (12), `rounded-2xl` (16), `rounded-[20px]`, `rounded-[28px]`, `rounded-[32px]`,
`rounded-[48px]`, `rounded-full`.

Pressed and selected states **change shape**, animated by a spring: a round button squares toward
its pressed token, a selected item in a connected group becomes a pill.

## The expressive shape library

`shared/utils/shapes/materialShapes.ts` builds Material's own shapes exactly as
`androidx.compose.material3.MaterialShapes` does: circle, oval, pill, cookie4, cookie9, cookie12,
pentagon, gem, sunny, verySunny, clover4, clover8, flower, softBurst, burst. Add a missing one
(Heart, Ghostish, Puffy, Bun, Arch...) by porting its vertices from androidx, never by eyeballing.

`<MaterialShape shape="…">` cuts any content to a shape with a CSS mask (give it a square box). For
motion between shapes use `sampleOutline` + `morphOutline` (`morph.ts`) on an SVG path.

## Which shape where (Doba's vocabulary)

| Meaning                           | Shape                                                                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The app / the persona's badge     | `cookie9`                                                                                            |
| A person's face, a persona avatar | `cookie12` or `clover4` - soft, friendly                                                             |
| Pictures / gallery                | `flower`                                                                                             |
| Sounds / voice                    | `softBurst` (sound radiates)                                                                         |
| Tapback badge                     | `cookie9` on `card` (on `primary-container` when it is the user's)                                   |
| Personality / prompt              | `pentagon`                                                                                           |
| Stickers                          | rotate through `cookie9`, `clover4`, `softBurst`, `flower`, `sunny` by asset id - stable per sticker |
| Empty states                      | a large (112dp) shape in `primary-container` with a 48dp glyph                                       |

A shape is chosen from an id, never at random per render: the same thing keeps the same face.

## Colour on shapes

Glyph on a tone: `bg-tone-N` + `text-inverse-foreground`, or `bg-primary-container` +
`text-primary-container-foreground`. Never a literal colour (`tests/tokens.test.ts` fails).
