import { useState, useEffect } from 'react'
import type { AssetInfoV2 } from '@ston-fi/api'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'
import { useOmnistonSwap } from '../../hooks/useOmnistonSwap'
import { useAssets } from '../../hooks/useAssets'

export const SwapInterface: React.FC = () => {
  const [amount, setAmount] = useState('')
  const [fromAsset, setFromAsset] = useState<AssetInfoV2 | undefined>()
  const [toAsset, setToAsset] = useState<AssetInfoV2 | undefined>()

  // Fetch available assets
  const { data: assets = [], isLoading: assetsLoading, error: assetsError } = useAssets()

  // Set default assets when loaded
  useEffect(() => {
    if (assets.length > 0 && !fromAsset) {
      setFromAsset(assets[0])
    }
    if (assets.length > 1 && !toAsset) {
      setToAsset(assets[1])
    }
  }, [assets, fromAsset, toAsset])

  const {
    quote,
    quoteLoading,
    quoteError,
    executeSwap,
    isSwapping,
    swapError,
    tradeStatus,
    resetSwap
  } = useOmnistonSwap({
    fromAsset,
    toAsset,
    amount
  })

  // Reset swap state when inputs change
  useEffect(() => {
    resetSwap()
  }, [fromAsset, toAsset, amount, resetSwap])

  if (assetsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <LoadingSpinner />
        <p className="mt-3 text-gray-600">Loading assets...</p>
      </div>
    )
  }

  if (assetsError) {
    return <ErrorMessage error={assetsError as Error} />
  }

  return (
    <div className="space-y-6">
      {/* From Token */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">From</label>
        <select
          value={fromAsset?.contractAddress || ''}
          onChange={(e) => {
            const selected = assets.find(a => a.contractAddress === e.target.value)
            setFromAsset(selected)
          }}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        >
          {assets.map(asset => (
            <option
              key={asset.contractAddress}
              value={asset.contractAddress}
              className="bg-white"
            >
              {asset.meta?.symbol || asset.meta?.displayName || 'Unknown'}
            </option>
          ))}
        </select>
      </div>

      {/* To Token */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">To</label>
        <select
          value={toAsset?.contractAddress || ''}
          onChange={(e) => {
            const selected = assets.find(a => a.contractAddress === e.target.value)
            setToAsset(selected)
          }}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        >
          {assets.map(asset => (
            <option
              key={asset.contractAddress}
              value={asset.contractAddress}
              className="bg-white"
            >
              {asset.meta?.symbol || asset.meta?.displayName || 'Unknown'}
            </option>
          ))}
        </select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Amount</label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
        />
      </div>

      {/* Quote Display */}
      {quoteLoading && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-sm">Fetching best quote...</p>
        </div>
      )}

      {quoteError && !isSwapping && <ErrorMessage error={quoteError as Error} />}

      {quote && 'quote' in quote && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-indigo-200">
          <p className="font-semibold text-gray-800 mb-2">Quote Details</p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-600">
              Provider: <span className="text-gray-800">{quote.quote.resolverName}</span>
            </p>
            <p className="text-gray-600">
              You send: <span className="text-gray-800">
                {(parseInt(quote.quote.bidUnits) / 10 ** (fromAsset?.meta?.decimals ?? 9)).toFixed(4)} {fromAsset?.meta?.symbol}
              </span>
            </p>
            <p className="text-gray-600">
              You receive: <span className="text-gray-800">
                {(parseInt(quote.quote.askUnits) / 10 ** (toAsset?.meta?.decimals ?? 9)).toFixed(4)} {toAsset?.meta?.symbol}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Swap Button */}
      {quote && 'quote' in quote && (
        <button
          onClick={executeSwap}
          disabled={isSwapping}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
        >
          {isSwapping ? 'Processing Swap...' : 'Execute Swap'}
        </button>
      )}

      {/* Swap Error */}
      {swapError && <ErrorMessage error={swapError} />}

      {/* Trade Status */}
      {tradeStatus && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            {tradeStatus.status?.tradeSettled ? (
              <span className="text-green-400">
                Trade completed: {getTradeResultText(tradeStatus)}
              </span>
            ) : (
              <span className="text-blue-400">Tracking trade...</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

// Helper function for trade status
function getTradeResultText(status: any) {
  if (!status?.status?.tradeSettled) return ""
  
  const result = status.status.tradeSettled.result
  switch (result) {
    case "TRADE_RESULT_FULLY_FILLED":
      return "Successfully completed"
    case "TRADE_RESULT_PARTIALLY_FILLED":
      return "Partially filled"
    case "TRADE_RESULT_ABORTED":
      return "Aborted"
    default:
      return "Unknown status"
  }
}