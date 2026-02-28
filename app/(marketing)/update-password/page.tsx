// This page is intentionally NOT a server component — the auth session
// from a password-reset link may arrive via a hash fragment or a fresh
// cookie that hasn't propagated to the server yet (common on iOS Safari).
// All auth gating is handled client-side in UpdatePasswordForm.
export { UpdatePasswordForm as default } from './update-password-form'
