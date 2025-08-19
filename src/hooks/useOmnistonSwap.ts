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
import { Address, Cell, internal, SendMode, toNano } from '@ton/ton'
import type { AssetInfoV2 } from '@ston-fi/api'
import { useTonWallet } from './useTonWallet'
import { getTonClient } from '../utils/tonClient'
import { prepareTonWallet, createTonSigner, getWalletSeqno, normalizeOmnistonValue, retry } from '../utils/tonWallet'

interface UseOmnistonSwapProps {
  fromAsset?: AssetInfoV2
  toAsset?: AssetInfoV2
  amount: string
}

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

  const tonWallet = user?.linkedAccounts?.find(
    account => account.type === 'wallet' && 'chainType' in account && account.chainType === 'ton'
  )
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

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
    enabled: !!fromAsset?.contractAddress && !!toAsset?.contractAddress && parseFloat(amount) > 0 && !outgoingTxHash && !isSwapping,
  })

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

  const buildTransaction = useCallback(async (willTradedQuote: QuoteResponseEvent_QuoteUpdated) => {
    if (!walletAddress) throw new Error('Wallet not connected')

    const tx = await omniston.buildTransfer({
      quote: willTradedQuote.quote,
      sourceAddress: { blockchain: Blockchain.TON, address: walletAddress },
      destinationAddress: { blockchain: Blockchain.TON, address: walletAddress },
      gasExcessAddress: { blockchain: Blockchain.TON, address: walletAddress },
      useRecommendedSlippage: true,
    })

    return tx.ton?.messages || []
  }, [omniston, walletAddress])

  const getTxByBOC = useCallback(async (exBoc: string, walletAddr: string): Promise<string> => {
    const client = getTonClient()
    const myAddress = Address.parse(walletAddr)
    
    return retry(async () => {
      const transactions = await client.getTransactions(myAddress, { limit: 10 })
      
      for (const tx of transactions) {
        const inMsg = tx.inMessage
        
        if (inMsg?.info.type === 'external-in') {
          // Compare the BOC directly
          try {
            if (inMsg.body) {
              const inBoc = inMsg.body.toBoc().toString('base64')
              
              if (inBoc === exBoc) {
                return tx.hash().toString('hex')
              }
            }
          } catch (error) {
            // If body comparison fails, try hash comparison as fallback
            const extHash = Cell.fromBase64(exBoc).hash().toString('hex')
            if (inMsg.body) {
              const inHash = inMsg.body.hash().toString('hex')
              
              if (extHash === inHash) {
                return tx.hash().toString('hex')
              }
            }
          }
        }
      }
      throw new Error('Transaction not found')
    }, { retries: 30, delay: 1000 })
  }, [])

  const executeSwap = useCallback(async () => {
    if (!quote || quote.type !== 'quoteUpdated' || !walletAddress || !tonWallet) {
      setSwapError(new Error('Missing requirements for swap'))
      return
    }

    if (!user) {
      setSwapError(new Error('User not authenticated. Please sign in again.'))
      return
    }

    setIsSwapping(true)
    setSwapError(null)

    try {
      setTradedQuote(quote)
      
      const messages = await buildTransaction(quote)
      if (!messages || messages.length === 0) {
        throw new Error('No transaction messages generated')
      }

      const authToken = await getAccessToken()
      const { wallet } = await prepareTonWallet(tonWallet, walletAddress, privyAppId, authToken || undefined)
      
      const client = getTonClient()
      const contract = client.open(wallet)

      const contractState = await client.getContractState(wallet.address)
      if (contractState.state !== 'active') {
        const balance = await client.getBalance(wallet.address)
        if (balance > 0n) {
          throw new Error('Wallet needs deployment. Please deploy your wallet first.')
        } else {
          throw new Error(
            'Your TON wallet is not deployed yet. Send at least 0.05 TON to your wallet address: ' + walletAddress
          )
        }
      }

      // Check if wallet has enough balance for the swap
      const walletBalance = await client.getBalance(wallet.address)
      const requiredAmount = messages.reduce((sum, msg) => {
        return sum + normalizeOmnistonValue(msg.sendAmount)
      }, 0n)
      const gasReserve = toNano('0.05') // Reserve for gas fees
      const totalRequired = requiredAmount + gasReserve

      if (walletBalance < totalRequired) {
        const balanceTON = (Number(walletBalance) / 1e9).toFixed(4)
        const requiredTON = (Number(totalRequired) / 1e9).toFixed(4)
        const swapAmountTON = (Number(requiredAmount) / 1e9).toFixed(4)
        
        throw new Error(
          `Insufficient balance for swap.\n\n` +
          `Current balance: ${balanceTON} TON\n` +
          `Swap amount: ${swapAmountTON} TON\n` +
          `Gas reserve: 0.05 TON\n` +
          `Total required: ${requiredTON} TON\n\n` +
          `Please add at least ${((Number(totalRequired) - Number(walletBalance)) / 1e9).toFixed(4)} TON to your wallet.`
        )
      }

      const seqno = await getWalletSeqno(contract)
      const signer = createTonSigner(signRawHash, walletAddress)

      const internalMessages = messages.map(msg => internal({
        value: normalizeOmnistonValue(msg.sendAmount),
        to: Address.parse(msg.targetAddress),
        body: msg.payload ? Cell.fromBase64(msg.payload) : undefined,
        bounce: true,
      }))

      const transfer = await contract.createTransfer({
        seqno,
        messages: internalMessages,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        signer
      })

      await contract.send(transfer)
      
      const exBoc = transfer.toBoc().toString('base64')
      const txHash = await getTxByBOC(exBoc, walletAddress)
      
      setOutgoingTxHash(txHash)
      
    } catch (err: any) {
      setSwapError(err as Error)
      setTradedQuote(null)
    } finally {
      setIsSwapping(false)
    }
  }, [quote, walletAddress, tonWallet, signRawHash, buildTransaction, getTxByBOC, privyAppId, getAccessToken, user, isSwapping])

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