import { useEmailAuth } from '../../hooks/useEmailAuth'
import { ErrorMessage } from '../ui/ErrorMessage'

export const AuthForm: React.FC = () => {
  const {
    email,
    code,
    isCodeSent,
    setEmail,
    setCode,
    resetAuth,
    sendCode,
    login,
    isSendingCode,
    isLoggingIn,
    sendCodeError,
    loginError
  } = useEmailAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TON Wallet</h1>
          <p className="text-purple-200">Connect with Privy to get started</p>
        </div>
        
        <div className="space-y-4">
          {!isCodeSent ? (
            <>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              {sendCodeError && <ErrorMessage error={sendCodeError} />}
              <button 
                onClick={sendCode} 
                disabled={!email || isSendingCode}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {isSendingCode ? 'Sending...' : 'Send Code'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-purple-200 text-sm">We sent a code to {email}</p>
              </div>
              <input
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              {loginError && <ErrorMessage error={loginError} />}
              <button 
                onClick={login} 
                disabled={!code || isLoggingIn}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {isLoggingIn ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button
                onClick={resetAuth}
                className="w-full py-2 text-purple-200 hover:text-white transition-colors text-sm"
              >
                Use different email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}