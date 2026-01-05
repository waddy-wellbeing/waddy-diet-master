# Meal Plans & Shopping List - Implementation Plan

**Created:** January 5, 2026  
**Status:** Planning  
**Priority:** HIGH  
**Feature:** Integrated Meal Planning with Smart Shopping Lists

---

## 📋 Overview

Integrate meal planning directly into the dashboard calendar, allowing users to plan meals for 3-14 days ahead with automatic shopping list generation. This creates a seamless experience from planning → shopping → cooking → logging.

### Core Philosophy
- **Minimal Clicks:** Everything accessible from dashboard
- **Visual Planning:** Calendar-based meal assignment
- **Smart Shopping:** Auto-calculate ingredients, round to buyable quantities
- **Flexible Duration:** Support 3, 4, 7, or 14-day plans

---

## 🎯 Goals & Success Metrics

### Primary Goals
1. **Reduce Friction:** Plan meals without leaving dashboard
2. **Simplify Shopping:** Generate smart grocery lists instantly
3. **Improve Adherence:** Visual calendar increases meal prep commitment
4. **Save Time:** Batch planning for multiple days at once

### Success Metrics
- Users plan ≥3 days ahead on average
- 70%+ of planned meals actually logged
- Shopping list generation used by 50%+ of active users
- Average time to plan week: <5 minutes

---

## 🎨 User Experience Design

### 1. Dashboard Calendar Enhancement

**Current State:**
- Calendar shows dates
- Click date → view daily log

**Enhanced State:**
- Calendar shows dates WITH meal indicators
- Visual differentiation:
  - **Planned meals:** Outlined circles (🔵 border only)
  - **Logged meals:** Filled circles (🟢 solid)
  - **Both:** Half-filled circles
  - **Empty days:** Gray outline
- Hover tooltip: "3 meals planned, 2 logged"

**Interaction Flow:**
```
User clicks future date (e.g., Tomorrow)
  ↓
Modal/Sheet opens: "Plan Meals for [Date]"
  ↓
Shows 3-4 meal slots (breakfast, lunch, dinner, snacks)
  ↓
User clicks "+" on a meal slot
  ↓
Recipe picker opens (search, favorites, recent)
  ↓
Select recipe → Preview nutrition → Confirm
  ↓
Meal added to plan
  ↓
Repeat for other meals
  ↓
Save plan → Calendar updates with indicator
```

### 2. Shopping List Generation

**Access Point:**
- Floating action button (FAB) on dashboard: 🛒 "Shopping List"
- Badge shows "X days planned" when plans exist

**Important:** Shopping lists are **dynamically generated** - NOT stored in database. Calculated fresh each time from `daily_plans` data.

**Generation Flow:**
```
User clicks Shopping List button
  ↓
Modal shows: "Shopping List"
  ↓
Auto-detects planned days: "You have meals planned for [Today] through [Jan 12]"
  ↓
Option to select date range (default: today → last planned day)
  ↓
Click "Generate"
  ↓
Loading animation (calculating ingredients from plans)
  ↓
Shopping list appears organized by category:
  - Produce (vegetables, fruits)
  - Proteins (chicken, fish, eggs)
  - Grains & Carbs (rice, pasta, bread)
  - Dairy
  - Spices & Condiments
  - Other
```

**Shopping List Features:**
- **Smart Rounding:** 250g chicken → "250-300g chicken breast"
- **Combine Similar:** Multiple recipes need tomatoes → Total tomatoes needed
- **Unit Conversion:** 200ml + 300ml milk → "500ml (½L) milk"
- **Checkboxes:** Mark items as purchased (session only - not persisted)
- **Share:** Direct WhatsApp share, copy as text, export as PDF or image
- **Ephemeral:** No storage - regenerated fresh each time

### 3. Quick Plan Templates

**Simple & Branded:**
- **Design:** Use brand identity (lime green, lightning bolt ⚡, clean UI)
- **Pre-built templates:**
  - ⚡ "Quick Week" (7 days, balanced meals)
  - 🎯 "3-Day Start" (3 days, lunch + dinner)
  - 💪 "Weekend Prep" (4 days, easy recipes)

