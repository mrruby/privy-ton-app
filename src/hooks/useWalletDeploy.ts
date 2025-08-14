import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSignRawHash } from '@privy-io/react-auth/extended-chains'
import { internal, toNano, Address, Cell } from '@ton/ton'
import { toHex } from 'viem'
import { useTonWallet } from './useTonWallet'
import { getTonClient } from '../utils/tonClient'
import { getWalletPublicKey } from '../utils/privyApi'
import { deriveTonWalletFromPublicKey } from '../utils/tonAddress'

export const useWalletDeploy = () => {
  const { user, getAccessToken } = usePrivy()
  const { address: walletAddress, balance, refetchBalance } = useTonWallet()
  const { signRawHash } = useSignRawHash()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployError, setDeployError] = useState<Error | null>(null)
  
  // Get TON wallet from Privy linked accounts
  const tonWallet = user?.linkedAccounts?.find(
    account => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ton'
  )
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

  const checkWalletState = useCallback(async () => {
    if (!walletAddress) return null
    
    try {
      const client = getTonClient()
      const state = await client.getContractState(Address.parse(walletAddress))
      return state
    } catch (error) {
      console.error('Failed to check wallet state:', error)
      return null
    }
  }, [walletAddress])

  // Helper function to wait for wallet to be ready for signing
  const waitForWalletReady = useCallback(async (maxAttempts = 10, delayMs = 1000) => {
    console.log('Checking if wallet is ready for signing...')
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Try a test sign operation with a dummy hash
        const testHash = '0x' + '0'.repeat(64)
        console.log(`Attempt ${attempt}: Testing wallet signing capability...`)
        
        await signRawHash({
          address: walletAddress!,
          chainType: 'ton',
          hash: testHash
        })
        
        console.log('Wallet is ready for signing!')
        return true
      } catch (error) {
        console.log(`Attempt ${attempt} failed:`, (error as any)?.message)
        
        if (attempt < maxAttempts) {
          console.log(`Waiting ${delayMs}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }
    
    console.error('Wallet failed to become ready after all attempts')
    return false
  }, [walletAddress, signRawHash])

  const deployWallet = useCallback(async () => {
    console.log('=== Starting wallet deployment ===')
    console.log('Wallet address:', walletAddress)
    console.log('TON wallet object:', tonWallet)
    
    if (!walletAddress || !tonWallet) {
      const error = new Error('No wallet connected')
      console.error('Deployment failed:', error.message)
      setDeployError(error)
      return false
    }

    // Check if this is an embedded wallet
    const isEmbeddedWallet = tonWallet.type === 'wallet' && 
      !(tonWallet as any).imported && 
      !(tonWallet as any).delegated
    
    if (!isEmbeddedWallet) {
      const error = new Error(
        'This appears to be an imported or delegated wallet, not a Privy embedded wallet. ' +
        'Wallet deployment is currently only supported with Privy embedded wallets. ' +
        'Current wallet: imported=' + (tonWallet as any).imported + ', delegated=' + (tonWallet as any).delegated
      )
      console.error('Deployment failed:', error.message)
      setDeployError(error)
      return false
    }

    setIsDeploying(true)
    setDeployError(null)

    try {
      // Wait for wallet to be ready for signing
      const isWalletReady = await waitForWalletReady()
      if (!isWalletReady) {
        throw new Error(
          'Wallet is not ready for signing operations. ' +
          'This is a known issue with Privy embedded wallets. ' +
          'Please try refreshing the page and reconnecting your wallet.'
        )
      }
      // Check if wallet has id field
      console.log('Checking wallet ID...')
      const walletId = (tonWallet as any).id
      console.log('Wallet ID:', walletId)
      
      if (!walletId) {
        throw new Error('Unable to find wallet ID in TON wallet')
      }

      // Get the public key from Privy
      console.log('Getting access token...')
      const authToken = await getAccessToken()
      console.log('Auth token obtained:', !!authToken)
      
      console.log('Fetching public key from Privy API...')
      const publicKey = await getWalletPublicKey(
        walletId, 
        privyAppId,
        authToken || undefined
      )
      console.log('Public key:', publicKey)

      // Derive wallet from public key
      console.log('Deriving wallet from public key...')
      const { wallet, address: derivedAddress } = deriveTonWalletFromPublicKey(publicKey)
      console.log('Derived wallet address:', derivedAddress)
      console.log('Wallet contract:', wallet)
      
      const client = getTonClient()
      console.log('TON client created')
      
      if (derivedAddress !== walletAddress) {
        console.warn('WARNING: Derived address does not match Privy wallet address!')
        console.warn(`Derived: ${derivedAddress}`)
        console.warn(`Expected: ${walletAddress}`)
        console.warn('This might be an issue with Privy address derivation. Proceeding with Privy address...')
        
        // Use Privy's address instead of derived one
        wallet.address = Address.parse(walletAddress)
      }
      
      console.log('Opening wallet contract...')
      const contract = client.open(wallet)
      console.log('Contract opened:', contract)
      
      // Check current state
      console.log('Checking contract state...')
      const contractState = await client.getContractState(wallet.address)
      console.log('Contract state:', contractState)
      
      if (contractState.state === 'active') {
        console.log('Wallet is already deployed')
        return true
      }

      // Get seqno (should be 0 for undeployed wallet)
      console.log('Getting sequence number...')
      let seqno = 0
      try {
        seqno = await contract.getSeqno()
        console.log('Current seqno:', seqno)
      } catch (seqnoError) {
        // Expected to fail for undeployed wallet
        console.log('Failed to get seqno (expected for undeployed wallet):', seqnoError)
        seqno = 0
      }

      // Create deployment transaction
      // For V4 wallet, we need to send at least one message to deploy
      // We'll send a small amount to ourselves
      const deployAmount = toNano('0.05') // 0.05 TON for deployment
      console.log('Required deployment amount:', deployAmount.toString(), 'nano')
      
      // Check if we have enough balance in nano
      console.log('Checking wallet balance...')
      const currentBalance = await client.getBalance(wallet.address)
      console.log('Current balance:', currentBalance.toString(), 'nano')
      console.log('Current balance in TON:', (Number(currentBalance) / 1e9).toFixed(4))
      
      if (currentBalance < deployAmount) {
        throw new Error(
          `Insufficient balance for deployment. Need at least 0.05 TON, but have ${(Number(currentBalance) / 1e9).toFixed(4)} TON`
        )
      }

      // Create deployment transaction with signer callback
      console.log('Creating deployment transaction...')
      console.log('Wallet address for message:', wallet.address.toString())
      
      let message
      try {
        message = await contract.createTransfer({
          seqno,
          messages: [
            internal({
              value: toNano('0.01'), // Small amount to self
              to: wallet.address,
              body: 'Initialize wallet',
            })
          ],
          signer: async (msg: Cell) => {
            console.log('=== Signing message ===')
            const hash = msg.hash()
            const hexHash = toHex(hash)
            console.log('Message hash:', hexHash)
            
            // Sign using Privy SDK
            console.log('Calling signRawHash with:')
            console.log('- Address:', walletAddress)
            console.log('- Chain type: ton')
            console.log('- Hash:', hexHash)
            
            let signature
            try {
              const signResult = await signRawHash({
                address: walletAddress,
                chainType: 'ton',
                hash: hexHash
              })
              signature = signResult.signature
              console.log('Signature received:', signature)
            } catch (signError) {
              console.error('Sign error details:', signError)
              console.error('Sign error message:', (signError as any)?.message)
              console.error('Sign error stack:', (signError as any)?.stack)
              
              // Check if it's the wallet proxy error
              if ((signError as any)?.message?.includes('Wallet proxy not initialized')) {
                throw new Error(
                  'Privy wallet is not ready for signing. This might be a timing issue. ' +
                  'Please try again in a few seconds, or refresh the page and reconnect your wallet.'
                )
              }
              throw signError
            }
            
            // Return signature as Buffer (remove 0x prefix)
            const sigBuffer = Buffer.from(signature.slice(2), 'hex')
            console.log('Signature buffer length:', sigBuffer.length)
            return sigBuffer
          },
        })
        
        console.log('Message created successfully:', message)
      } catch (messageError) {
        console.error('Failed to create message:', messageError)
        throw messageError
      }
      
      // Send deployment transaction
      console.log('Sending deployment transaction...')
      try {
        await contract.send(message)
        console.log('Wallet deployment transaction sent!')
      } catch (sendError) {
        console.error('Failed to send deployment transaction:', sendError)
        throw sendError
      }
      
      // Wait a bit for deployment to process
      console.log('Waiting for deployment to process...')
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Check deployment status
      console.log('Checking deployment status...')
      const newState = await client.getContractState(wallet.address)
      console.log('New contract state:', newState)
      
      if (newState.state === 'active') {
        console.log('Wallet deployed successfully!')
        await refetchBalance()
        return true
      } else {
        console.warn('Deployment transaction sent but wallet still not active')
        console.warn('Final state:', newState)
        return false
      }

    } catch (err) {
      console.error('=== Deployment error ===')
      console.error('Error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('Error message:', err instanceof Error ? err.message : String(err))
      console.error('Full error:', err)
      
      setDeployError(err as Error)
      return false
    } finally {
      console.log('=== Deployment process finished ===')
      setIsDeploying(false)
    }
  }, [walletAddress, tonWallet, balance, getAccessToken, privyAppId, signRawHash, waitForWalletReady, refetchBalance])

  return {
    deployWallet,
    isDeploying,
    deployError,
    checkWalletState,
  }
}