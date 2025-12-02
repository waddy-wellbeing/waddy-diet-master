'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushNotifications } from '@/lib/hooks/use-push-notifications'

const PROMPT_DISMISSED_KEY = 'push-notification-prompt-dismissed'
const PROMPT_DELAY_MS = 3000 // Show after 3 seconds

export function PushNotificationPrompt() {
  const [isVisible, setIsVisible] = useState(false)
  const [isEnabling, setIsEnabling] = useState(false)
  const { isSupported, isSubscribed, permission, subscribe } = usePushNotifications()

  useEffect(() => {
    // Don't show if:
    // - Not supported
    // - Already subscribed
    // - Permission already denied
    // - Already dismissed this session
    if (!isSupported || isSubscribed || permission === 'denied') {
      return
    }

    const dismissed = sessionStorage.getItem(PROMPT_DISMISSED_KEY)
    if (dismissed) {
      return
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, PROMPT_DELAY_MS)

    return () => clearTimeout(timer)
  }, [isSupported, isSubscribed, permission])

  const handleDismiss = () => {
    setIsVisible(false)
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true')
  }

  const handleEnable = async () => {
    setIsEnabling(true)
    const success = await subscribe()
    setIsEnabling(false)
    
    if (success) {
      setIsVisible(false)
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleDismiss}
          />

          {/* Prompt Card */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[400px] z-50"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="p-3 rounded-xl bg-primary/20 backdrop-blur-sm">
                        <Bell className="w-6 h-6 text-primary" />
                      </div>
                      {/* Animated ping */}
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Stay on Track!</h3>
                      <p className="text-sm text-muted-foreground">
                        Get timely nutrition reminders
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="p-1.5 rounded-full hover:bg-muted/50 transition-colors"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  {[
                    { icon: '🍽️', text: 'Meal time reminders' },
                    { icon: '🎯', text: 'Goal achievements' },
                    { icon: '📊', text: 'Daily nutrition summaries' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.1 }}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.text}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={handleDismiss}
                    className="flex-1"
                  >
                    Maybe Later
                  </Button>
                  <Button
                    onClick={handleEnable}
                    disabled={isEnabling}
                    className="flex-1 gap-2"
                  >
                    {isEnabling ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        >
                          <Zap className="w-4 h-4" />
                        </motion.div>
                        Enabling...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>

                {/* Privacy note */}
                <p className="text-xs text-center text-muted-foreground">
                  You can change this anytime in your profile settings
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
