/**
 * International phone number handling
 * Supports auto-detection and formatting for phone numbers from multiple countries
 */

export interface CountryPhoneConfig {
  code: string
  dialCode: string
  name: string
  emoji: string
  format: string // e.g., "+1 (XXX) XXX-XXXX"
  pattern: RegExp
  minLength: number
  maxLength: number
}

// Country phone configurations - excluding Israel
export const COUNTRY_PHONES: Record<string, CountryPhoneConfig> = {
  EG: {
    code: 'EG',
    dialCode: '20',
    name: 'Egypt',
    emoji: '🇪🇬',
    format: '+20 XXX XXX XXXX',
    pattern: /^(\+?20)?0?([0-9]{9,10})$/,
    minLength: 9,
    maxLength: 11,
  },
  SA: {
    code: 'SA',
    dialCode: '966',
    name: 'Saudi Arabia',
    emoji: '🇸🇦',
    format: '+966 XX XXX XXXX',
    pattern: /^(\+?966)?0?([0-9]{8,9})$/,
    minLength: 8,
    maxLength: 10,
  },
  AE: {
    code: 'AE',
    dialCode: '971',
    name: 'UAE',
    emoji: '🇦🇪',
    format: '+971 XX XXX XXXX',
    pattern: /^(\+?971)?0?([0-9]{7,9})$/,
    minLength: 7,
    maxLength: 9,
  },
  KW: {
    code: 'KW',
    dialCode: '965',
    name: 'Kuwait',
    emoji: '🇰🇼',
    format: '+965 XXXX XXXX',
    pattern: /^(\+?965)?0?([0-9]{8})$/,
    minLength: 8,
    maxLength: 8,
  },
  QA: {
    code: 'QA',
    dialCode: '974',
    name: 'Qatar',
    emoji: '🇶🇦',
    format: '+974 XXXX XXXX',
    pattern: /^(\+?974)?0?([0-9]{8})$/,
    minLength: 8,
    maxLength: 8,
  },
  OM: {
    code: 'OM',
    dialCode: '968',
    name: 'Oman',
    emoji: '🇴🇲',
    format: '+968 XXXX XXXX',
    pattern: /^(\+?968)?0?([0-9]{8})$/,
    minLength: 8,
    maxLength: 8,
  },
  BH: {
    code: 'BH',
    dialCode: '973',
    name: 'Bahrain',
    emoji: '🇧🇭',
    format: '+973 XXXX XXXX',
    pattern: /^(\+?973)?0?([0-9]{8})$/,
    minLength: 8,
    maxLength: 8,
  },
  JO: {
    code: 'JO',
    dialCode: '962',
    name: 'Jordan',
    emoji: '🇯🇴',
    format: '+962 XX XXX XXXX',
    pattern: /^(\+?962)?0?([0-9]{8,9})$/,
    minLength: 8,
    maxLength: 9,
  },
  LB: {
    code: 'LB',
    dialCode: '961',
    name: 'Lebanon',
    emoji: '🇱🇧',
    format: '+961 XX XXX XXXX',
    pattern: /^(\+?961)?0?([0-9]{7,8})$/,
    minLength: 7,
    maxLength: 8,
  },
  SY: {
    code: 'SY',
    dialCode: '963',
    name: 'Syria',
    emoji: '🇸🇾',
    format: '+963 XXX XXX XXXX',
    pattern: /^(\+?963)?0?([0-9]{9})$/,
    minLength: 9,
    maxLength: 9,
  },
  IQ: {
    code: 'IQ',
    dialCode: '964',
    name: 'Iraq',
    emoji: '🇮🇶',
    format: '+964 XXX XXX XXXX',
    pattern: /^(\+?964)?0?([0-9]{9})$/,
    minLength: 9,
    maxLength: 9,
  },
  US: {
    code: 'US',
    dialCode: '1',
    name: 'USA',
    emoji: '🇺🇸',
    format: '+1 (XXX) XXX-XXXX',
    pattern: /^(\+?1)?([0-9]{10})$/,
    minLength: 10,
    maxLength: 10,
  },
  GB: {
    code: 'GB',
    dialCode: '44',
    name: 'UK',
    emoji: '🇬🇧',
    format: '+44 XXXX XXX XXX',
    pattern: /^(\+?44)?0?([0-9]{10})$/,
    minLength: 10,
    maxLength: 10,
  },
  DE: {
    code: 'DE',
    dialCode: '49',
    name: 'Germany',
    emoji: '🇩🇪',
    format: '+49 XXX XXXXXX',
    pattern: /^(\+?49)?0?([0-9]{9,11})$/,
    minLength: 9,
    maxLength: 11,
  },
  FR: {
    code: 'FR',
    dialCode: '33',
    name: 'France',
    emoji: '🇫🇷',
    format: '+33 X XX XX XX XX',
    pattern: /^(\+?33)?0?([0-9]{9})$/,
    minLength: 9,
    maxLength: 9,
  },
  IN: {
    code: 'IN',
    dialCode: '91',
    name: 'India',
    emoji: '🇮🇳',
    format: '+91 XXXXX XXXXX',
    pattern: /^(\+?91)?0?([0-9]{10})$/,
    minLength: 10,
    maxLength: 10,
  },
  PK: {
    code: 'PK',
    dialCode: '92',
    name: 'Pakistan',
    emoji: '🇵🇰',
    format: '+92 XXX XXX XXXX',
    pattern: /^(\+?92)?0?([0-9]{9,10})$/,
    minLength: 9,
    maxLength: 10,
  },
  BD: {
    code: 'BD',
    dialCode: '880',
    name: 'Bangladesh',
    emoji: '🇧🇩',
    format: '+880 1XXXX XXXXX',
    pattern: /^(\+?880)?0?1([0-9]{9})$/,
    minLength: 10,
    maxLength: 10,
  },
}

