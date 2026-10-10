// NEXT_PUBLIC_* values are inlined at build time, so reference them directly.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Either the legacy anon key or the newer publishable key works; anon is tried
// first because it's the one verified against this project.
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
