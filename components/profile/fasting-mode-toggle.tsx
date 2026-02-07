"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Moon, Sun, Zap, Loader2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { togglePlanMode } from "@/lib/actions/users";
import { setFastingModePreferences } from "@/lib/actions/users";
import { toast } from "sonner";

interface FastingModeToggleProps {
  userId: string;
  currentMode: "regular" | "fasting";
  fastingSelectedMeals?: string[];
  onModeChange?: (mode: "regular" | "fasting") => void;
}

const FASTING_MEAL_OPTIONS = [
  {
    value: "pre-iftar",
    label_ar: "كسر صيام (قبل الإفطار)",
    description: "وجبة خفيفة مع تمر أو شوربة",
    is_recommended: true,
  },
  {
    value: "iftar",
    label_ar: "إفطار",
    description: "الوجبة الرئيسية",
    is_recommended: true,
  },
  {
    value: "full-meal-taraweeh",
    label_ar: "وجبة متكاملة بعد صلاة التراويح",
    description: "وجبة كاملة متوازنة",
    is_recommended: false,
  },
  {
    value: "snack-taraweeh",
    label_ar: "سناك بعد صلاة التراويح",
    description: "وجبة خفيفة مسائية",
    is_recommended: false,
  },
  {
    value: "suhoor",
    label_ar: "سحور",
    description: "وجبة قبل الفجر",
    is_recommended: true,
  },
] as const;

export function FastingModeToggle({
  userId,
  currentMode,
  fastingSelectedMeals,
  onModeChange,
}: FastingModeToggleProps) {
  const [mode, setMode] = useState<"regular" | "fasting">(currentMode);
  const [isToggling, setIsToggling] = useState(false);
  const [showMealConfig, setShowMealConfig] = useState(false);
  const [selectedMeals, setSelectedMeals] = useState<string[]>(
    fastingSelectedMeals || ["iftar", "suhoor"],
  );
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    setMode(currentMode);
  }, [currentMode]);

  const isFastingOn = mode === "fasting";

  const handleToggle = async () => {
    const newMode = isFastingOn ? "regular" : "fasting";

    // If switching to fasting mode, check if meals are selected
    if (
      newMode === "fasting" &&
      (!fastingSelectedMeals || fastingSelectedMeals.length < 1)
    ) {
      setShowMealConfig(true);
      return;
    }

    // If switching OFF fasting mode, just toggle immediately
    if (newMode === "regular") {
      setIsToggling(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        await togglePlanMode(userId, today, newMode);
        setMode(newMode);
        onModeChange?.(newMode);
        toast.success("تم إيقاف وضع الصوم");
      } catch (error) {
        console.error("Error toggling mode:", error);
        toast.error("حدث خطأ أثناء تغيير النمط");
      } finally {
        setIsToggling(false);
      }
      return;
    }

    // Switching TO fasting mode - perform action
    setIsToggling(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      await togglePlanMode(userId, today, newMode);
      setMode(newMode);
      onModeChange?.(newMode);

      toast.success("تم تفعيل وضع الصوم ✨");
    } catch (error) {
      console.error("Error toggling mode:", error);
      toast.error("حدث خطأ أثناء تغيير النمط");
    } finally {
      setIsToggling(false);
    }
  };

  const handleSaveMealConfig = async () => {
    // Validate at least one meal selected
    if (selectedMeals.length < 1) {
      toast.error("اختر وجبة واحدة على الأقل");
      return;
    }

    setIsSavingConfig(true);

    try {
      const result = await setFastingModePreferences(userId, selectedMeals);

      if (!result.success) {
        toast.error(result.error || "حدث خطأ أثناء حفظ الإعدادات");
        return;
      }

      setShowMealConfig(false);

      // Now toggle to fasting mode
      const today = new Date().toISOString().split("T")[0];
      await togglePlanMode(userId, today, "fasting");
      setMode("fasting");
      onModeChange?.("fasting");

      toast.success("تم حفظ إعدادات رمضان وتفعيل النمط ✨");
    } catch (error) {
      console.error("Error saving fasting config:", error);
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleConfigClick = () => {
    setSelectedMeals(fastingSelectedMeals || ["iftar", "suhoor"]);
    setShowMealConfig(true);
  };

  const toggleMealSelection = (mealValue: string) => {
    setSelectedMeals((prev) =>
      prev.includes(mealValue)
        ? prev.filter((m) => m !== mealValue)
        : [...prev, mealValue],
    );
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-xl transition-colors",
              isFastingOn ? "bg-purple-500/10" : "bg-muted",
            )}
          >
            {isFastingOn ? (
              <Moon className="w-5 h-5 text-purple-500" />
            ) : (
              <Moon className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">وضع الصوم 🌙</h3>
            <p className="text-xs text-muted-foreground">
              {isFastingOn
                ? `مُفعّل • ${fastingSelectedMeals?.length || 2} وجبات يومياً`
                : "غير مُفعّل"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFastingOn &&
            fastingSelectedMeals &&
            fastingSelectedMeals.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConfigClick}
                disabled={isToggling}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            )}

          <button
            type="button"
            onClick={handleToggle}
            disabled={isToggling}
            className={cn(
              "relative inline-flex h-8 w-14 items-center rounded-full transition-all",
              isFastingOn ? "bg-purple-500" : "bg-gray-300",
              isToggling && "opacity-50 cursor-not-allowed",
            )}
          >
            {isToggling ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </span>
            ) : (
              <motion.span
                className="inline-block h-6 w-6 transform rounded-full bg-white shadow-lg flex items-center justify-center"
                animate={{
                  x: isFastingOn ? 28 : 4,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {isFastingOn ? (
                  <Moon className="w-3 h-3 text-purple-500" />
                ) : (
                  <Moon className="w-3 h-3 text-gray-400" />
                )}
              </motion.span>
            )}
          </button>
        </div>
      </div>

      <Dialog open={showMealConfig} onOpenChange={setShowMealConfig}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              إعدادات نمط رمضان 🌙
            </DialogTitle>
            <DialogDescription className="text-right">
              اختر الوجبات التي تريد تناولها يومياً
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {FASTING_MEAL_OPTIONS.map((option) => {
              const isSelected = selectedMeals.includes(option.value);

              return (
                <motion.div
                  key={option.value}
                  className={cn(
                    "flex items-center space-x-3 space-x-reverse p-4 rounded-xl border transition-all",
                    isSelected
                      ? "border-purple-500 bg-purple-500/5"
                      : "border-border hover:border-purple-500/30",
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Label
                        htmlFor={option.value}
                        className="font-semibold cursor-pointer"
                      >
                        {option.label_ar}
                      </Label>
                      {option.is_recommended && (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                          موصى به
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <Checkbox
                    id={option.value}
                    checked={isSelected}
                    onCheckedChange={() => toggleMealSelection(option.value)}
                    className={cn(
                      isSelected &&
                        "data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500",
                    )}
                  />
                </motion.div>
              );
            })}

            <div className="pt-2 border-t">
              <p className="text-sm text-center text-muted-foreground">
                عدد الوجبات المختارة:{" "}
                <span className="font-semibold text-purple-600">
                  {selectedMeals.length}
                </span>
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowMealConfig(false)}
              disabled={isSavingConfig}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveMealConfig}
              disabled={isSavingConfig || selectedMeals.length < 1}
              className="flex-1 bg-purple-500 hover:bg-purple-600"
            >
              {isSavingConfig ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                "حفظ وتفعيل"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
