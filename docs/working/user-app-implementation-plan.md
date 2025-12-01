# BiteRight User App Implementation Plan

## Overview

This document outlines the complete implementation plan for the user-facing BiteRight app, including a comprehensive onboarding flow and three main pages with a profile section.

---

## 🎯 Design Principles

1. **Mobile-First**: Every component designed for mobile first, then scales up
2. **Delightful UX**: Smooth animations, micro-interactions, haptic feedback patterns
3. **Simplicity**: Minimum taps to complete any action
4. **Visual Clarity**: Clear hierarchy, generous whitespace, intuitive icons
5. **Performance**: Skeleton loaders, optimistic updates, instant feedback

---

## 📱 App Structure

```
/(app)/
├── onboarding/           # Multi-step onboarding flow
│   └── page.tsx          # Orchestrates onboarding steps
├── dashboard/            # Main home screen (default after onboarding)
│   └── page.tsx          
├── meal-builder/         # Meal customization & alternatives
│   └── page.tsx
│   └── [mealId]/
│       └── page.tsx      # Specific meal editing
├── nutrition/            # Nutrition details & tracking
│   └── page.tsx
├── profile/              # User profile & settings
│   └── page.tsx
└── layout.tsx            # App shell with bottom navigation
```

---

## 🚀 Phase 1: Onboarding Flow

### Design Goals
- Complete in under 5 minutes
- Mobile-optimized with swipe gestures
- Progress indicator throughout
- Ability to go back and edit
- Beautiful transitions between steps

### Onboarding Steps

#### Step 1: Welcome
- Warm greeting with app logo
- Brief value proposition (3 bullet points)
- "Let's personalize your experience" CTA
- Skip option for returning users

#### Step 2: Basic Information
- **Name** (optional, for personalization)
- **Age** (number picker, mobile-friendly)
- **Sex** (toggle: Male / Female / Other)
- **Height** (cm or ft/in toggle)
- **Weight** (kg or lbs toggle)

**UI Components:**
- Segmented controls for units
- Wheel pickers for numbers (mobile)
- Input fields with validation

#### Step 3: Activity Level
Visual selection with icons and descriptions:
- 🛋️ **Sedentary** - Desk job, minimal exercise
- 🚶 **Light** - Light exercise 1-3 days/week
- 🏃 **Moderate** - Moderate exercise 3-5 days/week
- 💪 **Active** - Hard exercise 6-7 days/week
- 🔥 **Very Active** - Athlete, physical job

**UI:** Large tappable cards with icons

#### Step 4: Your Goals
- **Goal Type** (visual cards):
  - 📉 Lose Weight
  - ⚖️ Maintain Weight
  - 💪 Build Muscle

- **Target Weight** (if lose/gain selected)
- **Pace** (segmented control):
  - Slow (sustainable)
  - Moderate (balanced)
  - Aggressive (faster results)

#### Step 5: Dietary Preferences
- **Diet Type** (single select):
  - Omnivore, Vegetarian, Vegan, Pescatarian, Keto, Paleo

- **Allergies** (multi-select chips):
  - Gluten, Dairy, Eggs, Nuts, Shellfish, Soy, etc.
  - "None" option

- **Dislikes** (searchable tags):
  - Common ingredients to avoid
  - Add custom items

#### Step 6: Lifestyle & Cooking
- **Cooking Skill** (visual cards):
  - 🍳 Beginner - Simple recipes
  - 👨‍🍳 Intermediate - Comfortable cooking
  - 👨‍🍳✨ Advanced - Love complex recipes

- **Max Prep Time** (slider):
  - Quick (<15 min)
  - Standard (15-30 min)
  - Extended (30+ min)

#### Step 7: Meal Structure
- **Number of Meals** (visual selection):
  - 3 meals (Breakfast, Lunch, Dinner)
  - 4 meals (+Snack)
  - 5 meals (+Morning & Afternoon snacks)
  - Custom

**Note:** Meal timing/percentages assigned by coach later

#### Step 8: Plan Preview & Confirmation
- Show calculated TDEE and daily targets
- Macro breakdown visualization
- "Your personalized plan is ready!"
- "Start My Journey" CTA

---

## 📊 Phase 2: Dashboard (Home)

### Header Section
- Greeting with user name
- Today's date with week navigator
- Profile avatar (links to settings)

### Week Progress Strip
- 7 circular cards for Mon-Sun
- Each card shows:
  - Day letter/number
  - Progress ring (calories consumed %)
  - Active state for today
  - Completed/future state styling
- Horizontally scrollable on mobile
- Today centered by default

