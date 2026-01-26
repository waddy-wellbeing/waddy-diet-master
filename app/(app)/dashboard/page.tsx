import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./dashboard-content";
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
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
      .select("plan, daily_totals")
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
      .select("plan_date, plan")
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

  // Process week plans for indicators
  const weekPlansMap: Record<string, DailyPlan> = {};
  if (weekPlans) {
    for (const planRecord of weekPlans) {
      weekPlansMap[planRecord.plan_date] = planRecord.plan as DailyPlan;
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

  if (userMealStructure && userMealStructure.length > 0) {
    for (const slot of userMealStructure) {
      mealTargets[slot.name] = Math.round(
        dailyCalories * (slot.percentage / 100),
      );
    }
  } else {
    // Fallback to default distribution
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

  // Build list of meal slots from saved structure, or use defaults
  const mealSlots =
    userMealStructure && userMealStructure.length > 0
      ? userMealStructure.map((slot: any) => slot.name)
      : ["breakfast", "lunch", "dinner", "snacks"];

  const recipesByMealType: Record<string, ScaledRecipe[]> = {};
  for (const slot of mealSlots) {
    recipesByMealType[slot] = [];
  }

  if (allRecipes) {
    for (const mealSlot of mealSlots) {
      const targetCalories = mealTargets[mealSlot];
      const acceptedMealTypes = mealTypeMapping[mealSlot];
      const primaryMealType = acceptedMealTypes[0];

      const suitableRecipes: ScaledRecipe[] = [];

      for (const recipe of allRecipes) {
        const recipeMealTypes = recipe.meal_type || [];
        const matchesMealType = acceptedMealTypes.some((t) =>
          recipeMealTypes.some(
            (rmt: string) => rmt.toLowerCase() === t.toLowerCase(),
          ),
        );

        if (!matchesMealType) continue;

        const baseCalories = recipe.nutrition_per_serving?.calories;
        if (!baseCalories || baseCalories <= 0) continue;

        // Calculate scale factor to hit exact target calories
        const scaleFactor = targetCalories / baseCalories;

        // Check if scaling is within acceptable limits
        if (scaleFactor < minScale || scaleFactor > maxScale) continue;

        // Calculate recipe's macro percentages
        const recipeProtein = recipe.nutrition_per_serving?.protein_g || 0;
        const recipeCarbs = recipe.nutrition_per_serving?.carbs_g || 0;
        const recipeFat = recipe.nutrition_per_serving?.fat_g || 0;
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

        suitableRecipes.push({
          ...(recipe as RecipeRecord),
          scale_factor: Math.round(scaleFactor * 100) / 100,
          scaled_calories: targetCalories, // Always equals target after scaling
          original_calories: baseCalories,
          macro_similarity_score: macroSimilarityScore, // Add score for sorting
        });
      }

      // Sort by: 1) Macro similarity (descending), 2) Primary meal type, 3) Scale factor closest to 1.0
      suitableRecipes.sort((a, b) => {
        // First priority: Macro similarity (higher is better)
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

  // If there's a daily plan, get the currently selected recipe indices
  const plan = dailyPlan?.plan as DailyPlan | undefined;
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
