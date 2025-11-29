import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const BUCKET_NAME = 'recipe-images'
const IMAGE_SIZE = { width: 800, height: 600 }

// Create a service role client for storage operations (bypasses RLS)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  
  return createServiceClient(supabaseUrl, serviceRoleKey)
}

/**
 * POST /api/upload/recipe-image
 * 
 * Uploads a recipe image (optimized and resized).
 * 
 * Request body: FormData with:
 * - image: File - the image to upload
 * - recipeId: string - the recipe ID to associate with the image
 * 
 * Response:
 * - image_url: string - URL of the uploaded image
 */
export async function POST(request: NextRequest) {
  try {
    // Use regular client for auth check
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    const recipeId = formData.get('recipeId') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    if (!recipeId) {
      return NextResponse.json(
        { error: 'Recipe ID is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Resize and optimize image (800x600, WebP format)
    const optimizedBuffer = await sharp(buffer)
      .resize(IMAGE_SIZE.width, IMAGE_SIZE.height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer()

    // Generate unique filename with timestamp
    // Uses 'cover/' prefix to match existing bucket structure
    const timestamp = Date.now()
    const imagePath = `cover/${recipeId}_${timestamp}.webp`

    // Use service role client for storage upload (bypasses RLS)
    const serviceClient = getServiceClient()
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET_NAME)
      .upload(imagePath, optimizedBuffer, {
        contentType: 'image/webp',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: `Failed to upload image: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}`
    const imageUrl = `${baseUrl}/${imagePath}`

    return NextResponse.json({
      image_url: imageUrl,
    })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    )
  }
}