**One-Click Setup:**
- Simple card-based selection
- Brand colors: lime green buttons
- Lightning bolt icons for energy/power
- Confirms start date
- System auto-fills calendar
- User can swap individual meals if desired

**Keep It Simple:** Templates should be straightforward, not overwhelming

---

## 🏗️ Technical Architecture

### Database Schema Enhancements

#### 1. Extend `daily_plans` Table
**Current:**
```sql
daily_plans (
  user_id UUID,
  date DATE,
  plan JSONB, -- { breakfast: {...}, lunch: {...}, ... }
  daily_totals JSONB,
  PRIMARY KEY (user_id, date)
)
```

**No Changes Needed!** Current schema already supports this perfectly:
- `plan` JSONB stores meal assignments per meal type
- `date` allows future dates
- We just need to populate for future dates

#### 2. Shopping Lists (No Database Storage)

**Important Decision:** Shopping lists are **dynamically calculated** - NOT stored in database.

**Why?**
- Plans change frequently (users swap recipes, adjust days)
- Shopping lists would become stale instantly
- Storage overhead not worth it
- Fresh calculation takes <500ms
- Simpler architecture, fewer bugs

**How it works:**
1. User clicks "Generate Shopping List"
2. Query `daily_plans` for date range
3. Extract all recipe ingredients
4. Aggregate, round, and categorize
5. Display in modal
6. User can check items off (session state only)
7. Export to PDF/text/image/WhatsApp
8. When modal closes, state discarded

**No tables needed!** ✅

#### 3. New Table: `plan_templates` (Optional - for later)
```sql
CREATE TABLE plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  template_data JSONB NOT NULL, -- Array of daily meal structures
  is_public BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Component Architecture

```
app/(app)/dashboard/
├── page.tsx (Enhanced with meal planning)
└── components/
    ├── calendar-with-plans.tsx        (Extend existing calendar with plan indicators)
    ├── meal-plan-sheet.tsx            (Bottom sheet to plan meals for a day - mobile first)
    ├── recipe-picker-sheet.tsx        (Search/select recipes - bottom sheet)
    ├── shopping-list-fab.tsx          (Floating action button)
    ├── shopping-list-modal.tsx        (Generate & view shopping list)
    └── shopping-list-display.tsx      (Formatted list with categories)

lib/actions/
├── meal-planning.ts                   (Plan CRUD operations)
└── shopping-list-generator.ts         (Calculate shopping list from plans - no storage)

