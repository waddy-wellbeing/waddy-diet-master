import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MealBuilderContent } from "./meal-builder-content";
import type { RecipeRecord } from "@/lib/types/nutri";

export const metadata: Metadata = {
  title: "Meal Builder | Waddy Diet Master",
  description: "Customize your meals",
};

// Recipe with ingredients and scaling
export interface ScaledRecipeWithIngredients extends RecipeRecord {
  scale_factor: number;
  scaled_calories: number;
  original_calories: number;
  macro_similarity_score?: number;
  recipe_ingredients: {
    id: string;
    ingredient_id: string | null;
    raw_name: string;
    quantity: number | null;
    scaled_quantity: number | null;
    unit: string | null;
    is_spice: boolean;
    is_optional: boolean;
    ingredient?: {
      id: string;
      name: string;
      name_ar: string | null;
      food_group: string | null;
    } | null;
  }[];
  parsed_instructions: { step: number; instruction: string }[];
}

function roundForMeasuring(value: number): number {
  if (value < 10) return Math.round(value);
  return Math.round(value / 5) * 5;
}

interface PageProps {
  searchParams: Promise<{ meal?: string; recipe?: string }>;
}

export default async function MealBuilderPage({ searchParams }: PageProps) {
  const { meal: initialMeal, recipe: initialRecipeId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile, recipes, and today's plan in parallel
  const todayStr = new Date().toISOString().split("T")[0];
  const [
    { data: profile },
    { data: allRecipes },
    { data: todaysPlan },
    { data: specificRecipe },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase
      .from("recipes")
      .select(
        `
        *,
        recipe_ingredients (
          id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
          ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (
            id, name, name_ar, food_group
          )
        )
      `,
      )
      .eq("is_public", true)
      .not("nutrition_per_serving", "is", null)
      .order("name"),
    supabase
      .from("daily_plans")
      .select("plan")
      .eq("user_id", user.id)
      .eq("plan_date", todayStr)
      .maybeSingle(),
    // Fetch specific recipe if ID is provided in URL
    initialRecipeId
      ? supabase
          .from("recipes")
          .select(
            `
            *,
            recipe_ingredients (
              id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
              ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (
                id, name, name_ar, food_group
              )
            )
          `,
          )
          .eq("id", initialRecipeId)
          .eq("is_public", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  // Get user's targets
  const dailyCalories = profile.targets?.daily_calories || 2000;
  const dailyProtein = profile.targets?.protein_g || 150;
  const dailyCarbs = profile.targets?.carbs_g || 250;
  const dailyFat = profile.targets?.fat_g || 65;

  // Fasting mode detection
  const isFasting = profile.preferences?.is_fasting || false;

  // Use user's saved meal structure if available, otherwise default percentages
  const userMealStructure = profile.preferences?.meal_structure;
  const mealTargets: Record<
    string,
    { calories: number; protein: number; carbs: number; fat: number }
  > = {};

  // Fasting meal order (canonical)
  const FASTING_MEAL_ORDER = [
    "pre-iftar",
    "iftar",
    "full-meal-taraweeh",
    "snack-taraweeh",
    "suhoor",
  ];

  // Build meal slots based on mode
  let mealSlots: string[];
  if (isFasting) {
    const selectedFastingMeals: string[] =
      profile.preferences?.fasting_selected_meals || [];
    mealSlots =
      selectedFastingMeals.length > 0
        ? FASTING_MEAL_ORDER.filter((m) => selectedFastingMeals.includes(m))
        : FASTING_MEAL_ORDER;
  } else if (userMealStructure && userMealStructure.length > 0) {
    mealSlots = (userMealStructure as Array<{ name: string }>).map(
      (slot) => slot.name,
    );
  } else {
    mealSlots = ["breakfast", "lunch", "dinner", "snacks"];
  }

  if (isFasting) {
    // Fasting calorie distribution (mirrors dashboard page logic)
    const fastingDistribution: Record<string, number> = {
      "pre-iftar": 0.1,
      iftar: 0.4,
      "full-meal-taraweeh": 0.3,
      "snack-taraweeh": 0.1,
      suhoor: 0.25,
    };
    const totalPct = mealSlots.reduce(
      (sum, meal) => sum + (fastingDistribution[meal] ?? 0.2),
      0,
    );
    for (const meal of mealSlots) {
      const normalizedPct = (fastingDistribution[meal] ?? 0.2) / totalPct;
      mealTargets[meal] = {
        calories: Math.round(dailyCalories * normalizedPct),
        protein: Math.round(dailyProtein * normalizedPct),
        carbs: Math.round(dailyCarbs * normalizedPct),
        fat: Math.round(dailyFat * normalizedPct),
      };
    }
  } else if (userMealStructure && userMealStructure.length > 0) {
    for (const slot of userMealStructure as Array<{
      name: string;
      percentage: number;
    }>) {
      const pct = slot.percentage / 100;
      mealTargets[slot.name] = {
        calories: Math.round(dailyCalories * pct),
        protein: Math.round(dailyProtein * pct),
        carbs: Math.round(dailyCarbs * pct),
        fat: Math.round(dailyFat * pct),
      };
    }
  } else {
    // Fallback to default distribution
    mealTargets.breakfast = {
      calories: Math.round(dailyCalories * 0.25),
      protein: Math.round(dailyProtein * 0.25),
      carbs: Math.round(dailyCarbs * 0.25),
      fat: Math.round(dailyFat * 0.25),
    };
    mealTargets.lunch = {
      calories: Math.round(dailyCalories * 0.35),
      protein: Math.round(dailyProtein * 0.35),
      carbs: Math.round(dailyCarbs * 0.35),
      fat: Math.round(dailyFat * 0.35),
    };
    mealTargets.dinner = {
      calories: Math.round(dailyCalories * 0.3),
      protein: Math.round(dailyProtein * 0.3),
      carbs: Math.round(dailyCarbs * 0.3),
      fat: Math.round(dailyFat * 0.3),
    };
    mealTargets.snacks = {
      calories: Math.round(dailyCalories * 0.1),
      protein: Math.round(dailyProtein * 0.1),
      carbs: Math.round(dailyCarbs * 0.1),
      fat: Math.round(dailyFat * 0.1),
    };
  }

  // Meal type mapping
  const mealTypeMapping: Record<string, string[]> = {
    breakfast: ["breakfast", "smoothies"],
    mid_morning: ["snack", "snacks & sweetes", "smoothies"],
    lunch: ["lunch", "one pot", "dinner", "side dishes"],
    afternoon: ["snack", "snacks & sweetes", "smoothies"],
    dinner: ["dinner", "lunch", "one pot", "side dishes", "breakfast"],
    snack: ["snack", "snacks & sweetes", "smoothies"],
    snacks: ["snack", "snacks & sweetes", "smoothies"],
    snack_1: ["snack", "snacks & sweetes", "smoothies"],
    snack_2: ["snack", "snacks & sweetes", "smoothies"],
    snack_3: ["snack", "snacks & sweetes", "smoothies"],
    evening: ["snack", "snacks & sweetes", "smoothies"],
    // Fasting meal types
    "pre-iftar": ["pre-iftar", "smoothies"], // Pre-iftar first, then smoothies as fallback
    iftar: ["lunch"], // Main breaking fast meal - lunch recipes only
    "full-meal-taraweeh": ["lunch", "dinner"], // Full meal after prayers - lunch or dinner
    "snack-taraweeh": ["snack"], // Snack after prayers - snack recipes only
    suhoor: ["breakfast", "dinner"], // Pre-dawn meal - breakfast or dinner
  };

  const minScale = 0.5;
  const maxScale = 2.0;

  // Calculate target macro percentages for filtering recipes
  const targetMacroPercentages = {
    protein_pct: Math.round(((dailyProtein * 4) / dailyCalories) * 100),
    carbs_pct: Math.round(((dailyCarbs * 4) / dailyCalories) * 100),
    fat_pct: Math.round(((dailyFat * 9) / dailyCalories) * 100),
  };

  // Process recipes for each meal type
  const recipesByMealType: Record<string, ScaledRecipeWithIngredients[]> = {};
  for (const slot of mealSlots) {
    recipesByMealType[slot] = [];
  }

  if (allRecipes) {
    for (const mealSlot of mealSlots) {
      const targetCalories = mealTargets[mealSlot]?.calories;
      if (!targetCalories) continue; // Skip if no target found

      const acceptedMealTypes = mealTypeMapping[mealSlot];
      const primaryMealType = acceptedMealTypes?.[0];

      const suitableRecipes: ScaledRecipeWithIngredients[] = [];

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

        const scaleFactor = targetCalories / baseCalories;
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

        // Scale ingredients
        const scaledIngredients = (recipe.recipe_ingredients || []).map(
          (ri: any) => ({
            id: ri.id,
            ingredient_id: ri.ingredient_id,
            raw_name: ri.raw_name,
            quantity: ri.quantity,
            scaled_quantity: ri.quantity
              ? roundForMeasuring(ri.quantity * scaleFactor)
              : null,
            unit: ri.unit,
            is_spice: ri.is_spice,
            is_optional: ri.is_optional,
            ingredient: ri.ingredient || null,
          }),
        );

        // Parse instructions
        let parsedInstructions: { step: number; instruction: string }[] = [];
        if (Array.isArray(recipe.instructions)) {
          parsedInstructions = recipe.instructions.map(
            (item: any, idx: number) => ({
              step: item.step || idx + 1,
              instruction:
                typeof item === "string"
                  ? item
                  : item.instruction || String(item),
            }),
          );
        }

        suitableRecipes.push({
          ...(recipe as RecipeRecord),
          scale_factor: Math.round(scaleFactor * 100) / 100,
          scaled_calories: targetCalories,
          original_calories: baseCalories,
          macro_similarity_score: macroSimilarityScore,
          recipe_ingredients: scaledIngredients,
          parsed_instructions: parsedInstructions,
        });
      }

      // Sort by: 1) Macro similarity (descending), 2) Primary meal type, 3) Scale factor closest to 1.0
      suitableRecipes.sort((a, b) => {
        // First priority: Macro similarity (higher is better)
        const macroScoreDiff =
          (b.macro_similarity_score || 0) - (a.macro_similarity_score || 0);
        if (Math.abs(macroScoreDiff) > 5) return macroScoreDiff;

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

        // Third priority: Scale factor closest to 1.0
        const aDistFromOne = Math.abs(a.scale_factor - 1);
        const bDistFromOne = Math.abs(b.scale_factor - 1);
        return aDistFromOne - bDistFromOne;
      });

      recipesByMealType[mealSlot] = suitableRecipes;
    }
  }

  // **FIX: Ensure specific recipe from URL is ALWAYS included in the meal type's recipe list**
  // This ensures clicking a recipe in dashboard shows the EXACT same recipe in meal-builder
  if (specificRecipe && initialMeal && mealSlots.includes(initialMeal)) {
    const targetCalories = mealTargets[initialMeal]?.calories;
    const existingRecipes = recipesByMealType[initialMeal] || [];

    // Check if recipe is already in the list
    const alreadyExists = existingRecipes.some(
      (r) => r.id === specificRecipe.id,
    );

    if (!alreadyExists && targetCalories) {
      const baseCalories = specificRecipe.nutrition_per_serving?.calories;
      if (baseCalories && baseCalories > 0) {
        const scaleFactor = targetCalories / baseCalories;

        // Calculate recipe's macro similarity score
        const recipeProtein =
          specificRecipe.nutrition_per_serving?.protein_g || 0;
        const recipeCarbs = specificRecipe.nutrition_per_serving?.carbs_g || 0;
        const recipeFat = specificRecipe.nutrition_per_serving?.fat_g || 0;
        const recipeMacroPercentages = {
          protein_pct: Math.round(((recipeProtein * 4) / baseCalories) * 100),
          carbs_pct: Math.round(((recipeCarbs * 4) / baseCalories) * 100),
          fat_pct: Math.round(((recipeFat * 9) / baseCalories) * 100),
        };

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

        // Scale ingredients
        const scaledIngredients = (specificRecipe.recipe_ingredients || []).map(
          (ri: any) => ({
            id: ri.id,
            ingredient_id: ri.ingredient_id,
            raw_name: ri.raw_name,
            quantity: ri.quantity,
            scaled_quantity: ri.quantity
              ? roundForMeasuring(ri.quantity * scaleFactor)
              : null,
            unit: ri.unit,
            is_spice: ri.is_spice,
            is_optional: ri.is_optional,
            ingredient: ri.ingredient || null,
          }),
        );

        // Parse instructions
        let parsedInstructions: { step: number; instruction: string }[] = [];
        if (Array.isArray(specificRecipe.instructions)) {
          parsedInstructions = specificRecipe.instructions.map(
            (item: any, idx: number) => ({
              step: item.step || idx + 1,
              instruction:
                typeof item === "string"
                  ? item
                  : item.instruction || String(item),
            }),
          );
        }

        // Add the specific recipe to the beginning of the list
        recipesByMealType[initialMeal].unshift({
          ...(specificRecipe as RecipeRecord),
          scale_factor: Math.round(scaleFactor * 100) / 100,
          scaled_calories: targetCalories,
          original_calories: baseCalories,
          macro_similarity_score: macroSimilarityScore,
          recipe_ingredients: scaledIngredients,
          parsed_instructions: parsedInstructions,
        });
      }
    }
  }

  // Validate initial meal param
  const selectedMeal =
    initialMeal && mealSlots.includes(initialMeal) ? initialMeal : null;

  return (
    <MealBuilderContent
      mealTargets={mealTargets}
      recipesByMealType={recipesByMealType}
      userId={user.id}
      userRole={profile?.role || "user"}
      initialMeal={selectedMeal as string | null}
      initialRecipeId={initialRecipeId || null}
      todaysPlan={todaysPlan?.plan}
    />
  );
}
