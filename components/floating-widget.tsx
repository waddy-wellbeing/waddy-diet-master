'use client'

/**
 * Floating Widget Component
 * Minimal, draggable widget that links to social/external links
 * Non-intrusive, easily movable, with subtle animations
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'

interface Position {
  x: number
  y: number
}

export function FloatingWidget() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  
  const widgetRef = useRef<HTMLDivElement>(null)
  const startPositionRef = useRef<Position>({ x: 0, y: 0 })
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 })
  const dragThreshold = 10 // pixels - minimum distance to consider it a drag
  const isMountedRef = useRef(true)

  // Initialize position on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsVisible(true)
      setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 100 })
    }

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !isMountedRef.current) return

    let newX = clientX - dragOffsetRef.current.x
    let newY = clientY - dragOffsetRef.current.y

    // Keep within viewport bounds
    newX = Math.max(0, Math.min(newX, window.innerWidth - 60))
    newY = Math.max(0, Math.min(newY, window.innerHeight - 60))

    setPosition({ x: newX, y: newY })
  }, [isDragging])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    startPositionRef.current = { x: e.clientX, y: e.clientY }
    const rect = widgetRef.current?.getBoundingClientRect()
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
    if (isMountedRef.current) {
      setIsDragging(true)
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    moveDrag(e.clientX, e.clientY)
  }, [moveDrag])

  const handleMouseUp = useCallback(() => {
    if (isMountedRef.current) {
      setIsDragging(false)
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      startPositionRef.current = { x: touch.clientX, y: touch.clientY }
      const rect = widgetRef.current?.getBoundingClientRect()
      if (rect) {
        dragOffsetRef.current = {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        }
      }
      if (isMountedRef.current) {
        setIsDragging(true)
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      moveDrag(touch.clientX, touch.clientY)
    }
  }, [moveDrag])

  const handleTouchEnd = useCallback(() => {
    if (isMountedRef.current) {
      setIsDragging(false)
    }
  }, [])

  const handleButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Calculate distance moved from start position
    const distanceMoved = Math.sqrt(
      Math.pow(e.clientX - startPositionRef.current.x, 2) +
      Math.pow(e.clientY - startPositionRef.current.y, 2)
    )

    // If user dragged, don't redirect
    if (distanceMoved > dragThreshold) {
      return
    }

    // Show confirmation on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (isMountedRef.current) {
        setShowConfirm(true)
      }
    } else {
      // Desktop - redirect directly
      window.open('https://beacons.ai/moustafaabbas', '_blank')
    }
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (e instanceof MouseEvent) {
        handleMouseMove(e)
      } else if (e instanceof TouchEvent) {
        handleTouchMove(e)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop for click confirmation */}
      {isHovered && (
        <div
          className="fixed inset-0 bg-black/20 pointer-events-none z-40"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        />
      )}

      {/* Floating Widget */}
      <div
        ref={widgetRef}
        className="fixed z-50 group"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {/* Main Widget Button */}
        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glow effect on hover */}
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-lime-400 to-lime-500 opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-300"
            style={{ transform: 'scale(1.1)' }}
          />

          {/* Main button */}
          <button
            onClick={handleButtonClick}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`
              relative w-14 h-14 rounded-full
              bg-gradient-to-br from-lime-400 to-lime-500
              hover:from-lime-300 hover:to-lime-400
              shadow-lg hover:shadow-xl
              transition-all duration-300
              flex items-center justify-center
              group/btn
              ${isHovered ? 'scale-110' : 'scale-100'}
            `}
            title="Connect with us - or drag to move"
          >
            {/* Icon with animation */}
            <div className="relative w-full h-full flex items-center justify-center">
              <ChevronRight
                className={`w-6 h-6 text-white font-bold transition-transform duration-300 ${
                  isHovered ? 'translate-x-1' : 'translate-x-0'
                }`}
              />
            </div>

            {/* Pulse animation */}
            <div
              className="absolute inset-0 rounded-full bg-lime-400 opacity-0 group-hover/btn:opacity-30 animate-pulse"
              style={{
                animation: isHovered ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
              }}
            />
          </button>

          {/* Label on hover */}
          {isHovered && (
            <div
              className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{ animation: 'slideInRight 0.3s ease-out' }}
            >
              <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
                Connect with us
                <div className="absolute left-full w-2 h-2 bg-gray-900 transform rotate-45 -translate-x-1" />
              </div>
            </div>
          )}
        </div>

        {/* Drag hint (shows on first hover) */}
        {isHovered && (
          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap"
            style={{ animation: 'fadeIn 0.4s ease-out 0.1s both' }}
          >
            Drag to move
          </div>
        )}
      </div>

      {/* Confirmation Modal for Mobile */}
      {showConfirm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
            <div
              className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl p-6 w-full md:max-w-sm pointer-events-auto mx-4 md:mx-0"
              style={{ animation: 'slideUp 0.3s ease-out' }}
            >
              <div className="text-center">
                <div className="mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-lime-400 to-lime-500 mx-auto flex items-center justify-center">
                    <ChevronRight className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Connect With Us</h3>
                <p className="text-sm text-gray-600 mb-6">
                  You'll be redirected to our social and external links
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-900 font-medium transition-colors hover:bg-gray-200 active:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirm(false)
                      window.open('https://beacons.ai/moustafaabbas', '_blank')
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-br from-lime-400 to-lime-500 text-white font-medium transition-all hover:shadow-lg active:scale-95"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </>
  )
}
