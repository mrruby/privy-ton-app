import { WalletContractV4 } from "@ton/ton"

export function maybeStripEd25519PublicKeyPrefix(publicKey: string) {
  if (publicKey.length === 66 && publicKey.startsWith("00")) {
    return publicKey.slice(2);
  } else {
    return publicKey;
  }
}

export function deriveTonWalletFromPublicKey(publicKey: string) {
  console.log('deriveTonWalletFromPublicKey called with:', publicKey)
  const strippedKey = maybeStripEd25519PublicKeyPrefix(publicKey)
  console.log('Stripped key:', strippedKey)
  const publicKeyBuffer = Buffer.from(strippedKey, 'hex')
  console.log('Public key buffer length:', publicKeyBuffer.length)
  
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: publicKeyBuffer,
  })
  
  console.log('Created wallet:', wallet)
  console.log('Wallet address:', wallet.address.toString())
  console.log('Wallet init:', wallet.init)
  
  return {
    address: wallet.address.toString(),
    wallet
  }
}