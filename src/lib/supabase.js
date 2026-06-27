import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase no está configurado. Copia .env.example a .env.local y agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  )
}

// Si no está configurado creamos un cliente con valores dummy para no romper
// el import; la app mostrará una pantalla de configuración en su lugar.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true },
  }
)
