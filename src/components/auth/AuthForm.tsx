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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-indigo-700 mb-2">TON Wallet</h1>
          <p className="text-gray-600">Connect with Privy to get started</p>
        </div>
        
        <div className="space-y-4">
          {!isCodeSent ? (
            <>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              {sendCodeError && <ErrorMessage error={sendCodeError} />}
              <button 
                onClick={sendCode} 
                disabled={!email || isSendingCode}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isSendingCode ? 'Sending...' : 'Send Code'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-gray-600 text-sm">We sent a code to {email}</p>
              </div>
              <input
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              {loginError && <ErrorMessage error={loginError} />}
              <button 
                onClick={login} 
                disabled={!code || isLoggingIn}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoggingIn ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button
                onClick={resetAuth}
                className="w-full py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
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