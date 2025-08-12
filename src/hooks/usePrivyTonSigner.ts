import { useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Cell, WalletContractV4 } from '@ton/ton'

export const usePrivyTonSigner = () => {
  const { signMessage } = usePrivy()

  const createSigner = useCallback(
    (walletId: string) => {
      return async (message: Cell): Promise<Buffer> => {
        const hash = message.hash()
        const hexHash = '0x' + hash.toString('hex')
        
        // Sign with Privy - this will prompt the user to sign
        const signatureResult = await signMessage({ message: hexHash }, {
          address: walletId
        })
        
        // Remove '0x' prefix and convert to Buffer
        return Buffer.from(signatureResult.signature.slice(2), 'hex')
      }
    },
    [signMessage]
  )

  const createTransferWithPrivy = useCallback(
    async (
      contract: WalletContractV4,
      walletId: string,
      seqno: number,
      messages: any[]
    ) => {
      const signer = createSigner(walletId)
      
      return await contract.createTransfer({
        seqno,
        messages,
        signer
      })
    },
    [createSigner]
  )

  return {
    createSigner,
    createTransferWithPrivy
  }
}