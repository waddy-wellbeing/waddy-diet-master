import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./dashboard-content";
import { FastingDashboardContent } from "./fasting-dashboard-content";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import type {
  DailyPlan,
  DailyLog,
  DailyTotals,
  RecipeRecord,
} from "@/lib/types/nutri";

export const metadata: Metadata = {
  title: "Dashboard | Waddy Diet Master",
  description: "Your daily nutrition overview",
};

// Force dynamic rendering - always fetch fresh data from database
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile (explicitly select preferences to ensure JSONB parsing)
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, user_id, name, email, avatar_url, role, plan_status, basic_info, targets, preferences, goals, onboarding_completed, onboarding_step, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");

  // Run ALL queries in parallel for maximum speed
  const [
    { data: dailyLog },
    { data: dailyPlan },
    { data: weekLogs },
    { data: weekPlans },
    { data: streakLogs },
    { data: allRecipes },
  ] = await Promise.all([
    // Today's log
    supabase
      .from("daily_logs")
      .select("log, logged_totals")
      .eq("user_id", user.id)
      .eq("log_date", todayStr)
      .maybeSingle(),

    // Today's plan
    supabase
      .from("daily_plans")
      .select("plan, daily_totals, fasting_plan")
      .eq("user_id", user.id)
      .eq("plan_date", todayStr)
      .maybeSingle(),

    // Week logs for the week selector
    supabase
      .from("daily_logs")
      .select("log_date, log, logged_totals")
      .eq("user_id", user.id)
      .gte("log_date", format(weekStart, "yyyy-MM-dd"))
      .lte("log_date", format(weekEnd, "yyyy-MM-dd")),

    // Week plans for the week selector (NEW - for plan indicators)
    supabase
      .from("daily_plans")
      .select("plan_date, plan, mode, fasting_plan")
      .eq("user_id", user.id)
      .gte("plan_date", format(weekStart, "yyyy-MM-dd"))
      .lte("plan_date", format(weekEnd, "yyyy-MM-dd")),

    // Last 30 days for streak calculation (single query instead of 30!)
    supabase
      .from("daily_logs")
      .select("log_date")
      .eq("user_id", user.id)
      .gte("log_date", thirtyDaysAgo)
      .lte("log_date", todayStr)
      .order("log_date", { ascending: false }),

    // All public recipes
    supabase
      .from("recipes")
      .select("*")
      .eq("is_public", true)
      .not("nutrition_per_serving", "is", null)
      .order("name"),
  ]);

  // Process week data
  const weekData: Record<string, { consumed: number }> = {};
  const weekLogsMap: Record<string, DailyLog> = {};
  if (weekLogs) {
    for (const log of weekLogs) {
      const totals = log.logged_totals as DailyTotals;
      weekData[log.log_date] = { consumed: totals.calories || 0 };
      weekLogsMap[log.log_date] = log.log as DailyLog;
    }
  }

  // Get fasting mode early (needed for weekPlansMap processing)
  const isFastingModeCheck = profile.preferences?.is_fasting || false;

  // Process week plans for indicators
  // Use correct column based on fasting mode
  const weekPlansMap: Record<string, DailyPlan> = {};
  if (weekPlans) {
    for (const planRecord of weekPlans) {
      const planData = isFastingModeCheck
        ? (planRecord.fasting_plan as DailyPlan)
        : (planRecord.plan as DailyPlan);
      if (planData) {
        weekPlansMap[planRecord.plan_date] = planData;
      }
    }
  }

  // Calculate streak from the fetched logs (no more loop queries!)
  let streak = 0;
  if (streakLogs && streakLogs.length > 0) {
    const logDates = new Set(streakLogs.map((l) => l.log_date));
    let checkDate = today;

    // Count consecutive days from today backwards
    for (let i = 0; i < 30; i++) {
      const dateStr = format(checkDate, "yyyy-MM-dd");
      if (logDates.has(dateStr)) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  }

  // Get user's daily targets and calculate meal targets
  const dailyCalories = profile.targets?.daily_calories || 2000;
  const dailyProtein = profile.targets?.protein_g || 150;
  const dailyCarbs = profile.targets?.carbs_g || 250;
  const dailyFat = profile.targets?.fat_g || 65;

  // Use user's saved meal structure if available, otherwise default percentages
  const userMealStructure = profile.preferences?.meal_structure;
  const mealTargets: Record<string, number> = {};

  if (isFastingModeCheck) {
    // Fasting mode: distribute calories across fasting meals
    // Default fasting distribution (can be customized later)
    const fastingDistribution: Record<string, number> = {
      "pre-iftar": 0.1, // 10% - light snack
      iftar: 0.4, // 40% - main breaking fast meal
      "full-meal-taraweeh": 0.3, // 30% - substantial meal
      "snack-taraweeh": 0.1, // 10% - light snack
      suhoor: 0.25, // 25% - pre-dawn meal
    };

    const selectedFastingMeals =
      profile.preferences?.fasting_selected_meals || [];
    const mealsToUse =
      selectedFastingMeals.length > 0
        ? selectedFastingMeals
        : Object.keys(fastingDistribution);

    // Calculate total percentage and normalize
    const totalPercentage = mealsToUse.reduce(
      (sum: number, meal: string) => sum + (fastingDistribution[meal] || 0),
      0,
    );

    for (const meal of mealsToUse) {
      const normalizedPercentage =
        (fastingDistribution[meal] || 0.2) / totalPercentage;
      mealTargets[meal] = Math.round(dailyCalories * normalizedPercentage);
    }
  } else if (userMealStructure && userMealStructure.length > 0) {
    // Regular mode with custom meal structure
    for (const slot of userMealStructure) {
      mealTargets[slot.name] = Math.round(
        dailyCalories * (slot.percentage / 100),
      );
    }
  } else {
    // Fallback to default regular distribution
    mealTargets.breakfast = Math.round(dailyCalories * 0.25);
    mealTargets.lunch = Math.round(dailyCalories * 0.35);
    mealTargets.dinner = Math.round(dailyCalories * 0.3);
    mealTargets.snacks = Math.round(dailyCalories * 0.1);
  }

  // Calculate target macro percentages for filtering recipes
  const targetMacroPercentages = {
    protein_pct: Math.round(((dailyProtein * 4) / dailyCalories) * 100),
    carbs_pct: Math.round(((dailyCarbs * 4) / dailyCalories) * 100),
    fat_pct: Math.round(((dailyFat * 9) / dailyCalories) * 100),
  };

  // Meal type mapping (same as test console)
  // Database meal_types: breakfast, lunch, dinner, snacks & sweetes, snack, smoothies, one pot, side dishes
  // Build mapping from saved meal structure, with defaults for standard slots
  const mealTypeMapping: Record<string, string[]> = {
    breakfast: ["breakfast", "smoothies"],
    mid_morning: ["snack", "snacks & sweetes", "smoothies"], // Mid-morning snacks
    lunch: ["lunch", "one pot", "dinner", "side dishes"], // Lunch includes one pot, dinner recipes, and sides
    afternoon: ["snack", "snacks & sweetes", "smoothies"], // Afternoon snacks
    dinner: ["dinner", "lunch", "one pot", "side dishes", "breakfast"], // Dinner uses dinner recipes first, then lunch/one pot
    snack: ["snack", "snacks & sweetes", "smoothies"], // Snack slot
    snacks: ["snack", "snacks & sweetes", "smoothies"], // Include both singular and plural forms
    snack_1: ["snack", "snacks & sweetes", "smoothies"],
    snack_2: ["snack", "snacks & sweetes", "smoothies"],
    snack_3: ["snack", "snacks & sweetes", "smoothies"],
    evening: ["snack", "snacks & sweetes", "smoothies"], // Evening snack
    // Fasting meal mappings
    "pre-iftar": ["pre-iftar", "smoothies"], // Pre-iftar first, then smoothies as fallback
    iftar: ["lunch"], // Main breaking fast meal - lunch recipes only
    "full-meal-taraweeh": ["lunch", "dinner"], // Full meal after prayers - lunch or dinner
    "snack-taraweeh": ["snack"], // Snack after prayers - snack recipes only
    suhoor: ["breakfast", "dinner"], // Pre-dawn meal - breakfast or dinner
  };

  // Get scaling limits from system settings or use defaults
  const minScale = 0.5;
  const maxScale = 2.0;

  // Process recipes for each meal type with scaling
  interface ScaledRecipe extends RecipeRecord {
    scale_factor: number;
    scaled_calories: number;
    original_calories: number;
    macro_similarity_score?: number; // Score 0-100 indicating how well recipe matches target macros
  }

  // Build list of meal slots based on fasting mode
  const FASTING_MEAL_ORDER = [
    "pre-iftar",
    "iftar",
    "full-meal-taraweeh",
    "snack-taraweeh",
    "suhoor",
  ];

  const mealSlots = (() => {
    if (isFastingModeCheck) {
      // Fasting mode: use selected fasting meals in specific order
      const selectedFastingMeals =
        profile.preferences?.fasting_selected_meals || [];
      if (selectedFastingMeals.length > 0) {
        return FASTING_MEAL_ORDER.filter((meal) =>
          selectedFastingMeals.includes(meal),
        );
      }
      // Fallback: show all fasting meals if none selected
      return FASTING_MEAL_ORDER;
    }

    // Regular mode: use meal structure or defaults
    if (userMealStructure && userMealStructure.length > 0) {
      return userMealStructure.map((slot: any) => slot.name);
    }
    return ["breakfast", "lunch", "dinner", "snacks"];
  })();

  const recipesByMealType: Record<string, ScaledRecipe[]> = {};
  for (const slot of mealSlots) {
    recipesByMealType[slot] = [];
  }

  // pre-iftar is special: only meal_type filter, NO calorie scaling
  // All other fasting meals now use both meal_type filtering AND calorie scaling
  const FASTING_CALORIES_ONLY_MEALS: string[] = [];

  if (allRecipes) {
    for (const mealSlot of mealSlots) {
      const targetCalories = mealTargets[mealSlot];
      const acceptedMealTypes = mealTypeMapping[mealSlot] || [];
      const primaryMealType = acceptedMealTypes[0];
      const isCaloriesOnlySlot = FASTING_CALORIES_ONLY_MEALS.includes(mealSlot);
      const isPreIftar = mealSlot === "pre-iftar";

      const suitableRecipes: ScaledRecipe[] = [];

      for (const recipe of allRecipes) {
        // Parse nutrition_per_serving if it's a JSON string
        const nutritionData =
          typeof recipe.nutrition_per_serving === "string"
            ? JSON.parse(recipe.nutrition_per_serving)
            : recipe.nutrition_per_serving;

        const baseCalories = nutritionData?.calories;
        if (!baseCalories || baseCalories <= 0) continue;

        // Calculate scale factor to hit exact target calories
        const scaleFactor = targetCalories / baseCalories;

        // Check meal_type filter FIRST
        let matchesMealType = true;
        if (!isCaloriesOnlySlot) {
          const recipeMealTypes = recipe.meal_type || [];
          matchesMealType = acceptedMealTypes.some((t) =>
            recipeMealTypes.some(
              (rmt: string) => rmt.toLowerCase() === t.toLowerCase(),
            ),
          );
          // Skip if doesn't match meal type (this is a hard filter)
          if (!matchesMealType) continue;
        }

        // Check if scaling is within acceptable limits (0.5x - 2.0x)
        // BUT: Don't skip recipes outside range - include ALL recipes for meal type
        // This ensures planned recipes are always available even if they don't fit current calorie targets
        const isWithinCalorieRange =
          scaleFactor >= minScale && scaleFactor <= maxScale;

        // Calculate recipe's macro percentages
        const recipeProtein = nutritionData?.protein_g || 0;
        const recipeCarbs = nutritionData?.carbs_g || 0;
        const recipeFat = nutritionData?.fat_g || 0;
        const recipeMacroPercentages = {
          protein_pct: Math.round(((recipeProtein * 4) / baseCalories) * 100),
          carbs_pct: Math.round(((recipeCarbs * 4) / baseCalories) * 100),
          fat_pct: Math.round(((recipeFat * 9) / baseCalories) * 100),
        };

        // Calculate macro similarity score (0-100, higher is better)
        // Prioritize protein (50%), then carbs (30%), then fat (20%)
        const proteinDiff = Math.abs(
          targetMacroPercentages.protein_pct -
            recipeMacroPercentages.protein_pct,
        );
        const carbsDiff = Math.abs(
          targetMacroPercentages.carbs_pct - recipeMacroPercentages.carbs_pct,
        );
        const fatDiff = Math.abs(
          targetMacroPercentages.fat_pct - recipeMacroPercentages.fat_pct,
        );

        const proteinScore = Math.max(0, 100 - proteinDiff * 1.5);
        const carbsScore = Math.max(0, 100 - carbsDiff * 1.5);
        const fatScore = Math.max(0, 100 - fatDiff * 1.5);

        const macroSimilarityScore = Math.round(
          proteinScore * 0.5 + carbsScore * 0.3 + fatScore * 0.2,
        );

        // For pre-iftar: force score to 0 so they appear LAST in sorted list
        // For recipes outside calorie range: also set score to -1 so they appear after pre-iftar
        const finalScore = isPreIftar
          ? 0
          : !isWithinCalorieRange
            ? -1
            : macroSimilarityScore;

        suitableRecipes.push({
          ...(recipe as RecipeRecord),
          scale_factor: Math.round(scaleFactor * 100) / 100,
          scaled_calories: targetCalories, // Always equals target after scaling
          original_calories: baseCalories,
          macro_similarity_score: finalScore, // Pre-iftar gets 0, out-of-range gets -1, others get calculated score
        });
      }

      // Sort by:
      // 0) Ramadan recommendation boost (when fasting mode is enabled)
      // 1) Macro similarity (descending)
      // 2) Primary meal type
      // 3) Scale factor closest to 1.0
      suitableRecipes.sort((a, b) => {
        // Priority 0: Ramadan recommendation boost (only when fasting mode is active)
        if (isFastingModeCheck) {
          const aRamadan = (
            a.recommendation_group as string[] | null
          )?.includes("ramadan")
            ? 1
            : 0;
          const bRamadan = (
            b.recommendation_group as string[] | null
          )?.includes("ramadan")
            ? 1
            : 0;
          if (bRamadan !== aRamadan) return bRamadan - aRamadan;
        }

        // First priority: Macro similarity (higher is better)
        // Negative scores (out-of-range recipes) will appear last
        const macroScoreDiff =
          (b.macro_similarity_score || 0) - (a.macro_similarity_score || 0);
        if (Math.abs(macroScoreDiff) > 5) return macroScoreDiff; // Only prioritize if difference > 5 points

        // Second priority: Primary meal type
        const aPrimary = a.meal_type?.some(
          (t) => t.toLowerCase() === primaryMealType,
        )
          ? 1
          : 0;
        const bPrimary = b.meal_type?.some(
          (t) => t.toLowerCase() === primaryMealType,
        )
          ? 1
          : 0;
        if (bPrimary !== aPrimary) return bPrimary - aPrimary;

        const aDistFromOne = Math.abs(a.scale_factor - 1);
        const bDistFromOne = Math.abs(b.scale_factor - 1);
        return aDistFromOne - bDistFromOne;
      });

      recipesByMealType[mealSlot] = suitableRecipes;
    }
  }

  // ===== DISTRIBUTE RAMADAN PICKS ACROSS MEAL SLOTS (avoid same recipe in every slot) =====
  // When multiple meal slots share the same Ramadan-recommended recipe at index 0,
  // rotate picks so each slot gets a different one when possible.
  // If there's only one Ramadan pick matching a group of slots, allow duplication.
  if (isFastingModeCheck) {
    // Track which Ramadan recipe IDs have been "claimed" as index-0 by a slot
    const claimedRamadanIds = new Set<string>();

    for (const slot of mealSlots) {
      const recipes = recipesByMealType[slot];
      if (!recipes || recipes.length === 0) continue;

      // Collect all Ramadan recipes in this slot's list
      const ramadanRecipes = recipes.filter((r) =>
        (r.recommendation_group as string[] | null)?.includes("ramadan"),
      );

      if (ramadanRecipes.length === 0) continue;

      const topRecipe = recipes[0];
      const isTopRamadan = (
        topRecipe.recommendation_group as string[] | null
      )?.includes("ramadan");
      if (!isTopRamadan) continue;

      // If the current top Ramadan recipe is already claimed by another slot,
      // try to find an unclaimed Ramadan recipe to promote to index 0
      if (claimedRamadanIds.has(topRecipe.id)) {
        const unclaimed = ramadanRecipes.find(
          (r) => !claimedRamadanIds.has(r.id),
        );

        if (unclaimed) {
          // Move the unclaimed Ramadan recipe to index 0
          const unclaimedIdx = recipes.indexOf(unclaimed);
          if (unclaimedIdx > 0) {
            recipes.splice(unclaimedIdx, 1);
            recipes.unshift(unclaimed);
          }
          claimedRamadanIds.add(unclaimed.id);
        } else {
          // All Ramadan picks are already claimed — allow duplication (few Ramadan picks scenario)
          claimedRamadanIds.add(topRecipe.id);
        }
      } else {
        claimedRamadanIds.add(topRecipe.id);
      }
    }
  }

  // If there's a daily plan, get the currently selected recipe indices
  // Use fasting_plan for fasting mode, plan for regular mode
  const plan = isFastingModeCheck
    ? (dailyPlan?.fasting_plan as DailyPlan | undefined)
    : (dailyPlan?.plan as DailyPlan | undefined);
  const selectedRecipeIndices: Record<string, number> = {};

  // Initialize with 0 for all meal slots
  for (const slot of mealSlots) {
    selectedRecipeIndices[slot] = 0;
  }

  // If plan exists, find the index of the planned recipe in the available recipes
  if (plan) {
    for (const slot of mealSlots) {
      const plannedRecipeId = (plan as Record<string, any>)[slot]?.recipe_id;
      if (plannedRecipeId) {
        const idx = recipesByMealType[slot].findIndex(
          (r) => r.id === plannedRecipeId,
        );
        if (idx >= 0) selectedRecipeIndices[slot] = idx;
      }
    }
  }

  // ===== ROUTE TO APPROPRIATE DASHBOARD BASED ON FASTING MODE =====
  if (isFastingModeCheck) {
    // User has fasting mode enabled → Show fasting dashboard
    return (
      <FastingDashboardContent
        profile={profile}
        initialDailyLog={dailyLog}
        initialDailyPlan={dailyPlan}
        initialWeekLogs={weekData}
        initialWeekPlans={weekPlansMap}
        initialWeekLogsMap={weekLogsMap}
        initialStreak={streak}
        recipesByMealType={recipesByMealType}
        initialSelectedIndices={selectedRecipeIndices}
        mealTargets={mealTargets}
      />
    );
  }

  // User has regular mode → Show regular dashboard
  return (
    <DashboardContent
      profile={profile}
      initialDailyLog={dailyLog}
      initialDailyPlan={dailyPlan}
      initialWeekLogs={weekData}
      initialWeekPlans={weekPlansMap}
      initialWeekLogsMap={weekLogsMap}
      initialStreak={streak}
      recipesByMealType={recipesByMealType}
      initialSelectedIndices={selectedRecipeIndices}
      mealTargets={mealTargets}
    />
  );
}
