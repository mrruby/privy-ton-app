import { TonClient } from '@ton/ton'

export const getTonClient = () => {
  const apiKey = import.meta.env.VITE_TON_API_KEY
  
  return new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: apiKey || undefined
  })
}