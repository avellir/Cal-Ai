# Expo Settings Tab Refactor Plan
## Cal AI Minimalist Architecture Implementation

**Project Context**: React Native + Expo Router app with existing Settings tab requiring refactor to match Cal AI's minimal UX pattern (hide static bio data, hero metric for calories).

**Success Criteria**: Settings tab displays Profile Card (with hidden bio access), Hero Daily Target metric, and clean preference toggles. All static biological data (height/sex/DOB) removed from main view.

---

## Phase 1: Foundation & Constants
**Goal**: Establish data structures and type definitions before UI work.

### 1.1 Create Type Definitions
**File**: `app/types/settings.ts` (new file)
- [ ] Define `UserProfile` interface (email, name, heightCm, biologicalSex, dateOfBirth)
- [ ] Define `ActivityLevel` union type ('sedentary' | 'light' | 'moderate' | 'active' | 'very_active')
- [ ] Define `Units` union type ('metric' | 'imperial')
- [ ] Define `SettingsData` interface (comprehensive state shape)

### 1.2 Create Constants/Mappings
**File**: `app/constants/settings.ts` (new file)
- [ ] Map `ActivityLevel` → display strings (e.g., 'moderate' → 'Moderately Active')
- [ ] Map `ActivityLevel` → subtitle descriptions (e.g., 'Affects your calorie calculation')
- [ ] Define `SEX_OPTIONS` array for pickers
- [ ] Define `UNIT_OPTIONS` array
- [ ] Create `calculateAge(dob: string): number` utility function

### 1.3 Theme Tokens (if not existing)
**File**: `app/constants/theme.ts` (modify or create)
- [ ] Add `iosGroupedBackground`: '#F2F2F7'
- [ ] Add `iosSecondaryBackground`: '#FFFFFF'
- [ ] Add `iosLabel`: '#000000'
- [ ] Add `iosSecondaryLabel`: '#8E8E93'
- [ ] Add `iosAccent`: '#34C759' (or app brand color)
- [ ] Add `iosDestructive`: '#FF3B30'

**Verification**: Types compile without errors. Constants export correctly.

---

## Phase 2: Reusable UI Components
**Goal**: Build atomic components that match iOS Settings aesthetic.

### 2.1 SettingsSection Container
**File**: `components/settings/SettingsSection.tsx`
- [ ] Props: `title: string`, `children: ReactNode`, `destructive?: boolean` (for Account section)
- [ ] Render uppercase section header (13px, grey, letterSpacing 0.5)
- [ ] Render white rounded container (borderRadius 10, marginHorizontal 16)
- [ ] Handle bottom spacing between sections (marginTop 32px, except first section marginTop 16px)

### 2.2 SettingsNavigationRow
**File**: `components/settings/SettingsRow.tsx`
- [ ] Props: `icon: string` (Ionicons name), `label: string`, `value?: string`, `subtitle?: string`, `onPress: () =&gt; void`, `showChevron?: boolean`
- [ ] Layout: Icon (29px wide) | Label (flex) | Value (grey, right) | Chevron (if navigation)
- [ ] Height minimum 44px for accessibility
- [ ] Use TouchableOpacity with activeOpacity 0.7
- [ ] Subtitle below label if provided (13px, grey)

### 2.3 SettingsToggleRow
**File**: `components/settings/SettingsToggle.tsx`
- [ ] Props: `icon: string`, `label: string`, `value: boolean`, `onValueChange: (val: boolean) =&gt; void`, `subtitle?: string`
- [ ] Layout: Icon | Label (flex) | Switch (right side, iOS native)
- [ ] Switch track color true: accent color, false: grey
- [ ] Height minimum 44px

### 2.4 SettingsPickerRow
**File**: `components/settings/SettingsPicker.tsx`
- [ ] Props: `icon: string`, `label: string`, `value: string`, `options: string[]`, `onSelect: (option: string) =&gt; void`
- [ ] Display current value in right column (grey text, not green pill)
- [ ] onPress opens ActionSheetIOS (iOS) or Alert (Android) with options
- [ ] Checkmark on current selection

**Verification**: All components render correctly in Storybook or test screen. Props are strictly typed.

---

## Phase 3: The Hero Components
**Goal**: Create the distinctive Cal AI profile card and hero metric.

### 3.1 ProfileHeader Component
**File**: `components/settings/ProfileHeader.tsx`
- [ ] Props: `email: string`, `name: string`, `heightCm: number`, `sex: string`, `age: number`, `onPress: () =&gt; void`
- [ ] Container: White bg, borderRadius 12, padding 16, margin 16, flexDirection row
- [ ] Left: Avatar placeholder (48px circle, grey bg, Ionicons person icon 24px)
- [ ] Middle: 
  - Name (17px bold, black)
  - Email (15px grey)
  - Metrics subtitle (13px grey): "{heightCm}cm • {Sex} • {age}y"
