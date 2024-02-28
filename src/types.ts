export type DatavoidDeployConfig = {
  contract?: string
  constructorArgsPath?: string
  mode: 'create' | 'create2'
  salt?: string
  signer?: string
  networks: string[]
  rpcUrls: string[]
  gasLimit: number
}
