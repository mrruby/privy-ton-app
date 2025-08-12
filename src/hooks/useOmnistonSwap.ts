import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
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
import { useTonWallet } from './useTonWallet'
import { usePrivyTonSigner } from './usePrivyTonSigner'
import { getTonClient } from '../utils/tonClient'

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
  const { user } = usePrivy()
  const { address: walletAddress } = useTonWallet()
  const { createTransferWithPrivy } = usePrivyTonSigner()
  const omniston = useOmniston()
  
  const [outgoingTxHash, setOutgoingTxHash] = useState('')
  const [tradedQuote, setTradedQuote] = useState<QuoteResponseEvent_QuoteUpdated | null>(null)
  const [swapError, setSwapError] = useState<Error | null>(null)
  const [isSwapping, setIsSwapping] = useState(false)

  // Use wallet address as walletId for Privy signing
  const walletId = walletAddress

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
    if (!quote || quote.type !== 'quoteUpdated' || !walletAddress || !walletId) {
      setSwapError(new Error('Missing requirements for swap'))
      return
    }

    setIsSwapping(true)
    setSwapError(null)

    try {
      setTradedQuote(quote)
      
      // Build transaction messages
      const messages = await buildTransaction(quote)
      
      // Create TON wallet instance  
      const client = getTonClient()
      
      // Get public key from Privy (you might need to store this when creating wallet)
      const tonWallet = user?.linkedAccounts?.find(
        account => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ton'
      )
      
      if (!tonWallet || !('publicKey' in tonWallet)) {
        throw new Error('TON wallet not found')
      }
      
      const publicKey = Buffer.from(tonWallet.publicKey?.slice(2) || '', 'hex')
      
      // Create wallet contract
      const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: publicKey,
      })
      const contract = client.open(wallet)
      
      // Get seqno
      const seqno = await contract.getSeqno()
      
      // Create transfer with Privy signing
      const transfer = await createTransferWithPrivy(
        wallet,
        walletId,
        seqno,
        messages.map(msg => internal({
          value: msg.sendAmount,
          to: msg.targetAddress,
          body: msg.payload ? Cell.fromBase64(msg.payload) : undefined
        }))
      )
      
      // Send transaction
      await contract.send(transfer)
      
      // Get transaction hash
      const exBoc = transfer.toBoc().toString('base64')
      const txHash = await getTxByBOC(exBoc, walletAddress)
      setOutgoingTxHash(txHash)
      
    } catch (err) {
      setSwapError(err as Error)
      setTradedQuote(null)
    } finally {
      setIsSwapping(false)
    }
  }, [quote, walletAddress, walletId, user, buildTransaction, createTransferWithPrivy, getTxByBOC])

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