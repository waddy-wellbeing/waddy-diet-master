'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { OnboardingLayout } from '@/components/onboarding/onboarding-layout'
import {
  WelcomeStep,
  BasicInfoStep,
  ActivityLevelStep,
  GoalsStep,
  DietaryPreferencesStep,
  LifestyleStep,
  MealStructureStep,
  PlanPreviewStep,
  type BasicInfoData,
  type ActivityLevel,
  type GoalsData,
  type DietaryPreferencesData,
  type LifestyleData,
  type MealsPerDay,
} from '@/components/onboarding/steps'
import { saveOnboardingData } from '@/lib/actions/onboarding'
import { toast } from 'sonner'

const TOTAL_STEPS = 8

const stepConfig = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'basic-info', title: 'About You', subtitle: "Let's personalize your experience" },
  { id: 'activity', title: 'Activity Level', subtitle: 'How active are you?' },
  { id: 'goals', title: 'Your Goals', subtitle: 'What do you want to achieve?' },
  { id: 'preferences', title: 'Dietary Preferences', subtitle: 'Any restrictions or dislikes?' },
  { id: 'lifestyle', title: 'Lifestyle', subtitle: 'Your cooking preferences' },
  { id: 'meals', title: 'Meal Structure', subtitle: 'How do you like to eat?' },
  { id: 'preview', title: 'Your Plan', subtitle: 'Review your personalized plan' },
]

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
}

export function OnboardingFlow() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  
  // Form state for all steps
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    name: '',
    age: '',
    sex: '',
    height: '',
    heightUnit: 'cm',
    weight: '',
    weightUnit: 'kg',
  })
  
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('')
  
  const [goals, setGoals] = useState<GoalsData>({
    goalType: '',
    targetWeight: '',
    targetWeightUnit: 'kg',
    pace: '',
  })
  
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreferencesData>({
    dietType: '',
    allergies: [],
    hasNoAllergies: false,
    dislikes: [],
  })
  
  const [lifestyle, setLifestyle] = useState<LifestyleData>({
    cookingSkill: '',
    maxPrepTime: 30,
  })
  
  const [mealsPerDay, setMealsPerDay] = useState<MealsPerDay>(3)

  const goToNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection(1)
      setCurrentStep((prev) => prev + 1)
    }
  }

  const goToPrevious = () => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((prev) => prev - 1)
    }
  }

  const canContinue = (): boolean => {
    switch (currentStep) {
      case 0: // Welcome
        return true
      case 1: // Basic Info
        return !!(
          basicInfo.name &&
          basicInfo.age &&
          basicInfo.sex &&
          basicInfo.height &&
          basicInfo.weight
        )
      case 2: // Activity Level
        return !!activityLevel
      case 3: // Goals
        if (goals.goalType === 'maintain') return true
        return !!(goals.goalType && goals.pace)
      case 4: // Dietary Preferences
        return !!dietaryPreferences.dietType
      case 5: // Lifestyle
        return !!lifestyle.cookingSkill
      case 6: // Meal Structure
        return !!mealsPerDay
      case 7: // Preview
        return true
      default:
        return false
    }
  }

  const handleComplete = () => {
    startTransition(async () => {
      try {
        await saveOnboardingData({
          basicInfo,
          activityLevel,
          goals,
          dietaryPreferences,
          lifestyle,
          mealsPerDay,
        })
        toast.success('Welcome to Waddy! ⚡')
        router.push('/dashboard')
        router.refresh()
      } catch (error) {
        console.error('Failed to save onboarding data:', error)
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep onContinue={goToNext} />
      case 1:
        return <BasicInfoStep data={basicInfo} onChange={setBasicInfo} />
      case 2:
        return <ActivityLevelStep value={activityLevel} onChange={setActivityLevel} />
      case 3:
        return (
          <GoalsStep
            data={goals}
            currentWeight={basicInfo.weight}
            weightUnit={basicInfo.weightUnit}
            onChange={setGoals}
          />
        )
      case 4:
        return <DietaryPreferencesStep data={dietaryPreferences} onChange={setDietaryPreferences} />
      case 5:
        return <LifestyleStep data={lifestyle} onChange={setLifestyle} />
      case 6:
        return <MealStructureStep value={mealsPerDay} onChange={setMealsPerDay} />
      case 7:
        return (
          <PlanPreviewStep
            basicInfo={basicInfo}
            activityLevel={activityLevel}
            goals={goals}
            dietaryPreferences={dietaryPreferences}
            lifestyle={lifestyle}
            mealsPerDay={mealsPerDay}
          />
        )
      default:
        return null
    }
  }

  // Welcome step renders itself without the layout wrapper
  if (currentStep === 0) {
    return renderStep()
  }

  const config = stepConfig[currentStep]

  return (
    <OnboardingLayout
      currentStep={currentStep - 1}
      totalSteps={TOTAL_STEPS - 1} // Exclude welcome from step count
      title={config.title}
      subtitle={config.subtitle}
      onBack={currentStep > 1 ? goToPrevious : undefined}
      nextLabel={currentStep === TOTAL_STEPS - 1 ? "Let's Start!" : 'Continue'}
      isNextDisabled={!canContinue()}
      isLoading={isPending}
      onNext={currentStep === TOTAL_STEPS - 1 ? handleComplete : goToNext}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </OnboardingLayout>
  )
}
