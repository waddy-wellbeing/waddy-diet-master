"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  format,
  startOfWeek,
  endOfWeek,
  isToday as isDateToday,
} from "date-fns";
import { Settings, Bell, LogOut, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WeekSelector,
  MealCard,
  QuickStats,
} from "@/components/dashboard/dashboard-components";
import { MealPlanSheet } from "@/components/dashboard/meal-plan-sheet";
import { useAnalytics } from "@/components/analytics/analytics-provider";
import { logout } from "@/lib/utils/logout";
import { createClient } from "@/lib/supabase/client";
import {
  buildFeatureUseEvent,
  buildButtonClickEvent,
  buildMealLogError,
  getCurrentPagePath,
} from "@/lib/utils/analytics";
import { saveFullDayPlan } from "@/lib/actions/daily-plans";
import { getSuggestedRecipeIndex } from "@/lib/utils/meal-suggestions";
import type {
  Profile,
  DailyLog,
  DailyPlan,
  DailyTotals,
  RecipeRecord,
  MealType,
} from "@/lib/types/nutri";

type MealName = MealType;

// Scaled recipe includes scale_factor and scaled_calories
interface ScaledRecipe extends RecipeRecord {
  scale_factor: number;
  scaled_calories: number;
  original_calories: number;
  macro_similarity_score?: number;
}

interface DashboardContentProps {
  profile: Profile;
  initialDailyLog: { log: DailyLog; logged_totals: DailyTotals } | null;
  initialDailyPlan: {
    plan: DailyPlan;
    daily_totals: DailyTotals;
    fasting_plan?: DailyPlan;
  } | null;
  initialWeekLogs: Record<string, { consumed: number }>;
  initialWeekPlans?: Record<string, DailyPlan>;
  initialWeekLogsMap?: Record<string, DailyLog>;
  initialStreak: number;
  recipesByMealType: Record<string, ScaledRecipe[]>;
  initialSelectedIndices: Record<string, number>;
  mealTargets: Record<string, number>;
}

