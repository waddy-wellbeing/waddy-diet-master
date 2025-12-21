# Swap & Alternative Implementation Plan

**Status**: In Progress  
**Last Updated**: December 19, 2025  
**Priority**: High - Core user experience feature

---

## 📊 Current Implementation Status

### ✅ What's Working

#### Recipe Alternatives (Meal-Level Swapping)
**Location**: `lib/actions/test-console.ts` - `getRecipeAlternatives()`

**Current Logic**:
- ✅ Matches recipes by **meal_type** (with overlap support)
- ✅ Scales recipes to match **target calories** exactly
- ✅ Filters by scale factor limits (0.5x - 2.0x)
- ✅ Sorts by scale factor closest to 1.0 (natural portions)
- ✅ Supports dietary filters (vegetarian, vegan, gluten-free, dairy-free)
- ✅ Pagination support for large result sets

**What's Missing**:
- ❌ No macro ratio consideration (protein/carbs/fat distribution)
- ❌ No micronutrient comparison
- ❌ No "similar profile" scoring beyond calories

#### Ingredient Swaps
**Location**: `lib/actions/recipes.ts` - `getUserIngredientSwaps()`

**Current Logic**:
- ✅ Matches ingredients by **food_group** (e.g., "Proteins", "Vegetables")
- ✅ Prioritizes same **subgroup** (e.g., "Lean meats" over "Fatty meats")
- ✅ Calculates calorie-equivalent quantities
- ✅ Shows calorie difference percentage

**What's Missing**:
- ❌ No protein content matching
- ❌ No macro ratio preservation
- ❌ No micronutrient consideration (iron, vitamins, etc.)

#### Meal Type Mapping
**Location**: Multiple files (dashboard, meal-builder, test-console)

**Current Status**:
- ✅ **UPDATED** - All database meal_types now properly mapped
- ✅ Supports: breakfast, lunch, dinner, snacks, one pot, side dishes, smoothies, snack (singular)
- ✅ Priority ordering (e.g., dinner prefers "dinner" recipes first)

---

## 🎯 Recommended Updates - Macro-Aware Swapping

### Philosophy
**Primary Goal**: Maintain nutritional balance when swapping  
**User Benefit**: Users hit their macro targets (protein/carbs/fat) consistently

### Approach: Tiered Matching System

#### Tier 1: Essential Match (Must Have)
- Calories within tolerance (±10%)
- Same meal_type category
- Dietary restrictions (if set)

#### Tier 2: Macro Balance (Preferred)
- Protein % within ±15% (most important for satiety & muscle)
- Total macro ratio similarity score

#### Tier 3: Micronutrients (Nice to Have)
- Fiber content similarity
- Key vitamin/mineral comparison (optional display)

---

## 📋 Implementation Phases

### **Phase 1: Foundation - Macro Scoring System** ⏱️ 2-3 days ✅ **COMPLETED**

**Goal**: Add macro comparison logic without breaking existing functionality

#### 1.1 Create Macro Calculation Utilities
**File**: `lib/utils/nutrition.ts` ✅ **COMPLETED**

```typescript
// Calculate macro percentages from absolute values
export function calculateMacroPercentages(macros: {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}) {
  const { calories, protein_g, carbs_g, fat_g } = macros
  return {
    protein_pct: (protein_g * 4 / calories) * 100,
    carbs_pct: (carbs_g * 4 / calories) * 100,
    fat_pct: (fat_g * 9 / calories) * 100,
  }
}

// Calculate similarity score between two macro profiles (0-100)
export function calculateMacroSimilarity(
  original: MacroProfile,
  alternative: MacroProfile,
  weights: { protein: number; carbs: number; fat: number } = { protein: 0.5, carbs: 0.3, fat: 0.2 }
): number {
  const proteinDiff = Math.abs(original.protein_pct - alternative.protein_pct)
  const carbsDiff = Math.abs(original.carbs_pct - alternative.carbs_pct)
  const fatDiff = Math.abs(original.fat_pct - alternative.fat_pct)
  
  // Convert differences to similarity (100 = identical, 0 = very different)
  const proteinScore = Math.max(0, 100 - proteinDiff)
  const carbsScore = Math.max(0, 100 - carbsDiff)
  const fatScore = Math.max(0, 100 - fatDiff)
  
  return (proteinScore * weights.protein) + (carbsScore * weights.carbs) + (fatScore * weights.fat)
}
```