lib/utils/
├── ingredient-aggregator.ts           (Combine ingredients from multiple recipes)
├── unit-converter.ts                  (ml→L, g→kg, etc.)
└── quantity-rounder.ts                (Round to buyable amounts)
```

---

## 🛠️ Implementation Phases

### Phase 1: Calendar Enhancement (Week 1)
**Goal:** Visual planning on dashboard

**Tasks:**
1. ✅ Enhance calendar component to show plan indicators
2. ✅ Create meal plan modal (opens when clicking future date)
3. ✅ Build recipe picker with search
4. ✅ Implement save/update plan logic
4. ✅ Add plan preview in bottom sheet
5. ✅ Show nutrition totals for day

**Mobile-First Design:**
- Bottom sheets for all modals
- Touch-friendly targets (min 44px)
- Swipe gestures for quick actions
- Optimized for thumb reach

**Deliverables:**
- Users can click future dates and assign recipes
- Visual indicators show planned vs logged meals
- Daily nutrition totals calculated
- Smooth mobile experience

**Acceptance Criteria:**
- [ ] Click future date → meal plan modal opens
- [ ] Can add/remove recipes to breakfast, lunch, dinner, snacks
- [ ] Calendar shows visual indicators for planned meals
- [ ] Nutrition totals update in real-time
- [ ] Plans saved to `daily_plans` table

---

### Phase 2: Shopping List Generation (Week 2)
**Goal:** Generate smart shopping lists

**Tasks:**
1. ✅ Create ingredient aggregation algorithm
2. ✅ Implement unit conversion system
3. ✅ Build quantity rounding logic
4. ✅ Create shopping list modal UI
5. ✅ Add category organization
6. ✅ Implement share/export features:
   - Direct WhatsApp share
   - Copy as text
   - Export as PDF
   - Export as image
7. ✅ Add checkbox state (session only - not persisted)

**Deliverables:**
- Shopping list FAB on dashboard
- Generate list for date range
- Organized by food category
- Smart quantity rounding
- Share/export capabilities

**Acceptance Criteria:**
- [ ] FAB shows "X days planned" badge
- [ ] Click FAB → shopping list modal opens
- [ ] Lists all unique ingredients with rounded quantities
- [ ] Grouped by category (produce, proteins, grains, etc.)
- [ ] Can check off items (session state only)
- [ ] Direct WhatsApp share
- [ ] Export as PDF, text, or image

---

### Phase 3: Smart Features (Week 3)
**Goal:** Enhance with convenience features

**Tasks:**
1. ✅ Plan templates (balanced week, simple start, etc.)
2. ✅ Duplicate day plan (copy meals to another day)
3. ✅ Bulk plan (select multiple days → assign same meals)
4. ✅ Swap meal between days (drag-and-drop or move)
5. ✅ Recipe suggestions based on:
   - Previous plans
   - Nutrition targets
   - Available ingredients (future)

**Deliverables:**
- Quick-start templates
- Time-saving bulk operations
- Intelligent meal suggestions

**Acceptance Criteria:**
- [ ] Can apply template to fill multiple days
- [ ] Can duplicate entire day plan
- [ ] Can swap meals between days
- [ ] Recipe suggestions appear in picker

---

### Phase 4: Mobile Optimization (Week 4)
**Goal:** Perfect mobile experience

**Tasks:**
1. ✅ Mobile-optimized calendar gestures
2. ✅ Bottom sheet for meal planning (instead of modal)
3. ✅ Swipe gestures for recipe picker
4. ✅ Progressive Web App (PWA) shopping list offline access
5. ✅ Native share sheet integration
6. ✅ Print optimization for shopping lists

**Deliverables:**
- Smooth mobile interactions
- Offline shopping list access
- Native mobile features

---

## 🧮 Shopping List Algorithm

### 1. Ingredient Aggregation

```typescript
interface AggregatedIngredient {
  ingredient_id: string
  name: string
  name_ar?: string
  total_quantity: number
  unit: string
  category: string
  recipes: string[] // Which recipes need this ingredient
  notes?: string[]  // Special notes (e.g., "chopped", "diced")
}

function aggregateIngredients(plans: DailyPlan[]): AggregatedIngredient[] {
  const ingredientMap = new Map<string, AggregatedIngredient>()
  
  for (const plan of plans) {
    for (const meal of Object.values(plan.meals)) {
      if (!meal.recipe) continue
      
      for (const ingredient of meal.recipe.ingredients) {
        const key = `${ingredient.ingredient_id}_${ingredient.unit}`
        
        if (!ingredientMap.has(key)) {
          ingredientMap.set(key, {
            ingredient_id: ingredient.ingredient_id,
            name: ingredient.name,
            total_quantity: 0,
            unit: ingredient.unit,
            category: ingredient.category || 'Other',
            recipes: [],
            notes: []
          })
        }
        
        const agg = ingredientMap.get(key)!
        agg.total_quantity += ingredient.quantity
        agg.recipes.push(meal.recipe.name)
        if (ingredient.notes) agg.notes.push(ingredient.notes)
      }
    }
  }
  
  return Array.from(ingredientMap.values())
}
```

### 2. Smart Rounding

```typescript
function roundToBuyableQuantity(quantity: number, unit: string): string {
  // Meat, fish, poultry
  if (unit === 'g' && quantity >= 100) {
    // Round to nearest 50g for purchases
    const rounded = Math.ceil(quantity / 50) * 50
    return `${rounded}g (approx ${quantity}g needed)`
  }
  
  // Liquids
  if (unit === 'ml') {
    if (quantity <= 250) return `250ml`
    if (quantity <= 500) return `500ml`
    if (quantity <= 1000) return `1L`
    return `${Math.ceil(quantity / 1000)}L`
  }
  
  // Eggs
  if (unit === 'piece' && quantity <= 12) {
    return `${Math.ceil(quantity)} eggs`
  }
  
  // Small quantities (spices, etc.)
  if (quantity < 5 && unit === 'g') {
    return `1 tsp (${quantity}g)`
  }
  
  // Default: round up
  return `${Math.ceil(quantity)}${unit}`
}
```

### 3. Category Organization

```typescript
const CATEGORIES = {
  'Produce': ['vegetables', 'fruits', 'herbs'],
  'Proteins': ['chicken', 'beef', 'fish', 'seafood', 'eggs', 'tofu'],
  'Grains & Carbs': ['rice', 'pasta', 'bread', 'flour', 'oats'],
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter'],
  'Oils & Fats': ['olive oil', 'vegetable oil', 'coconut oil'],
  'Spices & Condiments': ['salt', 'pepper', 'cumin', 'soy sauce'],
  'Canned & Packaged': ['tomato sauce', 'beans', 'stock'],
  'Other': []
}

