import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAuth } from './services/auth'
import { captureAttribution } from './lib/attribution'

// Restore the session from the refresh cookie while the first route loads.
void initAuth()
// Remember UTM tags and referrer from the landing page for the marketing forms.
captureAttribution()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
