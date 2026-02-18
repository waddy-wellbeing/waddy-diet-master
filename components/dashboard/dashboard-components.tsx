"use client";

import { useState } from "react";
import Link from "next/link";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Target,
  TrendingUp,
  Utensils,
  Check,
  ArrowLeftRight,
  Undo2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { ProfileTargets, DailyPlan, DailyLog } from "@/lib/types/nutri";
import {
  getDayPlanState,
  getPlanIndicatorClasses,
  getPlanIndicatorLabel,
  canPlanDate,
} from "@/lib/utils/meal-planning";
import { RamadanBadge } from "@/components/dashboard/ramadan-badge";

interface WeekDayCardProps {
  date: Date;
  isSelected: boolean;
  onClick: () => void;
  onPlanClick?: () => void;
  consumed: number;
  target: number;
  planState?: "none" | "planned" | "logged" | "both";
}

function WeekDayCard({
  date,
  isSelected,
  onClick,
  onPlanClick,
  consumed,
  target,
  planState = "none",
}: WeekDayCardProps) {
  const today = isToday(date);
  const progress = Math.min((consumed / target) * 100, 100);
  const dayName = format(date, "EEE");
  const dayNum = format(date, "d");
  const canPlan = canPlanDate(date);

  // Calculate stroke dash for circular progress (responsive radius)
  // Mobile: 18, Desktop: 22
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const radius = isMobile ? 18 : 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  const handleClick = (e: React.MouseEvent) => {
    if (e.altKey) {
      // Alt/Option + click opens plan sheet (view-only for past dates)
      e.preventDefault();
      e.stopPropagation();
      onPlanClick?.();
    } else {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={(e) => {
        // Long press / right-click on mobile opens plan sheet (view-only for past dates)
        e.preventDefault();
        onPlanClick?.();
      }}
      className={cn(
        "flex flex-col items-center p-1.5 sm:p-2 rounded-xl touch-manipulation flex-1 min-w-0 relative",
        "border-2 active:scale-95 transition-transform duration-75",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-transparent hover:bg-muted/50",
        today && !isSelected && "border-primary/30",
      )}
      title={
        planState !== "none" ? getPlanIndicatorLabel(planState) : undefined
      }
    >
      <span
        className={cn(
          "text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 leading-tight",
          isSelected ? "text-primary" : "text-muted-foreground",
        )}
      >
        {dayName}
      </span>

      {/* Circular progress */}
      <div className="relative w-9 sm:w-11 h-9 sm:h-11 mb-0.5 sm:mb-1">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
          {/* Background circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={cn(progress >= 100 ? "text-green-500" : "text-primary")}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-semibold leading-tight",
            isSelected ? "text-primary" : "text-foreground",
          )}
        >
          {dayNum}
        </span>

        {/* Plan indicator - positioned at bottom right of circle */}
        {planState !== "none" && (
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-2.5 sm:h-2.5 rounded-full ring-2 ring-background",
              getPlanIndicatorClasses(planState),
            )}
            aria-label={getPlanIndicatorLabel(planState)}
          />
        )}
      </div>

      {today && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
    </button>
  );
}

interface WeekSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onPlanClick?: (date: Date) => void;
  weekData: Record<string, { consumed: number }>;
  weekPlans?: Record<string, DailyPlan>;
  weekLogs?: Record<string, DailyLog>;
  dailyTarget: number;
  showDayProgress?: boolean;
}

