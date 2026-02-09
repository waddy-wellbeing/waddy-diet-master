"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Search,
  User,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Utensils,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { RecipePickerSheet } from "@/components/dashboard/recipe-picker-sheet";
import { toast } from "sonner";
import {
  AdminUserProfile,
  AdminUserPlan,
  AdminRecipeInfo,
  searchUsers,
  getUserPlans,
  getDayPlan,
  updateUserMeal,
  createDayPlan,
  getAllRecipes,
} from "@/lib/actions/admin-plans";

interface PlansContentProps {
  initialUsers: AdminUserProfile[];
}

// Format date for display
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Get date string in local timezone (YYYY-MM-DD)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Get week dates array
function getWeekDates(centerDate: Date): Date[] {
  const dates: Date[] = [];
  const startOfWeek = new Date(centerDate);
  startOfWeek.setDate(centerDate.getDate() - centerDate.getDay());

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}

// User Card Component
function UserCard({
  user,
  isSelected,
  onClick,
}: {
  user: AdminUserProfile;
  isSelected: boolean;
  onClick: () => void;
}) {
  const name = user.name || "Unknown User";
  const email = user.email || "No email";
  const joinDate = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary/50",
        isSelected && "border-primary bg-primary/5",
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <div className="text-right">
            <Badge variant="outline" className="text-xs">
              {user.role || "user"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{joinDate}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Meal Card Component
function MealCard({
  mealType,
  recipe,
  servings,
  onEdit,
  isLoading,
}: {
  mealType: string;
  recipe: AdminRecipeInfo | null;
  servings: number;
  onEdit?: () => void;
  isLoading?: boolean;
}) {
  const mealEmoji: Record<string, string> = {
    breakfast: "🌅",
    lunch: "☀️",
    dinner: "🌙",
    snacks: "🍿",
  };

  if (!recipe) {
    return (
      <Card
        className="border-dashed hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => onEdit?.()}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{mealEmoji[mealType] || "🍽️"}</span>
              <div>
                <p className="text-sm font-medium capitalize">{mealType}</p>
                <p className="text-xs text-muted-foreground">No meal planned</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {recipe.image_url ? (
            <div className="relative h-14 w-14 rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={recipe.image_url}
                alt={recipe.name}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
          ) : (
            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Utensils className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{mealEmoji[mealType] || "🍽️"}</span>
              <p className="text-xs text-muted-foreground capitalize">
                {mealType}
              </p>
            </div>
            <p className="font-medium text-sm truncate">{recipe.name}</p>
            <p className="text-xs text-muted-foreground">
              {servings} serving{servings !== 1 ? "s" : ""} •{" "}
              {recipe.nutrition_per_serving?.calories || 0} kcal
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onEdit?.()}
            disabled={isLoading}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Day Plan View Component
function DayPlanView({
  date,
  plan,
  recipes,
  onEditMeal,
  onCreatePlan,
  loadingMealKey,
  isFastingMode,
  fastingSelectedMeals,
}: {
  date: Date;
  plan: AdminUserPlan | null;
  recipes: Record<string, AdminRecipeInfo>;
  onEditMeal?: (mealType: string, snackIndex?: number) => void;
  onCreatePlan?: () => void;
  loadingMealKey?: string | null;
  isFastingMode?: boolean;
  fastingSelectedMeals?: string[];
}) {
  const dateStr = getLocalDateString(date);
  const isToday = dateStr === getLocalDateString(new Date());
  const isUnplanned = !plan;

  // Show "Create Plan" button for unplanned days
  if (isUnplanned) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">
              {formatDate(dateStr)}
              {isToday && <Badge className="ml-2 text-xs">Today</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              No plan for this day
            </p>
          </div>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              This day has no meal plan yet
            </p>
            <Button
              onClick={onCreatePlan}
              disabled={loadingMealKey === "create-plan"}
              className="gap-2"
            >
              {loadingMealKey === "create-plan" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getMealRecipe = (
    mealType: string,
  ): { recipe: AdminRecipeInfo | null; servings: number } => {
    // Choose plan based on fasting mode
    const activePlan = isFastingMode ? plan?.fasting_plan : plan?.plan;
    const meal = (activePlan as any)?.[mealType];
    if (!meal?.recipe_id) return { recipe: null, servings: 0 };
    return {
      recipe: recipes[meal.recipe_id] || null,
      servings: meal.servings || 1,
    };
  };

  const getSnacks = (): Array<{
    recipe: AdminRecipeInfo | null;
    servings: number;
  }> => {
    const snacksArray = (plan?.plan?.snacks as Array<any>) || [];
    return snacksArray.map((snack) => ({
      recipe: snack?.recipe_id ? recipes[snack.recipe_id] || null : null,
      servings: snack?.servings || 1,
    }));
  };

  // Determine which meals to display based on fasting mode
  const mealSlots = isFastingMode
    ? fastingSelectedMeals || []
    : ["breakfast", "lunch", "dinner", "snacks"];

  // Fasting meal emoji mapping
  const fastingMealEmoji: Record<string, string> = {
    "pre-iftar": "🥤",
    iftar: "🌙",
    "full-meal-taraweeh": "🕌",
    "snack-taraweeh": "🍪",
    suhoor: "🌅",
  };

  // Fasting meal labels (Arabic)
  const fastingMealLabels: Record<string, string> = {
    "pre-iftar": "ما قبل الإفطار",
    iftar: "الإفطار",
    "full-meal-taraweeh": "وجبة كاملة - تراويح",
    "snack-taraweeh": "سناك - تراويح",
    suhoor: "السحور",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">
            {formatDate(dateStr)}
            {isToday && <Badge className="ml-2 text-xs">Today</Badge>}
            {isFastingMode && (
              <Badge variant="secondary" className="ml-2 text-xs">
                🌙 Fasting
              </Badge>
            )}
          </p>
          {plan?.daily_totals && (
            <p className="text-xs text-muted-foreground">
              {plan.daily_totals.calories || 0} kcal • P:{" "}
              {plan.daily_totals.protein_g || 0}g • C:{" "}
              {plan.daily_totals.carbs_g || 0}g • F:{" "}
              {plan.daily_totals.fat_g || 0}g
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        {isFastingMode ? (
          // Fasting mode meals
          mealSlots.map((mealSlot) => {
            const meal = getMealRecipe(mealSlot);
            return (
              <div key={mealSlot} className="relative">
                {fastingMealEmoji[mealSlot] && (
                  <div className="absolute -left-8 top-3 text-xl">
                    {fastingMealEmoji[mealSlot]}
                  </div>
                )}
                <MealCard
                  mealType={mealSlot}
                  recipe={meal.recipe}
                  servings={meal.servings}
                  onEdit={() => onEditMeal?.(mealSlot)}
                  isLoading={loadingMealKey === mealSlot}
                />
                {fastingMealLabels[mealSlot] && (
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {fastingMealLabels[mealSlot]}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          // Regular mode meals
          <>
            <MealCard
              mealType="breakfast"
              recipe={getMealRecipe("breakfast").recipe}
              servings={getMealRecipe("breakfast").servings}
              onEdit={() => onEditMeal?.("breakfast")}
              isLoading={loadingMealKey === "breakfast"}
            />
            <MealCard
              mealType="lunch"
              recipe={getMealRecipe("lunch").recipe}
              servings={getMealRecipe("lunch").servings}
              onEdit={() => onEditMeal?.("lunch")}
              isLoading={loadingMealKey === "lunch"}
            />
            <MealCard
              mealType="dinner"
              recipe={getMealRecipe("dinner").recipe}
              servings={getMealRecipe("dinner").servings}
              onEdit={() => onEditMeal?.("dinner")}
              isLoading={loadingMealKey === "dinner"}
            />
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Snacks
              </p>
              <div className="space-y-2">
                {getSnacks().length === 0 ? (
                  <MealCard
                    mealType="snacks"
                    recipe={null}
                    servings={1}
                    onEdit={() => onEditMeal?.("snacks", 0)}
                    isLoading={loadingMealKey === `snacks-0`}
                  />
                ) : (
                  getSnacks().map((snack, index) => (
                    <MealCard
                      key={index}
                      mealType="snacks"
                      recipe={snack.recipe}
                      servings={snack.servings}
                      onEdit={() => onEditMeal?.("snacks", index)}
                      isLoading={loadingMealKey === `snacks-${index}`}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Main Content Component
export function PlansContent({ initialUsers }: PlansContentProps) {
  const [users, setUsers] = useState<AdminUserProfile[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserProfile | null>(
    null,
  );
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [userPlans, setUserPlans] = useState<AdminUserPlan[]>([]);
  const [recipes, setRecipes] = useState<Record<string, AdminRecipeInfo>>({});
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loadingDate, setLoadingDate] = useState(false);

  // Fasting mode state
  const [isFastingMode, setIsFastingMode] = useState(false);
  const [fastingSelectedMeals, setFastingSelectedMeals] = useState<string[]>(
    [],
  );

  // Recipe picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allRecipes, setAllRecipes] = useState<any[]>([]);
  const [activeMealType, setActiveMealType] = useState<string | null>(null);
  const [activeMealTypeForPicker, setActiveMealTypeForPicker] = useState<
    string | null
  >(null);
  const [activeSnackIndex, setActiveSnackIndex] = useState<number | null>(null);
  const [loadingMealKey, setLoadingMealKey] = useState<string | null>(null);

  // Helper: Save session state to localStorage
  const saveSessionState = useCallback(
    (user: AdminUserProfile | null, week: Date, date: Date) => {
      try {
        localStorage.setItem(
          "admin_plans_session",
          JSON.stringify({
            userId: user?.user_id || null,
            currentWeek: week.toISOString(),
            selectedDate: date.toISOString(),
            userPlans,
            recipes,
            isFastingMode,
            fastingSelectedMeals,
          }),
        );
      } catch (error) {
        console.error("Error saving session state:", error);
      }
    },
    [userPlans, recipes, isFastingMode, fastingSelectedMeals],
  );

  // Load last opened session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem("admin_plans_session");
      if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.userId) {
          // Find the user in initialUsers
          const user = initialUsers.find((u) => u.user_id === session.userId);
          if (user) {
            // Restore UI state immediately
            setSelectedUser(user);
            setCurrentWeek(new Date(session.currentWeek));
            setSelectedDate(new Date(session.selectedDate));
            setUserPlans(session.userPlans || []);
            setRecipes(session.recipes || {});
            setIsFastingMode(session.isFastingMode || false);
            setFastingSelectedMeals(session.fastingSelectedMeals || []);
          }
        }
      }
    } catch (error) {
      console.error("Error loading session from localStorage:", error);
    }
  }, [initialUsers]);

  // Save session whenever key state changes
  useEffect(() => {
    if (selectedUser) {
      saveSessionState(selectedUser, currentWeek, selectedDate);
    }
  }, [
    selectedUser,
    currentWeek,
    selectedDate,
    userPlans,
    recipes,
    saveSessionState,
  ]);

  // Fetch all recipes for the picker
  useEffect(() => {
    const fetchRecipes = async () => {
      const result = await getAllRecipes();
      if (result.success && result.data) {
        setAllRecipes(result.data);
      }
    };
    fetchRecipes();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        setIsSearching(true);
        const result = await searchUsers(searchQuery);
        if (result.success && result.data) {
          setUsers(result.data);
        }
        setIsSearching(false);
      } else if (searchQuery.trim().length === 0) {
        setUsers(initialUsers);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, initialUsers]);

  // Handle user selection
  const handleSelectUser = useCallback(async (user: AdminUserProfile) => {
    setSelectedUser(user);
    // Save to localStorage for session persistence
    localStorage.setItem("admin_plans_last_user_id", user.user_id);
    setIsLoadingPlans(true);

    // Set date to today when user is selected
    const today = new Date();
    setSelectedDate(today);
    setCurrentWeek(today);

    const result = await getUserPlans(user.user_id);
    if (result.success && result.data) {
      setUserPlans(result.data.plans);
      setRecipes(result.data.recipes);
      setIsFastingMode(result.data.isFastingMode);
      setFastingSelectedMeals(result.data.fastingSelectedMeals);
    } else {
      setUserPlans([]);
      setRecipes({});
      setIsFastingMode(false);
      setFastingSelectedMeals([]);
    }
    setIsLoadingPlans(false);
  }, []);

  // Navigate weeks
  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeek(newDate);
  };

  // Get plan for a specific date
  const getPlanForDate = (date: Date): AdminUserPlan | null => {
    const dateStr = getLocalDateString(date);
    return userPlans.find((p) => p.plan_date === dateStr) || null;
  };

  // Handle edit meal - opens recipe picker
  const handleEditMeal = (mealType: string, snackIndex?: number) => {
    // Map fasting meal slots to recipe meal_type for filtering
    let recipeMealType = mealType;
    if (isFastingMode) {
      const fastingMealTypeMap: Record<string, string> = {
        "pre-iftar": "pre-iftar",
        iftar: "lunch",
        "full-meal-taraweeh": "dinner",
        "snack-taraweeh": "snack",
        suhoor: "breakfast",
      };
      recipeMealType = fastingMealTypeMap[mealType] || mealType;
    }

    setActiveMealType(mealType); // Store original meal slot name for saving
    setActiveMealTypeForPicker(recipeMealType); // Mapped type for recipe filtering
    setActiveSnackIndex(snackIndex ?? null);
    setPickerOpen(true);
  };

  // Handle recipe selected from picker
  const handleRecipeSelected = async (recipeId: string) => {
    if (!selectedUser || !activeMealType) return;

    const dateStr = getLocalDateString(selectedDate);
    const mealKey =
      activeSnackIndex !== null ? `snacks-${activeSnackIndex}` : activeMealType;

    setLoadingMealKey(mealKey);
    setPickerOpen(false);

    try {
      // Update via server action
      const result = await updateUserMeal({
        userId: selectedUser.user_id,
        planDate: dateStr,
        mealType: activeMealType,
        recipeId,
        snackIndex: activeSnackIndex,
        isFastingMode,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to update meal", {
          duration: 3000,
        });
      } else {
        toast.success("Meal updated successfully", { duration: 3000 });

        // Refresh the plan data immediately
        const refreshResult = await getDayPlan(selectedUser.user_id, dateStr);
        if (
          refreshResult.success &&
          refreshResult.data &&
          refreshResult.data.plan
        ) {
          setUserPlans((prev) => {
            const filtered = prev.filter((p) => p.plan_date !== dateStr);
            return [...filtered, refreshResult.data!.plan!];
          });
          setRecipes((prev) => ({
            ...prev,
            ...refreshResult.data!.recipes,
          }));
        }
      }
    } catch (error) {
      console.error("Error updating meal:", error);
      toast.error("Failed to update meal", { duration: 3000 });
    } finally {
      setLoadingMealKey(null);
      setActiveMealType(null);
      setActiveMealTypeForPicker(null);
      setActiveSnackIndex(null);
    }
  };

  // Handle create plan for unplanned days
  const handleCreatePlan = async () => {
    if (!selectedUser) return;

    const dateStr = getLocalDateString(selectedDate);
    setLoadingMealKey("create-plan");

    try {
      // Get a few random recipes to create a basic plan
      const availableRecipes = allRecipes.filter((r) => r.is_public);

      if (availableRecipes.length < 3) {
        toast.error("Not enough recipes available to create a plan", {
          duration: 3000,
        });
        return;
      }

      // Randomly select recipes for each meal
      const shuffled = [...availableRecipes].sort(() => 0.5 - Math.random());

      const result = await createDayPlan({
        userId: selectedUser.user_id,
        planDate: dateStr,
        meals: {
          breakfast: shuffled[0]?.id,
          lunch: shuffled[1]?.id,
          dinner: shuffled[2]?.id,
          snacks: shuffled.length > 3 ? [shuffled[3].id] : undefined,
        },
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create plan", {
          duration: 3000,
        });
      } else {
        toast.success(
          "Plan created successfully! You can now edit individual meals.",
          { duration: 3000 },
        );

        // Refresh the plan data
        const refreshResult = await getDayPlan(selectedUser.user_id, dateStr);
        if (
          refreshResult.success &&
          refreshResult.data &&
          refreshResult.data.plan
        ) {
          setUserPlans((prev) => {
            const filtered = prev.filter((p) => p.plan_date !== dateStr);
            return [...filtered, refreshResult.data!.plan!];
          });
          setRecipes((prev) => ({
            ...prev,
            ...refreshResult.data!.recipes,
          }));
        }
      }
    } catch (error) {
      console.error("Error creating plan:", error);
      toast.error("Failed to create plan", { duration: 3000 });
    } finally {
      setLoadingMealKey(null);
    }
  };

  const weekDates = getWeekDates(currentWeek);

  return (
    <div className="grid lg:grid-cols-[350px_1fr] gap-6 h-[calc(100vh-200px)]">
      {/* Left Panel - Users List */}
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Users List */}
        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-4">
            {users.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No users found</p>
                </CardContent>
              </Card>
            ) : (
              users.map((user) => (
                <UserCard
                  key={user.user_id}
                  user={user}
                  isSelected={selectedUser?.user_id === user.user_id}
                  onClick={() => handleSelectUser(user)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - User Plans */}
      <div className="flex flex-col gap-4">
        {!selectedUser ? (
          <Card className="flex-1">
            <CardContent className="flex flex-col items-center justify-center h-full text-center p-8">
              <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Select a User</CardTitle>
              <CardDescription>
                Choose a user from the list to view and manage their meal plans
              </CardDescription>
            </CardContent>
          </Card>
        ) : isLoadingPlans ? (
          <Card className="flex-1">
            <CardContent className="flex flex-col items-center justify-center h-full p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading plans...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* User Header */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">
                        {selectedUser.name || "Unknown User"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedUser.email || "No email"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Week Navigation */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateWeek("prev")}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <p className="font-medium">
                    {formatDate(weekDates[0].toISOString())} -{" "}
                    {formatDate(weekDates[6].toISOString())}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigateWeek("next")}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                {/* Week Days */}
                <div className="grid grid-cols-7 gap-1">
                  {weekDates.map((date) => {
                    const dateStr = getLocalDateString(date);
                    const todayStr = getLocalDateString(new Date());
                    const isToday = dateStr === todayStr;
                    const isSelected =
                      dateStr === getLocalDateString(selectedDate);
                    const hasPlan = getPlanForDate(date) !== null;

                    return (
                      <button
                        key={dateStr}
                        onClick={async () => {
                          setLoadingDate(true);
                          setSelectedDate(date);

                          // Fetch real-time data for this specific date
                          if (selectedUser) {
                            const result = await getDayPlan(
                              selectedUser.user_id,
                              dateStr,
                            );
                            if (
                              result.success &&
                              result.data &&
                              result.data.plan
                            ) {
                              // Update only this date's plan and recipes
                              setUserPlans((prev) => {
                                const filtered = prev.filter(
                                  (p) => p.plan_date !== dateStr,
                                );
                                return [...filtered, result.data!.plan!];
                              });
                              setRecipes((prev) => ({
                                ...prev,
                                ...result.data!.recipes,
                              }));
                            }
                          }

                          setLoadingDate(false);
                        }}
                        className={cn(
                          "flex flex-col items-center p-2 rounded-lg transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                          isToday && !isSelected && "ring-2 ring-primary",
                        )}
                      >
                        <span className="text-xs font-medium">
                          {date.toLocaleDateString("en-US", {
                            weekday: "short",
                          })}
                        </span>
                        <span className="text-lg font-bold">
                          {date.getDate()}
                        </span>
                        {hasPlan && (
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1",
                              isSelected
                                ? "bg-primary-foreground"
                                : "bg-primary",
                            )}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Day Plan */}
            <Card className="flex-1 relative">
              <CardContent className="p-4">
                {loadingDate && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                <DayPlanView
                  date={selectedDate}
                  plan={getPlanForDate(selectedDate)}
                  recipes={recipes}
                  onEditMeal={handleEditMeal}
                  onCreatePlan={handleCreatePlan}
                  loadingMealKey={loadingMealKey}
                  isFastingMode={isFastingMode}
                  fastingSelectedMeals={fastingSelectedMeals}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recipe Picker Sheet */}
      <RecipePickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        recipes={allRecipes}
        onRecipeSelected={handleRecipeSelected}
        mealType={activeMealTypeForPicker as any}
      />
    </div>
  );
}
