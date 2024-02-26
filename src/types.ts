import { ethers } from 'ethers'

export type CdeployConfig = {
  contract?: string
  constructorArgsPath?: string
  mode: 'create' | 'create2'
  salt?: string
  signer?: string
  networks: string[]
  rpcUrls: string[]
  gasLimit: number
}

export type DeploymentContext = {
  codeHash: string
  compressedCode: string
  wallet: ethers.Wallet
}
