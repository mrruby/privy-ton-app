// Utility to interact with Privy API for extended wallet functionality

interface PrivyWalletDetails {
  public_key: string
}

export async function getWalletPublicKey(
  walletId: string,
  privyAppId: string,
  privyAuthToken?: string
): Promise<string> {
  const response = await fetch(`https://auth.privy.io/api/v1/wallets/${walletId}`, {
    headers: {
      'Authorization': `Bearer ${privyAuthToken || ''}`,
      'privy-app-id': privyAppId,
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch wallet details: ${response.status} ${response.statusText} - ${errorText}`)
  }
  const data: PrivyWalletDetails = await response.json()
  return data.public_key
}