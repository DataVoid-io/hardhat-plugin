import { HardhatRuntimeEnvironment } from 'hardhat/types/runtime'
import { DatavoidDeployer, DatavoidDeployerOptions, DatavoidDeployerResult } from './DatavoidDeployer'

export class HREDatavoid {
  private hre: HardhatRuntimeEnvironment

  constructor(hre: HardhatRuntimeEnvironment) {
    this.hre = hre
  }

  async deployContract(name: string, args?: any[], options?: DatavoidDeployerOptions): Promise<DatavoidDeployerResult> {
    args ??= []
    const deployer = new DatavoidDeployer(this.hre, name, args, options)
    await deployer.init()
    return await deployer.deploy()
  }
}
