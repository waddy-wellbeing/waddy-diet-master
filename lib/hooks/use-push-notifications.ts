'use client'

import { useState, useEffect, useCallback } from 'react'
import { saveSubscription, removeSubscription } from '@/lib/actions/notifications'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray as Uint8Array<ArrayBuffer>
}

function getDeviceInfo(): { type: string; name: string } {
  const ua = navigator.userAgent
  let type = 'web'
  let name = 'Unknown Device'

  if (/Android/i.test(ua)) {
    type = 'android'
    name = 'Android Device'
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    type = 'ios'
    name = 'iOS Device'
  } else if (/Windows/i.test(ua)) {
    type = 'desktop'
    name = 'Windows PC'
  } else if (/Mac/i.test(ua)) {
    type = 'desktop'
    name = 'Mac'
  } else if (/Linux/i.test(ua)) {
    type = 'desktop'
    name = 'Linux PC'
  }

  return { type, name }
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 
        'serviceWorker' in navigator && 
        'PushManager' in window && 
        'Notification' in window

      setIsSupported(supported)
      
      if (supported) {
        setPermission(Notification.permission)
        
        // Check existing subscription
        try {
          const registration = await navigator.serviceWorker.ready
          const existingSub = await registration.pushManager.getSubscription()
          setSubscription(existingSub)
          setIsSubscribed(!!existingSub)
        } catch (err) {
          console.error('Error checking subscription:', err)
        }
      }
      
      setIsLoading(false)
    }

    checkSupport()
  }, [])

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service workers not supported')
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      console.log('Service worker registered:', registration)
      return registration
    } catch (err) {
      console.error('Service worker registration failed:', err)
      throw err
    }
  }, [])

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Check if VAPID key exists
      if (!VAPID_PUBLIC_KEY) {
        throw new Error('VAPID public key not configured')
      }
      
      console.log('[Push] VAPID key length:', VAPID_PUBLIC_KEY.length)
      console.log('[Push] VAPID key:', VAPID_PUBLIC_KEY.substring(0, 20) + '...')

      // Request permission
      const permission = await Notification.requestPermission()
      setPermission(permission)
      console.log('[Push] Permission:', permission)

      if (permission !== 'granted') {
        setError('Notification permission denied')
        setIsLoading(false)
        return false
      }

      // Register service worker
      await registerServiceWorker()
      const registration = await navigator.serviceWorker.ready
      console.log('[Push] Service worker ready')

      // Check for existing subscription first
      const existingSub = await registration.pushManager.getSubscription()
      if (existingSub) {
        console.log('[Push] Found existing subscription, unsubscribing first...')
        await existingSub.unsubscribe()
      }

      // Subscribe to push
      console.log('[Push] Subscribing to push manager...')
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      console.log('[Push] Subscription created:', sub.endpoint.substring(0, 50) + '...')

      setSubscription(sub)
      setIsSubscribed(true)

      // Save to server
      const deviceInfo = getDeviceInfo()
      const result = await saveSubscription(sub.toJSON(), deviceInfo)

      if (!result.success) {
        throw new Error(result.error)
      }

      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Error subscribing:', err)
      setError(err instanceof Error ? err.message : 'Failed to subscribe')
      setIsLoading(false)
      return false
    }
  }, [registerServiceWorker])

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (subscription) {
        await subscription.unsubscribe()
        await removeSubscription(subscription.endpoint)
      }

      setSubscription(null)
      setIsSubscribed(false)
      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Error unsubscribing:', err)
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe')
      setIsLoading(false)
      return false
    }
  }, [subscription])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribe,
    unsubscribe,
  }
}