export function WeekSelector({
  selectedDate,
  onDateSelect,
  onPlanClick,
  weekData,
  weekPlans = {},
  weekLogs = {},
  dailyTarget,
  showDayProgress = false,
}: WeekSelectorProps) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToPreviousWeek = () => {
    setWeekStart((prev: Date) => addDays(prev, -7));
  };

  const goToNextWeek = () => {
    setWeekStart((prev: Date) => addDays(prev, 7));
  };

  // Get consumed calories for the selected day
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDayData = weekData[selectedDateKey] || { consumed: 0 };
  const consumed = selectedDayData.consumed;
  const progress = Math.min((consumed / dailyTarget) * 100, 100);
  const remaining = dailyTarget - consumed;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="text-sm font-medium text-muted-foreground">
          {format(weekStart, "MMM d")} -{" "}
          {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </span>

        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Week days */}
      <div className="flex justify-between gap-1">
        {weekDays.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const dayData = weekData[dateKey] || { consumed: 0 };
          const planState = getDayPlanState(date, weekPlans, weekLogs);

          return (
            <WeekDayCard
              key={dateKey}
              date={date}
              isSelected={isSameDay(date, selectedDate)}
              onClick={() => onDateSelect(date)}
              onPlanClick={() => onPlanClick?.(date)}
              consumed={dayData.consumed}
              target={dailyTarget}
              planState={planState}
            />
          );
        })}
      </div>

      {/* Simple progress bar when day is selected */}
      {showDayProgress && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 pt-4 border-t border-border/50"
        >
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">
              {consumed.toLocaleString()} kcal consumed
            </span>
            <span className="text-muted-foreground">
              of {dailyTarget.toLocaleString()}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full",
                progress >= 100 ? "bg-green-500" : "bg-primary",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Remaining calories */}
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Flame className="h-4 w-4 text-primary" />
            <span
              className={cn(
                "text-sm font-medium",
                remaining > 0 ? "text-muted-foreground" : "text-orange-500",
              )}
            >
              {remaining > 0
                ? `${remaining.toLocaleString()} remaining`
                : `${Math.abs(remaining).toLocaleString()} over target`}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface CalorieRingProps {
  consumed: number;
  target: number;
}

