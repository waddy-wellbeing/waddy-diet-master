# Phase 3 & 4 Testing Checklist

## Setup (Do This First)

### 1. Run the SQL Migration
Go to Supabase Dashboard → SQL Editor and run:
```sql
-- File: supabase/migrations/20251219_add_macro_similarity_settings.sql
INSERT INTO system_settings (key, value, description) VALUES
  ('macro_similarity_weights', '{"protein": 0.5, "carbs": 0.3, "fat": 0.2}'::jsonb, 
   'Weights for macro similarity scoring: protein 50%, carbs 30%, fat 20%.'),
  ('min_macro_similarity_threshold', '5'::jsonb, 
   'Minimum difference in macro similarity score to prioritize alternatives.')
ON CONFLICT (key) DO NOTHING;
```

### 2. Start Development Server
```bash
npm run dev
```

---

## Phase 3 Testing: Ingredient Swaps with Macro Awareness

### Test Location
**URL**: http://localhost:3000/admin/test-console/swaps

### Test Case 1: High-Protein Ingredient
**Goal**: Verify that high-protein alternatives are prioritized

**Steps**:
1. Search for "دجاج" or "chicken"
2. Select "دجاج صدور" (Chicken Breast)
3. Amount: 100g
4. Click "Find Swaps"

**Expected Results**:
- ✅ Original ingredient shows macro profile: ~75% Protein, ~0% Carbs, ~25% Fat
- ✅ Alternatives sorted with other chicken/turkey at top (same subgroup + high protein)
- ✅ Each alternative shows:
  - Macro similarity score (70-95 for similar meats)
  - Quality badge ("excellent" or "good" for similar proteins)
  - Color-coded macro percentages (P/C/F)
  - Protein difference in grams (should be small, ±2-5g for similar meats)
- ✅ Lower similarity scores (<60) for different protein sources

**Screenshot Checklist**:
- [ ] Original ingredient macro profile visible
- [ ] Swap quality badges present
- [ ] Macro similarity scores displayed
- [ ] Protein differences shown (green for more, red for less)

---

### Test Case 2: Balanced Macro Ingredient
**Goal**: Verify mixed macros show varied similarity scores

**Steps**:
1. Search for "زبادي" or "yogurt"
2. Select a yogurt option
3. Amount: 200g
4. Click "Find Swaps"

**Expected Results**:
- ✅ Original shows balanced macros (e.g., P:20%, C:40%, F:40%)
- ✅ Alternatives with similar balance ranked higher
- ✅ Wide range of similarity scores (50-95)
- ✅ "Same subgroup" badges for other dairy products
- ✅ Protein differences vary more widely

---

### Test Case 3: Sorting Verification
**Goal**: Verify 4-tier sorting logic works correctly

**Steps**:
1. Select any ingredient with multiple alternatives
2. Observe the order of results

**Expected Sorting Order**:
1. **Priority 1**: Same subgroup + High similarity (≥70%) + "excellent/good" badge
2. **Priority 2**: Same subgroup + Lower similarity + "Same subgroup" badge visible
3. **Priority 3**: Different subgroup + High similarity (≥70%)
4. **Priority 4**: Rest sorted by similarity score, then alphabetically

**Visual Indicators**:
- [ ] "Same subgroup" green badges appear on top results
- [ ] Highest macro similarity scores (85-95) near the top
- [ ] Quality badges correlate with position (excellent/good at top)

---

### Test Case 4: Edge Cases
**Goal**: Test unusual scenarios

**Test 4a - No Alternatives**:
- Search for a unique ingredient with no food group
- Expected: Empty state message

**Test 4b - Single Food Group Member**:
- Find ingredient with food_group but is only member
- Expected: "No swap options found" message

**Test 4c - Large Quantity**:
- Set amount to 500g
- Expected: Suggested amounts scale correctly, protein differences proportional

---

## Phase 4 Testing: Admin Settings Panel

### Test Location
**URL**: http://localhost:3000/admin/settings

### Test Case 1: Settings Display
**Goal**: Verify new "Macro Comparison" section appears

**Steps**:
1. Navigate to admin settings page
2. Scroll to find "Macro Comparison" section

**Expected Results**:
- ✅ Section header "Macro Comparison" with Target (🎯) icon
- ✅ Descriptive text: "Configure how recipe and ingredient alternatives are scored..."
- ✅ Two setting cards visible:
  1. "Macro Similarity Weights" (JSON editor)
  2. "Min Macro Similarity" (number input)
- ✅ Current values displayed:
  - Weights: `{"protein": 0.5, "carbs": 0.3, "fat": 0.2}`
  - Threshold: `5`

**Screenshot Checklist**:
- [ ] Section exists and is properly styled
- [ ] Settings cards render correctly
- [ ] Edit buttons visible on each card

---

