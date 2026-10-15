import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SessionProvider } from '@/context/session'
import { ApiError } from '@/api/client'
import { toast } from '@/components/ui/primitives'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SessionProvider onError={(e) => toast('Something went wrong', e instanceof ApiError ? e.fieldMessage ?? e.message : undefined, 'danger')}>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
