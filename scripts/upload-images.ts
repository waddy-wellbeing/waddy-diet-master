#!/usr/bin/env tsx
/**
 * Image Upload Script
 * 
 * Uploads optimized images from docs/datasets/images-optimized/ to Supabase Storage.
 * 
 * Usage:
 *   npm run images:upload
 *   npm run images:upload -- --dry-run    # Preview without uploading
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { createSeedClient, log } from './utils'

// Load environment variables
dotenv.config({ path: '.env.local' })

// =============================================================================
// Configuration
// =============================================================================

const OPTIMIZED_DIR = path.join(process.cwd(), 'docs', 'datasets', 'images-optimized')
const BUCKET_NAME = 'recipe-images'

// =============================================================================
// Helpers
// =============================================================================

interface UploadResult {
  uploaded: number
  skipped: number
  failed: number
  errors: string[]
}

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.webp'))
    .map(f => path.join(dir, f))
}

// =============================================================================
// Upload Functions
// =============================================================================

async function uploadFile(
  supabase: ReturnType<typeof createSeedClient>,
  localPath: string,
  storagePath: string,
  isDryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  if (isDryRun) {
    return { success: true }
  }

  try {
    const fileBuffer = fs.readFileSync(localPath)
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/webp',
        upsert: true, // Overwrite if exists
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function uploadDirectory(
  supabase: ReturnType<typeof createSeedClient>,
  localDir: string,
  storagePrefix: string,
  isDryRun: boolean
): Promise<UploadResult> {
  const result: UploadResult = {
    uploaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  const files = getFiles(localDir)
  
  for (let i = 0; i < files.length; i++) {
    const localPath = files[i]
    const fileName = path.basename(localPath)
    const storagePath = `${storagePrefix}/${fileName}`

    const uploadResult = await uploadFile(supabase, localPath, storagePath, isDryRun)
    
    if (uploadResult.success) {
      result.uploaded++
    } else {
      result.failed++
      result.errors.push(`${fileName}: ${uploadResult.error}`)
    }

    process.stdout.write(`\r  ${storagePrefix}: ${i + 1}/${files.length}`)
  }

  console.log() // New line
  return result
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')

  log.header(`Image Upload to Supabase Storage ${isDryRun ? '(DRY RUN)' : ''}`)

  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    log.error('NEXT_PUBLIC_SUPABASE_URL is not set')
    process.exit(1)
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.error('SUPABASE_SERVICE_ROLE_KEY is not set')
    process.exit(1)
  }

  // Check input directories
  const coverDir = path.join(OPTIMIZED_DIR, 'cover')
  const thumbDir = path.join(OPTIMIZED_DIR, 'thumb')

  if (!fs.existsSync(coverDir) && !fs.existsSync(thumbDir)) {
    log.error(`No optimized images found. Run 'npm run images:optimize' first.`)
    process.exit(1)
  }

  // Create Supabase client
  const supabase = createSeedClient()
  log.success('Connected to Supabase')

  // Check if bucket exists
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
  
  if (bucketError) {
    log.error(`Failed to list buckets: ${bucketError.message}`)
    process.exit(1)
  }

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
  
  if (!bucketExists) {
    log.warning(`Bucket '${BUCKET_NAME}' not found. Please create it in Supabase dashboard.`)
    log.info(`URL: https://supabase.com/dashboard/project/vzoypoerhdrkhyozwuiu/storage/buckets`)
    process.exit(1)
  }

  log.info(`Uploading to bucket: ${BUCKET_NAME}`)

  // Count files
  const coverFiles = getFiles(coverDir)
  const thumbFiles = getFiles(thumbDir)
  log.info(`Found ${coverFiles.length} cover images, ${thumbFiles.length} thumb images`)

  // Upload cover images
  log.subheader('Uploading cover images')
  const coverResult = await uploadDirectory(supabase, coverDir, 'cover', isDryRun)

  // Upload thumb images
  log.subheader('Uploading thumb images')
  const thumbResult = await uploadDirectory(supabase, thumbDir, 'thumb', isDryRun)

  // Summary
  log.header('Upload Summary')
  console.log(`  Cover:`)
  console.log(`    ✅ Uploaded: ${coverResult.uploaded}`)
  console.log(`    ❌ Failed: ${coverResult.failed}`)
  
  console.log(`  Thumb:`)
  console.log(`    ✅ Uploaded: ${thumbResult.uploaded}`)
  console.log(`    ❌ Failed: ${thumbResult.failed}`)

  const totalErrors = [...coverResult.errors, ...thumbResult.errors]
  if (totalErrors.length > 0) {
    console.log('\n  Errors:')
    totalErrors.slice(0, 10).forEach(err => {
      console.log(`    - ${err}`)
    })
    if (totalErrors.length > 10) {
      console.log(`    ... and ${totalErrors.length - 10} more`)
    }
  }

  // Show base URL
  const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`
  console.log(`\n  Base URL: ${baseUrl}`)
  console.log(`  Example:  ${baseUrl}/cover/example.webp`)

  if (isDryRun) {
    log.warning('Dry run complete. No files were uploaded.')
  } else {
    log.success('Upload complete!')
  }
}

main().catch(err => {
  log.error(`Fatal error: ${err}`)
  process.exit(1)
})
