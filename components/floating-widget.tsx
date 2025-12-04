'use client'

/**
 * Floating Widget Component
 * Minimal, draggable widget that links to social/external links
 * Non-intrusive, easily movable, with subtle animations
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'

interface Position {
  x: number
  y: number
}

export function FloatingWidget() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const startPositionRef = useRef<Position>({ x: 0, y: 0 })
  const dragThreshold = 10 // pixels - minimum distance to consider it a drag

  // Initialize position on mount
  useEffect(() => {
    setIsVisible(true)
    // Start in bottom-right corner
    setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 100 })
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't prevent default - let click events bubble
    setIsDragging(true)
    startPositionRef.current = { x: e.clientX, y: e.clientY }
    const rect = widgetRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    let newX = e.clientX - dragOffset.x
    let newY = e.clientY - dragOffset.y

    // Keep within viewport bounds
    newX = Math.max(0, Math.min(newX, window.innerWidth - 60))
    newY = Math.max(0, Math.min(newY, window.innerHeight - 60))

    setPosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    // Calculate distance moved from start position
    const distanceMoved = Math.sqrt(
      Math.pow(e.clientX - startPositionRef.current.x, 2) +
      Math.pow(e.clientY - startPositionRef.current.y, 2)
    )

    // Only redirect if user didn't drag significantly
    if (distanceMoved < dragThreshold) {
      window.open('https://beacons.ai/moustafaabbas', '_blank')
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

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