- [ ] Right: Chevron icon (arrow-forward)
- [ ] Entire card is TouchableOpacity navigating to body-metrics
- [ ] Accessibility: role="button", label="Edit profile and body metrics"

### 3.2 HeroMetric Component
**File**: `components/settings/HeroMetric.tsx`
- [ ] Props: `label: string` (e.g., "Daily Target"), `value: number`, `unit: string` (e.g., "calories/day"), `onPress: () =&gt; void`
- [ ] Container: White bg, borderRadius 12, padding 24, margin 16, alignItems center
- [ ] Content (centered):
  - Label above (13px uppercase grey, marginBottom 8)
  - Value (34px bold black)
  - Unit (15px grey, marginTop 4)
- [ ] Right side chevron or subtle press indicator
- [ ] Scale animation on press (to 0.98) using Animated API
- [ ] Accessibility: role="button", label="{label}, {value} {unit}, double tap to edit"

**Verification**: Components display correct data. ProfileHeader shows "173cm • Male • 34y" format. HeroMetric shows large "2,790" with small "calories/day" beneath.

---

## Phase 4: Main Settings Screen Assembly
**Goal**: Assemble the main Settings tab following the deletion checklist.

### 4.1 Screen Structure
**File**: `app/(tabs)/settings.tsx` (modify existing)
- [ ] Use ScrollView with `backgroundColor: iosGroupedBackground`
- [ ] Remove ALL existing sections/rows (prepare for clean slate)
- [ ] Add ProfileHeader at top (sticky not required, just first element)

### 4.2 Targets Section
**File**: `app/(tabs)/settings.tsx` (add inside ScrollView)
- [ ] SettingsSection title="TARGETS" (or null if first section)
- [ ] HeroMetric for Daily Calorie Target (value from state)
- [ ] SettingsNavigationRow for Activity Level:
  - Icon: figure-walk or walk-outline
  - Label: "Activity Level"
  - Value: Friendly string from constants (e.g., "Moderately Active")
  - Subtitle: "Affects your calorie calculation"
  - onPress: Open picker modal/sheet

### 4.3 Preferences Section
**File**: `app/(tabs)/settings.tsx` (continue)
- [ ] SettingsSection title="PREFERENCES"
- [ ] SettingsPickerRow for Units (Metric/Imperial)
- [ ] SettingsToggleRow for Reminders (Notifications)
  - Remove "Coming soon" badge entirely
- [ ] SettingsNavigationRow for Theme (pushes to theme screen if exists, or picker)

### 4.4 Account Section
**File**: `app/(tabs)/settings.tsx` (bottom)
- [ ] SettingsSection title="ACCOUNT" destructive={true}
- [ ] SettingsNavigationRow for Subscription (shows "Pro" or "Free")
- [ ] SettingsNavigationRow for Data Export
- [ ] SettingsNavigationRow for Help & Support
- [ ] Destructive button for Log Out (red text at bottom of section)

### 4.5 Data Integration
- [ ] Import calculateAge utility
- [ ] Create local state or use props for:
  - profile: {email, name, heightCm, sex, dob}
  - dailyTarget: number
  - activityLevel: ActivityLevel
  - units: Units
  - notifications: boolean
- [ ] Pass derived age (calculateAge(dob)) to ProfileHeader

**Verification**: Screen renders without scroll (fits iPhone 15 Pro). No "Personal Information" section visible. No "Required" badge. No "Coming soon" badge. HeroMetric is visually dominant.

---

## Phase 5: Body Metrics Sub-Screen
**Goal**: Create the hidden screen for static bio data (accessed only via Profile Card).

### 5.1 Screen Setup
**File**: `app/settings/body-metrics.tsx` (new route)
- [ ] Expo Router stack screen with headerTitle="Body Metrics"
- [ ] ScrollView with grouped background style
- [ ] Back button works automatically via stack navigator

### 5.2 Static Data Display
- [ ] Create section "ABOUT YOU"
- [ ] Four rows (non-interactive display or modal edit):
  1. Biological Sex - shows "Male", tap opens picker modal
  2. Height - shows "173 cm", tap opens number input modal  
  3. Date of Birth - shows "Jan 10, 1992", tap opens date picker
  4. Age - shows "34 years" (greyed out, calculated, non-editable)
- [ ] Add explanatory text: "Used to calculate your BMR and daily targets" (13px grey, centered below section)

### 5.3 Weight History (optional but recommended)
- [ ] Section "WEIGHT HISTORY"
- [ ] Show current weight large: "72 kg" with "Updated today" subtitle
- [ ] Button "Log New Weight" (accent color, rounded button)
- [ ] If history exists, show last 3-5 entries as small list

