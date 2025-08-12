import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Omniston, OmnistonProvider } from '@ston-fi/omniston-sdk-react'
import './index.css'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const omniston = new Omniston({ apiUrl: "wss://omni-ws.ston.fi" })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        loginMethods: ['email']
      }}
    >
      <QueryClientProvider client={queryClient}>
        <OmnistonProvider omniston={omniston}>
          <App />
        </OmnistonProvider>
      </QueryClientProvider>
    </PrivyProvider>
  </StrictMode>,
)
