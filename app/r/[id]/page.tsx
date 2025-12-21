import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChefHat, Clock, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShareRecipeButton } from '@/components/recipes/share-recipe-button'
import { getSiteUrl, toAbsoluteUrl } from '@/lib/utils/site-url'
import type { RecipeRecord } from '@/lib/types/nutri'

type PublicRecipe = RecipeRecord & {
  recipe_ingredients: {
    id: string
    ingredient_id: string | null
    raw_name: string
    quantity: number | null
    unit: string | null
    is_spice: boolean
    is_optional: boolean
    ingredient?: {
      id: string
      name: string
      name_ar: string | null
      food_group: string | null
    } | null
  }[]
}

function normalizeInstructions(instructions: unknown): { step: number; instruction: string }[] {
  if (!Array.isArray(instructions)) return []

  return instructions
    .map((item, idx) => {
      if (typeof item === 'string') {
        return { step: idx + 1, instruction: item }
      }

      if (item && typeof item === 'object') {
        const maybe = item as { step?: number; instruction?: unknown }
        const instruction = typeof maybe.instruction === 'string' ? maybe.instruction : String(maybe.instruction ?? '')
        return { step: maybe.step ?? idx + 1, instruction }
      }

      return { step: idx + 1, instruction: String(item) }
    })
    .filter(x => x.instruction.trim().length > 0)
}

function extractUuid(raw: string): string | null {
  // Accept UUID only. If users paste extra text (e.g. "<uuid> tuna roll"), we extract the UUID.
  const m = raw.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
  return m ? m[0] : null
}

async function getPublicRecipe(recipeId: string): Promise<PublicRecipe | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('recipes')
    .select(
      `
        *,
        recipe_ingredients (
          id, ingredient_id, raw_name, quantity, unit, is_spice, is_optional,
          ingredient:ingredients!recipe_ingredients_ingredient_id_fkey (
            id, name, name_ar, food_group
          )
        )
      `
    )
    .eq('id', recipeId)
    .eq('is_public', true)
    .maybeSingle()

  if (!data) return null
  return data as unknown as PublicRecipe
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id: rawId } = await props.params
  const id = extractUuid(rawId)

  if (!id) {
    return {
      title: 'Recipe not found | Waddy Diet Master',
    }
  }

  const recipe = await getPublicRecipe(id)

  if (!recipe) {
    return {
      title: 'Recipe not found | Waddy Diet Master',
    }
  }

  const title = `${recipe.name} | Waddy Diet Master`
  const description = recipe.description || 'View this recipe and start your personalized nutrition plan.'

  const url = new URL(`/r/${id}`, getSiteUrl()).toString()

  const image = recipe.image_url ? toAbsoluteUrl(recipe.image_url) : null

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      images: image
        ? [
            {
              url: image,
              alt: recipe.name,
            },
          ]
        : [],
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : [],
    },
  }
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { id: rawId } = await params
  const id = extractUuid(rawId)

  if (!id) notFound()
  if (rawId !== id) redirect(`/r/${id}`)

  const recipe = await getPublicRecipe(id)

  if (!recipe) notFound()

  const instructions = normalizeInstructions(recipe.instructions)
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)

  const mainIngredients = (recipe.recipe_ingredients || []).filter(i => !i.is_spice)
  const spices = (recipe.recipe_ingredients || []).filter(i => i.is_spice)

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="px-4 pt-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative h-[340px] sm:h-[420px] rounded-3xl overflow-hidden border bg-muted shadow-[0_20px_60px_-30px_rgba(0,0,0,0.45)]">
            {recipe.image_url ? (
              <>
                {/* Blurred backdrop for depth */}
                <Image
                  src={recipe.image_url}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  className="object-cover scale-110 blur-2xl brightness-90 saturate-150"
                  priority
                  aria-hidden
                />

                {/* Main image */}
                <Image
                  src={recipe.image_url}
                  alt={recipe.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  quality={90}
                  className="object-cover"
                  priority
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/25 via-primary/15 to-muted">
                <div
                  className="absolute inset-0 opacity-35"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35) 0%, transparent 45%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.25) 0%, transparent 55%)',
                  }}
                />
                <ChefHat className="w-20 h-20 text-primary/40" />
              </div>
            )}

            {/* Vignette + readability gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.45)' }} />

            {/* Top-right share */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <ShareRecipeButton
                recipeId={recipe.id}
                recipeName={recipe.name}
                className="bg-background/80 backdrop-blur-md border border-border/60 shadow"
              />
            </div>

            {/* Bottom text panel */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="inline-flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-md">
                  Public recipe
                </Badge>
                {recipe.cuisine && (
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-md">
                    {recipe.cuisine}
                  </Badge>
                )}
              </div>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold font-arabic text-white drop-shadow-lg">
                {recipe.name}
              </h1>
              {recipe.description && (
                <p className="mt-2 text-sm sm:text-base text-white/90 max-w-prose">
                  {recipe.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 pb-28 max-w-3xl mx-auto">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
          {totalTime > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {totalTime} min
            </span>
          )}
          {recipe.nutrition_per_serving?.calories != null && (
            <span className="inline-flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              {recipe.nutrition_per_serving.calories} cal / serving
            </span>
          )}
        </div>

        {/* Ingredients */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ingredients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mainIngredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ingredients listed.</p>
            ) : (
              <ul className="space-y-2">
                {mainIngredients.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-arabic">
                        {i.ingredient?.name_ar || i.ingredient?.name || i.raw_name}
                        {i.is_optional && (
                          <span className="text-xs text-muted-foreground"> (optional)</span>
                        )}
                      </div>
                      {i.ingredient?.food_group && (
                        <div className="text-xs text-muted-foreground">{i.ingredient.food_group}</div>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono whitespace-nowrap">
                      {i.quantity ?? '—'}{i.unit || ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {spices.length > 0 && (
              <div className="pt-2">
                <div className="text-sm font-medium text-muted-foreground mb-2">Spices & Seasonings</div>
                <div className="flex flex-wrap gap-2">
                  {spices.map((s) => (
                    <Badge key={s.id} variant="outline" className="font-arabic">
                      {s.ingredient?.name_ar || s.ingredient?.name || s.raw_name}
                      {s.quantity != null && s.unit && (
                        <span className="ml-1 opacity-70 font-mono text-[10px]">{s.quantity}{s.unit}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {instructions.length > 0 ? (
              <ol className="space-y-4">
                {instructions.map((step) => (
                  <li key={step.step} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold">
                      {step.step}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{step.instruction}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No instructions available.</p>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          Want a plan built around your goals?
        </div>
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
          <Button asChild className="flex-1 h-11">
            <Link href="/get-started">Get started</Link>
          </Button>
          <Button asChild variant="secondary" className="h-11">
            <Link href="/login">I have an account</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
