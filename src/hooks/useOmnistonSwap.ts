import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSignRawHash } from '@privy-io/react-auth/extended-chains'
import { 
  useRfq, 
  useOmniston, 
  useTrackTrade,
  SettlementMethod, 
  Blockchain, 
  GaslessSettlement,
  type QuoteResponseEvent_QuoteUpdated
} from '@ston-fi/omniston-sdk-react'
import { Address, Cell, beginCell, storeMessage, WalletContractV4, internal } from '@ton/ton'
import type { AssetInfoV2 } from '@ston-fi/api'
import { toHex } from 'viem'
import { useTonWallet } from './useTonWallet'
import { getTonClient } from '../utils/tonClient'
import { getWalletPublicKey } from '../utils/privyApi'

interface UseOmnistonSwapProps {
  fromAsset?: AssetInfoV2
  toAsset?: AssetInfoV2
  amount: string
}

// Convert floating point to base units
function toBaseUnits(amount: string, decimals?: number) {
  return Math.floor(parseFloat(amount) * 10 ** (decimals ?? 9)).toString()
}

export const useOmnistonSwap = ({ fromAsset, toAsset, amount }: UseOmnistonSwapProps) => {
  const { user, getAccessToken } = usePrivy()
  const { signRawHash } = useSignRawHash()
  const { address: walletAddress } = useTonWallet()
  const omniston = useOmniston()
  
  const [outgoingTxHash, setOutgoingTxHash] = useState('')
  const [tradedQuote, setTradedQuote] = useState<QuoteResponseEvent_QuoteUpdated | null>(null)
  const [swapError, setSwapError] = useState<Error | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)

  // Get TON wallet from Privy linked accounts
  const tonWallet = user?.linkedAccounts?.find(
    account => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ton'
  )
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

  // Fetch quote
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useRfq({
    settlementMethods: [SettlementMethod.SETTLEMENT_METHOD_SWAP],
    bidAssetAddress: fromAsset
      ? { blockchain: Blockchain.TON, address: fromAsset.contractAddress }
      : undefined,
    askAssetAddress: toAsset
      ? { blockchain: Blockchain.TON, address: toAsset.contractAddress }
      : undefined,
    amount: {
      bidUnits: fromAsset && amount ? toBaseUnits(amount, fromAsset.meta?.decimals) : '0'
    },
    settlementParams: {
      gaslessSettlement: GaslessSettlement.GASLESS_SETTLEMENT_POSSIBLE,
      maxPriceSlippageBps: 500,
    },
  }, {
    enabled: !!fromAsset?.contractAddress && !!toAsset?.contractAddress && amount !== '' && !outgoingTxHash
  })

  // Track trade
  const { data: tradeStatus, isLoading: trackingLoading, error: trackingError } = useTrackTrade({
    quoteId: tradedQuote?.quote?.quoteId || '',
    traderWalletAddress: {
      blockchain: Blockchain.TON,
      address: walletAddress || '',
    },
    outgoingTxHash,
  }, {
    enabled: !!tradedQuote?.quote?.quoteId && !!walletAddress && !!outgoingTxHash,
  })

  // Build transaction
  const buildTransaction = useCallback(async (willTradedQuote: QuoteResponseEvent_QuoteUpdated) => {
    if (!walletAddress) {
      throw new Error('Wallet not connected')
    }

    const tx = await omniston.buildTransfer({
      quote: willTradedQuote.quote,
      sourceAddress: {
        blockchain: Blockchain.TON,
        address: walletAddress,
      },
      destinationAddress: {
        blockchain: Blockchain.TON,
        address: walletAddress,
      },
      gasExcessAddress: {
        blockchain: Blockchain.TON,
        address: walletAddress,
      },
      useRecommendedSlippage: false,
    })

    return tx.ton?.messages || []
  }, [omniston, walletAddress])

  // Get transaction hash from BOC
  const getTxByBOC = useCallback(async (exBoc: string, walletAddr: string): Promise<string> => {
    const client = getTonClient()

    const myAddress = Address.parse(walletAddr)
    
    // Retry logic
    const retry = async (fn: () => Promise<string>, retries = 30, delay = 1000): Promise<string> => {
      try {
        return await fn()
      } catch (error) {
        if (retries === 0) throw error
        await new Promise(resolve => setTimeout(resolve, delay))
        return retry(fn, retries - 1, delay)
      }
    }

    return retry(async () => {
      const transactions = await client.getTransactions(myAddress, { limit: 5 })
      
      for (const tx of transactions) {
        const inMsg = tx.inMessage
        if (inMsg?.info.type === 'external-in') {
          const inBOC = inMsg?.body
          if (typeof inBOC === 'undefined') continue
          
          const extHash = Cell.fromBase64(exBoc).hash().toString('hex')
          const inHash = beginCell().store(storeMessage(inMsg)).endCell().hash().toString('hex')
          
          if (extHash === inHash) {
            return tx.hash().toString('hex')
          }
        }
      }
      throw new Error('Transaction not found')
    })
  }, [])

  // Execute swap using Privy wallet
  const executeSwap = useCallback(async () => {
    if (!quote || quote.type !== 'quoteUpdated' || !walletAddress || !tonWallet) {
      let errorMessage = 'Missing requirements for swap: '
      if (!quote) errorMessage += 'No quote available. '
      if (quote && quote.type !== 'quoteUpdated') errorMessage += `Quote type is ${quote.type}, expected quoteUpdated. `
      if (!walletAddress) errorMessage += 'No wallet address. '
      if (!tonWallet) errorMessage += 'No TON wallet found in linked accounts. '
      
      setSwapError(new Error(errorMessage))
      return
    }

    setIsSwapping(true)
    setSwapError(null)

    try {
      setTradedQuote(quote)
      
      // Build transaction messages
      const messages = await buildTransaction(quote)
      
      if (!messages || messages.length === 0) {
        throw new Error('No transaction messages generated')
      }

      // Fetch the public key from Privy API
      let publicKey: string
      
      // Check if wallet has id field
      const walletId = (tonWallet as any).id
      
      // Check if this is an embedded wallet (imported: false, delegated: false)
      const isEmbeddedWallet = tonWallet && 
        'imported' in tonWallet && 
        'delegated' in tonWallet && 
        tonWallet.imported === false && 
        tonWallet.delegated === false
      
      if (!walletId) {
        throw new Error(
          'Unable to find wallet ID in TON wallet. ' +
          'The wallet structure may have changed.'
        )
      }
      
      if (!isEmbeddedWallet) {
        throw new Error(
          'This appears to be an imported or delegated wallet, not a Privy embedded wallet. ' +
          'Swaps are currently only supported with Privy embedded wallets that can sign transactions. ' +
          'Current wallet: imported=' + (tonWallet as any).imported + ', delegated=' + (tonWallet as any).delegated
        )
      }
      
      const authToken = await getAccessToken()
      publicKey = await getWalletPublicKey(
        walletId, 
        privyAppId,
        authToken || undefined
      )

      // Create wallet contract with the public key
      const publicKeyBuffer = Buffer.from(publicKey, 'hex')
      
      // Create wallet - Privy's address derivation doesn't match standard WalletContractV4
      const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: publicKeyBuffer.length === 33 ? publicKeyBuffer.subarray(1) : publicKeyBuffer,
      })
      
      // Note: This will fail because Privy's wallet address derivation is non-standard
      if (wallet.address.toString() !== walletAddress) {
        throw new Error(
          'Unable to derive the correct wallet address from the public key. ' +
          'Privy\'s wallet address derivation does not match standard WalletContractV4 implementation. ' +
          'Expected: ' + walletAddress + ', Got: ' + wallet.address.toString()
        )
      }
      
      const client = getTonClient()
      const contract = client.open(wallet)

      // Get seqno for the wallet
      const seqno = await contract.getSeqno()

      // Convert Omniston messages to TON internal messages
      const internalMessages = messages.map(msg => 
        internal({
          value: msg.sendAmount,
          to: msg.targetAddress,
          body: msg.payload ? Cell.fromBase64(msg.payload) : undefined,
        })
      )

      // Create transfer with signer callback
      const transfer = await contract.createTransfer({
        seqno,
        messages: internalMessages,
        signer: async (msgCell: Cell) => {
          const hash = msgCell.hash()
          const hexHash = toHex(hash)
          
          // Sign using Privy
          const { signature } = await signRawHash({
            address: walletAddress,
            chainType: 'ton',
            hash: hexHash
          })
          
          // Return signature as Buffer (remove 0x prefix)
          return Buffer.from(signature.slice(2), 'hex')
        },
      })

      // Send the transaction
      await contract.send(transfer)
      
      // Get transaction hash from BOC
      const exBoc = transfer.toBoc().toString('base64')
      
      const txHash = await getTxByBOC(exBoc, walletAddress)
      setOutgoingTxHash(txHash)
      
    } catch (err) {
      setSwapError(err as Error)
      setTradedQuote(null)
    } finally {
      setIsSwapping(false)
    }
  }, [quote, walletAddress, tonWallet, signRawHash, buildTransaction, getTxByBOC, privyAppId, getAccessToken])

  // Reset swap state
  const resetSwap = useCallback(() => {
    setOutgoingTxHash('')
    setTradedQuote(null)
    setSwapError(null)
  }, [])

  return {
    quote,
    quoteLoading,
    quoteError,
    executeSwap,
    isSwapping,
    swapError,
    tradeStatus,
    trackingLoading,
    trackingError,
    resetSwap
  }
}