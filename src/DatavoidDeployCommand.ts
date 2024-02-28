import path from 'path'
import { ethers } from 'ethers'
import '@nomicfoundation/hardhat-ethers'
import { HardhatPluginError } from 'hardhat/plugins'
import { HardhatRuntimeEnvironment } from 'hardhat/types/runtime'
import { DatavoidDeployConfig } from './types'
import { PLUGIN_NAME } from './constants'
import { NetworkId, NETWORKS } from './networks'
import { DatavoidDeployer, DatavoidDeployerOptions } from './DatavoidDeployer'
import './type-extensions'

export class DatavoidDeployCommand {
  private hre: HardhatRuntimeEnvironment
  private config: DatavoidDeployConfig

  constructor(hre: HardhatRuntimeEnvironment) {
    if (!hre.config.dvdeploy) {
      throw new Error('Unexpected')
    }
    this.hre = hre
    this.config = hre.config.dvdeploy
  }

  async run() {
    this._checkConfig()
    await this.hre.run('compile')
    console.log('\nDeploying via DataVoid Compression Engine...')
    await this._deploy()
  }

  private _checkConfig() {
    if (!this.config.contract) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please specify the contract name of the smart contract to be deployed.`
        + `\nE.g.: { ..., dvdeploy: { contract: 'MyContract' }, ... }`,
      )
    }
    if (this.config.mode !== 'create' && this.config.mode !== 'create2') {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide a valid mode: 'create' | 'create2'`
        + `\nE.g.: { ..., dvdeploy: { mode: 'create' }, ... }`,
      )
    }
    if (this.config.mode === 'create2' && !/^0x([\da-f]{2}){12}$/.test(this.config.salt || '')) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide a 12-byte hex-string value as salt.`
        + `\nE.g.: { ..., dvdeploy: { salt: '0x000000000000000000000000' }, ... }`,
      )
    }
    if (!this.config.signer || this.config.signer.trim() === '') {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide a signer private key. We recommend using Hardhat configuration variables.`
        + `\nSee https://hardhat.org/hardhat-runner/docs/guides/configuration-variables.`
        + `\nE.g.: { ..., dvdeploy: { signer: vars.get('PRIVATE_KEY', '') }, ... }`,
      )
    }
    if (!this.config.networks || this.config.networks.length === 0) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide at least one deployment network via the hardhat config.`
        + `\nE.g.: { [...], dvdeploy: { networks: ['optimismSepolia'] }, [...] }`
        + `\nThe current supported networks are ${Object.keys(NETWORKS).join(', ')}.`,
      )
    }
    if (this.config.networks && this.config.networks.some((network) => !NETWORKS.hasOwnProperty(network))) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `You have tried to configure a network that this plugin does not yet support, or you have misspelled the network name.`
        + `\nThe currently supported networks are ${Object.keys(NETWORKS).join(', ')}.`,
      )
    }
    if (this.config.networks && this.config.rpcUrls && this.config.rpcUrls.length !== this.config.networks.length) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `The options "network" and "rpcUrls" do not have the same length. Please ensure that both parameters have the same length, i.e. for each network there is a corresponding rpcUrls entry.`,
      )
    }
    if (!this.config.gasLimit) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please specify a gas limit.\nE.g.: { ..., dvdeploy: { gasLimit: 1_000_000 }, ... }`,
      )
    }
    if (this.config.gasLimit > 15_000_000) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please specify a lower gasLimit. Each block has currently a maximum size of 15 million gas.`,
      )
    }
  }

  private async _deploy() {
    const constructorArgs = await this._getConstructorArgs()
    const options: DatavoidDeployerOptions = {
      mode:     this.config.mode,
      salt:     this.config.salt,
      gasLimit: this.config.gasLimit,
    }
    for (let i = 0; i < this.config.networks.length; i++) {
      const networkId = this.config.networks[i] as NetworkId
      const rpcUrl = this.config.rpcUrls[i]
      const provider = networkId === 'hardhat' ? this.hre.ethers.provider : new ethers.JsonRpcProvider(rpcUrl)
      const signer = new ethers.Wallet(this.config.signer!, provider)
      options.provider = provider
      options.signer = signer
      try {
        const deployer = new DatavoidDeployer(this.hre, this.config.contract!, constructorArgs, options)
        await deployer.init()
        await deployer.deploy()
      } catch (e) {
        throw new HardhatPluginError(PLUGIN_NAME, String(e))
      }
    }
  }

  private async _getConstructorArgs() {
    if (!this.config.constructorArgsPath) {
      return []
    }
    const argsPath = path.normalize(path.join(this.hre.config.paths.root, this.config.constructorArgsPath))
    const args = (await import(argsPath)).default
    if (!Array.isArray(args)) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Constructor args defined in ${this.config.constructorArgsPath} must be an array.`,
      )
    }
    return args
  }
}

