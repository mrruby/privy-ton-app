import { usePrivy } from '@privy-io/react-auth'
import { useCreateWallet } from '@privy-io/react-auth/extended-chains'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromNano, Address } from '@ton/ton'
import { getTonClient } from '../utils/tonClient'

const tonClient = getTonClient()

const fetchBalance = async (address: string): Promise<string> => {
  const tonAddr = Address.parse(address)
  const balance = await tonClient.getBalance(tonAddr)
  return fromNano(balance)
}

export const useTonWallet = () => {
  const { user } = usePrivy()
  const { createWallet } = useCreateWallet()
  const queryClient = useQueryClient()

  // Find existing TON wallet
  const tonWallet = user?.linkedAccounts?.find(
    account => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ton'
  )

  const walletAddress = tonWallet && 'address' in tonWallet ? tonWallet.address : undefined

  // Query for balance
  const { data: balance = '0', isLoading: isLoadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['tonBalance', walletAddress],
    queryFn: () => fetchBalance(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 2
  })

  // Mutation for creating wallet
  const createWalletMutation = useMutation({
    mutationFn: async () => {
      const { wallet } = await createWallet({ chainType: 'ton' })
      return wallet
    },
    onSuccess: (wallet) => {
      // Invalidate user query to refresh wallet list
      queryClient.invalidateQueries({ queryKey: ['tonBalance', wallet.address] })
    }
  })

  return {
    address: walletAddress || createWalletMutation.data?.address,
    balance,
    isLoadingBalance,
    refetchBalance,
    createWallet: createWalletMutation.mutate,
    isCreatingWallet: createWalletMutation.isPending,
    createWalletError: createWalletMutation.error,
    hasWallet: !!walletAddress || !!createWalletMutation.data
  }
}