function categorizeIngredient(ingredient: AggregatedIngredient): string {
  const name = ingredient.name.toLowerCase()
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category
    }
  }
  
  return 'Other'
}
```

---

## 🎯 UI/UX Detailed Design

### Dashboard Calendar States

```
┌─────────────────────────────────────────┐
│  📅 Your Meal Calendar                  │
├─────────────────────────────────────────┤
│                                         │
│   Sun   Mon   Tue   Wed   Thu   Fri   Sat│
│         1 🟢   2 🔵   3 ⚪   4 ⚪   5 ⚪   6 │
│   7     8 🟡   9 🔵  10 🔵  11     12    13│
│                                         │
│  Legend:                                │
│  🟢 Logged   🔵 Planned   🟡 Both        │
│  ⚪ Empty                                │
└─────────────────────────────────────────┘
```

### Meal Plan Modal (Mobile Bottom Sheet)

```
┌─────────────────────────────────────────┐
│  📆 Plan Meals - Tuesday, Jan 2         │
├─────────────────────────────────────────┤
│  🌅 Breakfast                           │
│  ┌─────────────────────────────────┐   │
│  │ + Add Recipe                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🌞 Lunch                               │
│  ┌─────────────────────────────────┐   │
│  │ 🍗 Grilled Chicken Salad        │   │
│  │ 450 kcal • 35g protein          │   │
│  │ [Edit] [Remove]                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🌙 Dinner                              │
│  ┌─────────────────────────────────┐   │
│  │ + Add Recipe                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  🍪 Snacks                              │
│  ┌─────────────────────────────────┐   │
│  │ + Add Recipe                    │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  Daily Total: 450 / 2000 kcal          │
│  [Copy from another day] [Save Plan]   │
└─────────────────────────────────────────┘
```

### Shopping List Modal

```
┌─────────────────────────────────────────┐
│  🛒 Shopping List                       │
│  Jan 2 - Jan 8 (7 days, 18 recipes)    │
├─────────────────────────────────────────┤
│  🥬 Produce                             │
│  ☐ Tomatoes - 1kg (6 recipes)          │
│  ☐ Onions - 500g (4 recipes)           │
│  ☐ Spinach - 200g (2 recipes)          │
│                                         │
│  🍗 Proteins                            │
│  ☐ Chicken breast - 800g (4 recipes)   │
│  ☐ Salmon fillet - 400g (2 recipes)    │
│  ☐ Eggs - 12 pieces (5 recipes)        │
│                                         │
│  🌾 Grains & Carbs                      │
│  ☐ Rice - 1kg (8 recipes)              │
│  ☐ Whole wheat pasta - 500g            │
│                                         │
│  [✓] Show checked items                │
├─────────────────────────────────────────┤
│  [Share] [Export PDF] [Close]          │
└─────────────────────────────────────────┘
```

---

## 🤔 Edge Cases & Considerations

### 1. Overlapping Plans & Logs

**Scenario:** User plans meals for tomorrow, but also logs meals as they eat.

**Solution:**
- Show both indicators on calendar (🟡 yellow = both planned & logged)
- In modal, show: "Planned: X meals | Logged: Y meals"
- Allow "Mark as eaten" button to convert plan → log quickly

### 2. Recipe Substitutions

**Scenario:** User planned salmon but doesn't find it at store.

**Solution:**
- Shopping list allows "Mark unavailable"
- Suggests alternatives: "Try: Cod, Tuna, or Chicken"
- Can swap recipe in plan without regenerating list

### 3. Partial Cooking

**Scenario:** Recipe makes 4 servings, user only cooking 1.

**Solution:**
- When adding recipe to plan, ask: "How many servings?"
- Shopping list multiplies quantities accordingly
- Default: 1 serving per meal slot

### 4. Multi-Day Recipes

**Scenario:** User cooks big batch on Sunday, eats for 3 days.

**Solution:**
- Add recipe to multiple days from one action
- Shopping list counts ingredients only once
- Badge shows "Meal prep" on those days

### 5. Ingredient Already at Home

**Scenario:** User has rice at home, doesn't need to buy.

**Solution:**
- Shopping list has "I have this" button
- Removes from list but remembers for next time
- Future lists check "home inventory" (Phase 5 feature)

### 6. Date Range Selection

**Scenario:** User has plans for 10 days but only wants shopping list for first 5.

**Solution:**
- Shopping list modal allows date range picker
- Default: Today → Last planned day
- Can customize start/end dates
- Visual calendar picker for selection

---

## 📱 Mobile-Specific Features

### Gestures
- **Swipe left on meal:** Quick delete
- **Swipe right on meal:** Duplicate to clipboard
- **Long press day:** Bulk select multiple days
- **Pinch calendar:** Zoom to see more/fewer weeks

### Progressive Web App
- **Offline Mode:** Cached shopping lists accessible offline
- **Add to Home Screen:** App icon on phone
- **Background Sync:** Plans sync when back online
- **Push Notifications:** "Reminder: Tomorrow's meals planned!"

### Native Integrations
- **Share Sheet:** Send shopping list via any app
- **Reminders App:** Export to Apple Reminders or Google Tasks
- **Calendar App:** Sync plans to native calendar (optional)
- **Camera:** Scan receipts to mark items purchased

---

## 🧪 Testing Plan

### Unit Tests
- Ingredient aggregation algorithm
- Unit conversion accuracy
- Quantity rounding logic
- Category classification

### Integration Tests
- Plan → Shopping list flow
- Recipe picker → Plan save
- Date range selection
- Export/share functionality

### User Acceptance Testing
- 5 beta users plan full week
- Generate shopping lists
- Go shopping with list
- Report friction points
- Time to complete tasks

### Performance Testing
- Load 14 days of plans
- Aggregate 100+ ingredients
- Calendar render with 30 days
- Shopping list generation < 500ms

---

## 📊 Analytics & Monitoring

### Key Metrics to Track
1. **Planning Engagement**
   - % users who plan ≥1 day ahead
   - Average days planned per user
   - Most popular planning duration (3, 7, or 14 days)

2. **Shopping List Usage**
   - Shopping list generation frequency
   - Average items per list
   - Share/export rate
   - Completion rate (checked items)

3. **Plan Adherence**
   - % of planned meals actually logged
   - Days between plan → log
   - Most common unlogged meal types

4. **Feature Usage**
   - Template usage rate
   - Recipe picker search terms
   - Most copied meals
   - Average time to plan week

---

## 🚀 Future Enhancements (Post-MVP)

### Phase 5: Smart Recommendations
- AI suggests recipes based on:
  - Nutrition targets
  - Previous likes
  - Seasonal ingredients
  - Budget constraints

### Phase 6: Home Inventory
- Track ingredients at home
- Auto-exclude from shopping lists
- Expiry date warnings
- Recipe suggestions using available items

### Phase 7: Budget Tracking
- Price estimates per ingredient
- Total shopping list cost
- Budget alerts
- Cheaper alternative suggestions

### Phase 8: Social Features
- Share plans with family
- Collaborative shopping lists
- Split recipes for household
- Meal planning groups

### Phase 9: Meal Prep Mode
- Batch cooking workflows
- Container/portion planning
- Freeze/reheat instructions
- Prep time optimization

### Phase 10: Store Integration
- Connect to grocery store APIs
- Online ordering
- Delivery scheduling
- Real-time price comparison

---

## 🎨 Design Tokens & Consistency

### Color System
```typescript
const MEAL_PLAN_COLORS = {
  planned: 'oklch(0.6 0.15 210)',        // Blue outline
  logged: 'oklch(0.7 0.15 150)',         // Green solid
  both: 'oklch(0.75 0.2 125)',           // Lime (brand color)
  empty: 'oklch(0.5 0 0)',               // Gray
}

