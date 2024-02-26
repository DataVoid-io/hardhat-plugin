import 'hardhat/types/config'
import { CdeployConfig } from './types'

declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    cdeploy?: CdeployConfig
  }

  interface HardhatConfig {
    cdeploy?: CdeployConfig
  }
}