### Test Case 2: Edit Macro Weights
**Goal**: Verify JSON editing works with validation

**Steps**:
1. Click edit (✏️) on "Macro Similarity Weights"
2. Modify JSON to:
   ```json
   {
     "protein": 0.7,
     "carbs": 0.2,
     "fat": 0.1
   }
   ```
3. Click "Save Changes"

**Expected Results**:
- ✅ JSON accepts valid format
- ✅ Success message appears
- ✅ Dialog closes
- ✅ Value updates in card
- ✅ **Effect**: Go back to swaps page, protein-rich alternatives should rank even higher now

**Test Invalid JSON**:
1. Edit again, enter invalid JSON: `{protein: 0.5}` (missing quotes)
2. Try to save
3. Expected: Error message about invalid JSON

---

### Test Case 3: Edit Threshold
**Goal**: Test number input validation

**Steps**:
1. Click edit on "Min Macro Similarity"
2. Change value to `10`
3. Save

**Expected Results**:
- ✅ Accepts number input
- ✅ Saves successfully
- ✅ **Effect**: Go to recipe alternatives, macro sorting should be less aggressive (only kick in with >10 point difference)

**Test Edge Cases**:
- Try negative number: Should it allow? (Currently no validation)
- Try very large number (e.g., 100): Should accept
- Try decimal (e.g., 7.5): Should accept

---

### Test Case 4: Settings Integration
**Goal**: Verify settings actually affect swap logic

**Steps**:
1. In settings, set `macro_similarity_weights` to heavily favor protein:
   ```json
   {"protein": 0.8, "carbs": 0.1, "fat": 0.1}
   ```
2. Save
3. Go to swaps page
4. Test high-protein ingredient (chicken)

**Expected Results**:
- ✅ Macro similarity scores change (higher for protein-matched items)
- ✅ Sorting adjusts (protein alternatives rank even higher)
- ✅ Score calculations reflect new weights

**Note**: Settings are loaded per-request, so changes take effect immediately without restart.

---

## Regression Testing

### Verify Existing Features Still Work

**Recipe Alternatives** (Phase 2 - Already Working):
- [ ] http://localhost:3000/admin/test-console/alternatives
- [ ] Macro similarity still displayed correctly
- [ ] Quality badges still present
- [ ] No errors in console

**Other Test Console Tools**:
- [ ] TDEE Calculator works
- [ ] Meal Planner works
- [ ] Full Tester works

**Admin Panel**:
- [ ] Other settings sections still editable
- [ ] No breaking changes to meal distribution, scaling limits, etc.

---

## Performance Checks

### Page Load Times
- [ ] Swaps page loads in < 2s
- [ ] Settings page loads in < 1s
- [ ] No console errors or warnings

### Calculation Performance
- [ ] Finding swaps for 50+ alternatives completes in < 500ms
- [ ] Macro calculations don't cause UI lag
- [ ] Sorting 100+ alternatives is instant

---

## Browser Console Checks

Open DevTools → Console while testing:

**Look For** (Should NOT appear):
- ❌ TypeScript errors
- ❌ React warnings about keys
- ❌ Undefined property accesses
- ❌ Failed API calls

**Look For** (Should appear):
- ✅ Clean console (or only expected Supabase auth logs)
- ✅ No red error messages

---

## Success Criteria

### Phase 3 - Ingredient Swaps ✅
- [ ] Macro similarity scores display correctly
- [ ] Swap quality badges show (excellent/good/acceptable/poor)
- [ ] Sorting prioritizes same subgroup + high protein
- [ ] Protein differences calculated accurately
- [ ] Original ingredient macro profile visible
- [ ] UI responsive on mobile/tablet

### Phase 4 - Admin Settings ✅
- [ ] "Macro Comparison" section renders
- [ ] Can edit macro similarity weights (JSON)
- [ ] Can edit threshold (number)
- [ ] Changes save to database
- [ ] Settings affect swap calculations immediately
- [ ] Validation prevents invalid JSON

### Overall ✅
- [ ] No breaking changes to existing features
- [ ] No TypeScript errors in build
- [ ] No runtime errors in console
- [ ] Performance acceptable
- [ ] UI/UX consistent with existing design

---

## Next Steps After Testing

If all tests pass:
1. Document any issues found
2. Decide whether to proceed with Phase 5 & 6 or make adjustments
3. Consider adding unit tests for macro calculation utilities

If issues found:
1. Note specific failures
2. Create bug fix tasks
3. Re-test after fixes

---

## Quick Command Reference

```bash
# Start dev server
npm run dev

# Build check
npm run build

# View logs
tail -f .next/trace

# Reset test data (if needed)
# Run in Supabase SQL Editor:
DELETE FROM system_settings WHERE key IN ('macro_similarity_weights', 'min_macro_similarity_threshold');
```
