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
  const [lastBalance, setLastBalance] = useState(balance)

  const checkDeployment = useCallback(async () => {
    if (!walletAddress) {
      setIsDeployed(null)
      return
    }

    setIsChecking(true)
    try {
      const client = getTonClient()
      const state = await client.getContractState(Address.parse(walletAddress))
      const deployed = state.state === 'active'
      setIsDeployed(deployed)
      console.log('Wallet deployment status:', deployed ? 'deployed' : 'not deployed', 'State:', state.state)
    } catch (error) {
      console.error('Failed to check wallet deployment:', error)
      setIsDeployed(false)
    } finally {
      setIsChecking(false)
    }
  }, [walletAddress])

  // Check deployment on mount and when wallet address changes
  useEffect(() => {
    checkDeployment()
  }, [walletAddress, checkDeployment])

  // Check deployment more frequently when balance changes (funds received)
  useEffect(() => {
    if (balance !== lastBalance && parseFloat(balance) > parseFloat(lastBalance)) {
      console.log('Balance increased, checking deployment status immediately')
      setLastBalance(balance)
      checkDeployment()
      
      // Check more frequently for the next minute after balance increase
      const rapidCheckInterval = setInterval(checkDeployment, 2000) // Every 2 seconds
      const stopRapidCheck = setTimeout(() => {
        clearInterval(rapidCheckInterval)
      }, 60000) // Stop after 1 minute
      
      return () => {
        clearInterval(rapidCheckInterval)
        clearTimeout(stopRapidCheck)
      }
    }
    setLastBalance(balance)
  }, [balance, lastBalance, checkDeployment])

  // Regular interval check
  useEffect(() => {
    const interval = setInterval(checkDeployment, 10000) // Every 10 seconds
    return () => clearInterval(interval)
  }, [checkDeployment])

  if (!walletAddress || isChecking || isDeployed === null) {
    return null
  }

  if (isDeployed) {
    return null // Wallet is deployed, no need to show anything
  }

  const handleRefresh = async () => {
    await refetchBalance()
    await checkDeployment()
  }
  
  const handleDeployClick = async () => {
    await deployWallet()
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Wallet Not Deployed
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>Your TON wallet needs to be deployed before you can make swaps.</p>
            
            {balance && parseFloat(balance) >= 0.05 ? (
              <>
                <p className="mt-2 font-semibold text-green-700">
                  ✓ Your wallet has sufficient balance ({balance} TON)
                </p>
                <p className="mt-1">Click the button below to deploy your wallet now:</p>
                
                <button
                  onClick={handleDeployClick}
                  disabled={isDeploying}
                  className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeploying ? 'Deploying Wallet...' : 'Deploy Wallet Now'}
                </button>
                
                {deployError && (
                  <p className="mt-2 text-sm text-red-600">{deployError.message}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 font-medium">To deploy your wallet:</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Send at least 0.05 TON to your wallet address</li>
                  <li>Once funded, click "Deploy Wallet Now"</li>
                </ol>
                <p className="mt-2 text-xs text-yellow-600">
                  Note: Simply receiving funds does NOT automatically deploy your wallet on TON. 
                  You must explicitly deploy it after receiving funds.
                </p>
              </>
            )}
            
            <div className="mt-3 p-2 bg-yellow-100 rounded break-all">
              <p className="text-xs font-medium text-yellow-800">Your wallet address:</p>
              <p className="text-xs font-mono mt-1">{walletAddress}</p>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={isChecking}
              className="mt-3 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? 'Checking...' : 'Check Deployment Status'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}