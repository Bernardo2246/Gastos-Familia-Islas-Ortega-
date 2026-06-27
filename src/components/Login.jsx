import { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function Login() {
  const { signIn } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (e2) {
      setErr(e2.message || 'No se pudo iniciar sesión')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <div className="logo">💰</div>
      <h1>Gastos Familia</h1>
      <p>Inicia sesión con la cuenta familiar.</p>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label>Correo</label>
          <input className="input" type="email" value={email} autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
