# Sources

Researched 2026-09-26/27. There is **no official Material MCP server, no llms.txt and no official
M3 phone skill**; m3.material.io is rendered by JavaScript and cannot be fetched as text.

- **Source of truth for numbers:** androidx Compose Material3 generated tokens -
  https://github.com/androidx/androidx/tree/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens
  (`ExpressiveMotionTokens.kt`, `ShapeTokens.kt`, `TypeScaleTokens.kt`, per-component files) and
  `MaterialShapes.kt`, `LoadingIndicator.kt` next to them.
- Colour: `@material/material-color-utilities` (already used - `materialScheme.ts`).
- Google Developer Knowledge MCP (https://developers.google.com/knowledge/mcp) covers
  developer.android.com, not m3.material.io; needs a GCP key.
- Community only (unofficial, unverified): material3-mcp-server
  (github.com/weppa-cloud/material3-mcp-server), MD3-Docs-MCP, hamen/material-3-skill.
- `@material/web` is in maintenance mode, has no Expressive support, and does not fit Framework7.
- Messaging references: Google Messages Expressive redesign -
  https://9to5google.com/2025/08/19/google-messages-material-3-expressive-redesign/ ,
  composer - https://9to5google.com/2025/03/25/google-messages-text-field-redesign-2025/ ,
  recorder - https://9to5google.com/2024/05/06/google-messages-recorder-redesign-voice-moods/
- Proxima (C:\Users\aybin\code\sig\proxima): where the shape library, character engine, onboarding
  scroll-driven parallax (`modules/auth/components/onboarding/OnboardingFlow.vue`), the backdrop
  glows (`AuthBackdrop.vue`) and the guided tour came from.
