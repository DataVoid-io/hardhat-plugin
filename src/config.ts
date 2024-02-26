import { ConfigExtender } from 'hardhat/types'
import { DEFAULT_GASLIMIT } from './constants'
import { CdeployConfig } from './types'

export const cdeployConfigExtender: ConfigExtender = (config, userConfig) => {
  if (!userConfig.cdeploy) {
    return
  }
  const defaultConfig: CdeployConfig = {
    mode:     'create',
    networks: [],
    rpcUrls:  [],
    gasLimit: DEFAULT_GASLIMIT,
  }
  config.cdeploy = { ...defaultConfig, ...userConfig.cdeploy }
}
