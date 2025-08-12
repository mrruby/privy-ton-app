import { useQuery } from '@tanstack/react-query'
import { StonApiClient, AssetTag, type AssetInfoV2 } from '@ston-fi/api'

export const useAssets = () => {
  return useQuery<AssetInfoV2[]>({
    queryKey: ['ston-assets'],
    queryFn: async () => {
      const client = new StonApiClient()
      const condition = [
        AssetTag.LiquidityVeryHigh,
        AssetTag.LiquidityHigh,
        AssetTag.LiquidityMedium
      ].join(' | ')
      return await client.queryAssets({ condition })
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}