/**
 * Detect country from phone number input
 * Returns the most likely country based on dial code or number pattern
 */
export function detectCountry(input: string): string | null {
  if (!input) return null

  const cleaned = input.replace(/\s+/g, '')

  // Check for explicit dial code
  for (const [code, config] of Object.entries(COUNTRY_PHONES)) {
    if (cleaned.startsWith('+' + config.dialCode)) {
      return code
    }
  }

  // Check for Egyptian common patterns (starts with +20, 0020, 0100, 0101, 0102, etc.)
  if (cleaned.match(/^(\+?20)?0?[0-9]{9,10}$/) || cleaned.match(/^0(1[0-2])/)) {
    return 'EG'
  }

  // Try to match against each country pattern
  for (const [code, config] of Object.entries(COUNTRY_PHONES)) {
    if (config.pattern.test(cleaned)) {
      return code
    }
  }

  return null
}

/**
 * Normalize phone number to international format: +<dialCode><number>
 * Returns null if invalid
 */
export function normalizePhoneNumber(input: string, countryCode?: string): string | null {
  if (!input) return null

  const cleaned = input.replace(/\s+/g, '').replace(/-/g, '')

  // Auto-detect country if not provided
  const detectedCountry = countryCode || detectCountry(cleaned)
  if (!detectedCountry || !COUNTRY_PHONES[detectedCountry]) {
    return null
  }

  const config = COUNTRY_PHONES[detectedCountry]

  // Extract just the number part (remove dial code and leading 0)
  let numberPart = cleaned.replace(/^\+?/, '')
  if (numberPart.startsWith(config.dialCode)) {
    numberPart = numberPart.slice(config.dialCode.length)
  }
  numberPart = numberPart.replace(/^0/, '')

  // Validate length
  if (numberPart.length < config.minLength || numberPart.length > config.maxLength) {
    return null
  }

  // Return normalized format
  return `+${config.dialCode}${numberPart}`
}

/**
 * Format phone number for display
 * Accepts either raw input or normalized format
 */
export function formatPhoneNumber(phone: string, countryCode?: string): string {
  if (!phone) return ''

  const normalized = normalizePhoneNumber(phone, countryCode)
  if (!normalized) return phone // Return as-is if can't normalize

  const detectedCountry = countryCode || detectCountry(phone)
  if (!detectedCountry || !COUNTRY_PHONES[detectedCountry]) {
    return normalized
  }

  const config = COUNTRY_PHONES[detectedCountry]
  const dialCode = config.dialCode
  const numberPart = normalized.slice(dialCode.length + 1)

  // Format according to country template
  let formatted = config.format
  let charIndex = 0
  const result = formatted.replace(/X/g, () => {
    return charIndex < numberPart.length ? numberPart[charIndex++] : ''
  })

  return result
}

/**
 * Validate phone number
 */
export function validatePhoneNumber(phone: string, countryCode?: string): boolean {
  const normalized = normalizePhoneNumber(phone, countryCode)
  return normalized !== null
}

/**
 * Get country info by code
 */
export function getCountryInfo(code: string): CountryPhoneConfig | null {
  return COUNTRY_PHONES[code] || null
}

/**
 * Get all supported countries sorted by name
 */
export function getSupportedCountries(): CountryPhoneConfig[] {
  return Object.values(COUNTRY_PHONES).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get top countries (most used for quick selection)
 */
export function getTopCountries(): CountryPhoneConfig[] {
  const topCodes = ['EG', 'SA', 'AE', 'US', 'GB', 'IN', 'PK']
  return topCodes
    .map((code) => COUNTRY_PHONES[code])
    .filter(Boolean) as CountryPhoneConfig[]
}
