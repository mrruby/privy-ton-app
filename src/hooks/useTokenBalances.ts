import { useQuery } from '@tanstack/react-query'
import { Address } from '@ton/core'
import { getTonApiClient } from '../utils/tonApiClient'

export interface TokenBalance {
  jettonAddress: string
  symbol: string
  name: string
  balance: string
  rawBalance: bigint
  decimals: number
  imageUrl?: string
}

export const useTokenBalances = (walletAddress: string | undefined) => {
  return useQuery<TokenBalance[]>({
    queryKey: ['token-balances', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return []

      try {
        const client = getTonApiClient()
        const owner = Address.parse(walletAddress)
        
        // Get all jetton balances in one call
        const response = await client.accounts.getAccountJettonsBalances(owner)
        
        // Map the response to our TokenBalance interface
        const balances: TokenBalance[] = response.balances
          .filter(b => BigInt(b.balance) > 0n) // Only non-zero balances
          .map(b => ({
            jettonAddress: b.jetton.address.toString(),
            symbol: b.jetton.symbol || 'Unknown',
            name: b.jetton.name || b.jetton.symbol || 'Unknown Token',
            balance: (Number(b.balance) / Math.pow(10, b.jetton.decimals)).toFixed(4),
            rawBalance: BigInt(b.balance),
            decimals: b.jetton.decimals,
            imageUrl: b.jetton.image
          }))
          .sort((a, b) => a.symbol.localeCompare(b.symbol)) // Sort alphabetically by symbol

        return balances
      } catch (error) {
        console.error('Error fetching token balances:', error)
        // Return empty array on error to avoid breaking the UI
        return []
      }
    },
    enabled: !!walletAddress,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000 // Refetch every minute
  })
}