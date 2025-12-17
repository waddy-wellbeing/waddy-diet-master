'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  detectCountry,
  formatPhoneNumber,
  validatePhoneNumber,
  getSupportedCountries,
  getTopCountries,
  COUNTRY_PHONES,
  type CountryPhoneConfig,
} from '@/lib/utils/phone'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  helpText?: string
  disabled?: boolean
  className?: string
  error?: string
}

export function PhoneInput({
  value,
  onChange,
  placeholder = '+20 100 123 4567',
  label = 'Mobile number',
  helpText = 'We may use this for account verification and SMS notifications',
  disabled = false,
  className,
  error,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryPhoneConfig | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const [detectedCountry, setDetectedCountry] = useState<CountryPhoneConfig | null>(null)
  const [isValid, setIsValid] = useState(false)

  // Detect country on mount and when value changes
  useEffect(() => {
    const detected = detectCountry(value)
    if (detected && COUNTRY_PHONES[detected]) {
      setDetectedCountry(COUNTRY_PHONES[detected])
      if (!selectedCountry) {
        setSelectedCountry(COUNTRY_PHONES[detected])
      }
    }

    const valid = validatePhoneNumber(value)
    setIsValid(valid)
  }, [value, selectedCountry])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // Auto-detect country from input
    const detected = detectCountry(newValue)
    if (detected && COUNTRY_PHONES[detected]) {
      setDetectedCountry(COUNTRY_PHONES[detected])
      setSelectedCountry(COUNTRY_PHONES[detected])
    }

    onChange(newValue)
  }

  const handleCountrySelect = (country: CountryPhoneConfig) => {
    setSelectedCountry(country)
    setIsDropdownOpen(false)

    // Reformat value with selected country if it's valid
    if (inputValue) {
      const reformatted = formatPhoneNumber(inputValue, country.code)
      setInputValue(reformatted)
      onChange(reformatted)
    }
  }

  const displayCountry = selectedCountry || detectedCountry

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor="phone-input" className="flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {label}
        </Label>
      )}

      <div className="relative">
        <div className="flex items-stretch gap-2">
          {/* Country selector */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={cn(
                'h-12 px-3 flex items-center gap-2 min-w-fit whitespace-nowrap',
                displayCountry && 'bg-muted/50'
              )}
            >
              <span className="text-lg">{displayCountry?.emoji}</span>
              <span className="text-sm font-medium hidden sm:inline">
                +{displayCountry?.dialCode}
              </span>
              <ChevronDown className={cn(
                'w-4 h-4 transition-transform',
                isDropdownOpen && 'rotate-180'
              )} />
            </Button>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 max-h-96 overflow-y-auto bg-background border border-border rounded-lg shadow-lg z-50">
                {/* Top countries */}
                <div className="border-b border-border/30 p-2 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wide">
                    Popular
                  </p>
                  <div className="space-y-1">
                    {getTopCountries().map((country) => (
                      <button
                        key={country.code}
                        onClick={() => handleCountrySelect(country)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left hover:bg-primary/10',
                          selectedCountry?.code === country.code && 'bg-primary/20'
                        )}
                      >
                        <span className="text-lg">{country.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{country.name}</div>
                          <div className="text-xs text-muted-foreground">+{country.dialCode}</div>
                        </div>
                        {selectedCountry?.code === country.code && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* All countries */}
                <div className="p-2">
                  <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wide">
                    All Countries
                  </p>
                  <div className="space-y-1">
                    {getSupportedCountries().map((country) => (
                      <button
                        key={country.code}
                        onClick={() => handleCountrySelect(country)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left hover:bg-primary/10',
                          selectedCountry?.code === country.code && 'bg-primary/20'
                        )}
                      >
                        <span className="text-lg">{country.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{country.name}</div>
                          <div className="text-xs text-muted-foreground">+{country.dialCode}</div>
                        </div>
                        {selectedCountry?.code === country.code && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phone number input */}
          <div className="flex-1 relative">
            <Input
              id="phone-input"
              type="tel"
              placeholder={placeholder}
              value={inputValue}
              onChange={handleInputChange}
              disabled={disabled}
              className={cn(
                'h-12 text-base',
                isValid && 'border-green-500 focus:ring-green-500',
                error && 'border-destructive focus:ring-destructive'
              )}
            />

            {/* Validation indicator */}
            {inputValue && !error && (
              <div className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium',
                isValid ? 'text-green-600' : 'text-amber-600'
              )}>
                {isValid ? '✓' : '○'}
              </div>
            )}
          </div>
        </div>

        {/* Help text and error */}
        <div className="mt-2 space-y-1">
          {error ? (
            <p className="text-xs text-destructive font-medium">{error}</p>
          ) : (
            helpText && <p className="text-xs text-muted-foreground">{helpText}</p>
          )}

          {/* Display format info */}
          {displayCountry && inputValue && (
            <p className="text-xs text-muted-foreground">
              Format: {displayCountry.format}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
