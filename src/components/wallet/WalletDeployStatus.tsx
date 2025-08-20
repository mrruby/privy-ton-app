import React, { useEffect, useState, useCallback } from 'react'
import { useTonWallet } from '../../hooks/useTonWallet'
import { getTonClient } from '../../utils/tonClient'
import { Address } from '@ton/ton'
import { useWalletDeploy } from '../../hooks/useWalletDeploy'

export const WalletDeployStatus: React.FC = () => {
  const { address: walletAddress, balance, refetchBalance } = useTonWallet()
  const { deployWallet, isDeploying, deployError } = useWalletDeploy()
  const [isDeployed, setIsDeployed] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkDeployment = useCallback(async () => {
    if (!walletAddress || isChecking) return
    
    setIsChecking(true)
    try {
      const client = getTonClient()
      const state = await client.getContractState(Address.parse(walletAddress))
      const deployed = state.state === 'active'
      setIsDeployed(deployed)
      console.log('Wallet status:', state.state)
    } catch (error) {
      console.error('Failed to check wallet:', error)
      setIsDeployed(false)
    } finally {
      setIsChecking(false)
    }
  }, [walletAddress, isChecking])

  // Check deployment status on mount and when wallet/balance changes
  useEffect(() => {
    checkDeployment()
  }, [walletAddress, balance])

  // Periodic status check
  useEffect(() => {
    if (!walletAddress) return
    
    const interval = setInterval(() => {
      checkDeployment()
    }, isDeployed ? 30000 : 10000) // Check every 10s if not deployed, 30s if deployed
    
    return () => clearInterval(interval)
  }, [walletAddress, isDeployed])

  // Don't show anything if wallet is deployed or still checking
  if (!walletAddress || isDeployed === null || isDeployed) {
    return null
  }

  const hasSufficientBalance = balance && parseFloat(balance) >= 0.05
  
  const handleDeploy = () => deployWallet()
  const handleRefresh = () => {
    refetchBalance()
    checkDeployment()
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        
        <div className="flex-1 space-y-3">
          <h3 className="text-sm font-medium text-yellow-800">Wallet Not Deployed</h3>
          
          <p className="text-sm text-yellow-700">
            Your TON wallet needs to be deployed before you can make swaps.
          </p>

          {hasSufficientBalance ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-green-700">
                ✓ Your wallet has {balance} TON (minimum 0.05 TON required)
              </p>
              
              <button
                onClick={handleDeploy}
                disabled={isDeploying}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeploying ? 'Deploying Wallet...' : 'Deploy Wallet Now'}
              </button>
              
              {deployError && (
                <p className="text-sm text-red-600">{deployError.message}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-yellow-700">To deploy your wallet:</p>
              <ol className="list-decimal list-inside text-sm text-yellow-700 space-y-1">
                <li>Send at least 0.05 TON to your wallet</li>
                <li>Click "Deploy Wallet Now" once funded</li>
              </ol>
              <p className="text-xs text-yellow-600">
                Note: Deployment is a manual step required after funding.
              </p>
            </div>
          )}
          
          <div className="p-2 bg-yellow-100 rounded">
            <p className="text-xs font-medium text-yellow-800">Your wallet address:</p>
            <p className="text-xs font-mono mt-1 break-all">{walletAddress}</p>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={isChecking}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Refresh Status'}
          </button>
        </div>
      </div>
    </div>
  )
}