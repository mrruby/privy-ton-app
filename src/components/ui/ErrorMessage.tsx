interface ErrorMessageProps {
  error: Error | null | undefined
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => (
  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
    <p className="text-red-200 text-sm">{error?.message || 'An error occurred'}</p>
  </div>
)