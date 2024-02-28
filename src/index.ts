import { extendConfig, extendEnvironment, task } from 'hardhat/config'
import { DatavoidDeployConfig } from './types'
import { HREDatavoid } from './HREDatavoid'
import { HardhatPluginError } from 'hardhat/plugins'
import { DEFAULT_GASLIMIT, PLUGIN_NAME } from './constants'
import { DatavoidDeployCommand } from './DatavoidDeployCommand'
import './type-extensions'

extendEnvironment((hre) => {
  hre.datavoid = new HREDatavoid(hre)
})

extendConfig((config, userConfig) => {
  if (!userConfig.dvdeploy) {
    return
  }
  const defaultConfig: DatavoidDeployConfig = {
    mode:     'create',
    networks: [],
    rpcUrls:  [],
    gasLimit: DEFAULT_GASLIMIT,
  }
  config.dvdeploy = { ...defaultConfig, ...userConfig.dvdeploy }
})

task(
  'dvdeploy',
  'Deploys a contract via DataVoid Compression Engine',
).setAction(async (_, hre) => {
  if (!hre.config.dvdeploy) {
    throw new HardhatPluginError(
      PLUGIN_NAME,
      `Please add the "dvdeploy" section to your hardhat config. See the README.`,
    )
  }
  const deployCommand = new DatavoidDeployCommand(hre)
  await deployCommand.run()
})