const CATEGORY_COLORS = {
  produce: '#4ade80',     // Green
  proteins: '#f87171',    // Red
  grains: '#fbbf24',      // Yellow
  dairy: '#60a5fa',       // Blue
  spices: '#a78bfa',      // Purple
  other: '#94a3b8',       // Gray
}
```

### Spacing & Typography
- Meal cards: `p-4` with `rounded-xl`
- Shopping list items: `p-3` with `border-b`
- Category headers: `text-sm font-semibold uppercase tracking-wide`
- Quantities: `font-mono` for alignment

---

## 📝 Documentation Updates Needed

### 1. User Guide
- "How to Plan Your Week"
- "Generating Shopping Lists"
- "Understanding Quantity Rounding"
- "Sharing Your Shopping List"

### 2. Copilot Instructions
Add to `.github/copilot-instructions.md`:
```markdown
## Meal Planning & Shopping Lists

### Component Patterns
- Calendar enhancements use `calendar-enhanced.tsx`
- Meal planning modals use bottom sheets on mobile
- Shopping lists organized by food category
- All quantities rounded to buyable amounts

### Data Flow
1. User plans meals → Save to `daily_plans` table
2. Generate shopping list → Aggregate ingredients from date range
3. Round quantities → Smart rounding per ingredient type
4. Organize by category → Use `CATEGORIES` mapping
5. Enable sharing → Export as PDF or text

