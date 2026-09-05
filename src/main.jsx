import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
)
