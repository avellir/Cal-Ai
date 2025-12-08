# Cal AI Visual Design & UX Improvement Plan

## Objectives
- Modernize the visual language so the experience feels premium, intentional, and health-focused.
- Reduce friction and uncertainty across the core journeys: sign in, goal setup, capture → analyze → log, and daily tracking.
- Improve comprehension of nutrition data with clearer hierarchy, motion, and feedback.
- Build reusable primitives so new screens ship faster with consistent quality (dark mode ready).

## Current Observations (from code)
- **Brand/system:** `constants/theme.ts` defines tokens but most screens hardcode hex values; typography relies on defaults and lacks a distinctive typeface. No dark mode support across `app/(app)` and `app/(public)`.

### Decisions (Task 0)
- **Accent Color:** Citrus (#F59E0B) for primary actions and highlights.
- **Typography:** Manrope (if available) or System Sans with rounded traits.
- **Dark Mode:** Out of scope for this phase.
- **Surface:** Light backgrounds (#F8FAFC) with soft borders (#E2E8F0) and diffuse shadows.
- **Home dashboard:** `app/(app)/(tabs)/index.tsx` uses a static day strip and a manually drawn calorie ring; macro cards look similar to rest of the UI and don’t indicate progress. Empty/loading states are plain text, and the FAB has no affordances (tooltips, labels).
- **Progress tab:** `app/(app)/(tabs)/progress.tsx` is placeholder copy without charts, filters, or time range controls; no visual cues for trends or goal attainment.
- **Food capture & result:** `app/(app)/camera.tsx` is utilitarian with minimal guidance; `app/(app)/food-result.tsx` is text-heavy, uses stacked cards, and lacks scannable visual hierarchy for macros, warnings, and adjustments. Portion controls are button presets only (no slider) and confidence messaging isn’t clearly tied to actions.
- **Goal flow:** Screens under `app/(app)/goal-flow` use repeated inline styles, limited progress context, and minimal affordances (e.g., no inline tips, no live validation for targets, no preview of outcomes until the final screen).
- **Settings/profile:** `app/(app)/(tabs)/settings.tsx` shows dense cards without supporting metadata, lacks quick actions (e.g., unit system, reminders), and has a flat visual hierarchy.
- **Auth:** `app/(public)/signin.tsx` relies on generic cards and text; no illustration/hero, no passwordless explainer, and social CTAs feel boilerplate.

## Design Direction
- **Mood:** Crisp, clinical-fresh, and supportive—light neutrals with strong black accents and energizing citrus + mint highlights (e.g., charcoal #0F172A, off-white #F8FAFC, accent tints like #F59E0B, #10B981, #22D3EE).
- **Typography:** Introduce a distinctive sans (e.g., Sora or Manrope) with clear weight scale; use rounded numerals for macro figures. Set consistent type ramp for titles, overlines, captions.
- **Surfaces:** Use soft gradients or subtle noise backgrounds for hero sections; cards with layered depth (border + soft shadow) and rounded corners aligned to `Layout.cardBorderRadius`.
- **Data viz:** Prefer circular/linear progress with accent strokes, segmented macro bars, and sparkline trend chips for recent days.
- **Motion:** Gentle easing for transitions, staggered fades for list items, and tactile press states on primary actions.

## Screen-Level Improvements
- **Home (daily dashboard)**
  - Replace manual calorie ring with a reusable circular progress component (animated, segmented for macros).
  - Swap static day strip for a scrollable streak/weekday chip row with checkmarks and tappable summaries.
  - Elevate the “recently logged” card with thumbnail, context tags (meal type/time), and swipe actions (edit/delete).
  - Add “Today’s guidance” banner that contextualizes remaining macros and suggests a next action (log water, adjust portion).
  - Convert FAB into an extended action with label (“Add meal”) and optional secondary actions (scan, manual, barcode).
- **Progress**
  - Introduce tabs for `7d / 30d / custom` with animated charts: stacked bar for macros, line for calories, donut for goal adherence.
  - Add streak card with heatmap strip and microcopy on how streaks are calculated.
  - Provide filters by meal type and time-of-day insights (cards summarizing breakfast vs dinner calories).
- **Food capture → result**
  - Camera: add friendly hero, permission rationale sheet, and real-time hints (lighting, distance). Include ghost preview frame.
  - Analysis: use a vertical stepper (captured → analyzing → verified) with progress dots; keep user informed if using network vs on-device.
  - Result screen: redesign hierarchy—hero image with gradient overlay, bold calorie headline, macro “pill meters,” and a portion slider with haptics. Split sections: accuracy/confidence, warnings, ingredients, adjustments. Add “Impact on today” widget showing remaining macros from `useUserGoalsStore`.
  - Logging actions: surface “Save & duplicate” and “Save as favorite”; keep retake secondary.
- **Goal flow**
  - Add stepper badges and a persistent “what you’ll get” preview (calories + macros) updated as inputs change.
  - Inline validation copy near fields; add helper microcopy (healthy ranges, examples).
  - For target weight, visualize the delta with a mini timeline showing estimated weeks (from `calculateNutritionPlan`) and expected date.
  - Results: make macro circles tappable for editing and add a “Share plan” CTA; include offline-saving feedback state.
- **Settings/Profile**
  - Restructure into sections: Personal data, Goals, Reminders/Notifications, Integrations (wearables), Theme (light/dark/system).
  - Use concise cards with icons, secondary text, and chevrons; add quick toggles for units and reminder time.
- **Auth**
  - Add welcoming hero illustration and a short “Why passwordless?” note; provide inline error banners instead of alerts.
  - Make social buttons visually distinct with brand-safe palettes; show terms/privacy links.

## System & Component Work
- Create primitives in `components/ui`: `Button` (variants + loading), `Card` (elevations), `Chip`, `Pill`, `ProgressRing`, `ProgressBar`, `ListRow`, `InputField`, `Stepper`.
- Centralize colors/typography in `constants/theme.ts` and refactor screens to consume tokens; add semantic roles (info/success/warning backgrounds).
- Add dark mode palettes and ensure `ThemedText/ThemedView` are used consistently.
- Build motion tokens (durations, easings) and standardize press/hover/focus states.
- Add skeleton/loading components for cards, charts, and lists; unify empty/error states with illustrations and CTA guidance.
- Prepare design documentation (MDX or Storybook for React Native Web) to preview tokens and components.

## UX Enhancements & Content
- **Navigation:** Add contextual back labels, breadcrumbs within goal flow, and sticky CTAs on long forms.
- **Accessibility:** Increase contrast for text on tinted backgrounds; ensure `accessibilityLabel`/`accessibilityRole` on interactive elements; support dynamic type scaling and focus order.
- **Copy & guidance:** Replace generic subtitles with actionable tips (e.g., “You’re 22g protein short—try adding Greek yogurt”). Standardize tone (encouraging, concise).
- **Feedback:** Replace alert-only flows with inline banners/snackbars for save errors, offline mode, and pending sync (e.g., `PENDING_GOALS_KEY` usage).
- **Micro-interactions:** Haptic feedback on primary actions (goal save, food save), subtle chart anims on tab switch.

## Roadmap (suggested sequence)
1. **Foundation (Week 1-2):** Finalize visual direction, update `constants/theme.ts` with new palette/type, build core primitives, add dark mode scaffold.
2. **Capture & Results (Week 2-3):** Redesign camera and food result surfaces; integrate portion slider, impact-on-today widget, and improved confidence/warning hierarchy.
3. **Dashboard & Progress (Week 3-4):** Replace home hero ring/day strip, add streak chips, introduce progress charts and filters.
4. **Goal Flow (Week 4):** Add live previews, timeline visualization, and richer validation; polish results with editable macro circles.
5. **Settings/Auth (Week 5):** Re-card settings with quick toggles and theme controls; refresh sign-in with hero, error banners, and refined social CTAs.
6. **Polish & QA (Week 6):** Accessibility pass, motion tuning, skeletons/empty states, documentation in `components/ui` showcase.

## Success Criteria
- Faster comprehension: users can identify daily status (calories/macros left) in <5s on home.
- Higher confidence: scan/save funnel drop-off reduced after confidence/warning redesign.
- Consistency: ≥80% of screens consume shared tokens/components; dark mode parity across critical flows.
