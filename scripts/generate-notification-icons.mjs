/**
 * Generate PNG notification icons from SVG using sharp
 * Run: npm install sharp (if not already installed)
 * Then: node scripts/generate-notification-icons.js
 */

import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

async function generateIcons() {
  console.log('🎨 Generating notification icons...\n')

  const icons = [
    { input: 'icon-192x192.svg', output: 'icon-192x192.png', size: 192 },
    { input: 'badge-72x72.svg', output: 'badge-72x72.png', size: 72 },
  ]

  for (const icon of icons) {
    const inputPath = join(projectRoot, 'public', 'icons', icon.input)
    const outputPath = join(projectRoot, 'public', 'icons', icon.output)

    if (!existsSync(inputPath)) {
      console.log(`❌ ${icon.input} not found`)
      continue
    }

    try {
      await sharp(inputPath)
        .resize(icon.size, icon.size)
        .png({ quality: 100 })
        .toFile(outputPath)
      
      console.log(`✅ Created ${icon.output} (${icon.size}x${icon.size})`)
    } catch (error) {
      console.error(`❌ Error creating ${icon.output}:`, error.message)
    }
  }

  console.log('\n✨ Icon generation complete!')
}

generateIcons()
