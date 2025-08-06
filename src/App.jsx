import { useState, useEffect, useCallback } from 'react'
import { usePrivy, useLoginWithEmail } from '@privy-io/react-auth'
import { useCreateWallet } from '@privy-io/react-auth/extended-chains'
import { TonClient, fromNano, Address } from '@ton/ton'
import './App.css'

function App() {
  const { authenticated, user, logout, ready } = usePrivy()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const { createWallet } = useCreateWallet()
  
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [tonBalance, setTonBalance] = useState('0')
  const [tonAddress, setTonAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [walletLoading, setWalletLoading] = useState(false)

  const fetchTonBalance = useCallback(async (address) => {
    try {
      const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
      })

      // Parse the address string to TON Address object
      const tonAddr = Address.parse(address)

      const balance = await client.getBalance(tonAddr)
      console.log('Balance:', balance.toString(), 'nanoTON')
      setTonBalance(fromNano(balance))
    } catch (error) {
      console.error('Error fetching balance:', error)
      setTonBalance('0')
    }
  }, [])

  const checkForTonWallet = useCallback(async () => {
    // Check if user has a TON wallet in their linked accounts
    const tonWallet = user?.linkedAccounts?.find(account => 
      account.type === 'wallet' && account.chainType === 'ton'
    )
    
    if (tonWallet) {
      console.log('Found existing TON wallet:', tonWallet)
      setTonAddress(tonWallet.address)
      await fetchTonBalance(tonWallet.address)
    } else {
      console.log('No TON wallet found')
    }
  }, [user, fetchTonBalance])

  const createTonWallet = async () => {
    setWalletLoading(true)
    setWalletError('')
    try {
      console.log('Creating TON wallet...')
      const { wallet } = await createWallet({ chainType: 'ton' })
      console.log('TON wallet created:', wallet)
      
      setTonAddress(wallet.address)
      await fetchTonBalance(wallet.address)
    } catch (error) {
      console.error('Error creating TON wallet:', error)
      setWalletError(error.message || 'Failed to create TON wallet')
    } finally {
      setWalletLoading(false)
    }
  }

  useEffect(() => {
    if (authenticated && ready && user) {
      checkForTonWallet()
    }
  }, [authenticated, ready, user, checkForTonWallet])

  const handleSendCode = async () => {
    setLoading(true)
    try {
      await sendCode({ email })
      setIsCodeSent(true)
    } catch (error) {
      console.error('Error sending code:', error)
    }
    setLoading(false)
  }

  const handleLogin = async () => {
    setLoading(true)
    try {
      await loginWithCode({ code, email })
    } catch (error) {
      console.error('Error logging in:', error)
    }
    setLoading(false)
  }

  if (!authenticated) {
    return (
      <div className="App">
        <h1>Privy + TON Wallet</h1>
        <div className="auth-container">
          {!isCodeSent ? (
            <>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button onClick={handleSendCode} disabled={!email || loading}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button onClick={handleLogin} disabled={!code || loading}>
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="App">
      <h1>TON Wallet</h1>
      <div className="wallet-info">
        <p>Email: {user?.email?.address}</p>
        {walletLoading && <p>Creating wallet...</p>}
        {walletError && <p style={{color: 'red'}}>Error: {walletError}</p>}
        {tonAddress ? (
          <>
            <p>TON Address: {tonAddress}</p>
            <p>Balance: {tonBalance} TON</p>
          </>
        ) : (
          !walletLoading && (
            <button onClick={createTonWallet}>Create TON Wallet</button>
          )
        )}
        <button onClick={logout}>Logout</button>
      </div>
    </div>
  )
}

export default App