import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#151B28',
            color: '#E2E8F4',
            border: '1px solid #1E2535',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#151B28' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#151B28' } },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
