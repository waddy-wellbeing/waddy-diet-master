# Weekly Shopping List Feature - Comprehensive Study

> **Status**: Planning Complete  
> **Created**: December 29, 2025  
> **Purpose**: Analyze readiness and create implementation plan for weekly shopping list feature

---

## Executive Summary

### Current System Analysis

**How Plans Are Created:**
1. User completes onboarding with TDEE calculation and meal preferences
2. System calculates daily calorie targets and distributes across meals
3. Recipes are dynamically scaled to match user's meal calorie budgets
4. Daily plans stored in `daily_plans` table with JSONB structure
5. Each plan contains: `breakfast`, `lunch`, `dinner`, `snacks` slots
6. Each slot references a recipe_id with servings (scale factor)

**Data Structure:**
```typescript
// daily_plans.plan (JSONB)
{
  breakfast: { recipe_id: "uuid", servings: 1.25 },
  lunch: { recipe_id: "uuid", servings: 1.5 },
  dinner: { recipe_id: "uuid", servings: 1.0 },
  snacks: [{ recipe_id: "uuid", servings: 1.0 }]
}

// recipes.ingredients (JSONB)
[
  { 
    ingredient_id: "uuid", 
    raw_name: "Chicken breast",
    quantity: 150, 
    unit: "g",
    is_spice: false 
  }
]
```

### Readiness Assessment: 95% Ready ✅

**What We Have:**
- ✅ Complete ingredient database with nutrition data
- ✅ Recipe system with structured ingredients
- ✅ Daily meal plans with recipe references
- ✅ User authentication and RLS
- ✅ Serving/scaling system
- ✅ Food groups for ingredient categorization
- ✅ Mobile-first UI components (shadcn/ui)

**What We Need:**
- ⚠️ Shopping list storage table (simple addition)
- ⚠️ Aggregation logic for weekly ingredients
- ⚠️ UI page for shopping list view

**Confidence Level:** HIGH - Feature aligns perfectly with existing architecture

---

## Implementation Plan

### Phase 1: Database Schema (2 hours)

**Goal:** Minimal schema extension for shopping list storage

**New Table:**
```sql
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  checked_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopping_lists_user_week_unique UNIQUE (user_id, week_start_date)
);

CREATE INDEX shopping_lists_user_id_idx ON shopping_lists(user_id);
CREATE INDEX shopping_lists_week_start_idx ON shopping_lists(week_start_date);
```

**Items JSONB Structure:**
```typescript
interface ShoppingListItem {
  ingredient_id: string
  ingredient_name: string
  total_quantity: number
  unit: string
  food_group: string
  used_in_recipes: string[] // Recipe names for reference
}

// Grouped by food_group
type ShoppingListItems = Record<string, ShoppingListItem[]>
```

**RLS Policies:**
```sql
-- Users can only access their own shopping lists
CREATE POLICY shopping_lists_select_own ON shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY shopping_lists_insert_own ON shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY shopping_lists_update_own ON shopping_lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY shopping_lists_delete_own ON shopping_lists
  FOR DELETE USING (auth.uid() = user_id);
```

**Migration File:** `supabase/migrations/20251229_add_shopping_lists.sql`

**Schema Updates:**
- Update `supabase/schema.sql`
- Update `lib/types/nutri.ts` with new types
- Update `docs/main/database-erd.md`

---

### Phase 2: Backend Logic (4 hours)

**New File:** `lib/actions/shopping-lists.ts`

**Key Functions:**

1. **generateShoppingList(weekStartDate: Date)**
   - Fetch all daily_plans for the week (7 days)
   - For each plan, fetch all recipes
   - Extract ingredients from each recipe
   - Apply serving multiplier (scale factor)
   - Aggregate by ingredient_id
   - Group by food_group
   - Store in shopping_lists table
   
2. **getShoppingList(weekStartDate: Date)**
   - Retrieve stored shopping list for the week
   - Return grouped items with checked status
   
3. **updateShoppingListItem(listId: string, itemId: string, checked: boolean)**
   - Toggle checked state for individual items
   - Update checked_items JSONB array
   
4. **deleteShoppingList(listId: string)**
   - Remove shopping list (if user wants to regenerate)

**Algorithm Example:**
```typescript
async function generateShoppingList(weekStartDate: Date) {
  // 1. Get week's daily plans
  const plans = await getDailyPlansForWeek(weekStartDate)
  
  // 2. Aggregate ingredients
  const aggregated = new Map<string, {
    ingredient_id: string
    name: string
    total_quantity: number
    unit: string
    food_group: string
    recipes: Set<string>
  }>()
  
  for (const plan of plans) {
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
      const slot = plan.plan[meal]
      if (!slot) continue
      
      const recipe = await getRecipe(slot.recipe_id)
      const scaleFactor = slot.servings || 1
      
      for (const ingredient of recipe.ingredients) {
        if (ingredient.is_spice) continue // Skip spices
        
        const key = ingredient.ingredient_id
        if (aggregated.has(key)) {
          const item = aggregated.get(key)
          item.total_quantity += ingredient.quantity * scaleFactor
          item.recipes.add(recipe.name)
        } else {
          const ingredientData = await getIngredient(ingredient.ingredient_id)
          aggregated.set(key, {
            ingredient_id: ingredient.ingredient_id,
            name: ingredientData.name,
            total_quantity: ingredient.quantity * scaleFactor,
            unit: ingredient.unit,
            food_group: ingredientData.food_group,
            recipes: new Set([recipe.name])
          })
        }
      }
    }
  }
  
  // 3. Group by food_group
  const grouped = groupByFoodGroup(aggregated)
  
  // 4. Store in database
  await saveShoppingList(weekStartDate, grouped)
}
```

