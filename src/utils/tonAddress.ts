import { WalletContractV4 } from "@ton/ton"

export function maybeStripEd25519PublicKeyPrefix(publicKey: string) {
  if (publicKey.length === 66 && publicKey.startsWith("00")) {
    return publicKey.slice(2);
  } else {
    return publicKey;
  }
}

export function deriveTonWalletFromPublicKey(publicKey: string) {
  const strippedKey = maybeStripEd25519PublicKeyPrefix(publicKey)
  const publicKeyBuffer = Buffer.from(strippedKey, 'hex')
  
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: publicKeyBuffer,
  })
  
  return {
    address: wallet.address.toString(),
    wallet
  }
}