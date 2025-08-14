import { WalletContractV4, Address, Cell } from '@ton/ton'
import { toHex } from 'viem'
import { getWalletPublicKey } from './privyApi'
import { deriveTonWalletFromPublicKey } from './tonAddress'
import { getTonClient } from './tonClient'

export interface TonWalletInfo {
  wallet: WalletContractV4
  walletId: string
  isEmbedded: boolean
}

export async function prepareTonWallet(
  tonWallet: any,
  walletAddress: string,
  privyAppId: string,
  authToken?: string
): Promise<TonWalletInfo> {
  const walletId = tonWallet?.id
  if (!walletId) {
    throw new Error('Unable to find wallet ID in TON wallet')
  }

  const isEmbedded = tonWallet.type === 'wallet' && 
    !tonWallet.imported && 
    !tonWallet.delegated

  if (!isEmbedded) {
    throw new Error(
      `This wallet type is not supported. Only Privy embedded wallets can be used. ` +
      `Current wallet: imported=${tonWallet.imported}, delegated=${tonWallet.delegated}`
    )
  }

  const publicKey = await getWalletPublicKey(walletId, privyAppId, authToken)
  const { wallet, address: derivedAddress } = deriveTonWalletFromPublicKey(publicKey)

  if (derivedAddress !== walletAddress) {
    const walletAtPrivyAddress = WalletContractV4.create({
      workchain: 0,
      publicKey: wallet.publicKey,
    })
    return {
      wallet: {
        ...walletAtPrivyAddress,
        address: Address.parse(walletAddress)
      } as WalletContractV4,
      walletId,
      isEmbedded
    }
  }

  return { wallet, walletId, isEmbedded }
}

export function createTonSigner(
  signRawHash: any,
  walletAddress: string
) {
  return async (msgCell: Cell) => {
    const hash = msgCell.hash()
    const hexHash = toHex(hash) as `0x${string}`
    
    return retry(async () => {
      const { signature } = await signRawHash({
        address: walletAddress,
        chainType: 'ton' as const,
        hash: hexHash
      })
      
      return Buffer.from(signature.slice(2), 'hex')
    }, { 
      retries: 3, 
      delay: 2000 
    }).catch(error => {
      if (error?.response?.status === 401) {
        throw new Error('Authentication failed. Please reconnect your wallet.')
      }
      if (error?.message?.includes('Wallet proxy not initialized')) {
        throw new Error('Wallet not ready. Please try again.')
      }
      throw error
    })
  }
}

export async function getWalletSeqno(contract: any): Promise<number> {
  try {
    return await contract.getSeqno()
  } catch {
    return 0
  }
}

export async function checkWalletState(walletAddress: string) {
  const client = getTonClient()
  return await client.getContractState(Address.parse(walletAddress))
}

export function normalizeOmnistonValue(sendAmount: string | number | bigint): bigint {
  if (typeof sendAmount === 'string') {
    return BigInt(sendAmount)
  } else if (typeof sendAmount === 'number') {
    return BigInt(sendAmount)
  }
  return sendAmount as bigint
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number } = {}
): Promise<T> {
  const { retries = 3, delay = 1000 } = options
  
  let lastError: any
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}