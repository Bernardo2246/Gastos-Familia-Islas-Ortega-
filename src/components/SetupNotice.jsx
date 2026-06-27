export default function SetupNotice() {
  return (
    <div className="center-screen">
      <div className="logo">🔧</div>
      <h1>Falta configurar Supabase</h1>
      <p>Crea el archivo <strong>.env.local</strong> en la raíz del proyecto con:</p>
      <div className="code">{`VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key`}</div>
      <p>Luego reinicia el servidor de desarrollo. Los valores están en Supabase &gt; Project Settings &gt; API.</p>
    </div>
  )
}