**Tasks**:
- [x] Create `lib/utils/nutrition.ts`
- [x] Add macro percentage calculator
- [x] Add similarity scoring function
- [x] Add helper utilities (classifyMacroProfile, getSwapQuality, formatMacroProfile, calculateProteinDifference)
- [x] Document calculation methodology with JSDoc comments
- [ ] Add unit tests (recommended for next phase)

---
 ✅ **COMPLETED**

**Goal**: Update recipe swapping to consider macro ratios

#### 2.1 Update `getRecipeAlternatives()` Function ✅ **COMPLETED**
**File**: `lib/actions/test-console.ts`

**Changes**:
1. Calculate macro percentages for original recipe ✅
2. Calculate macro percentages for each alternative ✅
3. Add similarity score to each alternative ✅
4. Update sorting: Primary by similarity score, secondary by scale factor ✅
5. Add macro comparison data to response ✅

**New Response Format**:
```typescript
{
  id: string
  name: string
  // ... existing fields ...
  scale_factor: number
  scaled_calories: number
  macro_similarity_score: number  // NEW: 0-100
  macro_profile: {                // NEW
    protein_pct: number
    carbs_pct: number
    fat_pct: number
  }
  protein_diff_g: number          // NEW: difference in grams
  swap_quality: 'excellent' | 'good' | 'acceptable' | 'poor'  // NEW
}
```

**Tasks**:
- [x] Update RecipeForMealPlan interface with macro fields
- [x] Integrate macro similarity scoring
- [x] Update sorting algorithm (macro similarity primary, then scale factor)
- [x] Add macro profile to response
- [x] Calculate protein difference
- [x] Add swap quality rating
- [x] Update TypeScript types
- [x] Maintain backward compatibility
- [ ] Test with various recipes (ready for testing)

#### 2.2 Add System Settings for Macro Tolerances
**File**: `lib/actions/settings.ts`

**Status**: ⏸️ **DEFERRED** - Using sensible defaults for now
- Current defaults: protein weight 50%, carbs 30%, fat 20%
- Min macro similarity threshold: 5 points (only prioritize if significant difference)
- Can be added later based on user feedback

**Tasks**:
- [ ] Add swap_preferences to system_settings table (future)
- [ ] Create getter/setter functions (future)
- [ ] Add admin UI for configuration (Phase 4)
- [ ] Document default values (current defaults documented in code)uration
- [ ] Document default values

---

### **Phase 3: Ingredient Swaps Enhancement** ⏱️ 2-3 days ✅ **COMPLETED**

**Goal**: Update ingredient swapping to preserve protein content and macro similarity

#### 3.1 Update `getUserIngredientSwaps()` Function
**File**: `lib/actions/recipes.ts`

**Changes**:
1. Calculate protein percentage of original ingredient
2. Filter alternatives by protein similarity (±20%)
3. Add macro comparison to response
4. Sort by: same subgroup → protein similarity → name

**New Sorting Priority**:
```
1. Same subgroup AND similar protein (±20%)
2. Same subgroup
3. Different subgroup but similar protein
4. All others (sorted by name)
```

**Tasks**:
- [x] Add protein percentage calculation
- [x] Add macro similarity scoring for ingredients
- [x] Update sorting logic (4-tier priority system)
- [x] Add macro comparison data to response (macro_similarity_score, macro_profile, protein_diff_g, swap_quality)
- [x] Update TypeScript types and interfaces
- [x] Enhanced UI with macro badges and similarity scores
- [x] Test with various ingredients (ready for testing)

#### 3.2 Add Micronutrient Display (Optional)
**File**: `components/meal-builder/ingredient-swap-card.tsx` (NEW)

**Features**:
- Show fiber comparison
- Show key vitamins/minerals if available
- Collapsible "Nutritional Comparison" section

**Tasks**:
- [ ] Design swap card component
- [ ] Add micronutrient comparison UI
- [ ] Add toggle for detailed view
- [ ] Test responsiveness

---

### **Phase 4: Admin Panel - Testing & Validation** ⏱️ 1-2 days ✅ **COMPLETED**

