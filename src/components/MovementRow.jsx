import { useRef, useState } from 'react'

const SWIPE_START_PX = 10
const DELETE_WIDTH_PX = 88

// Fila única de movimiento (gastos y aportaciones): concepto a la izquierda,
// monto siempre a la derecha. Tocar abre el detalle; deslizar a la izquierda
// revela "Eliminar" (con confirmación). Con mouse no hay deslizamiento: se
// elimina desde la hoja de detalle.
export function MovementRow({ title, subtitle, amount, amountClass, onOpen, onDelete, deleteConfirm = '¿Eliminar este movimiento?' }) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef(null)
  const swiped = useRef(false)

  const onPointerDown = (e) => {
    if (!onDelete || e.pointerType === 'mouse') return
    gesture.current = { x: e.clientX, y: e.clientY, base: offset, mode: 'pending' }
    swiped.current = false
  }

  const onPointerMove = (e) => {
    const g = gesture.current
    if (!g || g.mode === 'scroll') return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (g.mode === 'pending') {
      // Movimiento vertical: es scroll de la lista, no un deslizamiento.
      if (Math.abs(dy) > SWIPE_START_PX && Math.abs(dy) > Math.abs(dx)) { g.mode = 'scroll'; return }
      if (Math.abs(dx) <= SWIPE_START_PX) return
      g.mode = 'swipe'
      swiped.current = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setOffset(Math.max(-DELETE_WIDTH_PX, Math.min(0, g.base + dx)))
  }

  const onPointerEnd = () => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.mode !== 'swipe') return
    setDragging(false)
    setOffset((o) => (o < -DELETE_WIDTH_PX / 2 ? -DELETE_WIDTH_PX : 0))
  }

  const handleClick = () => {
    if (swiped.current) { swiped.current = false; return }
    // Con "Eliminar" visible, tocar la fila solo la cierra.
    if (offset !== 0) { setOffset(0); return }
    onOpen?.()
  }

  const handleDelete = () => {
    setOffset(0)
    if (confirm(deleteConfirm)) onDelete?.()
  }

  return (
    <li className="mv-row">
      {onDelete && (
        <button type="button" className="mv-delete" tabIndex={offset === 0 ? -1 : 0}
          aria-hidden={offset === 0} onClick={handleDelete}>
          Eliminar
        </button>
      )}
      <div
        className={`mv-content${dragging ? ' dragging' : ''}${onOpen ? ' tappable' : ''}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (onOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen() }
        }}
      >
        <div className="mv-main">
          <div className="mv-title">{title}</div>
          {subtitle && <div className="mv-sub">{subtitle}</div>}
        </div>
        <span className={`mv-amount${amountClass ? ` ${amountClass}` : ''}`}>{amount}</span>
        {onOpen && <span className="mv-chevron" aria-hidden="true">›</span>}
      </div>
    </li>
  )
}

// Lista de filas separadas por línea fina, dentro de un solo panel.
export function MovementList({ children, empty }) {
  const has = Array.isArray(children) ? children.some(Boolean) : Boolean(children)
  return <ul className="mv-list">{has ? children : <li className="mv-empty">{empty}</li>}</ul>
}
