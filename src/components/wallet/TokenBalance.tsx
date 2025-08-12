import type { TokenBalance } from '../../hooks/useTokenBalances'

interface TokenBalanceProps {
  tokenBalance: TokenBalance
}

export const TokenBalanceItem: React.FC<TokenBalanceProps> = ({ tokenBalance }) => {
  const { symbol, name, balance, imageUrl } = tokenBalance

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={symbol}
            className="w-8 h-8 rounded-full object-cover"
            onError={(e) => {
              // Fallback to first letter if image fails
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <div 
          className={`w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm ${imageUrl ? 'hidden' : ''}`}
        >
          {symbol.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-gray-800">{symbol}</p>
          <p className="text-xs text-gray-500">{name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-gray-800">{balance}</p>
      </div>
    </div>
  )
}