# BiteRight User Scenarios

## Overview

This document outlines the key user scenarios and flows for the BiteRight nutrition app. These scenarios guide feature development and UX design decisions.

---

## Scenario 1: New User Onboarding

### Context
A new user has just signed up and needs to complete onboarding to get their personalized meal plan.

### Flow

1. **Welcome Screen**
   - User sees a friendly welcome message
   - Brief explanation of what to expect (3-5 minutes)
   - "Let's Get Started" CTA

2. **Basic Information**
   - Name (optional display name)
   - Age, height, weight
   - Biological sex (for accurate calorie calculations)
   - Activity level (sedentary, light, moderate, active, very active)

3. **Goals Selection**
   - Primary goal: Lose weight / Maintain weight / Build muscle
   - Target weight (if applicable)
   - Pace preference: Slow & steady / Moderate / Aggressive

4. **Dietary Preferences**
   - Diet type: Omnivore, Vegetarian, Vegan, Pescatarian, Keto, etc.
   - Allergies/intolerances: Gluten, Dairy, Nuts, Shellfish, etc.
   - Dislikes: Ingredients to exclude from plans

5. **Lifestyle & Cooking**
   - Cooking skill: Beginner, Intermediate, Advanced
   - Time available: Quick meals (<15 min), Standard (15-30 min), Elaborate (30+ min)
   - Meal prep preference: Cook daily vs. batch prep

6. **Plan Generation**
   - Loading screen with encouraging message
   - Show calculated targets (calories, protein, carbs, fat)
   - Preview of first day's meals

7. **Onboarding Complete**
   - Celebration moment
   - Navigate to dashboard with Day 1 plan

### Success Criteria
- Completion rate > 80%
- Time to complete < 5 minutes
- User understands their targets

---

## Scenario 2: Viewing Today's Meal Plan

### Context
A user opens the app to see what they should eat today.

### Flow

1. **Dashboard Load**
   - Today's date prominently displayed
   - Daily progress ring (calories consumed vs. target)
   - Macro breakdown (protein, carbs, fat)

2. **Meal Cards**
   - Breakfast, Lunch, Dinner, Snacks displayed as cards
   - Each card shows:
     - Meal name and photo
     - Calories and key macros
     - Prep time indicator
     - Quick actions: "Log It" / "Swap" / "View Recipe"

3. **Meal Detail**
   - Tap a meal to see full recipe
   - Ingredients list with quantities
   - Step-by-step instructions
   - Nutritional breakdown
   - "Log This Meal" button

4. **Navigation**
   - Swipe or tap arrows to view other days
   - Quick access to recipes, logging history

### Success Criteria
- Time to view today's plan < 2 seconds
- User can see all meals without scrolling excessively
- Clear visual hierarchy

---

## Scenario 3: Swapping a Meal

### Context
User doesn't like a suggested meal or doesn't have the ingredients, and wants to swap it for something else.

### Flow

1. **Initiate Swap**
   - User taps "Swap" on a meal card
   - Or taps meal detail and selects "Find Alternative"

2. **Alternative Options**
   - Show 3-5 alternative meals that:
     - Fit similar calorie/macro profile
     - Match user's dietary preferences
     - Are appropriate for the meal type (breakfast alternatives for breakfast)
   - Each option shows name, photo, calories, prep time

3. **Quick Filters** (optional)
   - Filter by: Prep time, Cuisine type, Main ingredient
   - "Show me something completely different"

4. **Confirm Swap**
   - User taps preferred alternative
   - Confirmation: "Swap [Old Meal] with [New Meal]?"
   - Plan updates immediately
   - Daily totals recalculate

5. **Feedback** (optional)
   - "Why are you swapping?" (Don't have ingredients, Don't like it, Takes too long, Other)
   - Helps improve future recommendations

### Success Criteria
- Swap completed in < 30 seconds
- Alternatives are genuinely appealing
- Daily targets remain balanced after swap

---

## Scenario 4: Logging What You Ate

### Context
User has eaten a meal and wants to log it to track their nutrition.

### Flow

#### Path A: Logging a Planned Meal

1. **One-Tap Log**
   - From dashboard, tap "Log It" on a meal card
   - Meal is logged with pre-calculated nutrition
   - Progress ring updates immediately
   - Optional: Adjust portion size (ate half, ate 1.5x, etc.)

2. **Confirmation**
   - Brief toast: "Logged! 🎉"
   - Meal card shows "Logged" status
   - Streak counter updates if applicable

#### Path B: Logging an Unplanned Meal/Food

1. **Open Logging**
   - Tap "+" button or "Log Food" from nav
   - Search bar prominent

2. **Ingredient Search**
    - Type ingredient name (e.g., "chicken breast")
    - Results from:
       - User's recent ingredients
       - Recipes in the system
       - Ingredient database
    - Each result shows name, serving size, calories

3. **Select & Customize**
   - Tap an ingredient item
   - Adjust quantity/serving size
   - See macro breakdown update in real-time

4. **Assign to Meal**
   - Select meal slot: Breakfast, Lunch, Dinner, Snack
   - Confirm log

5. **Confirmation**
   - Progress updates
   - Ingredient added to history for easy re-logging

#### Path C: Quick Add (Calories Only)

1. **Quick Add Option**
   - For when user just wants to log approximate calories
   - Enter calories manually
   - Optional: Add protein estimate

### Success Criteria
- Planned meal logged in < 3 seconds
- Unplanned food logged in < 30 seconds
- User feels motivated, not burdened

---

## Scenario 5: Reviewing Weekly Progress

### Context
User wants to see how they've been doing over the past week.

### Flow

1. **Access Progress**
   - Tap "Progress" or "History" in navigation
   - Default view: Current week

2. **Weekly Overview**
   - Calendar view showing logged days (checkmarks/streaks)
   - Average daily calories vs. target
   - Macro adherence chart
   - Logging streak counter

3. **Day Drill-Down**
   - Tap any day to see what was logged
   - Compare planned vs. actual
   - See which meals were swapped

4. **Insights** (Phase 2)
   - "You hit your protein target 5 out of 7 days!"
   - "Your most logged breakfast: Oatmeal with berries"
   - Trends over time

### Success Criteria
- User understands their adherence at a glance
- Insights feel encouraging, not judgmental
- Easy navigation between days/weeks

---

## Technical Notes

### Data Requirements per Scenario

| Scenario | Primary Tables | Key JSONB Fields |
|----------|---------------|------------------|
| Onboarding | `profiles` | `basic_info`, `targets`, `preferences` |
| View Plan | `daily_plans`, `recipes` | `plan`, `ingredients` |
| Swap Meal | `daily_plans`, `recipes` | `plan` |
| Log Meal | `daily_logs`, `ingredients` | `log`, `macros` |
| Progress | `daily_logs`, `profiles` | `log`, `targets` |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-11-25 | 1.0 | Initial scenarios document |
