'use client'

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, Copy, Check, RefreshCw, Loader2, ShieldAlert } from 'lucide-react'
import { adminResetUserPassword } from '@/lib/actions/admin-auth'
import type { UserWithProfile } from '@/lib/actions/users'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ResetPasswordDialogProps {
  user: UserWithProfile | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (userId: string) => void
}

/** Characters used when building a temporary password */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // removed I, O to avoid confusion
const LOWER = 'abcdefghjkmnpqrstuvwxyz'  // removed i, l, o
const DIGITS = '23456789'                 // removed 0, 1 to avoid confusion
const SPECIAL = '!@#$'

function cryptoRandom(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

function generatePassword(): string {
  // Guarantee at least one character from each set
  const pick = (chars: string) => chars[cryptoRandom(chars.length)]

  const mandatory = [
    pick(UPPER),
    pick(UPPER),
    pick(LOWER),
    pick(LOWER),
    pick(DIGITS),
    pick(DIGITS),
    pick(SPECIAL),
  ]

  const all = UPPER + LOWER + DIGITS + SPECIAL
  const extra = Array.from({ length: 5 }, () => pick(all))

  // Shuffle all characters using Fisher-Yates with crypto random
  const combined = [...mandatory, ...extra]
  for (let i = combined.length - 1; i > 0; i--) {
    const j = cryptoRandom(i + 1)
    ;[combined[i], combined[j]] = [combined[j], combined[i]]
  }

  return combined.join('')
}

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState(() => generatePassword())
  const [copied, setCopied] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  const regenerate = useCallback(() => {
    setPassword(generatePassword())
    setCopied(false)
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy password')
    }
  }

  async function handleReset() {
    if (!user) return
    setIsResetting(true)

    const result = await adminResetUserPassword(user.id, password)

    if (!result.success) {
      toast.error(result.error || 'Failed to reset password')
      setIsResetting(false)
      return
    }

    setResetDone(true)
    setIsResetting(false)
    toast.success('Password reset successfully ⚡')
    onSuccess?.(user.id)
  }

  function handleClose() {
    onOpenChange(false)
  }

  const displayName =
    user?.profile?.name ||
    user?.profile?.basic_info?.name ||
    user?.profile?.email ||
    'this user'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle>Reset Password</DialogTitle>
          </div>
          <DialogDescription>
            {resetDone ? (
              'The temporary password has been set. The user will be prompted to change it on next login.'
            ) : (
              <>
                Set a temporary password for{' '}
                <span className="font-medium text-foreground">{displayName}</span>.
                They will be required to change it when they next log in.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {resetDone ? (
          /* ─── Success state ─────────────────────────────────────── */
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Temporary password
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-background border rounded-md px-3 py-2 select-all">
                  {password}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className={cn(
                    'shrink-0 transition-colors',
                    copied && 'border-primary text-primary'
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this password with the user securely. They will be forced to set a new
                password on their next login.
              </p>
            </div>
          </div>
        ) : (
          /* ─── Pre-reset state ───────────────────────────────────── */
          <div className="space-y-4 py-2">
            {/* Warning banner */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">
                This will immediately override the user&apos;s current password and require them to
                set a new one on next login.
              </p>
            </div>

            {/* Generated password */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Generated temporary password</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={password}
                  className="font-mono text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className={cn(
                    'shrink-0 transition-colors',
                    copied && 'border-primary text-primary'
                  )}
                  title="Copy password"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={regenerate}
                  className="shrink-0"
                  title="Regenerate password"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the field to select all, or use the copy button.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {resetDone ? (
            <Button onClick={handleClose} className="w-full sm:w-auto">
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isResetting}>
                Cancel
              </Button>
              <Button
                onClick={handleReset}
                disabled={isResetting || !password}
                className="gap-2"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Resetting…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
