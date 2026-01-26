# Phase 1 Testing Guide - Calendar Enhancement & Meal Planning

## Overview
Phase 1 adds meal planning capability to the dashboard calendar with visual indicators and a mobile-first planning interface.

## Acceptance Criteria

### 1. Calendar Visual Indicators ✅
**What to test:**
- [ ] Past dates with plans show 🟢 filled green indicator
- [ ] Past dates with logs show 🟢 filled green indicator
- [ ] Past dates with both show 🟡 filled indicator (half-filled or distinct color)
- [ ] Future dates with plans show 🔵 border-only blue indicator
- [ ] Future dates without plans show no indicator
- [ ] Today shows appropriate indicator based on plan/log status

**How to test:**
1. Navigate to `/dashboard`
2. Look at calendar dates
3. Plan a meal for tomorrow → should see 🔵 blue border
4. Log a meal for yesterday → should see 🟢 green fill
5. Plan AND log for today → should see 🟡 indicator

**Expected behavior:**
- Indicators are visible and distinct
- Colors match brand (lime green for logged)
- Mobile-friendly size (min 8px × 8px)

### 2. Calendar Interactivity ✅
**What to test:**
- [ ] Clicking past dates does nothing (or shows view-only)
- [ ] Clicking today opens meal planning sheet
- [ ] Clicking future dates opens meal planning sheet
- [ ] Clicking dates beyond 14 days shows "Can only plan 14 days ahead" message

**How to test:**
1. Click yesterday's date → no sheet opens
2. Click today → meal planning sheet opens
3. Click next week → meal planning sheet opens
4. Click 20 days from now → error toast appears

**Expected behavior:**
- Sheet opens smoothly with slide-up animation (300ms)
- Sheet covers ~90% of screen height on mobile
- Backdrop is semi-transparent dark overlay

### 3. Meal Planning Sheet UI ✅
**What to test:**
- [ ] Sheet header shows selected date (e.g., "Plan Meals for Monday, Jan 6")
- [ ] Four meal type sections: Breakfast, Lunch, Dinner, Snacks
- [ ] Each section has "+ Add Recipe" button
- [ ] Existing plans show recipe name, image thumbnail, servings (1)
- [ ] Can remove recipe from slot (× button)
- [ ] "Save Plan" button at bottom
- [ ] "Cancel" or swipe-down closes sheet

**How to test:**
1. Open meal planning sheet
2. Verify header date is correct
3. Check all 4 meal sections are visible
4. Try scrolling - content should not clip
5. Click "+ Add Recipe" → recipe picker opens

**Expected behavior:**
- Touch targets min 44px × 44px
- Clear visual hierarchy (meal types bold)
- Empty state shows "+ Add Recipe" prominently
- Bottom buttons are thumb-reachable

### 4. Recipe Picker Sheet ✅
**What to test:**
- [ ] Search bar at top with debounced search (300ms)
- [ ] Recipe cards show: image, name, prep time, calories, macros
- [ ] Can filter by: meal type, prep time, dietary tags
- [ ] Clicking recipe card selects it and closes picker
- [ ] Back button returns to meal planning sheet
- [ ] Shows "No recipes found" if search returns nothing

**How to test:**
1. Open meal planning sheet → click "+ Add Recipe"
2. See recipe picker with search bar
3. Type "chicken" → wait 300ms → results filter
4. Click a recipe → picker closes, recipe appears in meal slot
5. Test filters (if implemented in Phase 1)

**Expected behavior:**
- Search is responsive (debounced)
- Recipe images load properly
- Scrolling is smooth
- Selected recipe shows visual feedback (checkmark)

### 5. Save & Persist Plans ✅
**What to test:**
- [ ] Clicking "Save Plan" saves to `daily_plans` table
- [ ] Success toast appears: "Meal plan saved!"
- [ ] Sheet closes after save
- [ ] Calendar indicator updates immediately (optimistic)
- [ ] Refreshing page shows saved plan still exists
- [ ] Re-opening sheet for same date shows saved recipes

**How to test:**
1. Plan meals for tomorrow
2. Add 2 recipes (breakfast + lunch)
3. Click "Save Plan"
4. Verify toast appears
5. Verify calendar shows 🔵 indicator
6. Refresh browser (Cmd+R)
7. Click tomorrow again → should see 2 recipes still there

**Expected behavior:**
- Save is fast (<500ms for 1-4 recipes)
- Optimistic UI updates immediately
- Data persists after refresh
- No duplicate entries created

### 6. Update Existing Plans ✅
**What to test:**
- [ ] Opening existing plan shows all saved recipes
- [ ] Can add more recipes to existing plan
- [ ] Can remove recipes from existing plan
- [ ] Can replace recipe in a meal slot
- [ ] Clicking "Save Plan" updates (not creates duplicate)

**How to test:**
1. Open existing plan for tomorrow
2. Remove breakfast recipe
3. Add dinner recipe
4. Click "Save Plan"
5. Refresh and verify changes persisted

**Expected behavior:**
- Update operation uses UPSERT (ON CONFLICT UPDATE)
- Plan date + user_id uniqueness enforced
- No orphaned records

### 7. Delete Plans ✅
**What to test:**
- [ ] "Clear All" button appears when plan has recipes
- [ ] Confirmation dialog appears before delete
- [ ] Deleting removes plan from database
- [ ] Calendar indicator disappears after delete
- [ ] Can create new plan for same date after delete