**Goal**: Give admins tools to validate and tune swap logic with UI enhancements

#### 4.1 Enhanced Test Console ✅ **COMPLETED**
**Files**: 
- `app/admin/test-console/alternatives/page.tsx` (Phase 2)
- `app/admin/test-console/swaps/page.tsx` (Phase 3)

**New Features**:
1. ✅ Display macro similarity scores in alternatives/swaps cards
2. ✅ Show macro comparison with color-coded percentages (P/C/F)
3. ✅ Display protein difference in grams (+/-)
4. ✅ Swap quality badges (excellent/good/acceptable/poor)
5. ✅ Macro profiles for original and alternatives

**Tasks**:
- [x] Add macro similarity display to alternatives cards
- [x] Add macro similarity display to ingredient swap cards
- [x] Show macro comparison (original vs alternatives)
- [x] Add swap quality visual indicators
- [x] Display protein differences
- [ ] Add filter: "Show only high protein alternatives" (future enhancement)
- [ ] Add filter: "Min macro similarity score" (future enhancement)
- [ ] Export test results as CSV (future enhancement)

#### 4.2 Admin Settings Panel ✅ **COMPLETED**
**File**: `components/admin/settings-manager.tsx`

**New Settings Category**: "Macro Comparison"

**Settings Added**:
1. ✅ `macro_similarity_weights` - JSON weights for protein/carbs/fat (default: {protein: 0.5, carbs: 0.3, fat: 0.2})
2. ✅ `min_macro_similarity_threshold` - Minimum score difference to prioritize (default: 5)

**UI Features**:
- ✅ New "Macro Comparison" section with Target icon
- ✅ Description explaining macro-aware scoring
- ✅ JSON editor for similarity weights
- ✅ Number input for threshold
- ✅ Validation for meal distribution sums

**Tasks**:
- [x] Add Target icon import
- [x] Add 'macro' category to settings metadata
- [x] Create `macro_similarity_weights` setting metadata
- [x] Create `min_macro_similarity_threshold` setting metadata
- [x] Add macroSettings filter
- [x] Add "Macro Comparison" section to UI
- [x] Add descriptive text for macro settings
- [ ] Create SQL migration for default settings (see note below)

**Note**: Settings must be manually added to database via SQL:
```sql
INSERT INTO system_settings (key, value, description) VALUES
  ('macro_similarity_weights', '{"protein": 0.5, "carbs": 0.3, "fat": 0.2}'::jsonb, 'Weights for macro similarity scoring: protein 50%, carbs 30%, fat 20%'),
  ('min_macro_similarity_threshold', '5'::jsonb, 'Minimum difference in macro similarity score to prioritize (5 = only prioritize if difference >5 points)')
ON CONFLICT (key) DO NOTHING;
```

#### 4.3 Recipe Management - Macro Analysis
**File**: `app/admin/recipes/page.tsx`

**New Features**:
1. Show macro profile badges on recipe cards (High Protein, Balanced, High Carb)
2. Add macro profile filters
3. Bulk tag recipes by macro profile

**Tasks**:
- [ ] Calculate macro profiles for all recipes
- [ ] Add macro badges to recipe cards
- [ ] Add filter controls
- [ ] Create bulk tagging tool

---

### **Phase 5: Dashboard - User-Facing Improvements** ⏱️ 2-3 days ✅ **COMPLETED**

**Goal**: Show users why alternatives are suggested

#### 5.1 Enhanced Meal Card - Macro Preview ✅ **COMPLETED**
**File**: `components/dashboard/dashboard-components.tsx`

**Changes Implemented**:
1. ✅ Added P/C/F breakdown below calories with color-coded display
2. ✅ Animated entry with framer-motion for smooth UX
3. ✅ Scaled macro values based on serving size
4. ✅ Clean monospace font for numbers

**Implementation Details**:
- Protein (blue): `P: {protein}g`
- Carbs (amber): `C: {carbs}g`
- Fat (pink): `F: {fat}g`
- Conditional rendering only when nutrition data available
- Animated appearance with fade-in and slide-up effect

**Tasks**:
- [x] Add macro display to MealCard component
- [x] Design color-coded P/C/F breakdown
- [x] Add smooth animations
- [x] Test responsiveness

