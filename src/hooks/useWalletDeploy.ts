import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSignRawHash } from '@privy-io/react-auth/extended-chains'
import { internal, toNano, SendMode } from '@ton/ton'
import { useTonWallet } from './useTonWallet'
import { getTonClient } from '../utils/tonClient'
import { prepareTonWallet, createTonSigner, getWalletSeqno, checkWalletState, retry } from '../utils/tonWallet'

export const useWalletDeploy = () => {
  const { user, getAccessToken } = usePrivy()
  const { address: walletAddress, refetchBalance } = useTonWallet()
  const { signRawHash } = useSignRawHash()
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployError, setDeployError] = useState<Error | null>(null)
  
  const tonWallet = user?.linkedAccounts?.find(
    account => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ton'
  )
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

  const deployWallet = useCallback(async () => {
    if (!walletAddress || !tonWallet) {
      setDeployError(new Error('No wallet connected'))
      return false
    }

    setIsDeploying(true)
    setDeployError(null)

    try {
      const authToken = await getAccessToken()
      const { wallet } = await prepareTonWallet(tonWallet, walletAddress, privyAppId, authToken || undefined)
      
      const client = getTonClient()
      const contract = client.open(wallet)
      
      const contractState = await client.getContractState(wallet.address)
      if (contractState.state === 'active') {
        return true
      }

      const deployAmount = toNano('0.05')
      const currentBalance = await client.getBalance(wallet.address)
      
      if (currentBalance < deployAmount) {
        throw new Error(
          `Insufficient balance for deployment. Need at least 0.05 TON, but have ${(Number(currentBalance) / 1e9).toFixed(4)} TON`
        )
      }

      const seqno = await getWalletSeqno(contract)
      const signer = createTonSigner(signRawHash, walletAddress)
      
      const message = await contract.createTransfer({
        seqno,
        messages: [
          internal({
            value: toNano('0.01'),
            to: wallet.address,
            body: 'Initialize wallet',
          })
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        signer
      })
      
      await contract.send(message)
      
      await retry(async () => {
        const newState = await client.getContractState(wallet.address)
        if (newState.state !== 'active') {
          throw new Error('Wallet not yet active')
        }
      }, { retries: 10, delay: 2000 })
      
      await refetchBalance()
      return true
    } catch (err) {
      setDeployError(err as Error)
      return false
    } finally {
      setIsDeploying(false)
    }
  }, [walletAddress, tonWallet, getAccessToken, privyAppId, signRawHash, refetchBalance])

  return {
    deployWallet,
    isDeploying,
    deployError,
    checkWalletState: useCallback(() => walletAddress ? checkWalletState(walletAddress) : Promise.resolve(null), [walletAddress])
  }
}