### Daily Summary Card
- Large calorie ring (consumed / target)
- Macro pills (Protein, Carbs, Fat) with progress bars
- "On Track" / "Over" / "Under" status badge

### Meal Cards Section
Based on user's meal structure (3-5 meals):

Each **Meal Card** contains:
- Meal type label (Breakfast, Lunch, etc.)
- Recipe image (lazy loaded)
- Recipe name
- Calories & prep time badges
- Status indicator (Planned / Logged / Skipped)

**Card Actions (swipe or tap):**
- ✅ **Log It** - One-tap logging
- 🔄 **Swap** - Find alternative recipe
- 👁️ **View** - Go to Meal Builder for details

**Interaction Patterns:**
- Swipe left → Reveal "Swap" action
- Swipe right → Quick "Log It"
- Tap → Open Meal Builder
- Long press → Quick actions menu

### Quick Actions FAB
- Floating action button
- Options: Log food, Add water, Quick log

### Water Intake Widget (Optional)
- Glass/drop icons
- Tap to add 250ml
- Progress toward daily goal

---

## 🍽️ Phase 3: Meal Builder

### Purpose
Detailed view of a meal with ability to:
1. View full recipe details
2. Swap entire recipe for alternative
3. Swap individual ingredients
4. Adjust portions
5. Log the meal

### Layout

#### Recipe Header
- Full-width image (parallax on scroll)
- Recipe name overlay
- Badges: Calories, Prep time, Difficulty
- Heart/save button

#### Quick Stats Bar
- Calories
- Protein
- Carbs
- Fat
- Fiber

#### Tabs or Segments
1. **Ingredients**
2. **Instructions**
3. **Nutrition**

#### Ingredients Tab
- List of ingredients with:
  - Name
  - Quantity & unit
  - Calories contribution
  - **Swap icon** for alternatives
- "Swap entire recipe" button

#### Instructions Tab
- Numbered steps
- Optional step images
- Timer buttons for timed steps
- Checkbox to mark completed

#### Nutrition Tab
- Detailed macro breakdown
- Micronutrients (vitamins, minerals)
- Visual charts/rings

### Bottom Action Bar
- Portion adjuster (0.5x, 1x, 1.5x, 2x)
- "Log This Meal" primary CTA

### Swap Flow (Recipe Level)
1. Tap "Find Alternative"
2. Slide-up sheet with:
   - Similar calorie alternatives
   - Filter options
   - Each card shows: Name, Image, Cals, Time
3. Tap to preview, confirm to swap

### Swap Flow (Ingredient Level)
1. Tap swap icon on ingredient
2. Show inline alternatives or bottom sheet
3. Alternatives with similar nutritional profile
4. One-tap swap & recalculate nutrition

---

## 📈 Phase 4: Nutrition Details

### Purpose
Comprehensive view of daily/weekly nutrition intake with detailed macro and micronutrient tracking.

### Header
- Date selector (today highlighted)
- Week/Month toggle
- Calendar icon for date picker

### Calories Overview
- Large animated ring
- Consumed / Target in center
- Remaining below
- Color-coded (green/yellow/red based on status)

### Macros Section
- Three horizontal progress bars:
  - 🥩 Protein (g consumed / target)
  - 🍞 Carbs (g consumed / target)
  - 🥑 Fat (g consumed / target)
- Percentage labels
- Color-coded progress

### Detailed Breakdown Card
- Pie chart of macro distribution
- Actual percentages vs. recommended
- Tap for detailed view

### Micronutrients Section
Expandable/collapsible sections:

#### Vitamins
- Vitamin A, C, D, E, K, B vitamins
- Progress bars to RDA %
- Deficiency/excess indicators

#### Minerals
- Iron, Calcium, Potassium, Sodium, etc.
- Progress bars to RDA %

### Meal Log Section
- List of logged meals today
- Time logged
- Calories per meal
- Tap to edit/delete

### Trends (Weekly/Monthly View)
- Line/bar charts for:
  - Calorie trend
  - Macro distribution over time
  - Average intake vs. target
- Insights: "You averaged 1,850 cal this week"

---

## 👤 Phase 5: Profile & Settings

### Profile Header
- Avatar (upload/change)
- Name
- Current plan status badge
- Member since date

### Current Stats Card
- Daily Calorie Target
- Weight (current vs. goal)
- BMI indicator

### Quick Actions
- Edit Goals
- Update Preferences
- Recalculate Targets

### Settings Sections

#### Account
- Email
- Password change
- Notifications