#### 5.2 Swap Animation - Macro Comparison ✅ **COMPLETED**
**File**: `app/(app)/dashboard/dashboard-content.tsx`

**Changes Implemented**:
1. ✅ Toast notification showing macro comparison on recipe swap
2. ✅ Displays protein and carbs differences with directional indicators
3. ✅ Green checkmark (✓) for similar macros (±3g)
4. ✅ Up/down arrows (↑↓) for significant differences
5. ✅ 3-second display duration for optimal visibility

**Visual Output**:
```
Recipe Swapped!
[Recipe Name]
P: 32g ✓  C: 48g ↑
```

**Tasks**:
- [x] Import toast from sonner
- [x] Calculate macro differences before swap
- [x] Show swap comparison toast/notification
- [x] Add visual indicators (✓, ↑, ↓)
- [x] Test with various macro differences

---

### **Phase 6: Meal Builder - Enhanced Swap Experience** ⏱️ 3-4 days ✅ **COMPLETED**

**Goal**: Give users full control over macro-aware swapping

#### 6.1 Ingredient Swap Panel - Macro Display ✅ **COMPLETED**
**File**: `app/(app)/meal-builder/meal-builder-content.tsx`

**Changes Implemented**:
1. ✅ Enhanced protein display for each swap option
2. ✅ "⚡ Similar Protein" badge for swaps with ≥10g protein
3. ✅ "💪 High Protein" badge for swaps with ≥15g protein
4. ✅ "💚 Low Cal" badge for swaps with <100 calories
5. ✅ Priority border styling for protein-similar swaps (primary color with ring)
6. ✅ Color-coded protein values (blue for high protein, primary for similar)

**Visual Example (Implemented)**:
```
Original: Chicken Breast (100g)

Available Swaps:
✓ Turkey Breast (105g) - 165 cal • P: 30g ⚡ Similar Protein
  Salmon Fillet (95g) - 180 cal • P: 24g
  Tofu (150g) - 120 cal • P: 18g 💚 Low Cal
```

**Tasks**:
- [x] Update swap panel layout with macro badges
- [x] Add protein comparison with visual indicators
- [x] Prioritize protein-similar options with enhanced styling
- [x] Show protein content for each swap option
- [x] Update animations for smooth UX
- [x] Test across different ingredient types

#### 6.2 Macro Target Display ✅ **COMPLETED**
**File**: `app/(app)/meal-builder/meal-builder-content.tsx`

**New Feature Implemented**: Meal-level macro target comparison
```
Breakfast Target: 500 cal (P: 35g, C: 50g, F: 20g)
Current Recipe: 480 cal (P: 32g, C: 48g, F: 19g) ✓ On Track
```

**Changes Implemented**:
1. ✅ Target comparison badge showing P and C targets
2. ✅ Green "✓ On Track" when protein within ±5g AND carbs within ±10g
3. ✅ Amber "⚠ Target" when off track, shows target values
4. ✅ Positioned below macro display with smooth animation
5. ✅ Compact design: `Target: P 35g • C 50g`

**Tasks**:
- [x] Calculate meal-level macro targets (from profile)
- [x] Add target comparison component
- [x] Show "On Track" vs "Target" indicators
- [x] Add conditional styling (green/amber)
- [x] Position elegantly in recipe header
- [x] Test with various recipes and targets

---

### **Phase 7: Performance & Polish** ⏱️ 2 days

**Goal**: Optimize queries and user experience

#### 7.1 Database Optimization
**Tasks**:
- [ ] Add indexes on macro fields in recipes table
- [ ] Add computed column for macro_profile_type
- [ ] Optimize alternative queries (reduce DB calls)
- [ ] Add caching for frequently requested alternatives

#### 7.2 User Experience Polish
**Tasks**:
- [ ] Add loading skeletons for swap panels
- [ ] Add empty states with helpful messages
- [ ] Add analytics tracking for swap usage
- [ ] A/B test macro display formats
- [ ] User feedback survey

---

## 🔧 Technical Implementation Details

### Database Changes

