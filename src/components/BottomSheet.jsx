import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Hoja inferior: encabezado fijo y solo el cuerpo hace scroll. Cierra con el
// fondo, Escape o "Cerrar". Mientras está abierta la página de fondo no se mueve
// (cuenta hojas apiladas para no soltar el bloqueo antes de tiempo).
export default function BottomSheet({ title, onClose, children, footer }) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const root = document.documentElement
    const level = Number(root.dataset.sheets || 0) + 1
    root.dataset.sheets = String(level)
    root.classList.add('sheet-open')
    // Con hojas apiladas, Escape cierra solo la de arriba.
    const onKey = (e) => e.key === 'Escape' && Number(root.dataset.sheets) === level && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const left = Number(root.dataset.sheets || 1) - 1
      root.dataset.sheets = String(left)
      if (left <= 0) root.classList.remove('sheet-open')
    }
  }, [])

  return createPortal(
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link-btn" onClick={onClose}>Cerrar</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