### Key Files
- `lib/utils/ingredient-aggregator.ts` - Combines ingredients
- `lib/utils/quantity-rounder.ts` - Smart rounding logic
- `lib/actions/shopping-list.ts` - Generation & persistence
```

### 3. API Documentation
- `generateShoppingList(userId, startDate, endDate)`
- `savePlan(userId, date, meals)`
- `duplicateDayPlan(userId, fromDate, toDate)`
- `applyTemplate(userId, templateId, startDate)`

---

## 💡 My Recommendations & Suggestions

### 1. **Start with Minimal MVP (Phase 1 + 2)**
Focus on core functionality first:
- ✅ Plan meals on calendar
- ✅ Generate basic shopping list
- ✅ Share/export list

Skip for MVP:
- ❌ Templates (add later)
- ❌ Drag-and-drop (nice-to-have)
- ❌ AI recommendations (future)

**Why?** Get feedback on core UX before building advanced features.

---

### 2. **Use Bottom Sheet Instead of Full Modal**
On mobile, bottom sheets feel more native and less disruptive.

**Recommendation:** Use `@radix-ui/react-dialog` with:
```typescript
<Sheet>
  <SheetTrigger />
  <SheetContent side="bottom" className="h-[90vh]">
    {/* Meal planning UI */}
  </SheetContent>
