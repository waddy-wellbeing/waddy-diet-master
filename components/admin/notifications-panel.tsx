'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Send,
  Users,
  Smartphone,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  User,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { sendNotificationToUser, sendBroadcastNotification } from '@/lib/actions/notifications'

interface NotificationsPanelProps {
  stats?: {
    totalSubscriptions: number
    activeSubscriptions: number
    usersWithPushEnabled: number
    recentNotifications: number
  } | null
  users: Array<{
    user_id: string
    name: string | null
    email: string | null
    subscription_count: number
  }>
  recentLogs: Array<{
    id: string
    title: string
    body: string
    is_broadcast: boolean
    status: string
    sent_at: string
    user_id: string
  }>
}

export function NotificationsPanel({ stats, users, recentLogs }: NotificationsPanelProps) {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [sendMode, setSendMode] = useState<'single' | 'broadcast'>('single')
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

  const handleSendToUser = async () => {
    if (!selectedUser || !title || !body) return

    setIsSending(true)
    setResult(null)

    const res = await sendNotificationToUser(selectedUser, {
      title,
      body,
      url: url || undefined,
    })

    if (res.success) {
      setResult({
        type: 'success',
        message: `Sent to ${res.data?.sent} device(s)${res.data?.failed ? `, ${res.data.failed} failed` : ''}`,
      })
      setTitle('')
      setBody('')
      setUrl('')
    } else {
      setResult({ type: 'error', message: res.error })
    }

    setIsSending(false)
  }

  const handleBroadcast = async () => {
    if (!title || !body) return

    setIsSending(true)
    setResult(null)

    const res = await sendBroadcastNotification({
      title,
      body,
      url: url || undefined,
    })

    if (res.success) {
      setResult({
        type: 'success',
        message: `Broadcast sent to ${res.data?.sent}/${res.data?.total} devices`,
      })
      setTitle('')
      setBody('')
      setUrl('')
    } else {
      setResult({ type: 'error', message: res.error })
    }

    setIsSending(false)
  }

  const selectedUserData = users.find(u => u.user_id === selectedUser)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          className="bg-card rounded-xl border p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Smartphone className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</p>
              <p className="text-sm text-muted-foreground">Active Devices</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl border p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Users className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.usersWithPushEnabled || 0}</p>
              <p className="text-sm text-muted-foreground">Users with Push</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl border p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Bell className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.recentNotifications || 0}</p>
              <p className="text-sm text-muted-foreground">Sent (24h)</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl border p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Activity className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.totalSubscriptions || 0}</p>
              <p className="text-sm text-muted-foreground">Total Subscriptions</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Send Notification Section */}
      <motion.div
        className="bg-card rounded-xl border overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold flex items-center gap-2">
            <Send className="w-5 h-5" />
            Send Test Notification
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={sendMode === 'single' ? 'default' : 'outline'}
              onClick={() => setSendMode('single')}
              className="flex-1"
            >
              <User className="w-4 h-4 mr-2" />
              Single User
            </Button>
            <Button
              type="button"
              variant={sendMode === 'broadcast' ? 'default' : 'outline'}
              onClick={() => setSendMode('broadcast')}
              className="flex-1"
            >
              <Radio className="w-4 h-4 mr-2" />
              Broadcast All
            </Button>
          </div>

          {/* User Selection (for single mode) */}
          {sendMode === 'single' && (
            <div className="space-y-2">
              <Label>Select User</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors',
                    'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                    isUserDropdownOpen && 'border-primary'
                  )}
                >
                  {selectedUserData ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {(selectedUserData.name || selectedUserData.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {selectedUserData.name || 'Unnamed User'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedUserData.email || 'No email'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Choose a user...</span>
                  )}
                  <ChevronDown className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isUserDropdownOpen && 'rotate-180'
                  )} />
                </button>

                <AnimatePresence>
                  {isUserDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-2 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      {users.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No users with push subscriptions
                        </div>
                      ) : (
                        users.map(user => (
                          <button
                            key={user.user_id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user.user_id)
                              setIsUserDropdownOpen(false)
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left',
                              selectedUser === user.user_id && 'bg-primary/5'
                            )}
                          >
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {(user.name || user.email || '?')[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {user.name || 'Unnamed User'}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email || 'No email'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Smartphone className="w-3 h-3" />
                              {user.subscription_count}
                            </div>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Notification Content */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Body *</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification message"
              maxLength={500}
              rows={3}
              className={cn(
                'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
                'ring-offset-background placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'resize-none'
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Click URL (optional)</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Where users go when they click the notification
            </p>
          </div>

          {/* Result Message */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  'p-3 rounded-lg flex items-center gap-2',
                  result.type === 'success'
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                )}
              >
                {result.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 shrink-0" />
                )}
                <span className="text-sm">{result.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send Button */}
          <Button
            onClick={sendMode === 'single' ? handleSendToUser : handleBroadcast}
            disabled={
              isSending || 
              !title || 
              !body || 
              (sendMode === 'single' && !selectedUser)
            }
            className="w-full"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {sendMode === 'single' ? 'Send to User' : 'Broadcast to All'}
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Recent Notifications Log */}
      <motion.div
        className="bg-card rounded-xl border overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Notifications
          </h2>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No notifications sent yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {recentLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate">{log.title}</p>
                      {log.is_broadcast && (
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-xs rounded-full">
                          Broadcast
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {log.body}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      log.status === 'sent'
                        ? 'bg-green-500/10 text-green-500'
                        : log.status === 'failed'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {log.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.sent_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
