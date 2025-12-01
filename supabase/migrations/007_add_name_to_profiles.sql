-- Add name, email, and avatar_url columns to profiles table
-- These are frequently accessed fields that benefit from being direct columns

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add index for name searches
CREATE INDEX IF NOT EXISTS profiles_name_idx ON profiles(name);

-- Seed email and name from auth.users
-- Name is derived from the email (part before @)
UPDATE profiles p
SET 
  email = u.email,
  name = COALESCE(
    p.basic_info->>'name',                          -- First: use existing name from basic_info
    SPLIT_PART(u.email, '@', 1)                     -- Fallback: extract name from email
  ),
  avatar_url = COALESCE(
    p.avatar_url,
    u.raw_user_meta_data->>'avatar_url'             -- Try to get avatar from auth metadata
  )
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.name IS NULL);

-- Comment on columns
COMMENT ON COLUMN profiles.name IS 'User display name';
COMMENT ON COLUMN profiles.email IS 'User email (synced from auth.users)';
COMMENT ON COLUMN profiles.avatar_url IS 'User avatar image URL';
