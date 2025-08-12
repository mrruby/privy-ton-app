import { TonApiClient } from '@ton-api/client'

export const getTonApiClient = () => {
  return new TonApiClient({ 
    baseUrl: 'https://tonapi.io',
  })
}