#### Option 1: Computed Columns (Recommended)
Add computed macro percentage columns to recipes table:
```sql
ALTER TABLE recipes 
ADD COLUMN macro_protein_pct DECIMAL(5,2) GENERATED ALWAYS AS (
  (CAST(nutrition_per_serving->>'protein_g' AS DECIMAL) * 4 / 
   NULLIF(CAST(nutrition_per_serving->>'calories' AS DECIMAL), 0)) * 100
) STORED;

-- Similar for carbs_pct and fat_pct
-- Add indexes for faster filtering
CREATE INDEX idx_recipes_macro_protein_pct ON recipes(macro_protein_pct);
```

#### Option 2: Function-based (Simpler)
Keep calculations in application code (current approach)

**Recommendation**: Start with Option 2, migrate to Option 1 in Phase 7 for performance.

---

### API Changes

#### New Endpoints (if needed)
```typescript
// GET /api/recipes/alternatives?recipeId=xxx&considerMacros=true
// GET /api/ingredients/swaps?ingredientId=xxx&matchProtein=true
```

#### Updated Response Types
```typescript
interface RecipeAlternative {
  // ... existing fields ...
  macro_similarity_score: number
  macro_profile: MacroProfile
  protein_diff_g: number
  is_high_protein: boolean
  swap_quality: 'excellent' | 'good' | 'acceptable'
}
```

---

## 📊 Success Metrics

### Phase 1-3 (Foundation)
- [ ] All alternatives have macro similarity scores
- [ ] Sorting by similarity works correctly
- [ ] Unit tests pass (>90% coverage)

### Phase 4 (Admin Panel)
- [ ] Admins can validate swap quality
- [ ] Macro comparison charts display correctly
- [ ] Export functionality works

### Phase 5-6 (User Experience)
- [ ] Users see macro information on swaps
- [ ] Swap satisfaction survey: >4.0/5.0
- [ ] Swap usage increases by >20%

### Phase 7 (Performance)
- [ ] Alternative queries <500ms
- [ ] Page load time remains <2s
- [ ] No regression in user metrics

---

## 🚀 Rollout Strategy

### Week 1-2: Development
- Phases 1-3 (foundation and core logic)
- Internal testing with admin panel

### Week 3: Beta Testing
- Phase 4-5 (admin panel + dashboard)
- Beta users test macro-aware swapping
- Collect feedback

### Week 4: Full Release
- Phase 6 (meal builder enhancements)
- Phase 7 (optimization)
- Monitor metrics
- Iterate based on feedback

---

## 🎓 User Education

### In-App Hints
- "💡 Tip: We match recipes with similar protein to help you hit your targets"
- "🔄 Swapped! This meal has similar macros to maintain your balance"

### Help Articles (Future)
- "Understanding Macro-Based Recipe Swaps"
- "Why Protein Matters for Your Goals"
- "How We Find Similar Meals"

---

## ⚠️ Risks & Mitigations

### Risk 1: Too Few Alternatives
**Issue**: Strict macro matching might reduce available alternatives  
**Mitigation**: Use tiered approach - show best matches first, then acceptable matches

### Risk 2: Performance Impact
**Issue**: Macro calculations might slow down queries  
**Mitigation**: Pre-calculate and index macro percentages in Phase 7

### Risk 3: User Confusion
**Issue**: Users might not understand macro percentages  
**Mitigation**: Use simple language ("High Protein", "Balanced") + optional details

---

## 📝 Notes & Decisions

### Design Decisions
1. **Why protein priority?** - Research shows protein is most important for satiety and muscle maintenance
2. **Why ±15% tolerance?** - Allows variety while maintaining nutritional balance
3. **Why tiered approach?** - Ensures users always have options, even if not perfect matches

### Future Enhancements (Post-Phase 7)
- [ ] Machine learning for personalized swap preferences
- [ ] "Smart Swap" - AI suggests best alternative based on user history
- [ ] Seasonal ingredient swaps (use what's in season)
- [ ] Budget-aware swaps (cheaper alternatives with similar nutrition)

---

## 🔗 Related Documents
- [Architecture Overview](architecture.md)
- [Database ERD](database-erd.md)
- [User Scenarios](../main/scenarios.md)
- [Admin Panel Completion Plan](admin-panel-completion.md)

---

**Questions or Feedback?**  
Update this document as implementation progresses. Track progress with checkboxes above.
