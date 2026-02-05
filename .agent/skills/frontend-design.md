# Frontend Design Skill (Expo)

Best-practice guidance for building distinctive, polished UI in this Expo
project without drifting into generic "AI slop" aesthetics.

## When to use
- Building a new screen, component, or UI flow
- Reworking visual style, layout, or interaction polish
- Translating a design brief into React Native code

## Core goals
- Make the UI feel intentionally designed, not default or template-like.
- Commit to a cohesive aesthetic (type, color, motion, background).
- Respect the existing design system and patterns in this repo.

## Why this skill
- Models tend to converge on generic UI without guidance.
- Targeted prompting across typography, motion, backgrounds, and themes yields better output.
- Give guidance at the right altitude: concrete direction without pixel-level lock-in.

## Project-specific constraints
- Use `components/ui/` primitives where possible.
- Use `DesignColors` (and existing theme tokens) for consistency.
- Prefer `StyleSheet.create` and `@/` path aliases.
- Keep design changes consistent across related screens.

## Brand alignment: Cal AI + MacroFactor

### Cal AI cues (marketing + product feel)
- Camera-first promise: the experience should feel like "track with a picture" (fast, simple, photo-led).
- Social proof energy: influencer/testimonial-style moments are acceptable for consumer warmth.
- Dark-mode friendly and gradient-backed; lean into sleek, glossy surfaces when appropriate.

### MacroFactor cues (product trust + clarity)
- Science-forward tone: serious, confident, and data-literate.
- Bold, precise typography for key metrics and headings.
- Consistent, clear food icons and explanatory visuals.
- Space-themed / adventurous illustration style is on-brand for delight moments.

### How to blend
- Use Cal AI energy for onboarding, capture, and results reveal.
- Use MacroFactor clarity for dashboards, stats, and decision points.
- Keep UI confident, not playful; “supportive coach” over “gamified tracker.”

## Design axes (high impact)

### Typography
- Avoid default/system fonts; use a distinctive pairing (1 display, 1 body).
- Use weight and size contrast: 100/200 vs 800/900, 3x scale jumps.
- Keep line length readable; increase line height for body text.

### Themes
- Choose a clear aesthetic reference (editorial, athletic, culinary, neo-brutalist, etc.).
- Carry the theme through typography, color, icon style, and motion.
- Avoid "default app" vibes by committing to the chosen theme.

### Color & theme
- Pick a dominant palette and 1-2 sharp accents; avoid timid "everything equal."
- Use variables/constants to keep palette consistent.
- Avoid cliche gradients (especially purple-on-white).
- Pull palette inspiration from cultural aesthetics or IDE themes, not generic defaults.

### Layout & spacing
- Use a clear spacing scale (4/8/12/16/24/32/40).
- Define hierarchy with consistent vertical rhythm.
- Prefer deliberate asymmetry to break generic card grids.

### Background & depth
- Avoid flat white backgrounds; add depth with gradients, noise, or shapes.
- Use overlays and soft shadows sparingly for focus.
- Match background texture to the chosen theme. 

### Motion
- One high-impact motion sequence beats many micro-animations.
- Use staggered reveals or a single page-load transition.
- Keep motion purposeful and tied to hierarchy.

### Imagery & icons
- Use icon families consistently.
- If you add illustrations or photos, keep style consistent across screens.

## Expo/React Native implementation notes
- Prefer `expo-linear-gradient` (or equivalent) for layered backgrounds.
- Use `react-native-reanimated` only when necessary; keep defaults simple.
- If you add fonts, use `expo-font` and document the choice.

## Guidance altitude
- Avoid over-specifying exact values (e.g., hex codes) unless required.
- Avoid vague advice; give concrete but flexible direction tied to design axes.

## Prompt block (use as a reusable skill snippet)

<frontend_aesthetics_expo>
Avoid generic, on-distribution UI. Build a distinctive, cohesive interface.

Focus on:
- Typography: choose interesting fonts; avoid Inter/Roboto/system defaults.
- Color & Theme: commit to a dominant palette + sharp accents; use tokens.
- Motion: one strong, orchestrated sequence; avoid noisy micro-motions.
- Backgrounds: add depth with gradients, shapes, or textures; no flat whites.
- Themes: pick a clear aesthetic reference and apply it consistently.
- Variation: avoid converging on the same safe fonts or layouts across screens.
- Avoid swapping one default for another (e.g., don't always fall back to Space Grotesk).

Avoid:
- Cookie-cutter layouts and purple-on-white gradients
- Predictable component patterns with no visual hierarchy
- Overused fonts or timid palettes

Make it feel intentionally designed for this product.
</frontend_aesthetics_expo>

## Output checklist
- Distinct type pairing used consistently
- Palette defined with dominant + accent colors
- Background has depth (gradient/shape/texture)
- Motion used sparingly but purposefully
- Components align with existing UI system
