import { usePrivy } from '@privy-io/react-auth'
import { AuthForm } from './components/auth/AuthForm'
import { WalletDashboard } from './components/wallet/WalletDashboard'

function App() {
  const { authenticated } = usePrivy()
  
  return authenticated ? <WalletDashboard /> : <AuthForm />
}

export default App