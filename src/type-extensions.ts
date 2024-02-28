import 'hardhat/types/config'
import { DatavoidDeployConfig } from './types'
import { HREDatavoid } from './HREDatavoid'

declare module 'hardhat/types/config' {
  interface HardhatUserConfig {
    dvdeploy?: DatavoidDeployConfig
  }

  interface HardhatConfig {
    dvdeploy?: DatavoidDeployConfig
  }
}

declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    datavoid: HREDatavoid
  }
}
