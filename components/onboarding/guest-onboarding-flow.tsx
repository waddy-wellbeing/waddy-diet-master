'use client'

import { useState, useEffect } from 'react'
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
import {
  saveGuestOnboardingData,
  loadGuestOnboardingData,
  type GuestOnboardingData,
} from '@/lib/utils/guest-storage'
import { toast } from 'sonner'

const TOTAL_STEPS = 7

const stepConfig = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'basic-info', title: 'About You', subtitle: "Let's personalize your experience" },
  { id: 'activity', title: 'Activity Level', subtitle: 'How active are you?' },
  { id: 'goals', title: 'Your Goals', subtitle: 'What do you want to achieve?' },
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

export function GuestOnboardingFlow() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isInitialized, setIsInitialized] = useState(false)
  
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

  // Load saved data from local storage on mount
  useEffect(() => {
    const savedData = loadGuestOnboardingData()
    if (savedData) {
      if (savedData.basicInfo) setBasicInfo(savedData.basicInfo)
      if (savedData.activityLevel) setActivityLevel(savedData.activityLevel)
      if (savedData.goals) setGoals(savedData.goals)
      if (savedData.dietaryPreferences) setDietaryPreferences(savedData.dietaryPreferences)
      if (savedData.lifestyle) setLifestyle(savedData.lifestyle)
      if (savedData.mealsPerDay) setMealsPerDay(savedData.mealsPerDay)
    }
    setIsInitialized(true)
  }, [])

  // Auto-save to local storage whenever form data changes
  useEffect(() => {
    if (!isInitialized) return
    
    const data: GuestOnboardingData = {
      basicInfo,
      activityLevel,
      goals,
      dietaryPreferences,
      lifestyle,
      mealsPerDay,
    }
    saveGuestOnboardingData(data)
  }, [basicInfo, activityLevel, goals, dietaryPreferences, lifestyle, mealsPerDay, isInitialized])

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
      case 4: // Lifestyle
        return !!lifestyle.cookingSkill
      case 5: // Meal Structure
        return !!mealsPerDay
      case 6: // Preview
        return true
      default:
        return false
    }
  }

  const handleComplete = () => {
    setIsLoading(true)
    
    // Save final data with completion timestamp
    const data: GuestOnboardingData = {
      basicInfo,
      activityLevel,
      goals,
      dietaryPreferences,
      lifestyle,
      mealsPerDay,
      completedAt: new Date().toISOString(),
    }
    saveGuestOnboardingData(data)
    
    toast.success('Your plan is ready! ⚡')
    toast.info('Sign in to save your progress and access all features')
    
    // Redirect to sign up with a flag to sync data
    router.push('/signup?from=onboarding')
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
        return <LifestyleStep data={lifestyle} onChange={setLifestyle} />
      case 5:
        return <MealStructureStep value={mealsPerDay} onChange={setMealsPerDay} />
      case 6:
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
      totalSteps={TOTAL_STEPS - 1}
      title={config.title}
      subtitle={config.subtitle}
      onBack={currentStep > 1 ? goToPrevious : undefined}
      nextLabel={currentStep === TOTAL_STEPS - 1 ? 'Save & Sign Up' : 'Continue'}
      isNextDisabled={!canContinue()}
      isLoading={isLoading}
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