**How to test:**
1. Open existing plan
2. Click "Clear All"
3. Confirm deletion
4. Verify calendar indicator disappears
5. Re-open date → empty sheet

**Expected behavior:**
- Confirmation prevents accidental deletes
- Delete is permanent (no soft delete)
- Cascade delete handles related data

### 8. Mobile Responsiveness ✅
**What to test:**
- [ ] Bottom sheet works on mobile Safari iOS
- [ ] Touch targets are easy to tap (44px min)
- [ ] Sheet swipe-down gesture closes it
- [ ] No horizontal scrolling
- [ ] Text is readable without zoom
- [ ] Buttons are thumb-reachable

**How to test:**
1. Open on iPhone (use Safari DevTools responsive mode)
2. Test all touch interactions
3. Verify sheet height (should be ~90vh)
4. Try swiping down to close
5. Check all buttons in bottom-right thumb zone

**Expected behavior:**
- Smooth animations (60fps)
- No layout shift
- Native-like feel

### 9. Error Handling ✅
**What to test:**
- [ ] Network error shows "Failed to save plan" toast
- [ ] Empty plan shows "Add at least one recipe" validation
- [ ] Duplicate recipe in same slot shows warning
- [ ] Loading states show skeleton/spinner

**How to test:**
1. Turn off network → try to save → error toast
2. Try to save empty plan → validation message
3. Add same recipe twice → warning
4. Observe loading states during data fetch

**Expected behavior:**
- Errors are user-friendly
- Loading states prevent confusion
- Validation is clear and helpful

### 10. Performance ✅
**What to test:**
- [ ] Calendar render with 30 days < 100ms
- [ ] Opening sheet < 200ms
- [ ] Recipe search results < 500ms
- [ ] Save operation < 500ms
- [ ] No memory leaks (open/close 10 times)

**How to test:**
1. Open Chrome DevTools Performance tab
2. Record calendar render
3. Check for long tasks (>50ms)
4. Monitor memory usage
5. Use Lighthouse for accessibility score

**Expected behavior:**
- Smooth 60fps animations
- No jank during scroll
- Memory stable after multiple operations

## Manual Test Flow (Complete E2E)

### Scenario 1: First Time User Plans Week
1. ✅ Navigate to `/dashboard`
2. ✅ See empty calendar (no indicators)
3. ✅ Click tomorrow's date
4. ✅ See meal planning sheet open
5. ✅ Add breakfast recipe (search "oats")
6. ✅ Add lunch recipe (search "chicken")
7. ✅ Click "Save Plan"
8. ✅ See success toast
9. ✅ See calendar show 🔵 indicator for tomorrow
10. ✅ Click day after tomorrow
11. ✅ Plan 3 meals (breakfast, lunch, dinner)
12. ✅ Save and verify indicator
13. ✅ Refresh page
14. ✅ Verify both plans persist

### Scenario 2: User Updates Existing Plan
1. ✅ Open existing plan for tomorrow
2. ✅ See saved recipes load
3. ✅ Remove breakfast recipe
4. ✅ Add snack recipe
5. ✅ Save
6. ✅ Re-open to verify changes

### Scenario 3: User Deletes Plan
1. ✅ Open existing plan
2. ✅ Click "Clear All"
3. ✅ Confirm deletion
4. ✅ Verify indicator disappears
5. ✅ Re-open to verify empty state

### Scenario 4: Mobile User
1. ✅ Open on mobile device
2. ✅ Plan meals using touch
3. ✅ Swipe down to close sheet
4. ✅ Verify thumb-reachable buttons
5. ✅ Test in PWA mode

## Automated Testing (Optional for Phase 1)

```typescript
// Example test cases for Phase 2+ when we add testing

describe('Calendar Indicators', () => {
  it('shows blue border for future planned dates', async () => {
    // Test implementation
  })
  
  it('shows green fill for logged dates', async () => {
    // Test implementation
  })
})

describe('Meal Planning Sheet', () => {
  it('opens when clicking future date', async () => {
    // Test implementation
  })
  
  it('saves plan to database', async () => {
    // Test implementation
  })
})
```

## Phase 1 Completion Checklist

Before marking Phase 1 complete, ensure:

- [ ] All 10 acceptance criteria sections have ✅ checkmarks
- [ ] Manual test flows pass (all 4 scenarios)
- [ ] Mobile testing complete (iOS Safari + Chrome Android)
- [ ] No console errors
- [ ] No TypeScript errors (`npm run build`)
- [ ] Code committed to feature branch
- [ ] Ready to merge to main or continue to Phase 2

## Known Limitations (Acceptable for Phase 1)

- No recipe filters in picker (basic search only) ✅
- No bulk operations (add same recipe to multiple days) ✅
- No templates yet ✅
- No shopping list generation ✅
- Fixed 1 serving per recipe ✅

These will be addressed in Phases 2-4.

## Success Metrics

After Phase 1 deployment:
- Users can plan meals for 1-14 days ahead
- Calendar shows clear visual feedback
- Mobile-first design feels native
- Zero data loss (all saves persist)
- <5% error rate on save operations

---

**Next Phase:** Phase 2 - Shopping List Generation
