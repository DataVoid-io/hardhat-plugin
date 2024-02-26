export type NetworkID = 'hardhat'
  | 'localhost'
  | 'arbitrumSepolia'
  | 'optimismSepolia'

export type NetworkConfig = {
  factoryAddress: string
  explorerUrl: string
}

export const NETWORKS: { [k in NetworkID]: NetworkConfig } = {
  hardhat: {
    factoryAddress: '0x3133700000000000000000000000000000000001',
    explorerUrl: '',
  },
  localhost: {
    factoryAddress: '0x3133700000000000000000000000000000000001',
    explorerUrl: '',
  },
  arbitrumSepolia: {
    factoryAddress: '0x0000346fEb0000002919F700F261D41400d300FC',
    explorerUrl: 'https://sepolia.arbiscan.io/',
  },
  optimismSepolia: {
    factoryAddress: '0xfFA991c979EB02Ea9444a01E8bb930Acc1AADD27',
    explorerUrl: 'https://sepolia-optimism.etherscan.io/',
  },
}