### 5.4 Recalculate Button (Optional UX enhancement)
- [ ] Add button at top: "Recalculate My Plan"
- [ ] Triggered when height/sex changes (notifies user targets will update)

**Verification**: Accessible only via ProfileHeader tap. Contains height/sex/DOB. No "Required" badges. Shows informative age calculation.

---

## Phase 6: Navigation & Routing
**Goal**: Wire up navigation between main settings and body metrics.

### 6.1 Route Configuration
**File**: `app/settings/_layout.tsx` (create if doesn't exist, or modify app/_layout.tsx)
- [ ] Add Stack.Screen for settings/body-metrics with presentation="card" (push transition)
- [ ] Ensure modal presentation for Daily Target editing (optional: could be inline or modal)

### 6.2 Navigation Handlers
**File**: `app/(tabs)/settings.tsx` (add navigation logic)
- [ ] ProfileHeader onPress: `router.push('/settings/body-metrics')`
- [ ] HeroMetric onPress: `router.push('/settings/edit-target')` or open local modal
- [ ] Activity Level onPress: Open ActionSheet/push picker screen
- [ ] Theme onPress: `router.push('/settings/theme')` (if separate screen exists)

### 6.3 Tab Bar Configuration
**File**: `app/(tabs)/_layout.tsx` (ensure proper)
- [ ] Settings tab icon: gear or settings-outline
- [ ] Active tint color: accent color (green)
- [ ] Inactive tint color: grey

**Verification**: Tapping Profile Card pushes to Body Metrics with slide animation. Back button returns to Settings.

---

## Phase 7: Cleanup & Deletion
**Goal**: Remove old code and verify no remnants remain.

### 7.1 Deletions from settings.tsx
- [ ] Remove "Personal Information" section component
- [ ] Remove "Adjust..." row 
- [ ] Remove "Required" badge component usage
- [ ] Remove "Coming soon" badge component usage
- [ ] Remove height state display from main list
- [ ] Remove Date of Birth display with age calculation from main list
- [ ] Remove Biological Sex row from main list
- [ ] Remove green "Metric" badge component (if custom component, delete file)
- [ ] Clean up unused imports

### 7.2 Verification Checklist
Open app and verify:
- [ ] Height is NOT visible on main settings screen
- [ ] Sex is NOT visible on main settings screen  
- [ ] DOB/Age is NOT visible on main settings screen
- [ ] "Required" badge nowhere to be found
- [ ] "Coming soon" badge nowhere to be found
- [ ] Daily Target is largest text element (34pt)
- [ ] Only 3-4 main sections visible without scrolling (Profile, Targets, Preferences, Account)
- [ ] Tapping Profile navigates to screen with all the hidden bio data

---

## Phase 8: Polish & Edge Cases
**Goal**: Final UX refinements.

### 8.1 Loading States
- [ ] ProfileHeader shows skeleton or placeholder if data loading
- [ ] HeroMetric shows "—" if calorie target not calculated yet

### 8.2 Haptics
- [ ] Add `expo-haptics` or React Native Vibration
- [ ] Light impact on row press (Haptics.ImpactFeedbackStyle.Light)
- [ ] Success haptic when saving weight or target

### 8.3 Accessibility Audit
- [ ] All rows minimum 44px height verified
- [ ] Screen reader reads ProfileHeader as "Edit profile and body metrics"
- [ ] Screen reader reads HeroMetric value clearly
- [ ] Switch components labeled correctly

**Final Verification**: Compare side-by-side with Cal AI screenshots. Ensure visual hierarchy matches (small label, giant number, subtle secondary info).

---

## Implementation Notes for Agent

**Priority Order**:
1. Complete Phase 1 (types) before any UI
2. Complete Phase 2 (components) before screens
3. Phase 4 (main screen) is the MVP deliverable - Body Metrics sub-screen can be Phase 5
4. Phase 7 (Cleanup) is mandatory - ensure old UI elements are fully removed, not just commented out

**File Structure Expected**:
app/
├── (tabs)/
│   └── settings.tsx          [Modified - main screen]
├── settings/
│   ├── body-metrics.tsx      [New - hidden bio data]
│   └── _layout.tsx           [New - stack navigator]
├── types/
│   └── settings.ts           [New]
├── constants/
│   └── settings.ts           [New]
└── components/settings/
├── SettingsSection.tsx   [New]
├── SettingsRow.tsx       [New]
├── SettingsToggle.tsx    [New]
├── SettingsPicker.tsx    [New]
├── ProfileHeader.tsx     [New]
└── HeroMetric.tsx        [New]
Copy

**Key Constraint**: Use only React Native built-in components + Expo Router + @expo/vector-icons. No heavy UI libraries unless already present in project.