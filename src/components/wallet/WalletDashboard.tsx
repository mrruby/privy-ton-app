import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useTonWallet } from '../../hooks/useTonWallet'
import { useTokenBalances } from '../../hooks/useTokenBalances'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'
import { SwapInterface } from '../swap/SwapInterface'
import { TokenBalanceItem } from './TokenBalance'
import { WalletDeployStatus } from './WalletDeployStatus'

export const WalletDashboard: React.FC = () => {
  const { user, logout } = usePrivy()
  const [activeTab, setActiveTab] = useState<'wallet' | 'swap'>('wallet')
  const {
    address,
    balance,
    isLoadingBalance,
    refetchBalance,
    createWallet,
    isCreatingWallet,
    createWalletError,
    hasWallet
  } = useTonWallet()

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-indigo-700 mb-2">TON Wallet</h1>
          <p className="text-gray-600">Manage assets & swap tokens</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
              activeTab === 'wallet'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Wallet
          </button>
          <button
            onClick={() => setActiveTab('swap')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
              activeTab === 'swap'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            disabled={!hasWallet}
          >
            Swap
          </button>
        </div>

        <div className="space-y-6">
          {/* Common account info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Email</span>
              <span className="text-gray-800 font-medium">{user?.email?.address}</span>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'wallet' ? (
            <>
              {isCreatingWallet && <LoadingSpinner />}
              {createWalletError && <ErrorMessage error={createWalletError} />}

              {hasWallet && address ? (
                <div className="space-y-4">
                  {/* Wallet deployment status */}
                  <WalletDeployStatus />
                  
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-indigo-200">
                    <div className="space-y-4">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Wallet Address</p>
                        <p className="text-gray-800 font-mono text-xs break-all">{address}</p>
                      </div>
                      <div className="pt-2 border-t border-indigo-100">
                        <p className="text-gray-600 text-sm mb-1">Balance</p>
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold text-gray-800">{balance} TON</p>
                          {isLoadingBalance && (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-indigo-500"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Token Balances */}
                  <TokenBalancesList walletAddress={address} />

                  <button
                    onClick={() => refetchBalance()}
                    disabled={isLoadingBalance}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
                  >
                    {isLoadingBalance ? 'Refreshing...' : 'Refresh Balance'}
                  </button>
                </div>
              ) : (
                !isCreatingWallet && (
                  <button 
                    onClick={() => createWallet()}
                    className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-[1.02]"
                  >
                    Create TON Wallet
                  </button>
                )
              )}
            </>
          ) : (
            <SwapInterface onTradeComplete={() => setActiveTab('wallet')} />
          )}

          <button 
            onClick={logout}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

// Separate component for token balances to keep the main component clean
const TokenBalancesList: React.FC<{ walletAddress: string }> = ({ walletAddress }) => {
  const { data: tokenBalances = [], isLoading, error } = useTokenBalances(walletAddress)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Other Tokens</h3>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return null // Silently fail for token balances
  }

  if (tokenBalances.length === 0) {
    return null // Don't show section if no other tokens
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Other Tokens</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tokenBalances.map((tokenBalance) => (
          <TokenBalanceItem
            key={tokenBalance.jettonAddress}
            tokenBalance={tokenBalance}
          />
        ))}
      </div>
    </div>
  )
}