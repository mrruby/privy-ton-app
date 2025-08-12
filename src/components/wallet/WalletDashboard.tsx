import { usePrivy } from '@privy-io/react-auth'
import { useTonWallet } from '../../hooks/useTonWallet'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'

export const WalletDashboard: React.FC = () => {
  const { user, logout } = usePrivy()
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TON Wallet</h1>
          <p className="text-purple-200">Manage your TON assets</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-purple-200 text-sm">Email</span>
              <span className="text-white font-medium">{user?.email?.address}</span>
            </div>
          </div>

          {isCreatingWallet && <LoadingSpinner />}
          {createWalletError && <ErrorMessage error={createWalletError} />}

          {hasWallet && address ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-6 border border-purple-500/30">
                <div className="space-y-4">
                  <div>
                    <p className="text-purple-200 text-sm mb-1">Wallet Address</p>
                    <p className="text-white font-mono text-xs break-all">{address}</p>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <p className="text-purple-200 text-sm mb-1">Balance</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-white">{balance} TON</p>
                      {isLoadingBalance && (
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-purple-500"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => refetchBalance()}
                disabled={isLoadingBalance}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all duration-200 border border-white/20 disabled:opacity-50"
              >
                {isLoadingBalance ? 'Refreshing...' : 'Refresh Balance'}
              </button>
            </div>
          ) : (
            !isCreatingWallet && (
              <button 
                onClick={() => createWallet()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-[1.02]"
              >
                Create TON Wallet
              </button>
            )
          )}

          <button 
            onClick={logout}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all duration-200 border border-white/20"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}