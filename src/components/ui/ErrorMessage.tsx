interface ErrorMessageProps {
  error: Error | null | undefined
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-600 text-sm">{error?.message || 'An error occurred'}</p>
  </div>
)