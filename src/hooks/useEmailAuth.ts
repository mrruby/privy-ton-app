import { useReducer } from 'react'
import { useLoginWithEmail } from '@privy-io/react-auth'
import { useMutation } from '@tanstack/react-query'

interface AuthState {
  email: string
  code: string
  isCodeSent: boolean
}

type AuthAction =
  | { type: 'SET_EMAIL'; payload: string }
  | { type: 'SET_CODE'; payload: string }
  | { type: 'CODE_SENT' }
  | { type: 'RESET' }

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_EMAIL':
      return { ...state, email: action.payload }
    case 'SET_CODE':
      return { ...state, code: action.payload }
    case 'CODE_SENT':
      return { ...state, isCodeSent: true }
    case 'RESET':
      return { email: '', code: '', isCodeSent: false }
    default:
      return state
  }
}

export const useEmailAuth = () => {
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const [state, dispatch] = useReducer(authReducer, {
    email: '',
    code: '',
    isCodeSent: false
  })

  const sendCodeMutation = useMutation({
    mutationFn: async (email: string) => {
      await sendCode({ email })
      return email
    },
    onSuccess: () => {
      dispatch({ type: 'CODE_SENT' })
    }
  })

  const loginMutation = useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      await loginWithCode({ code })
    }
  })

  const setEmail = (email: string) => dispatch({ type: 'SET_EMAIL', payload: email })
  const setCode = (code: string) => dispatch({ type: 'SET_CODE', payload: code })
  const resetAuth = () => dispatch({ type: 'RESET' })

  return {
    email: state.email,
    code: state.code,
    isCodeSent: state.isCodeSent,
    setEmail,
    setCode,
    resetAuth,
    sendCode: () => sendCodeMutation.mutate(state.email),
    login: () => loginMutation.mutate({ code: state.code }),
    isSendingCode: sendCodeMutation.isPending,
    isLoggingIn: loginMutation.isPending,
    sendCodeError: sendCodeMutation.error,
    loginError: loginMutation.error
  }
}