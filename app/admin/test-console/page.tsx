import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calculator, UtensilsCrossed, RefreshCw, ArrowRightLeft } from 'lucide-react'

export const metadata = {
  title: 'Test Console | BiteRight Admin',
  description: 'Simulate and validate the meal planning engine',
}

const tools = [
  {
    title: 'TDEE Calculator',
    description: 'Simulate TDEE calculation with different user parameters. Test BMR, activity multipliers, and goal adjustments.',
    icon: Calculator,
    href: '/admin/test-console/tdee-calculator',
    status: 'coming-soon' as const,
  },
  {
    title: 'Meal Plan Preview',
    description: 'Preview meal suggestions for any calorie target. See how recipes are selected and scaled for different meal structures.',
    icon: UtensilsCrossed,
    href: '/admin/test-console/meal-planner',
    status: 'coming-soon' as const,
  },
  {
    title: 'Recipe Alternatives',
    description: 'Test recipe filtering by meal type. See what alternatives would be shown when a user swipes to change a meal.',
    icon: RefreshCw,
    href: '/admin/test-console/alternatives',
    status: 'coming-soon' as const,
  },
  {
    title: 'Ingredient Swaps',
    description: 'Test ingredient substitution by food group. Validate swap suggestions and nutritional comparisons.',
    icon: ArrowRightLeft,
    href: '/admin/test-console/swaps',
    status: 'coming-soon' as const,
  },
]

export default function TestConsolePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Console</h1>
        <p className="text-muted-foreground">
          Simulate user scenarios to validate the meal planning engine before going live
        </p>
      </div>

      {/* Tools Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((tool) => (
          <Card key={tool.title} className="relative overflow-hidden">
            {tool.status === 'coming-soon' && (
              <div className="absolute top-3 right-3">
                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                  Coming Soon
                </span>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{tool.title}</CardTitle>
              </div>
              <CardDescription className="mt-2">
                {tool.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                disabled={tool.status === 'coming-soon'}
                asChild={tool.status !== 'coming-soon'}
              >
                {tool.status === 'coming-soon' ? (
                  <span>Coming Soon</span>
                ) : (
                  <Link href={tool.href}>Open Tool</Link>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">What is the Test Console?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The Test Console is a <strong>sandbox environment</strong> for coaches and admins to validate the meal planning engine works correctly before users see it.
          </p>
          <p>
            Use these tools to:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Verify TDEE calculations for different user profiles</li>
            <li>Preview which recipes would be suggested for specific calorie targets</li>
            <li>Test recipe filtering and alternatives by meal type</li>
            <li>Validate ingredient swap suggestions within food groups</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