export function CalorieRing({ consumed, target }: CalorieRingProps) {
  const remaining = target - consumed;
  const progress = Math.min((consumed / target) * 100, 100);

  // Circular progress
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-center gap-8">
        {/* Large circular progress ring */}
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-muted/20"
            />
            {/* Progress circle */}
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                progress >= 100 ? "text-green-500" : "text-primary",
              )}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">
              {consumed.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              of {target.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">calories</span>
          </div>
        </div>

        {/* Remaining info */}
        <div className="text-center">
          <div
            className={cn(
              "text-4xl font-bold mb-1",
              remaining > 0 ? "text-primary" : "text-orange-500",
            )}
          >
            {Math.abs(remaining).toLocaleString()}
          </div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Flame className="h-4 w-4" />
            <span className="text-sm">
              {remaining > 0 ? "remaining" : "over"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep DaySummary for backwards compatibility but simplified
interface DaySummaryProps {
  consumed: number;
  target: number;
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

export function DaySummary({ consumed, target }: DaySummaryProps) {
  // Simplified - just use CalorieRing
  return <CalorieRing consumed={consumed} target={target} />;
}

interface MealCardProps {
  meal: {
    name: "breakfast" | "lunch" | "dinner" | "snacks";
    label: string;
    targetCalories: number;
    consumedCalories: number;
    isLogged: boolean;
    loggedRecipeName?: string | null;
    recipe: {
      id: string;
      name: string;
      image_url?: string | null;
      nutrition_per_serving?: {
        calories?: number;
        protein_g?: number;
        carbs_g?: number;
        fat_g?: number;
      };
      scale_factor?: number;
      scaled_calories?: number;
      recommendation_group?: string[] | null;
    } | null;
    recipeCount: number;
    currentIndex: number;
    planSlot?: {
      recipe_id: string;
      servings: number;
      swapped?: boolean;
      swapped_ingredients?: Record<
        string,
        {
          ingredient_id: string;
          name: string;
          quantity: number;
          unit: string;
        }
      >;
    } | null;
  };
  isToday?: boolean;
  onLogMeal?: (mealName: string) => void;
  onUnlogMeal?: (mealName: string) => void;
  onSwapMeal?: (mealName: string, direction: "left" | "right") => void;
  onAddFood?: () => void;
  isLoading?: boolean;
}

export function MealCard({
  meal,
  isToday = true,
  onLogMeal,
  onUnlogMeal,
  onSwapMeal,
  onAddFood,
  isLoading = false,
}: MealCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [justSwapped, setJustSwapped] = useState(false);
  const [showHint, setShowHint] = useState(
    typeof window !== "undefined"
      ? !sessionStorage.getItem(`swap-hint-${meal.name}`)
      : true,
  );

  const progress = meal.isLogged ? 100 : 0;
  const hasRecipe = !!meal.recipe;
  const canSwipe = meal.recipeCount > 1 && isToday;

  // Use scaled calories if available, otherwise use target
  const displayCalories =
    (meal.recipe as any)?.scaled_calories || meal.targetCalories;

  const mealEmojis: Record<string, string> = {
    breakfast: "🌅",
    lunch: "☀️",
    dinner: "🌙",
    snacks: "🍎",
  };

  const emoji = mealEmojis[meal.name] || "🍽️";

  // Swipe gesture handlers
  const handleDragEnd = (
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) => {
    setIsDragging(false);
    if (showHint) {
      sessionStorage.setItem(`swap-hint-${meal.name}`, "true");
      setShowHint(false);
    }
    if (!canSwipe) return;

    const threshold = 100;
    const velocity = 500;

    if (info.offset.x > threshold || info.velocity.x > velocity) {
      setJustSwapped(true);
      setTimeout(() => setJustSwapped(false), 1500);
      onSwapMeal?.(meal.name, "right");
    } else if (info.offset.x < -threshold || info.velocity.x < -velocity) {
      setJustSwapped(true);
      setTimeout(() => setJustSwapped(false), 1500);
      onSwapMeal?.(meal.name, "left");
    }

    setSwipeX(0);
  };

  // If there's a recipe assigned OR viewing a past day with logged meal
  if (hasRecipe || (!isToday && meal.isLogged)) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl",
          !isToday && "opacity-75",
        )}
      >
        {/* Swipe hint - shows users how to swap recipes - TODO: enhance for better discoverability */}
        {/* {canSwipe && swipeX === 0 && !isDragging && showHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-1.5 left-0 right-0 flex justify-center pointer-events-none z-10"
          >
            <div className="inline-flex items-center gap-2">
              <motion.span 
                animate={{ x: [-2, 2, -2] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-lg"
              >
                👆
              </motion.span>
              <motion.span 
                animate={{ x: [2, -2, 2] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                className="text-lg"
              >
                👆
              </motion.span>
            </div>
          </motion.div>
        )} */}

        {/* Swipe indicator background - shows direction feedback */}
        {canSwipe && (swipeX !== 0 || isDragging) && (
          <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none z-5">
            <div
              className={cn(
                "flex flex-col items-center gap-1 text-sm font-semibold transition-all",
                swipeX > 30
                  ? "opacity-100 text-primary scale-110"
                  : "opacity-20",
              )}
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-xs">Previous</span>
            </div>
            <div
              className={cn(
                "flex flex-col items-center gap-1 text-sm font-semibold transition-all",
                swipeX < -30
                  ? "opacity-100 text-primary scale-110"
                  : "opacity-20",
              )}
            >
              <ChevronRight className="h-5 w-5" />
              <span className="text-xs">Next</span>
            </div>
          </div>
        )}

        {/* Recipe Changed Notification */}
        <AnimatePresence>
          {justSwapped && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="absolute inset-x-0 top-0 flex justify-center pt-2 pointer-events-none z-20"
            >
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-lg font-semibold text-sm">
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 1, repeat: 1 }}
                >
                  ✓
                </motion.span>
                Recipe Changed!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={cn(
            "bg-card rounded-xl border border-border overflow-hidden relative touch-manipulation",
            !isToday && "bg-muted/30",
          )}
          drag={canSwipe ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragStart={() => setIsDragging(true)}
          onDrag={(_, info) => setSwipeX(info.offset.x)}
          onDragEnd={handleDragEnd}
          animate={{ x: 0 }}
          whileTap={{ scale: isDragging ? 1 : 0.99 }}
        >
          <div className="flex">
            {/* Recipe image */}
            <div
              className={cn(
                "relative w-24 h-24 flex-shrink-0 bg-muted",
                !isToday && "grayscale",
              )}
            >
              {meal.recipe?.image_url ? (
                <img
                  src={meal.recipe.image_url}
                  alt={meal.recipe.name}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl bg-primary/10">
                  {emoji}
                </div>
              )}
              {/* Meal type badge */}
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/90 rounded text-[10px] font-medium">
                {meal.label}
              </span>
            </div>

            {/* Recipe info */}
            <div className="flex-1 p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  {meal.recipe?.id ? (
                    <Link
                      href={`/meal-builder?meal=${meal.name}&recipe=${meal.recipe.id}`}
                      className="font-semibold text-sm line-clamp-1 flex-1 font-arabic hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!isToday && meal.loggedRecipeName
                        ? meal.loggedRecipeName
                        : meal.recipe?.name || "No recipe"}
                    </Link>
                  ) : (
                    <h3 className="font-semibold text-sm line-clamp-1 flex-1 font-arabic">
                      {!isToday && meal.loggedRecipeName
                        ? meal.loggedRecipeName
                        : meal.recipe?.name || "No recipe"}
                    </h3>
                  )}
                  {canSwipe && (
                    <motion.span
                      key={`count-${meal.currentIndex}`}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap"
                    >
                      {meal.currentIndex + 1}/{meal.recipeCount}
                    </motion.span>
                  )}
                </div>

                {/* Nutrition info */}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <motion.p
                    key={`cal-${meal.currentIndex}`}
                    initial={{ scale: 1.1, color: "rgb(34, 197, 94)" }}
                    animate={{ scale: 1, color: "rgb(115, 115, 115)" }}
                    transition={{ duration: 0.4 }}
                    className="text-xs text-muted-foreground font-mono"
                  >
                    {displayCalories} cal
                  </motion.p>
                  {/* Ramadan recommendation badge */}
                  {meal.recipe?.recommendation_group?.includes('ramadan') && (
                    <RamadanBadge />
                  )}
                  {meal.planSlot?.swapped &&
                    meal.planSlot?.swapped_ingredients &&
                    Object.keys(meal.planSlot.swapped_ingredients).length >
                      0 && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-[10px] px-2 py-1 bg-gradient-to-r from-primary/20 to-primary/10 text-primary rounded-full font-semibold border border-primary/30 cursor-help"
                        title="This meal has ingredient swaps"
                      >
                        🔄{" "}
                        {Object.keys(meal.planSlot.swapped_ingredients).length}{" "}
                        swap
                        {Object.keys(meal.planSlot.swapped_ingredients).length >
                        1
                          ? "s"
                          : ""}
                      </motion.span>
                    )}
                </div>
              </div>

              {/* Action buttons - only for today */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {!isToday ? (
                  // Past day - just show status
                  meal.isLogged ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600/70 font-medium">
                      <Check className="h-3 w-3" />
                      Eaten
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Not logged
                    </span>
                  )
                ) : meal.isLogged ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                      <Check className="h-3 w-3" />
                      Logged
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                      disabled={isLoading}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onUnlogMeal?.(meal.name);
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Undo2 className="h-3 w-3 mr-1" />
                      )}
                      Undo
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs px-3"
                    disabled={isLoading}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onLogMeal?.(meal.name);
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {isLoading ? "Logging..." : "I ate it"}
                  </Button>
                )}

                {canSwipe && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-1.5 ml-auto"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onSwapMeal?.(meal.name, "right");
                    }}
                  >
                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Swap</span>
                  </Button>
                )}

                {/* Edit Swaps button - shows when ingredient swaps exist */}
                {meal.planSlot?.swapped &&
                  meal.planSlot?.swapped_ingredients &&
                  Object.keys(meal.planSlot.swapped_ingredients).length > 0 && (
                    <Link
                      href={`/meal-builder?meal=${meal.name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-1.5 border-primary/50 hover:bg-primary/5"
                      >
                        <Flame className="h-3 w-3 mr-0 sm:mr-1 text-primary" />
                        <span className="hidden sm:inline">Edit Swaps</span>
                      </Button>
                    </Link>
                  )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // No recipe assigned - empty state
  return (
    <div className="bg-card rounded-xl border border-border p-4 touch-manipulation active:scale-[0.99] transition-transform duration-75">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <div>
            <h3 className="font-semibold">{meal.label}</h3>
            <p className="text-sm text-muted-foreground">
              0 / {meal.targetCalories} cal
            </p>
          </div>
        </div>

        {/* Mini progress ring */}
        <div className="relative w-10 h-10">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted/30"
            />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 16}
              strokeDashoffset={2 * Math.PI * 16 * (1 - progress / 100)}
              className="text-primary"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <button
        onClick={onAddFood}
        className="w-full py-3 border-2 border-dashed border-muted rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Add food
      </button>
    </div>
  );
}

interface QuickStatsProps {
  streak: number;
  weeklyAverage: number;
  weeklyTarget: number;
}

export function QuickStats({
  streak,
  weeklyAverage,
  weeklyTarget,
}: QuickStatsProps) {
  const adherence = Math.round((weeklyAverage / weeklyTarget) * 100);

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-bold text-primary">{streak}</div>
        <p className="text-xs text-muted-foreground">Day Streak</p>
      </div>
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-bold">
          {weeklyAverage.toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground">Avg Cal/Day</p>
      </div>
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <div
          className={cn(
            "text-2xl font-bold",
            adherence >= 90
              ? "text-green-500"
              : adherence >= 70
                ? "text-primary"
                : "text-orange-500",
          )}
        >
          {adherence}%
        </div>
        <p className="text-xs text-muted-foreground">Adherence</p>
      </div>
    </div>
  );
}
