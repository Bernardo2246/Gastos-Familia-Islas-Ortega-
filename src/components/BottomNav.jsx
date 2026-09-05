import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', ico: '🏠', label: 'Inicio', end: true },
  { to: '/categorias', ico: '📊', label: 'Categorías' },
  { to: '/aportaciones', ico: '👥', label: 'Aportaciones' },
  { to: '/historial', ico: '🗓️', label: 'Historial' },
  { to: '/dashboard', ico: '📈', label: 'Análisis' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}>
          <span className="ico">{it.ico}</span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
