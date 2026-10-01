# Component numbers (androidx tokens, dp)

Elevation levels 0/1/3/6/8/12. State layers: hover 0.08, focus 0.10, pressed 0.10, dragged 0.16.
Disabled content 0.38, disabled container 0.12. Typography "emphasized" = same size, one weight up.

| Component              | Numbers                                                                                                                                  | In Doba                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Buttons XS/S/M/L/XL    | height 32/40/56/96/136, icon 20/20/24/32/40, padding 16/16/24/48/64; round = full, pressed squares toward small/small/medium/large/large | `F7Button round` (S); hero CTAs hand-built M/L    |
| Button group           | 12 gap                                                                                                                                   | flex gap-3                                        |
| Connected button group | 2 gap, 40 high, outer corners full, inner 8 → 4 pressed → 50% selected                                                                   | segmented choices (model tier, frequency)         |
| Split button           | S 40 / M 56, 2 gap, inner corner 4 → 12 pressed                                                                                          | -                                                 |
| FAB                    | S 40 (r12), baseline 56 (r16), M 80 (r20), L 96 (r28); icon 24/24/28/32                                                                  | `F7Fab` on list pages                             |
| Extended FAB small     | 56 high, r16                                                                                                                             | `F7Fab :text`                                     |
| FAB menu               | items 56 high pill, level 3, 4 gap                                                                                                       | -                                                 |
| Floating toolbar       | 64 high pill, 16 margin, 8 padding, 4 gap; surface-container or primary-container (vibrant)                                              | actions over media, recorder controls             |
| Docked toolbar         | 64 high, square, surface-container                                                                                                       | -                                                 |
| App bars               | small 64; medium flexible 112 (136 w/ subtitle); large flexible 120 (152); level 0, level 2 on scroll                                    | `F7Navbar class="navbar-gradient"`                |
| Search bar             | 56 pill, level 3                                                                                                                         | history search                                    |
| Navigation bar         | 64 (tall 80), indicator 56x32 pill in secondary-container                                                                                | none (Doba has no tabs)                           |
| Loading indicator      | 48 container, 38 shape                                                                                                                   | shape loop, see motion.md                         |
| Wavy progress          | linear 4 thick, amplitude 3, wavelength 40 (20 indeterminate); circular 40 (48 wavy)                                                     | voice-note playback, uploads                      |
| Lists (expressive)     | items r4, r16 when selected/pressed, group container r16, 1-line 56, 12 between items in segmented style, avatar 40                      | `F7List strong inset` (Framework7's radius vars)  |
| Cards                  | r12; elevated level 1                                                                                                                    | `bg-card rounded-xl shadow-card`                  |
| Chips                  | 32 high, r8, icon 18, outline 1                                                                                                          | suggestion chips are taller (48, full) for thumbs |
| Dialog                 | r28, surface-container-high, level 3                                                                                                     | `f7.dialog` (themed)                              |
| Bottom sheet           | top r28, surface-container-low, level 1, handle 32x4                                                                                     | persona creator steps, camera                     |
| Snackbar               | r4, inverse-surface, level 3, 48 / 68                                                                                                    | `f7.toast`                                        |
| Text fields            | outlined 56, r4, outline 1 → 2 focus                                                                                                     | `F7ListInput`                                     |
| Slider (expressive)    | track 16 pill, handle 4x44 (2 pressed), 6 gap                                                                                            | -                                                 |
| Menu                   | r4 baseline, surface-container, level 2; expressive items animate shape on select                                                        | `ChatMoreMenu` (popover of words)                 |
