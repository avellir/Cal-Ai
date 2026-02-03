---
name: expo-frontend-design
description: Use this skill when designing or refactoring UI for React Native/Expo. It enforces high-fidelity aesthetics, modern typography, and smooth motion.
---

# Expo Frontend Design Skill

## Design Principles
Avoid "AI-distributional" designs (white backgrounds, blue buttons, Inter font). Instead, commit to a specific aesthetic:
- **Typography:** Avoid default system fonts. Prefer specific Google Fonts (via `expo-font`) like 'Lexend', 'Bricolage Grotesque', or 'Space Grotesque'.
- **Color:** Use high-contrast accents. Implement a "Glassmorphism" or "Neumorphism" style when appropriate.
- **Layout:** Use `gap` in Flexbox rather than individual margins. Ensure all touch targets are at least 44x44.

## Technical Requirements
- **Styling:** Use NativeWind (Tailwind) for consistent utility-first styling.
- **Motion:** Always use `react-native-reanimated` for interactions. Use `entering` and `exiting` layout animations for all list items.
- **Icons:** Default to `@expo/vector-icons` (Lucide or Phosphor sets).

## Implementation Rules
1. When generating a new screen, always wrap the root in a `SafeAreaView` from `react-native-safe-area-context`.
2. Use `expo-blur` for header backgrounds to create depth.
3. If the user asks for a "list," implement a `FlashList` from Shopify for performance.