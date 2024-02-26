import { extendConfig, task } from 'hardhat/config'
import { cdeployConfigExtender } from './config'
import { DatavoidDeployer } from './DatavoidDeployer'
import { HardhatPluginError } from 'hardhat/plugins'
import { PLUGIN_NAME } from './constants'

extendConfig(cdeployConfigExtender)

task(
  'cdeploy',
  'Deploys the contract across all defined networks',
).setAction(async (_, hre) => {
  if (!hre.config.cdeploy) {
    throw new HardhatPluginError(
      PLUGIN_NAME,
      `Please add the "cdeploy" section to your hardhat config. See the README.`,
    )
  }
  const deployer = new DatavoidDeployer(hre)
  await deployer.run()
})
