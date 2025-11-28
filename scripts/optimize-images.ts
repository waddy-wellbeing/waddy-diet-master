#!/usr/bin/env tsx
/**
 * Image Optimization Script
 * 
 * Resizes images from docs/datasets/images/ to optimized WebP format:
 * - Cover: 600×600px (for recipe detail pages)
 * - Thumb: 200×200px (for recipe cards/lists)
 * 
 * Usage:
 *   npm run images:optimize
 */

import sharp from 'sharp'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { log } from './utils'

// =============================================================================
// Configuration
// =============================================================================

const INPUT_DIR = path.join(process.cwd(), 'docs', 'datasets', 'images')
const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'datasets', 'images-optimized')

const SIZES = {
  cover: { width: 600, height: 600 },
  thumb: { width: 200, height: 200 },
} as const

const QUALITY = 80
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'])

// =============================================================================
// Helpers
// =============================================================================

interface OptimizeResult {
  success: number
  failed: number
  skipped: number
  errors: string[]
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getImageFiles(dir: string): string[] {
  const files: string[] = []

  const walk = (currentDir: string) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (ALLOWED_EXTENSIONS.has(ext)) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(dir)
  return files
}

function sanitizeFilename(name: string): string {
  // For Supabase Storage: use hash + sanitized suffix for unique, compatible names
  // This ensures ASCII-only filenames while maintaining uniqueness
  const hash = crypto.createHash('md5').update(name).digest('hex').slice(0, 8)
  
  // Create a sanitized suffix from the original name (ASCII only)
  const sanitized = name
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (keeps ASCII letters, numbers, underscore)
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/^[-_]+/, '') // Remove leading dashes/underscores
    .replace(/[-_]+$/, '') // Remove trailing dashes/underscores
    .replace(/[-_]{2,}/g, '-') // Replace multiple dashes/underscores with single dash
    .toLowerCase()
    .slice(0, 50) // Limit length
  
  return sanitized ? `${hash}-${sanitized}` : hash
}

// =============================================================================
// Main Optimization Function
// =============================================================================

async function optimizeImage(
  inputPath: string,
  outputBaseName: string
): Promise<{ cover: boolean; thumb: boolean; error?: string }> {
  const result = { cover: false, thumb: false, error: undefined as string | undefined }
  
  try {
    const image = sharp(inputPath)
    const metadata = await image.metadata()
    
    if (!metadata.width || !metadata.height) {
      result.error = 'Could not read image dimensions'
      return result
    }

    // Process cover size
    const coverPath = path.join(OUTPUT_DIR, 'cover', `${outputBaseName}.webp`)
    await sharp(inputPath)
      .resize(SIZES.cover.width, SIZES.cover.height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: QUALITY })
      .toFile(coverPath)
    result.cover = true

    // Process thumb size
    const thumbPath = path.join(OUTPUT_DIR, 'thumb', `${outputBaseName}.webp`)
    await sharp(inputPath)
      .resize(SIZES.thumb.width, SIZES.thumb.height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: QUALITY })
      .toFile(thumbPath)
    result.thumb = true

  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }

  return result
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  log.header('Image Optimization')
  
  // Check input directory
  if (!fs.existsSync(INPUT_DIR)) {
    log.error(`Input directory not found: ${INPUT_DIR}`)
    process.exit(1)
  }

  // Create output directories
  ensureDir(path.join(OUTPUT_DIR, 'cover'))
  ensureDir(path.join(OUTPUT_DIR, 'thumb'))
  log.info(`Output directory: ${OUTPUT_DIR}`)

  // Get all image files
  const imageFiles = getImageFiles(INPUT_DIR)
  log.info(`Found ${imageFiles.length} images to process`)

  if (imageFiles.length === 0) {
    log.warning('No images found to process')
    return
  }

  // Process images
  const result: OptimizeResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  // Track processed names to avoid duplicates
  const processedNames = new Set<string>()
  
  // Mapping from original name to sanitized filename (for URL updates later)
  const imageMapping: Record<string, string> = {}

  for (let i = 0; i < imageFiles.length; i++) {
    const inputPath = imageFiles[i]
    const originalName = path.parse(inputPath).name
    const sanitizedName = sanitizeFilename(originalName)
    
    // Skip duplicates
    if (processedNames.has(sanitizedName)) {
      result.skipped++
      continue
    }
    processedNames.add(sanitizedName)
    
    // Store mapping
    imageMapping[originalName] = `${sanitizedName}.webp`

    const optimizeResult = await optimizeImage(inputPath, sanitizedName)
    
    if (optimizeResult.cover && optimizeResult.thumb) {
      result.success++
    } else if (optimizeResult.error) {
      result.failed++
      result.errors.push(`${originalName}: ${optimizeResult.error}`)
    }

    // Progress indicator
    process.stdout.write(`\r  Progress: ${i + 1}/${imageFiles.length}`)
  }

  console.log() // New line after progress
  
  // Save mapping file for use by update-image-urls script
  const mappingPath = path.join(OUTPUT_DIR, 'image-mapping.json')
  fs.writeFileSync(mappingPath, JSON.stringify(imageMapping, null, 2), 'utf-8')
  log.info(`Saved image mapping to ${mappingPath}`)

  // Summary
  log.header('Optimization Summary')
  console.log(`  ✅ Success: ${result.success}`)
  console.log(`  ❌ Failed: ${result.failed}`)
  console.log(`  ⏭️  Skipped (duplicates): ${result.skipped}`)
  
  if (result.errors.length > 0) {
    console.log('\n  Errors:')
    result.errors.slice(0, 10).forEach(err => {
      console.log(`    - ${err}`)
    })
    if (result.errors.length > 10) {
      console.log(`    ... and ${result.errors.length - 10} more`)
    }
  }

  // Output info
  const coverDir = path.join(OUTPUT_DIR, 'cover')
  const thumbDir = path.join(OUTPUT_DIR, 'thumb')
  const coverFiles = fs.existsSync(coverDir) ? fs.readdirSync(coverDir).length : 0
  const thumbFiles = fs.existsSync(thumbDir) ? fs.readdirSync(thumbDir).length : 0
  
  console.log(`\n  Output:`)
  console.log(`    Cover (${SIZES.cover.width}×${SIZES.cover.height}): ${coverFiles} files`)
  console.log(`    Thumb (${SIZES.thumb.width}×${SIZES.thumb.height}): ${thumbFiles} files`)
  
  log.success('Image optimization complete!')
}

main().catch(err => {
  log.error(`Fatal error: ${err}`)
  process.exit(1)
})