</Sheet>
```

---

### 3. **Progressive Disclosure for Shopping List**
Don't show all categories expanded by default.

**Recommendation:**
- Show collapsed categories with item count
- Click to expand: "🥬 Produce (6 items)"
- Reduces scrolling, especially for long lists

---

### 4. **Smart Defaults for Date Range**
Auto-detect logical shopping list range.

**Logic:**
```typescript
// If user has plans for next 7 days
// Default range: Today → Last planned day
// Or if weekend: Today → Next Sunday (batch shop)
```

---

### 5. **Visual Feedback for Planning**
Make planning feel rewarding.

**Suggestions:**
- ✅ Checkmark animation when meal added
- ✅ Confetti when full week planned
- ✅ Progress bar: "4/7 days planned"
- ✅ Streak badge: "5-day planning streak!"

---

### 6. **Offline-First Shopping List**
Critical for grocery store (spotty signal).

**Implementation:**
- Cache generated list in localStorage
- Service worker caches for PWA
- Sync checked items when back online
- "Last synced: 5 min ago" indicator

---

### 7. **Quick Actions Menu**
Right-click or long-press on calendar day for:
- Copy meals from another day
- Clear all meals
- Apply template
- Duplicate to next week

---

### 8. **Quantity Input Flexibility**
When adding recipe, allow portion adjustment.

**UI:**
```
🍗 Grilled Chicken Salad
Servings: [1] [2] [3] [4] [Custom]
Per serving: 450 kcal, 35g protein
```

Shopping list automatically adjusts quantities.

---

### 9. **Category Customization**
Let users organize shopping list their way.

**Settings:**
- Reorder categories (drag-and-drop)
- Rename categories
- Hide unused categories
- Match their grocery store layout

---

### 10. **Smart Notifications**
Helpful reminders without annoying.

**Suggestions:**
- "Tomorrow's meals planned! 🎉" (evening before)
- "Generate shopping list for the week?" (Sunday morning)
- "3 days left on plan, time to plan ahead" (Wednesday)
- "You planned salmon for dinner tonight! 🐟" (4 PM)

---

## 🤝 Design Decisions

### Confirmed Decisions:

### 1. **Calendar View:** ✅ **CONFIRMED**
   - Use existing dashboard calendar implementation
   - Enhance with meal plan indicators
   - Keep current navigation (already familiar to users)

### 2. **Shopping List Persistence:** ✅ **CONFIRMED - NO STORAGE**
   - Dynamically calculated from plans
   - No database storage
   - Fresh calculation each time
   - Session state only for checkboxes

### 3. **Recipe Portions:** ❓ **NEEDS CLARIFICATION**
   
   **Question:** When user adds a recipe to a meal slot, can they specify number of servings?
   
   **Example Scenario:**
   - User is cooking for 2 people
   - Recipe makes 4 servings total
   - User wants to assign 2 servings to this meal
   
   **Options:**
   - **A)** Fixed 1 serving per meal slot (simpler, assumes single person)
   - **B)** Adjustable servings per recipe (flexible, supports meal prep/families)
   - **C)** Auto-detect from user profile (if they have family size setting)
   
   **Impact on Shopping List:**
   - Option A: 1 chicken breast per recipe
   - Option B: 2 chicken breasts if user selected 2 servings
   
   **Your preference?**

### 4. **Template Design:** ✅ **CONFIRMED - SIMPLE & BRANDED**
   - Keep it simple and straightforward
   - Use brand identity:
     * Lime green (oklch 0.75-0.78, 0.2, 125)
     * Lightning bolt ⚡ icon
     * Clean, minimal design
   - 3 pre-built templates max
   - No user-created templates (for now)

### 5. **Platform Priority:** ✅ **CONFIRMED - MOBILE FIRST**
   - Design for mobile primarily
   - Desktop adapts/enhances
   - Bottom sheets on mobile
   - Touch-optimized interactions
   - Thumb-friendly button placement

### 6. **Export Formats:** ✅ **CONFIRMED - ALL 4 OPTIONS**
   - ✅ **PDF:** Professional, printable
   - ✅ **Text:** Copy to clipboard, paste anywhere
   - ✅ **Image:** Easy to share, visual format
   - ✅ **WhatsApp:** Direct share via WhatsApp Web API
   
   **Implementation:**
   ```typescript
   // Share menu options
   - Share to WhatsApp (web.whatsapp.com with text)
   - Copy as Text (navigator.clipboard)
   - Export as PDF (jsPDF library)
   - Export as Image (html2canvas)
   ```

---

## ✅ Next Steps

### Before Implementation:
1. Review this plan together
2. Finalize UI/UX mockups
3. Validate database schema
4. Create component wireframes
5. Set up dev branch: `feature/meal-planning`

### Week 1 Kickoff:
1. Create `calendar-enhanced.tsx` component
2. Build meal plan modal/bottom sheet
3. Implement recipe picker
4. Add save plan logic
5. Update Copilot instructions

### Success Definition:
✅ User can plan 7 days of meals from dashboard  
✅ Shopping list generates in <1 second  
✅ List organized, rounded, and shareable  
✅ Zero navigation to external pages  
✅ Mobile experience smooth and intuitive  

---

**Ready to start building? Let's refine this plan together! 🚀**
