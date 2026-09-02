import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/vazirmatn'
import './styles.css'
import App from './App'
import { ensureSettings } from './lib/db'
import { registerAppServiceWorker } from './lib/pwa'

void registerAppServiceWorker()

ensureSettings().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode><App /></React.StrictMode>
  )
})
