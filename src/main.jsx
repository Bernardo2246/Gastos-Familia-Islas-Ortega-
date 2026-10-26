import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'

// Bloquea el pellizco (pinch-to-zoom) del contenido dentro de la PWA.
// touch-action: pan-x pan-y (index.css) ya lo cubre en iOS 17+; estos
// listeners de gesturestart son el respaldo para Safari/iOS más viejo,
// donde ese gesto se dispara aparte y touch-action no lo intercepta.
// Solo actúa sobre el documento de esta app: no afecta el zoom del
// sistema operativo (p. ej. la función de accesibilidad "Zoom") ni el
// pinch-zoom en otras apps o pestañas.
;['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault())
})

const root = createRoot(document.getElementById('root'))

// /__preview: la app con datos falsos para revisar diseño sin login. Solo en
// `npm run dev`: en el build import.meta.env.DEV es false y Vite elimina esta
// rama junto con src/dev/.
if (import.meta.env.DEV && location.pathname.startsWith('/__preview')) {
  import('./dev/Preview.jsx').then(({ default: Preview }) => root.render(
    <StrictMode>
      <MemoryRouter>
        <Preview />
      </MemoryRouter>
    </StrictMode>
  ))
} else {
  root.render(
    <StrictMode>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </StrictMode>
  )
}