**Edge Cases:**
- Empty week (no plans) → Show empty state with CTA
- Missing ingredients (no ingredient_id) → Use raw_name, mark as "Uncategorized"
- Unit mismatches → Show as-is (Phase 2 enhancement: unit conversion)
- Spices → Exclude from shopping list (they're "to taste")

---

### Phase 3: UI Components (5 hours)

**New Route:** `app/(app)/shopping-list/page.tsx`

**Component Structure:**
```
shopping-list/
├── page.tsx (Server Component - fetch data)
└── shopping-list-content.tsx (Client Component - interactions)
```

**Features:**
- Week selector (default: current week)
- "Generate Shopping List" button
- Grouped ingredient display by food_group
- Checkboxes for marking items as purchased
- Total quantities with units
- Recipe references (tooltip/expandable)
- Export options (print, share, copy to clipboard)
- Empty state when no plans exist

**UI Design:**
```
┌─────────────────────────────────┐
│  🛒 Shopping List               │
│  Week of Dec 25 - Dec 31  [📅] │
├─────────────────────────────────┤
│  [Generate List] [Export] ⋮    │
├─────────────────────────────────┤
│  🥩 Proteins (3 items)          │
│  ☐ Chicken breast · 750g        │
│     Used in: Grilled Chicken... │
│  ☐ Ground beef · 500g           │
│  ☑ Salmon fillet · 300g         │
├─────────────────────────────────┤
│  🌾 Grains & Carbs (2 items)    │
│  ☐ Brown rice · 400g            │
│  ☐ Whole wheat bread · 1 loaf   │
├─────────────────────────────────┤
│  🥬 Vegetables (5 items)        │
│  ...                            │
└─────────────────────────────────┘
```

**Reusable Components:**
- `WeekSelector` - Date range picker
- `ShoppingListGroup` - Collapsible food group section
- `ShoppingListItem` - Individual ingredient with checkbox
- `ExportMenu` - Export options dropdown

**Mobile Considerations:**
- Sticky header with week selector
- Large touch targets for checkboxes
- Swipe to delete checked items
- Pull-to-refresh to regenerate

---

### Phase 4: Integration & Navigation (2 hours)

**Dashboard Integration:**
1. Add navigation link in main menu
2. Add quick action FAB (Floating Action Button)
3. Add widget showing "Your weekly shopping list is ready"

**Navigation Updates:**
- Update `components/layout/app-nav.tsx`
- Add shopping cart icon (Lucide: ShoppingCart)
- Place between "Dashboard" and "Recipes"

**Dashboard Widget:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>🛒 This Week's Shopping List</CardTitle>
  </CardHeader>
  <CardContent>
    {hasShoppingList ? (
      <>
        <p>32 items ready for this week</p>
        <Button asChild>
          <Link href="/shopping-list">View List</Link>
        </Button>
      </>
    ) : (
      <>
        <p>Generate your weekly shopping list</p>
        <Button onClick={handleGenerate}>Generate</Button>
      </>
    )}
  </CardContent>
</Card>
```

---

### Phase 5: Polish & Testing (3 hours)

**Testing Checklist:**
- [ ] Generate list for week with full plans
- [ ] Generate list for week with partial plans
- [ ] Generate list for week with no plans
- [ ] Check/uncheck items
- [ ] Verify ingredient aggregation accuracy
- [ ] Test unit consistency
- [ ] Test with multiple recipes using same ingredient
- [ ] Test export functionality
- [ ] Test on mobile devices
- [ ] Test loading states
- [ ] Test error states

**Edge Case Testing:**
- Empty week
- Week with only one day planned
- Recipes with missing ingredients
- Very large quantities
- Mixed units (kg and g for same ingredient)

**Performance:**
- Optimize aggregation queries
- Cache shopping list
- Lazy load ingredient details
- Pagination for large lists (>100 items)

---

## Technical Considerations

### 1. Unit Conversion (Future Enhancement)

**Current Approach:** Show units as-is
```
Chicken breast: 150g + 200g + 400g = 750g ✅
```

**Future Enhancement:**
```
Chicken breast: 150g + 200g + 1kg = 1.35kg
```

**Implementation:** Add unit conversion utility
```typescript
function normalizeUnit(quantity: number, unit: string): { quantity: number, unit: string } {
  const conversions = {
    'g': { kg: 0.001 },
    'ml': { l: 0.001 },
    // ...
  }
  // Convert to base unit if quantity > threshold
}
```

### 2. Ingredient Substitutions

**Current:** Use exact ingredient from recipe
**Future:** Allow user to mark substitutions
```
☐ Chicken breast · 750g
  ↳ Or use: Ground chicken, Turkey breast
```

### 3. Store Integration

**Future API Integration:**
- Link ingredients to store products
- Add to online cart (Instacart, Amazon Fresh)
- Price estimation
- Availability check

### 4. Smart Suggestions

**Future ML Enhancement:**
- Suggest common staples not in recipes (salt, pepper, oil)
- Predict pantry items user might already have
- Suggest bulk buying for frequently used items

---

## Migration Strategy

### Step 1: Create Migration File
```bash
# Create new migration
touch supabase/migrations/20251229000000_add_shopping_lists.sql
```

### Step 2: Update Schema
- Add table definition to `supabase/schema.sql`
- Add RLS policies
- Add trigger for updated_at

### Step 3: Update Types
- Add TypeScript interfaces to `lib/types/nutri.ts`
- Export new types for use in components

### Step 4: Deploy
```bash
# Apply migration locally
supabase db reset

# Test locally
npm run dev

# Deploy to production (admin action)
supabase db push
```

---

## Scalability Considerations

### Performance
- **Query Optimization:** Use single query with joins instead of N+1 queries
- **Caching:** Cache generated shopping lists for 24 hours
- **Pagination:** Load food groups incrementally for large lists

### Storage
- **JSONB Size:** Shopping lists are small (<100KB per user per week)
- **Retention:** Auto-delete shopping lists older than 8 weeks
- **Indexing:** Index on user_id and week_start_date for fast lookups

### Future Growth
- **B2B Extension:** Organizations can see aggregated shopping lists for all clients
- **Bulk Orders:** Trainers can place bulk orders for multiple clients
- **Analytics:** Track most common ingredients, seasonal trends

---

## Risk Assessment

### Low Risk ✅
- Database schema addition (non-breaking)
- New isolated feature (no impact on existing features)
- Server-side rendering (SEO friendly, fast)
- RLS protection (secure by design)

### Medium Risk ⚠️
- Aggregation logic complexity (needs thorough testing)
- Unit inconsistencies in ingredient data (data quality issue)
- Performance with large plans (unlikely, but needs monitoring)

### Mitigation
- Comprehensive unit tests for aggregation
- Data validation on ingredient import
- Performance monitoring and alerts
- Graceful degradation for edge cases

---

## Success Metrics

### User Engagement
- % of users generating shopping lists weekly
- Average time spent on shopping list page
- Repeat usage rate

### Feature Adoption
- Time from signup to first shopping list
- Shopping list generation rate (weekly active users)
- Export/share rate

### User Satisfaction
- Reduction in meal prep friction
- User feedback on accuracy
- Feature rating (in-app survey)

---

## Copilot Instructions Updates

Add to `.github/copilot-instructions.md`:

```markdown
## Shopping Lists

The app includes a weekly shopping list feature:
- Located at `app/(app)/shopping-list/`
- Aggregates ingredients from user's weekly meal plans
- Groups items by food_group for easy shopping
- Stored in `shopping_lists` table with JSONB structure
- Users can check off items as they shop

Key files:
- `lib/actions/shopping-lists.ts` - Backend logic
- `lib/types/nutri.ts` - ShoppingList types
- `supabase/migrations/*_add_shopping_lists.sql` - Schema

When working on shopping lists:
1. Always aggregate same ingredients across the week
2. Exclude spices (is_spice = true) from shopping lists
3. Group by food_group for better UX
4. Apply serving multipliers from daily_plans
5. Handle missing ingredient_id gracefully
```

---

## Timeline Estimate

| Phase | Description | Time | Dependencies |
|-------|-------------|------|--------------|
| 1 | Database Schema | 2h | None |
| 2 | Backend Logic | 4h | Phase 1 |
| 3 | UI Components | 5h | Phase 2 |
| 4 | Integration | 2h | Phase 3 |
| 5 | Testing & Polish | 3h | Phase 4 |
| **Total** | | **16h** | |

**Recommended Approach:** 2-3 days of focused work

---

## Conclusion

**Readiness: 95% ✅**

The Waddy Diet Master app is excellently positioned to implement a weekly shopping list feature:
- Existing architecture supports it naturally
- Minimal database changes needed
- Clear data flow from plans → recipes → ingredients
- Scalable design for future enhancements

**Recommendation:** Proceed with implementation following the phased approach. The feature aligns perfectly with the app's goals and will significantly improve user experience.

**Next Steps:**
1. Review and approve this plan
2. Create PR for Phase 1 (database schema)
3. Implement backend logic (Phase 2)
4. Build UI (Phase 3)
5. Integrate and test (Phase 4-5)

---

**Document Version:** 1.0  
**Last Updated:** December 29, 2025  
**Prepared by:** GitHub Copilot Agent
