#!/usr/bin/env tsx
/**
 * Storage Images Integrity Audit Script
 * 
 * Checks for orphaned images in Supabase Storage that don't have matching recipes.
 * 
 * Usage:
 *   npx tsx scripts/audit-storage-images.ts           # Audit only
 *   npx tsx scripts/audit-storage-images.ts --delete  # Delete orphaned images
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })

const BUCKET_NAME = 'recipe-images'

// =============================================================================
// Helpers
// =============================================================================

const log = {
  header: (msg: string) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`),
  subheader: (msg: string) => console.log(`\n${msg}\n${'-'.repeat(40)}`),
  info: (msg: string) => console.log(`  ℹ️  ${msg}`),
  success: (msg: string) => console.log(`  ✅ ${msg}`),
  warning: (msg: string) => console.log(`  ⚠️  ${msg}`),
  error: (msg: string) => console.log(`  ❌ ${msg}`),
}

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey)
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2)
  const shouldDelete = args.includes('--delete')

  log.header(`Storage Images Integrity Audit ${shouldDelete ? '(DELETE MODE)' : '(AUDIT ONLY)'}`)

  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    log.error('NEXT_PUBLIC_SUPABASE_URL is not set')
    process.exit(1)
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.error('SUPABASE_SERVICE_ROLE_KEY is not set')
    process.exit(1)
  }

  const supabase = createServiceClient()

  // 1. Get all recipes from database
  log.subheader('Loading recipes from database...')
  
  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('id, image_url')

  if (recipesError) {
    log.error(`Failed to fetch recipes: ${recipesError.message}`)
    process.exit(1)
  }

  const recipeImageUrls = new Set(
    recipes
      .filter(r => r.image_url)
      .map(r => r.image_url as string)
  )
  
  log.info(`Found ${recipes.length} recipes in database`)
  log.info(`${recipeImageUrls.size} recipes have image_url set`)

  // 2. List all files in storage bucket
  log.subheader('Loading images from storage...')

  const folders = ['cover', 'thumb']
  const allStorageFiles: { folder: string; name: string; path: string }[] = []

  for (const folder of folders) {
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, { limit: 10000 })

    if (listError) {
      log.error(`Failed to list ${folder}/: ${listError.message}`)
      continue
    }

    if (files) {
      for (const file of files) {
        if (file.name.endsWith('.webp')) {
          allStorageFiles.push({
            folder,
            name: file.name,
            path: `${folder}/${file.name}`,
          })
        }
      }
    }
  }

  log.info(`Found ${allStorageFiles.length} images in storage`)

  // 3. Check for orphaned images (in storage but URL not referenced by any recipe)
  log.subheader('Checking for orphaned images...')

  const orphanedImages: { path: string; reason: string }[] = []
  const validImages: string[] = []
  const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`

  for (const file of allStorageFiles) {
    const fullUrl = `${baseUrl}/${file.path}`

    // Check if this URL is referenced by any recipe's image_url
    if (recipeImageUrls.has(fullUrl)) {
      validImages.push(file.path)
    } else {
      orphanedImages.push({ path: file.path, reason: 'Not referenced by any recipe' })
    }
  }

  // 4. Check for missing images (referenced in DB but not in storage)
  log.subheader('Checking for missing images...')

  const missingImages: { recipeId: string; url: string }[] = []

  for (const recipe of recipes) {
    if (recipe.image_url) {
      // Extract the path from the URL
      const urlPath = recipe.image_url.replace(`${baseUrl}/`, '')
      const file = allStorageFiles.find(f => f.path === urlPath)
      
      if (!file) {
        missingImages.push({ recipeId: recipe.id, url: recipe.image_url })
      }
    }
  }

  // 5. Summary
  log.header('Audit Summary')

  console.log(`\n  Total images in storage: ${allStorageFiles.length}`)
  console.log(`  Valid images: ${validImages.length}`)
  console.log(`  Orphaned images: ${orphanedImages.length}`)
  console.log(`  Missing images (in DB, not in storage): ${missingImages.length}`)

  if (orphanedImages.length > 0) {
    log.subheader('Orphaned Images')
    orphanedImages.slice(0, 20).forEach(img => {
      console.log(`    ${img.path}`)
      console.log(`      Reason: ${img.reason}`)
    })
    if (orphanedImages.length > 20) {
      console.log(`    ... and ${orphanedImages.length - 20} more`)
    }

    // Calculate size
    const orphanedPaths = orphanedImages.map(i => i.path)
    
    if (shouldDelete) {
      log.subheader('Deleting orphaned images...')
      
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(orphanedPaths)

      if (deleteError) {
        log.error(`Failed to delete: ${deleteError.message}`)
      } else {
        log.success(`Deleted ${orphanedImages.length} orphaned images`)
      }
    } else {
      log.warning(`Run with --delete to remove orphaned images`)
    }
  }

  if (missingImages.length > 0) {
    log.subheader('Missing Images (recipes with broken image_url)')
    missingImages.slice(0, 10).forEach(img => {
      console.log(`    Recipe: ${img.recipeId}`)
      console.log(`    URL: ${img.url}`)
    })
    if (missingImages.length > 10) {
      console.log(`    ... and ${missingImages.length - 10} more`)
    }
    log.warning('Consider clearing image_url for these recipes or re-uploading images')
  }

  if (orphanedImages.length === 0 && missingImages.length === 0) {
    log.success('Storage is clean! No issues found.')
  }

  console.log('')
}

main().catch(console.error)
