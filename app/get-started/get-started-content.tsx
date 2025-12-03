'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles, Target, Utensils, ArrowRight, LogIn } from 'lucide-react'

const features = [
  {
    icon: Target,
    title: 'Personalized for You',
    description: 'Meal plans tailored to your goals and preferences',
  },
  {
    icon: Utensils,
    title: 'Simple Meal Planning',
    description: 'Know exactly what to eat each day',
  },
  {
    icon: Sparkles,
    title: 'Easy Tracking',
    description: 'Log meals with just one tap',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
}

export function GetStartedContent() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 to-background">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md text-center"
        >
          {/* Logo/Icon */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
              <span className="text-4xl">⚡</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Waddy Diet Master
            </h1>
            <p className="text-muted-foreground mt-2">
              Master your diet, transform your life
            </p>
          </motion.div>

          {/* Features */}
          <motion.div variants={itemVariants} className="space-y-4 mb-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border/50 text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div variants={itemVariants} className="space-y-3">
            <Button
              asChild
              size="lg"
              className="w-full h-14 text-lg font-semibold"
            >
              <Link href="/get-started/onboarding">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full h-12"
            >
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In to Existing Account
              </Link>
            </Button>
          </motion.div>

          {/* Time estimate */}
          <motion.p
            variants={itemVariants}
            className="text-sm text-muted-foreground mt-6"
          >
            ⏱️ Takes about 30-60 seconds to set up
          </motion.p>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </footer>
    </div>
  )
}
