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
import { Address, Cell, beginCell, storeMessage, internal, toNano, SendMode } from '@ton/ton'
import type { AssetInfoV2 } from '@ston-fi/api'
import { toHex } from 'viem'
import { useTonWallet } from './useTonWallet'
import { getTonClient } from '../utils/tonClient'
import { getWalletPublicKey } from '../utils/privyApi'
import { deriveTonWalletFromPublicKey } from '../utils/tonAddress'

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

    console.log('=== Building Omniston transaction ===')
    console.log('Quote:', willTradedQuote.quote)
    console.log('Wallet address:', walletAddress)

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
      useRecommendedSlippage: true, // Changed to true to use recommended slippage from the quote
    })

    console.log('Built transaction:', tx)
    console.log('TON messages:', tx.ton?.messages)
    
    if (!tx.ton?.messages || tx.ton.messages.length === 0) {
      console.error('No messages generated from Omniston buildTransfer')
    }

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

      // Derive the TON wallet and address from the public key
      console.log('Public key from Privy:', publicKey)
      const { address: derivedAddress, wallet } = deriveTonWalletFromPublicKey(publicKey)
      console.log('Derived address:', derivedAddress)
      console.log('Privy wallet address:', walletAddress)
      
      // Verify the derived address matches Privy's wallet address
      if (derivedAddress !== walletAddress) {
        console.warn(
          'Derived address does not match Privy wallet address. ' +
          'Expected: ' + walletAddress + ', Got: ' + derivedAddress + '. ' +
          'This may indicate Privy uses a different derivation method.'
        )
      }
      
      const client = getTonClient()
      const contract = client.open(wallet)

      // Check if wallet is deployed
      const contractState = await client.getContractState(wallet.address)
      console.log('Wallet contract state:', contractState.state)
      
      if (contractState.state !== 'active') {
        console.warn('Wallet is not deployed. State:', contractState.state)
        
        // Check if wallet has balance but needs deployment
        const balance = await client.getBalance(wallet.address)
        console.log('Wallet balance:', balance.toString())
        
        if (balance > 0n) {
          console.log('Wallet has funds but needs deployment. Attempting to deploy...')
          
          try {
            // Create a deployment transaction (send small amount to self with seqno 0)
            const deployAmount = toNano('0.01') // Small amount for deployment
            
            const deployTransfer = await wallet.createTransfer({
              seqno: 0, // First transaction, includes StateInit
              messages: [
                internal({
                  value: deployAmount,
                  to: wallet.address,
                  body: 'Wallet deployment',
                })
              ],
              signer: async (msgCell: Cell) => {
                const hash = msgCell.hash()
                const hexHash = toHex(hash)
                console.log('Signing deployment message hash:', hexHash)
                
                // Sign using Privy
                const { signature } = await signRawHash({
                  address: walletAddress,
                  chainType: 'ton',
                  hash: hexHash
                })
                console.log('Got deployment signature:', signature)
                
                // Return signature as Buffer (remove 0x prefix)
                return Buffer.from(signature.slice(2), 'hex')
              },
            })
            
            console.log('Sending deployment transaction...')
            await contract.send(deployTransfer)
            
            // Wait a bit for deployment to process
            await new Promise(resolve => setTimeout(resolve, 3000))
            
            // Check deployment status again
            const newState = await client.getContractState(wallet.address)
            if (newState.state === 'active') {
              console.log('Wallet deployed successfully!')
            } else {
              throw new Error('Deployment transaction sent but wallet still not active')
            }
          } catch (deployError) {
            console.error('Failed to deploy wallet:', deployError)
            throw new Error(
              'Failed to deploy wallet. Error: ' + (deployError instanceof Error ? deployError.message : String(deployError))
            )
          }
        } else {
          throw new Error(
            'Your TON wallet is not deployed yet. To deploy it:\n\n' +
            '1. Send at least 0.05 TON to your wallet address\n' +
            '2. Try to make a swap again - the wallet will auto-deploy\n\n' +
            'Your wallet address: ' + walletAddress + '\n\n' +
            'Note: On TON, all wallets are smart contracts that need to be deployed.'
          )
        }
      }

      // Get seqno for the wallet
      let seqno: number
      try {
        seqno = await contract.getSeqno()
        console.log('Wallet seqno:', seqno)
      } catch (seqnoError) {
        console.error('Failed to get seqno:', seqnoError)
        // If wallet is not deployed, seqno is 0
        seqno = 0
        console.log('Using seqno 0 for undeployed wallet')
      }

      // Convert Omniston messages to TON internal messages
      console.log('Building internal messages from:', messages)
      const internalMessages = messages.map(msg => {
        console.log('Processing message:', {
          value: msg.sendAmount,
          to: msg.targetAddress,
          hasPayload: !!msg.payload,
          payload: msg.payload
        })
        return internal({
          value: msg.sendAmount,
          to: msg.targetAddress,
          body: msg.payload ? Cell.fromBase64(msg.payload) : undefined,
          bounce: true, // Enable bounce for smart contract interactions
        })
      })

      // Create transfer with signer callback
      console.log('Creating transfer with seqno:', seqno, 'and', internalMessages.length, 'messages')
      let transfer
      try {
        transfer = await contract.createTransfer({
          seqno,
          messages: internalMessages,
          sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
          signer: async (msgCell: Cell) => {
            const hash = msgCell.hash()
            const hexHash = toHex(hash)
            console.log('Signing message hash:', hexHash)
            
            // Sign using Privy
            const { signature } = await signRawHash({
              address: walletAddress,
              chainType: 'ton',
              hash: hexHash
            })
            console.log('Got signature:', signature)
            
            // Return signature as Buffer (remove 0x prefix)
            return Buffer.from(signature.slice(2), 'hex')
          },
        })
        console.log('Transfer created successfully')
      } catch (createError) {
        console.error('Failed to create transfer:', createError)
        throw new Error(`Failed to create transfer: ${createError instanceof Error ? createError.message : String(createError)}`)
      }

      // Send the transaction
      console.log('=== Sending transaction ===')
      console.log('Transfer object:', transfer)
      console.log('Transfer BOC:', transfer.toBoc().toString('base64'))
      
      try {
        await contract.send(transfer)
        console.log('Transaction sent successfully')
      } catch (sendError: any) {
        console.error('Failed to send transaction:', sendError)
        // Log the detailed error response if available
        if (sendError.response?.data) {
          console.error('API Error Response:', sendError.response.data)
        }
        if (sendError.response?.status === 500 && sendError.response?.data?.error) {
          const apiError = sendError.response.data.error
          throw new Error(`TON API Error: ${apiError}`)
        }
        throw new Error(`Failed to send transaction: ${sendError instanceof Error ? sendError.message : String(sendError)}`)
      }
      
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