export function FastingDashboardContent({
  profile,
  initialDailyLog,
  initialDailyPlan,
  initialWeekLogs,
  initialWeekPlans = {},
  initialWeekLogsMap = {},
  initialStreak,
  recipesByMealType,
  initialSelectedIndices,
  mealTargets,
}: DashboardContentProps) {
  const router = useRouter();
  const { trackEvent, captureError } = useAnalytics(); // Call hook at component level
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyLog, setDailyLog] = useState(initialDailyLog);
  const [dailyPlan, setDailyPlan] = useState(initialDailyPlan);
  const [weekData, setWeekData] = useState(initialWeekLogs);
  const [weekPlans, setWeekPlans] = useState(initialWeekPlans);
  const [weekLogsMap, setWeekLogsMap] = useState(initialWeekLogsMap);
  const [streak, setStreak] = useState(initialStreak);
  const [loadingMeal, setLoadingMeal] = useState<string | null>(null); // Track which meal is being logged
  const [showDebug, setShowDebug] = useState(false);
  const [loadingDayData, setLoadingDayData] = useState(false); // Track day data loading

  // Meal planning sheet state
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [planSheetDate, setPlanSheetDate] = useState<Date | null>(null);

  // Fasting mode is always enabled for this dashboard
  const isFastingMode = true;

  // Fasting meal labels mapping with specific order
  const FASTING_MEAL_LABELS: Record<string, string> = {
    "pre-iftar": "كسر صيام",
    iftar: "إفطار",
    "full-meal-taraweeh": "وجبة بعد التراويح",
    "snack-taraweeh": "سناك بعد التراويح",
    suhoor: "سحور",
  };

  // ORDERED fasting meal slots (specific order as requested)
  const FASTING_MEAL_ORDER = [
    "pre-iftar",
    "iftar",
    "full-meal-taraweeh",
    "snack-taraweeh",
    "suhoor",
  ];

  // Build meal slots from user's selected fasting meals, maintaining the order
  const mealSlots = (() => {
    const selectedMeals = profile.preferences?.fasting_selected_meals || [];

    // If no meals selected, show all fasting meals in order
    if (selectedMeals.length === 0) {
      return FASTING_MEAL_ORDER.map((mealName) => ({
        name: mealName,
        label: FASTING_MEAL_LABELS[mealName] || mealName,
      }));
    }

    // Filter FASTING_MEAL_ORDER to only include meals the user selected
    // This maintains the correct order while only showing selected meals
    return FASTING_MEAL_ORDER.filter((meal) =>
      selectedMeals.includes(meal),
    ).map((mealName) => ({
      name: mealName,
      label: FASTING_MEAL_LABELS[mealName] || mealName,
    }));
  })();

  // Track current recipe index for each meal type (for swiping)
  const [selectedIndices, setSelectedIndices] = useState<
    Record<string, number>
  >(() => {
    const initial: Record<string, number> = {};
    for (const slot of mealSlots) {
      initial[slot.name] = initialSelectedIndices[slot.name] || 0;
    }
    return initial;
  });

  // Track meals where user explicitly swapped away from a Ramadan recommendation
  // This prevents the Ramadan override from fighting with user's manual swap within a session
  const [userOverriddenMeals, setUserOverriddenMeals] = useState<Set<string>>(new Set());

  // Get targets from profile
  const targets = profile.targets;
  const dailyCalories = targets.daily_calories || 2000;

  // Get logged totals (defaults to 0 if no log exists)
  const loggedTotals = dailyLog?.logged_totals || {};
  const todayConsumed = loggedTotals.calories || 0;

  // Fetch data when selected date changes
  const fetchDayData = useCallback(
    async (date: Date) => {
      setLoadingDayData(true);
      try {
        const supabase = createClient();
        const dateStr = format(date, "yyyy-MM-dd");

        // Fetch daily log
        const { data: logData } = await supabase
          .from("daily_logs")
          .select("log, logged_totals")
          .eq("user_id", profile.user_id)
          .eq("log_date", dateStr)
          .maybeSingle();

        // Fetch daily plan
        const { data: planData } = await supabase
          .from("daily_plans")
          .select("plan, daily_totals, fasting_plan")
          .eq("user_id", profile.user_id)
          .eq("plan_date", dateStr)
          .maybeSingle();

        // Set to null if no data (important for unplanned days)
        setDailyLog(logData || null);
        setDailyPlan(planData || null);

        // NOTE: We intentionally do NOT update selectedIndices here!
        // selectedIndices is for suggested recipes (days without plans)
        // Planned days use dailyPlan.plan directly in getCurrentRecipe()
        // This separation prevents one day's plan from overwriting all days' displays

        // Wait a bit for React to re-render and images to start loading
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        console.error("Error fetching day data:", error);
      } finally {
        setLoadingDayData(false);
      }
    },
    [profile.user_id],
  );

  // Fetch week data when week changes
  const fetchWeekData = useCallback(
    async (date: Date) => {
      const supabase = createClient();
      const weekStart = startOfWeek(date, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

      const { data: weekLogs } = await supabase
        .from("daily_logs")
        .select("log_date, logged_totals")
        .eq("user_id", profile.user_id)
        .gte("log_date", format(weekStart, "yyyy-MM-dd"))
        .lte("log_date", format(weekEnd, "yyyy-MM-dd"));

      const weekRecord: Record<string, { consumed: number }> = {};
      if (weekLogs) {
        for (const log of weekLogs) {
          const totals = log.logged_totals as DailyTotals;
          weekRecord[log.log_date] = { consumed: totals.calories || 0 };
        }
      }
      setWeekData(weekRecord);
    },
    [profile.user_id],
  );

  // Fetch data whenever selected date changes (including today)
  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Always fetch data when switching dates to ensure fresh plan/log data
    // This fixes the issue where switching from planned to unplanned days doesn't update
    fetchDayData(selectedDate);
    fetchWeekData(selectedDate);
  }, [selectedDate, fetchDayData, fetchWeekData]);

  // Auto-save today's plan on mount if it doesn't exist
  useEffect(() => {
    const saveTodaysPlan = async () => {
      // Only save if viewing today and no plan exists yet
      if (!isDateToday(selectedDate) || initialDailyPlan) {
        return;
      }

      // Get the first recipe for each FASTING meal type (with safe array access)
      const preIftar = recipesByMealType["pre-iftar"]?.[0];
      const iftar = recipesByMealType.iftar?.[0];
      const fullMealTaraweeh = recipesByMealType["full-meal-taraweeh"]?.[0];
      const snackTaraweeh = recipesByMealType["snack-taraweeh"]?.[0];
      const suhoor = recipesByMealType.suhoor?.[0];

      // Only save if we have recipes available
      if (
        !preIftar &&
        !iftar &&
        !fullMealTaraweeh &&
        !snackTaraweeh &&
        !suhoor
      ) {
        return;
      }

      console.log("Auto-saving today's fasting plan...");
      await saveFullDayPlan({
        date: format(new Date(), "yyyy-MM-dd"),
        meals: {
          "pre-iftar": preIftar
            ? { recipeId: preIftar.id, servings: preIftar.scale_factor }
            : undefined,
          iftar: iftar
            ? { recipeId: iftar.id, servings: iftar.scale_factor }
            : undefined,
          "full-meal-taraweeh": fullMealTaraweeh
            ? {
                recipeId: fullMealTaraweeh.id,
                servings: fullMealTaraweeh.scale_factor,
              }
            : undefined,
          "snack-taraweeh": snackTaraweeh
            ? {
                recipeId: snackTaraweeh.id,
                servings: snackTaraweeh.scale_factor,
              }
            : undefined,
          suhoor: suhoor
            ? { recipeId: suhoor.id, servings: suhoor.scale_factor }
            : undefined,
        },
        isFastingMode: true, // NEW: Save to fasting_plan column
      });
    };

    saveTodaysPlan();
  }, []); // Run only once on mount

  // Persist Ramadan-recommended recipes into the plan on mount
  // This updates specific meal slots where a Ramadan recipe should replace the current plan
  useEffect(() => {
    const updatePlanWithRamadanRecipes = async () => {
      if (!isDateToday(selectedDate)) return;

      const currentFastingPlan = (initialDailyPlan as any)?.fasting_plan as
        | DailyPlan
        | undefined;
      if (!currentFastingPlan) return; // No plan to update (auto-save handles creation)

      const { saveMealToPlan } = await import("@/lib/actions/daily-plans");
      const dateStr = format(new Date(), "yyyy-MM-dd");
      let updatedAny = false;

      for (const slot of mealSlots) {
        const topRecipe = recipesByMealType[slot.name]?.[0];
        if (!topRecipe) continue;

        const isRamadan = (
          topRecipe.recommendation_group as string[] | null
        )?.includes("ramadan");
        if (!isRamadan) continue;

        const planSlot = (currentFastingPlan as any)?.[slot.name];
        if (planSlot?.recipe_id !== topRecipe.id) {
          await saveMealToPlan({
            date: dateStr,
            mealType: slot.name as MealName,
            recipeId: topRecipe.id,
            servings: topRecipe.scale_factor || 1,
            isFastingMode: true,
          });
          updatedAny = true;
        }
      }

      // Refresh plan data if any slots were updated
      if (updatedAny) {
        fetchDayData(selectedDate);
      }
    };

    updatePlanWithRamadanRecipes();
  }, []); // Run only once on mount

  // Get current recipe for each meal type based on selected index
  // Get current recipe for the selected day
  // - If the day has a fasting plan in database: show the PLANNED recipe
  // - If the day has no plan: show the SUGGESTED recipe (uses selectedIndices for swapping)
  // - Ramadan-recommended recipes take priority over stale plans (unless user explicitly swapped)
  const getCurrentRecipe = (mealType: MealName): ScaledRecipe | null => {
    const recipes = recipesByMealType[mealType] || [];
    if (recipes.length === 0) return null;

    // Get the fasting plan (fasting mode only)
    const currentPlan = (dailyPlan as any)?.fasting_plan as
      | DailyPlan
      | undefined;

    // ===== PLANNED DAY: Return recipe from database fasting plan =====
    if (currentPlan) {
      const planSlot =
        mealType === "snacks"
          ? currentPlan.snacks?.[0]
          : (currentPlan as any)?.[mealType];
      const recipeId = planSlot?.recipe_id;

      if (recipeId) {
        // Check if a Ramadan-recommended recipe should take priority over the saved plan
        // Only override if the user hasn't explicitly swapped this meal in this session
        if (!userOverriddenMeals.has(mealType)) {
          const topRecipe = recipes[0];
          const topIsRamadan = (topRecipe?.recommendation_group as string[] | null)?.includes('ramadan');
          if (topIsRamadan && recipeId !== topRecipe.id) {
            return topRecipe;
          }
        }

        // Find the recipe in all available recipes
        const allRecipes = Object.values(recipesByMealType).flat();
        const plannedRecipe = allRecipes.find((r) => r.id === recipeId);
        if (plannedRecipe) {
          return plannedRecipe;
        }
      }
    }

    // ===== UNPLANNED DAY: Return recipe based on selectedIndices (allows swapping) =====
    const currentIndex = selectedIndices[mealType] || 0;
    return recipes[currentIndex] || recipes[0] || null;
  };

  // Get recipe count for each meal type
  const getRecipeCount = (mealType: MealName): number => {
    return (recipesByMealType[mealType] || []).length;
  };

  // Meal planning handlers
  const handlePlanClick = (date: Date) => {
    setPlanSheetDate(date);
    setPlanSheetOpen(true);
  };

  const handlePlanUpdated = async () => {
    // Refresh week data to show updated indicators
    const supabase = createClient();
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });

    const { data: updatedPlans } = await supabase
      .from("daily_plans")
      .select("plan_date, fasting_plan")
      .eq("user_id", profile.user_id)
      .gte("plan_date", format(weekStart, "yyyy-MM-dd"))
      .lte("plan_date", format(weekEnd, "yyyy-MM-dd"));

    if (updatedPlans) {
      const newPlans: Record<string, DailyPlan> = {};
      for (const p of updatedPlans) {
        newPlans[p.plan_date] = (p as any).fasting_plan as DailyPlan;
      }
      setWeekPlans(newPlans);
    }

    // Always refresh the planned date's data to show updated meals immediately
    if (planSheetDate) {
      await fetchDayData(planSheetDate);
      // If the planned date is the selected date, make sure we see it
      if (
        format(planSheetDate, "yyyy-MM-dd") ===
        format(selectedDate, "yyyy-MM-dd")
      ) {
        await fetchDayData(selectedDate);
      }
    }
  };

  // Build meal data using mealTargets for proper calorie allocation
  const plan = (dailyPlan as any)?.fasting_plan as DailyPlan | undefined;
  const log = dailyLog?.log as DailyLog | undefined;

  // Check if selected date is today
  const isSelectedToday = isDateToday(selectedDate);

  // Helper to get logged recipe name from log items
  const getLoggedRecipeName = (
    mealLog:
      | { items?: Array<{ recipe_id?: string; recipe_name?: string }> }
      | undefined,
  ): string | null => {
    if (!mealLog?.items?.length) return null;
    // Try to get recipe name from the first logged item
    const firstItem = mealLog.items[0];
    return firstItem?.recipe_name || null;
  };

  // Helper to get actual calories from logged meal using the recipe
  const getLoggedCalories = (mealName: string): number => {
    const mealLog = log?.[mealName as keyof DailyLog];
    if (!mealLog?.items?.length) return 0;

    // Get the recipe for this meal to calculate actual calories
    const recipes = recipesByMealType[mealName] || [];
    return mealLog.items.reduce((sum, item) => {
      // Find the recipe by ID
      const recipe = recipes.find((r) => r.id === item.recipe_id);
      if (!recipe) return sum;

      // Use scaled_calories which already accounts for scale_factor
      const calories =
        recipe.scaled_calories || recipe.nutrition_per_serving?.calories || 0;

      return sum + calories * (item.servings || 1);
    }, 0);
  };

  // Build meals array dynamically from mealSlots
  const meals = mealSlots.map((slot: { name: string; label?: string }) => ({
    name: slot.name as MealType,
    label: slot.label || slot.name,
    targetCalories: mealTargets[slot.name],
    consumedCalories: getLoggedCalories(slot.name),
    isLogged: !!log?.[slot.name as keyof DailyLog]?.items?.length,
    loggedRecipeName: getLoggedRecipeName(log?.[slot.name as keyof DailyLog]),
    recipe: getCurrentRecipe(slot.name as MealName),
    recipeCount: getRecipeCount(slot.name as MealName),
    currentIndex: selectedIndices[slot.name] || 0,
    planSlot: (plan as any)?.[slot.name],
  }));

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = profile.basic_info?.name?.split(" ")[0] || "there";

  // Handle logout
  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  // Handler for logging a meal
  const handleLogMeal = async (mealName: string) => {
    // trackEvent and captureError are already available from component-level hook call

    if (loadingMeal) return; // Prevent double-click
    setLoadingMeal(mealName);

    try {
      const supabase = createClient();
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Find the meal and its recipe
      const meal = meals.find((m: any) => m.name === mealName);
      if (!meal?.recipe) {
        setLoadingMeal(null);
        return;
      }

      // Get scaled values from the recipe
      const scaledRecipe = meal.recipe as ScaledRecipe;
      const scaleFactor = scaledRecipe.scale_factor || 1;

      const logEntry = {
        type: "recipe" as const,
        recipe_id: meal.recipe.id,
        recipe_name: meal.recipe.name, // Store recipe name for historical display
        servings: meal.planSlot?.servings || 1,
        scale_factor: scaleFactor, // Store scale factor for reference
        from_plan: true,
      };

      // Get or create daily log
      const { data: existingLog } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("log_date", dateStr)
        .single();

      const currentLog = (existingLog?.log || {}) as DailyLog;
      const currentTotals = (existingLog?.logged_totals || {}) as DailyTotals;

      // Add to the appropriate meal
      const mealLog = currentLog[mealName as keyof DailyLog] || { items: [] };
      const updatedMealLog = {
        logged_at: new Date().toISOString(),
        items: [...(mealLog.items || []), logEntry],
      };

      const updatedLog = {
        ...currentLog,
        [mealName]: updatedMealLog,
      };

      // Use SCALED calories (what user sees), not original recipe calories
      // NOTE: scaled_calories is already the target amount (e.g., breakfast target = 488 cal)
      // It's NOT per-serving - it's the total scaled amount for this meal
      // So we don't multiply by servings/scale_factor here!
      const scaledCalories =
        scaledRecipe.scaled_calories ||
        (meal.recipe.nutrition_per_serving?.calories || 0) * scaleFactor;
      const originalProtein = meal.recipe.nutrition_per_serving?.protein_g || 0;
      const originalCarbs = meal.recipe.nutrition_per_serving?.carbs_g || 0;
      const originalFat = meal.recipe.nutrition_per_serving?.fat_g || 0;
      const scaleFactor2 = scaledRecipe.scale_factor || 1;

      const updatedTotals = {
        calories: (currentTotals.calories || 0) + Math.round(scaledCalories),
        protein_g:
          (currentTotals.protein_g || 0) +
          Math.round(originalProtein * scaleFactor2),
        carbs_g:
          (currentTotals.carbs_g || 0) +
          Math.round(originalCarbs * scaleFactor2),
        fat_g:
          (currentTotals.fat_g || 0) + Math.round(originalFat * scaleFactor2),
      };

      if (existingLog) {
        await supabase
          .from("daily_logs")
          .update({
            log: updatedLog,
            logged_totals: updatedTotals,
            meals_logged: Object.keys(updatedLog).filter((k) => {
              const mealLog = updatedLog[k as keyof DailyLog];
              return mealLog?.items && mealLog.items.length > 0;
            }).length,
          })
          .eq("id", existingLog.id);
      } else {
        await supabase.from("daily_logs").insert({
          user_id: profile.user_id,
          log_date: dateStr,
          log: updatedLog,
          logged_totals: updatedTotals,
          meals_logged: 1,
        });
      }

      // Check for achievements (non-blocking)
      const { checkAndNotifyAchievements } =
        await import("@/lib/actions/daily-logs");
      checkAndNotifyAchievements(profile.user_id, dateStr).catch((err) => {
        console.error("Failed to check achievements:", err);
      });

      // Refresh the data
      fetchDayData(selectedDate);
      fetchWeekData(selectedDate);

      // Track meal logging event
      trackEvent(
        buildButtonClickEvent("dashboard", "log_meal", getCurrentPagePath(), {
          meal_type: mealName,
          recipe_id: meal.recipe.id,
          recipe_name: meal.recipe.name,
          calories: Math.round(updatedTotals.calories),
          date: dateStr,
        }),
      );
    } catch (error) {
      captureError(
        buildMealLogError(
          mealName,
          error instanceof Error ? error.message : "Unknown error",
        ),
      );
    } finally {
      setLoadingMeal(null);
    }
  };

  // Handler for unlogging a meal
  const handleUnlogMeal = async (mealName: string) => {
    // trackEvent and captureError are already available from component-level hook call

    if (loadingMeal) return; // Prevent double-click
    setLoadingMeal(mealName);

    try {
      const supabase = createClient();
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Get current daily log
      const { data: existingLog } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("log_date", dateStr)
        .single();

      if (!existingLog) return;

      const currentLog = (existingLog.log || {}) as DailyLog;
      const currentTotals = (existingLog.logged_totals || {}) as DailyTotals;

      // Get the meal log to remove
      const mealLog = currentLog[mealName as keyof DailyLog];
      if (!mealLog?.items?.length) return;

      // Calculate calories to subtract using scaled values
      // NOTE: scaled_calories is already the target amount (total for this meal)
      // NOT per-serving, so don't multiply by servings/scale_factor!
      const meal = meals.find((m: any) => m.name === mealName);
      const scaledRecipe = meal?.recipe as ScaledRecipe | undefined;
      const scaleFactor = scaledRecipe?.scale_factor || 1;
      const scaledCalories =
        scaledRecipe?.scaled_calories ||
        (meal?.recipe?.nutrition_per_serving?.calories || 0) * scaleFactor;
      const originalProtein =
        meal?.recipe?.nutrition_per_serving?.protein_g || 0;
      const originalCarbs = meal?.recipe?.nutrition_per_serving?.carbs_g || 0;
      const originalFat = meal?.recipe?.nutrition_per_serving?.fat_g || 0;

      // Remove the meal from log
      const updatedLog = {
        ...currentLog,
        [mealName]: { logged_at: null, items: [] },
      };

      // Update totals (subtract the scaled calories)
      const updatedTotals = {
        calories: Math.max(
          0,
          (currentTotals.calories || 0) - Math.round(scaledCalories),
        ),
        protein_g: Math.max(
          0,
          (currentTotals.protein_g || 0) -
            Math.round(originalProtein * scaleFactor),
        ),
        carbs_g: Math.max(
          0,
          (currentTotals.carbs_g || 0) -
            Math.round(originalCarbs * scaleFactor),
        ),
        fat_g: Math.max(
          0,
          (currentTotals.fat_g || 0) - Math.round(originalFat * scaleFactor),
        ),
      };

      await supabase
        .from("daily_logs")
        .update({
          log: updatedLog,
          logged_totals: updatedTotals,
          meals_logged: Object.keys(updatedLog).filter((k) => {
            const ml = updatedLog[k as keyof DailyLog];
            return ml?.items && ml.items.length > 0;
          }).length,
        })
        .eq("id", existingLog.id);

      // Refresh the data
      fetchDayData(selectedDate);
      fetchWeekData(selectedDate);

      // Track meal unlogging event
      trackEvent(
        buildButtonClickEvent("dashboard", "unlog_meal", getCurrentPagePath(), {
          meal_type: mealName,
          removed_calories: Math.round(updatedTotals.calories),
          date: dateStr,
        }),
      );
    } catch (error) {
      captureError(
        buildMealLogError(
          mealName,
          error instanceof Error ? error.message : "Unknown error",
        ),
      );
    } finally {
      setLoadingMeal(null);
    }
  };

  // Handler for swapping a meal - navigates to next/previous recipe and saves to plan
  const handleSwapMeal = async (
    mealName: string,
    direction: "left" | "right",
  ) => {
    // trackEvent and captureError are already available from component-level hook call

    const mealType = mealName as MealName;
    const recipes = recipesByMealType[mealType] || [];
    if (recipes.length <= 1) return; // Nothing to swap to

    // Set loading state immediately
    setLoadingMeal(mealType);

    const currentIdx = selectedIndices[mealType];
    let newIdx: number;

    if (direction === "right") {
      // Next recipe (wrap around)
      newIdx = (currentIdx + 1) % recipes.length;
    } else {
      // Previous recipe (wrap around)
      newIdx = currentIdx === 0 ? recipes.length - 1 : currentIdx - 1;
    }

    // Get old and new recipes for comparison
    const oldRecipe = recipes[currentIdx];
    const newRecipe = recipes[newIdx];

    // Show macro comparison toast
    if (oldRecipe && newRecipe) {
      const oldNutrition = oldRecipe.nutrition_per_serving;
      const newNutrition = newRecipe.nutrition_per_serving;

      if (oldNutrition && newNutrition) {
        const oldProtein = Math.round(
          (oldNutrition.protein_g || 0) * (oldRecipe.scale_factor || 1),
        );
        const newProtein = Math.round(
          (newNutrition.protein_g || 0) * (newRecipe.scale_factor || 1),
        );
        const oldCarbs = Math.round(
          (oldNutrition.carbs_g || 0) * (oldRecipe.scale_factor || 1),
        );
        const newCarbs = Math.round(
          (newNutrition.carbs_g || 0) * (newRecipe.scale_factor || 1),
        );
        const proteinDiff = newProtein - oldProtein;
        const carbsDiff = newCarbs - oldCarbs;

        const getChangeEmoji = (diff: number) => {
          if (Math.abs(diff) <= 3) return "✓";
          return diff > 0 ? "↑" : "↓";
        };

        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">Recipe Swapped!</p>
            <p className="text-xs text-muted-foreground">{newRecipe.name}</p>
            <div className="flex gap-3 text-xs pt-1">
              <span
                className={Math.abs(proteinDiff) <= 3 ? "text-green-600" : ""}
              >
                P: {newProtein}g {getChangeEmoji(proteinDiff)}
              </span>
              <span
                className={Math.abs(carbsDiff) <= 3 ? "text-green-600" : ""}
              >
                C: {newCarbs}g {getChangeEmoji(carbsDiff)}
              </span>
            </div>
          </div>,
          { duration: 3000 },
        );
      }
    }

    // Update local UI first for instant feedback
    setSelectedIndices((prev) => ({
      ...prev,
      [mealType]: newIdx,
    }));

    // Track that user explicitly overrode this meal (prevents Ramadan auto-override for this session)
    setUserOverriddenMeals((prev) => new Set(prev).add(mealType));

    // Save to daily plan if viewing today or any date with an existing plan
    const todayDateStr = format(new Date(), "yyyy-MM-dd");
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

    if (todayDateStr === selectedDateStr || dailyPlan) {
      // Get the new recipe and save it to plan
      const newRecipe = recipes[newIdx];
      if (newRecipe) {
        try {
          const { saveMealToPlan } = await import("@/lib/actions/daily-plans");
          await saveMealToPlan({
            date: selectedDateStr,
            mealType,
            recipeId: newRecipe.id,
            servings: newRecipe.scale_factor || 1,
            isFastingMode: true, // NEW: Save to fasting_plan column
          });
          // Refresh data to show the updated plan immediately
          await fetchDayData(selectedDate);
          await fetchWeekData(selectedDate);

          // Track recipe swap event
          trackEvent(
            buildButtonClickEvent(
              "meal_builder",
              "swap_recipe",
              getCurrentPagePath(),
              {
                meal_type: mealType,
                recipe_id: newRecipe.id,
                recipe_name: newRecipe.name,
                direction,
                calories:
                  newRecipe.scaled_calories || newRecipe.original_calories,
              },
            ),
          );
        } catch (error) {
          captureError(
            buildMealLogError(
              mealType,
              error instanceof Error ? error.message : "Unknown error",
            ),
          );
        } finally {
          setLoadingMeal(null);
        }
      }
    }
  };

  // Shuffle all meals to find better macro matches (Admin only)
  const handleShuffleMeals = async () => {
    if (!isSelectedToday) return;

    setLoadingMeal("shuffle");
    try {
      const { saveMealToPlan } = await import("@/lib/actions/daily-plans");
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // For each meal type, try to find the next available recipe with better macro match
      const updates = [];
      for (const slot of mealSlots) {
        const mealType = slot.name;
        const recipes = recipesByMealType[mealType] || [];
        if (recipes.length === 0) continue;

        const currentIndex = selectedIndices[mealType] || 0;
        // Try the next recipe, or wrap around to start
        const nextIndex = (currentIndex + 1) % recipes.length;
        const nextRecipe = recipes[nextIndex];

        if (nextRecipe) {
          updates.push(
            saveMealToPlan({
              date: dateStr,
              mealType: mealType as any,
              recipeId: nextRecipe.id,
              servings: nextRecipe.scale_factor || 1,
              isFastingMode: true, // NEW: Save to fasting_plan column
            }),
          );

          // Update the selected index
          setSelectedIndices((prev) => ({
            ...prev,
            [mealType]: nextIndex,
          }));
        }
      }

      // Execute all updates in parallel
      await Promise.all(updates);

      // Refresh data
      await fetchDayData(selectedDate);
      await fetchWeekData(selectedDate);

      // Track shuffle event
      trackEvent(
        buildButtonClickEvent(
          "dashboard",
          "shuffle_meals",
          getCurrentPagePath(),
          {
            date: dateStr,
          },
        ),
      );

      toast.success("Meals shuffled! Check the new suggestions.", {
        description: "Selected recipes with better macro matches",
      });
    } catch (error) {
      captureError(
        buildMealLogError(
          "shuffle",
          error instanceof Error ? error.message : "Unknown error",
        ),
      );
      toast.error("Failed to shuffle meals", {
        description: "Please try again",
      });
    } finally {
      setLoadingMeal(null);
    }
  };

  // Calculate weekly average from weekData
  const weekDaysWithData = Object.values(weekData).filter(
    (d) => d.consumed > 0,
  );
  const weeklyAverage =
    weekDaysWithData.length > 0
      ? Math.round(
          weekDaysWithData.reduce((sum, d) => sum + d.consumed, 0) /
            weekDaysWithData.length,
        )
      : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">
              {greeting()}, {firstName}! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* TODO: Implement notifications later */}
            {/* <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button> */}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Week Selector with inline progress bar */}
        <WeekSelector
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onPlanClick={handlePlanClick}
          weekData={weekData}
          weekPlans={weekPlans}
          weekLogs={weekLogsMap}
          dailyTarget={dailyCalories}
          showDayProgress={true}
        />

        {/* Debug Panel - Admin/Moderator Only */}
        {showDebug && (profile.role === "admin" || profile.role === "moderator") &&
          (() => {
            // Calculate macro quality for each meal
            const getMacroQuality = (recipe: ScaledRecipe | null) => {
              if (!recipe?.macro_similarity_score)
                return {
                  quality: "unknown",
                  score: 0,
                  color: "text-muted-foreground",
                };
              const score = recipe.macro_similarity_score;
              if (score >= 80)
                return {
                  quality: "✨ Excellent",
                  score,
                  color: "text-green-600",
                };
              if (score >= 60)
                return { quality: "✅ Good", score, color: "text-blue-600" };
              if (score >= 40)
                return {
                  quality: "⚠️ Acceptable",
                  score,
                  color: "text-amber-600",
                };
              return { quality: "❌ Poor", score, color: "text-red-600" };
            };

            const breakfastQuality = getMacroQuality(
              meals.find((m: any) => m.name === "breakfast")?.recipe || null,
            );
            const lunchQuality = getMacroQuality(
              meals.find((m: any) => m.name === "lunch")?.recipe || null,
            );
            const dinnerQuality = getMacroQuality(
              meals.find((m: any) => m.name === "dinner")?.recipe || null,
            );
            const snacksQuality = getMacroQuality(
              meals.find((m: any) => m.name === "snacks")?.recipe || null,
            );

            const averageScore = Math.round(
              (breakfastQuality.score +
                lunchQuality.score +
                dinnerQuality.score +
                snacksQuality.score) /
                4,
            );

            return (
              <div className="bg-muted/50 border border-border rounded-lg p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    🐛 Debug Info
                  </div>
                  {isSelectedToday && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShuffleMeals}
                      disabled={loadingMeal === "shuffle"}
                      className="h-7 text-xs"
                    >
                      {loadingMeal === "shuffle" ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Shuffling...
                        </>
                      ) : (
                        <>🔀 Shuffle Meals</>
                      )}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground">
                      Consumed (from DB):
                    </div>
                    <div className="font-mono">
                      {todayConsumed} cal | {loggedTotals.protein_g || 0}g P |{" "}
                      {loggedTotals.carbs_g || 0}g C | {loggedTotals.fat_g || 0}
                      g F
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Daily Target:</div>
                    <div className="font-mono">
                      {dailyCalories} cal | {targets.protein_g || 0}g P |{" "}
                      {targets.carbs_g || 0}g C | {targets.fat_g || 0}g F
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Meals Logged:</div>
                    <div className="font-mono">
                      {meals.filter((m: any) => m.isLogged).length} / 4
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Calorie Status:</div>
                    <div className="font-mono">
                      {Math.abs(todayConsumed - dailyCalories) <=
                      dailyCalories * 0.05
                        ? "✅ On Track"
                        : `${todayConsumed < dailyCalories ? "⚠️ Under" : "⚠️ Over"} (${Math.round((todayConsumed / dailyCalories) * 100)}%)`}
                    </div>
                  </div>
                </div>

                {/* Macro Quality Rating */}
                <div className="pt-2 border-t border-border space-y-1">
                  <div className="text-muted-foreground font-semibold mb-1">
                    Macro Match Quality:
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Breakfast:</span>
                      <span
                        className={cn("font-semibold", breakfastQuality.color)}
                      >
                        {breakfastQuality.quality} ({breakfastQuality.score})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lunch:</span>
                      <span className={cn("font-semibold", lunchQuality.color)}>
                        {lunchQuality.quality} ({lunchQuality.score})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dinner:</span>
                      <span
                        className={cn("font-semibold", dinnerQuality.color)}
                      >
                        {dinnerQuality.quality} ({dinnerQuality.score})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Snacks:</span>
                      <span
                        className={cn("font-semibold", snacksQuality.color)}
                      >
                        {snacksQuality.quality} ({snacksQuality.score})
                      </span>
                    </div>
                    <div className="flex justify-between col-span-2 pt-1 border-t border-border/50">
                      <span className="text-muted-foreground font-semibold">
                        Average:
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          averageScore >= 80
                            ? "text-green-600"
                            : averageScore >= 60
                              ? "text-blue-600"
                              : averageScore >= 40
                                ? "text-amber-600"
                                : "text-red-600",
                        )}
                      >
                        {averageScore >= 80
                          ? "✨ Excellent"
                          : averageScore >= 60
                            ? "✅ Good"
                            : averageScore >= 40
                              ? "⚠️ Acceptable"
                              : "❌ Poor"}{" "}
                        ({averageScore})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground pt-2 border-t border-border">
                  Logged Calories: Breakfast{" "}
                  {meals.find((m: any) => m.name === "breakfast")
                    ?.consumedCalories || 0}{" "}
                  | Lunch{" "}
                  {meals.find((m: any) => m.name === "lunch")
                    ?.consumedCalories || 0}{" "}
                  | Dinner{" "}
                  {meals.find((m: any) => m.name === "dinner")
                    ?.consumedCalories || 0}{" "}
                  | Snacks{" "}
                  {meals.find((m: any) => m.name === "snacks")
                    ?.consumedCalories || 0}
                </div>
              </div>
            );
          })()}

        {/* Meals Section */}
        <section className="relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isSelectedToday
                ? "Today's Meals"
                : format(selectedDate, "EEEE's Meals")}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => handlePlanClick(selectedDate)}
            >
              {isSelectedToday ? "Plan Today" : "Plan Day"}
            </Button>
          </div>

          {/* Loading overlay */}
          {loadingDayData && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10 min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading meals...
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {meals.map((meal: any) => (
              <MealCard
                key={meal.name}
                meal={meal}
                isToday={isSelectedToday}
                isLoading={loadingMeal === meal.name}
                onLogMeal={handleLogMeal}
                onUnlogMeal={handleUnlogMeal}
                onSwapMeal={handleSwapMeal}
                onAddFood={() => {
                  // Navigate to meal builder or open add food modal
                  console.log("Add food to", meal.name);
                }}
              />
            ))}
          </div>
        </section>

        {/* Quick Stats */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Weekly Overview</h2>
          <QuickStats
            streak={streak}
            weeklyAverage={weeklyAverage}
            weeklyTarget={dailyCalories}
          />
        </section>

        {/* Admin link if applicable */}
        {(profile.role === "admin" || profile.role === "moderator") && (
          <div className="pt-4 border-t border-border space-y-2">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin">Go to Admin Panel</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setShowDebug((v) => !v)}
            >
              {showDebug ? "Hide Debug Mode" : "🐛 Debug Mode"}
            </Button>
          </div>
        )}
      </main>

      {/* Meal Planning Sheet */}
      <MealPlanSheet
        open={planSheetOpen}
        onOpenChange={setPlanSheetOpen}
        date={planSheetDate}
        recipes={(() => {
          // Deduplicate recipes using Map (recipes can appear in multiple meal types)
          const uniqueRecipes = new Map();
          Object.values(recipesByMealType)
            .flat()
            .forEach((recipe) => {
              if (!uniqueRecipes.has(recipe.id)) {
                uniqueRecipes.set(recipe.id, recipe);
              }
            });
          return Array.from(uniqueRecipes.values());
        })()}
        onPlanUpdated={handlePlanUpdated}
        isFastingMode={true}
        selectedMeals={mealSlots.map((slot) => slot.name as MealType)} // Pass selected meals
      />
    </div>
  );
}
