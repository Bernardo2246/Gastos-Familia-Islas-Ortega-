import { useLayoutEffect, useRef } from 'react'

// Nota/concepto que crece con el texto: un concepto largo se ve completo
// mientras se edita, en vez de cortarse en un solo renglón.
export default function NoteField({ id, value, onChange, placeholder }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return (
    <textarea ref={ref} id={id} className="input note-field" rows={1} placeholder={placeholder}
      value={value} onChange={(e) => onChange(e.target.value)} />
  )
}