#### Preferences
- Diet type
- Allergies
- Dislikes
- Cooking preferences

#### App Settings
- Units (metric/imperial)
- Language
- Theme (light/dark/system)
- Notifications

#### Support
- Help & FAQ
- Contact Support
- Privacy Policy
- Terms of Service

#### Danger Zone
- Delete Account
- Export Data

---

## 🎨 UI Components Library

### New Components Needed

```
/components/app/
├── navigation/
│   └── bottom-nav.tsx           # Bottom navigation bar
├── onboarding/
│   ├── step-indicator.tsx       # Progress dots/bar
│   ├── onboarding-card.tsx      # Wrapper for each step
│   ├── wheel-picker.tsx         # Mobile-friendly number picker
│   ├── visual-select.tsx        # Icon cards for selection
│   ├── chip-select.tsx          # Multi-select chips
│   └── unit-toggle.tsx          # Metric/Imperial toggle
├── dashboard/
│   ├── week-strip.tsx           # Horizontal week days
│   ├── day-card.tsx             # Single day circle
│   ├── calorie-ring.tsx         # Circular progress
│   ├── meal-card.tsx            # Swipeable meal card
│   ├── macro-bar.tsx            # Horizontal progress bar
│   └── quick-actions-fab.tsx    # Floating action button
├── meal-builder/
│   ├── recipe-header.tsx        # Image + overlay
│   ├── ingredient-row.tsx       # Swappable ingredient
│   ├── instruction-step.tsx     # Numbered step
│   ├── nutrition-chart.tsx      # Pie/bar charts
│   └── portion-adjuster.tsx     # Portion size buttons
├── nutrition/
│   ├── calorie-overview.tsx     # Large ring + stats
│   ├── macro-breakdown.tsx      # Three progress bars
│   ├── nutrient-row.tsx         # Single nutrient progress
│   └── trend-chart.tsx          # Line/bar chart
└── shared/
    ├── swipeable-card.tsx       # Left/right swipe actions
    ├── bottom-sheet.tsx         # Slide-up modal
    ├── animated-ring.tsx        # SVG circular progress
    └── skeleton-card.tsx        # Loading placeholder
```

---

## 🗂️ Implementation Order

### Sprint 1: Foundation & Onboarding
1. Create app layout with bottom navigation
2. Build onboarding step components
3. Implement onboarding flow with state management
4. Add onboarding completion logic (update profile)
5. Create redirect logic (onboarding → dashboard)

### Sprint 2: Dashboard Core
1. Week strip component
2. Calorie ring component
3. Meal card component (basic)
4. Dashboard layout
5. Fetch daily plan data

### Sprint 3: Dashboard Interactions
1. Swipeable meal cards
2. Quick log functionality
3. Meal swap modal
4. Water tracking widget

### Sprint 4: Meal Builder
1. Recipe detail view
2. Ingredients list with swap
3. Instructions view
4. Nutrition breakdown
5. Portion adjustment
6. Log meal action

### Sprint 5: Nutrition Details
1. Calorie overview
2. Macro breakdown
3. Micronutrient sections
4. Meal log list
5. Weekly/monthly trends

### Sprint 6: Profile & Polish
1. Profile page
2. Settings pages
3. Edit preferences
4. Animations & transitions
5. Performance optimization

---

## 📐 Responsive Breakpoints

```css
/* Mobile First */
/* Default: 0-639px (mobile) */
sm: 640px   /* Large phone / small tablet */
md: 768px   /* Tablet portrait */
lg: 1024px  /* Tablet landscape / small laptop */
xl: 1280px  /* Desktop */
2xl: 1536px /* Large desktop */
```

### Layout Adaptations
- **Mobile**: Single column, bottom nav, full-width cards
- **Tablet**: Two-column layouts, larger cards
- **Desktop**: Three-column max, sidebar navigation option

---

## 🎭 Animation Guidelines

- **Page transitions**: Fade + slide (300ms)
- **Card interactions**: Spring physics for swipe
- **Progress rings**: Animated on mount (600ms ease-out)
- **Modals**: Slide up from bottom (250ms)
- **Micro-interactions**: Scale on press (95%), color transitions

---

## ✅ Ready to Implement

Please confirm this plan, and we'll start with **Sprint 1: Foundation & Onboarding**.

The first implementation steps will be:
1. Create the app layout with bottom navigation
2. Build the onboarding step indicator component
3. Create each onboarding step as a component
4. Implement the onboarding flow with local state
5. Connect to Supabase to save profile data
6. Add routing logic for onboarding completion

**Shall we proceed with this plan?**
