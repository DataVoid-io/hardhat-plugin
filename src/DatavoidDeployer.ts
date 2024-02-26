import path from 'path'
import { ethers, JsonRpcProvider } from 'ethers'
import type { TransactionRequest } from 'ethers/src.ts/providers/provider'
import { HardhatRuntimeEnvironment } from 'hardhat/types/runtime'
import '@nomicfoundation/hardhat-ethers'
import { HardhatPluginError } from 'hardhat/plugins'
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider'
import './type-extensions'
import { CdeployConfig, DeploymentContext } from './types'
import { ENCODER_API_URL, PLUGIN_NAME } from './constants'
import { NetworkID, NETWORKS } from './networks'
import FactoryHEX from './contracts/Factory.json'
import FeeManagerHEX from './contracts/FeeManager.json'
import DecompressorHEX from './contracts/Decompressor.json'
import FactoryABI from './abi/Factory.json'

export class DatavoidDeployer {
  private hre: HardhatRuntimeEnvironment
  private config: CdeployConfig

  constructor(hre: HardhatRuntimeEnvironment) {
    if (!hre.config.cdeploy) {
      throw new Error('Unexpected')
    }
    this.hre = hre
    this.config = hre.config.cdeploy
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
        + `\nE.g.: { ..., cdeploy: { contract: 'MyContract' }, ... }`,
      )
    }
    if (this.config.mode !== 'create' && this.config.mode !== 'create2') {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide a valid mode: 'create' | 'create2'`
        + `\nE.g.: { ..., cdeploy: { mode: 'create' }, ... }`,
      )
    }
    if (this.config.mode === 'create2' && !/^0x([\da-f]{2}){12}$/.test(this.config.salt || '')) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide a 12-byte hex-string value as salt.`
        + `\nE.g.: { ..., cdeploy: { salt: '0x000000000000000000000000' }, ... }`,
      )
    }
    if (!this.config.signer || this.config.signer.trim() === '') {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide a signer private key. We recommend using Hardhat configuration variables.`
        + `\nSee https://hardhat.org/hardhat-runner/docs/guides/configuration-variables.`
        + `\nE.g.: { ..., cdeploy: { signer: vars.get('PRIVATE_KEY', '') }, ... }`,
      )
    }
    if (!this.config.networks || this.config.networks.length === 0) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Please provide at least one deployment network via the hardhat config.`
        + `\nE.g.: { [...], cdeploy: { networks: ['optimismSepolia'] }, [...] }`
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
        `Please specify a gas limit.\nE.g.: { ..., cdeploy: { gasLimit: 1_000_000 }, ... }`,
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
    const contract = await this.hre.ethers.getContractFactory(this.config.contract!)
    const deployTx = await contract.getDeployTransaction(...constructorArgs)
    const code = deployTx.data
    console.log('Code:', code)
    const codeHash = ethers.keccak256(code)
    console.log('Code hash:', codeHash)
    const compressedCode = await this._getCompressedCode(code)
    const wallet = new this.hre.ethers.Wallet(this.config.signer!)
    const context: DeploymentContext = {
      codeHash,
      compressedCode,
      wallet,
    }
    for (let i = 0; i < this.config.networks.length; i++) {
      const network = this.config.networks[i] as NetworkID
      const rpcUrl = this.config.rpcUrls[i]
      await this._deployToNetwork(context, network, rpcUrl)
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

  private async _getCompressedCode(code: string) {
    const response = await fetch(ENCODER_API_URL, {
      method:  'post',
      headers: {
        'content-type': 'application/json',
        'Api-Key':      'deploy',
      },
      body:    JSON.stringify({ data: code }),
    })
    const result = await response.json()
    if (result.status !== 'OK') {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `DataVoid API: encoder: status is not OK (${result.error})`
      )
    }
    console.log('result', result)
    console.log('Compression efficiency:', (result.efficiency ?? 0) / 1000000, '%')
    return result.encoded
  }

  private async _deployToNetwork(context: DeploymentContext, network: NetworkID, rpcUrl: string) {
    let provider
    if (network === 'hardhat') {
      provider = this.hre.ethers.provider
    } else {
      provider = new this.hre.ethers.JsonRpcProvider(rpcUrl)
    }
    const signer = context.wallet.connect(provider)
    const factoryAddress = NETWORKS[network].factoryAddress
    if (!factoryAddress) {
      throw new Error(`Unexpected: factoryAddress for ${network} is missing`)
    }
    if (network === 'hardhat' || network === 'localhost') {
      await this._prepareLocalProvider(provider, signer.address, factoryAddress)
    }
    const [address, cost] = await this._getAddressAndCost(context, factoryAddress, signer)
    console.log('Address:', address)
    console.log('Cost:', cost)
    if (await provider.getCode(address) !== '0x') {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `The address of the contract you want to deploy already has existing bytecode on ${network}.`
        + `\nIt is very likely that you have deployed this contract before with the same salt parameter value.`
        + `\nPlease try using a different salt value.`,
      )
    }
    try {
      const txReceipt = await this._executeFactoryTx(context, factoryAddress, signer)
      const chainId = (await provider.getNetwork()).chainId
      const explorerUrl = NETWORKS[network].explorerUrl
      const result = {
        network,
        chainId:     chainId.toString(),
        contract:    this.config.contract,
        txHash:      txReceipt.hash,
        txHashLink:  `${explorerUrl}tx/${txReceipt.hash}`,
        address,
        cost,
        addressLink: `${explorerUrl}address/${address}`,
        receipt:     txReceipt.toJSON(),
        deployed:    true,
      }
      console.log('Result:', result)
    } catch (err) {
      console.log(`Exception: ${err}`)
    }
  }

  private async _prepareLocalProvider(provider: HardhatEthersProvider | JsonRpcProvider, signerAddress: string, factoryAddress: string) {
    assert(await provider.send('hardhat_setBalance', [signerAddress, '0x' + 10000_000000000000000000n.toString(16)]))
    factoryAddress = '0x3133700000000000000000000000000000000001'
    assert(await provider.send('hardhat_setCode', [factoryAddress, FactoryHEX]))
    const feeManagerAddress = '0x3133700000000000000000000000000000000002'
    assert(await provider.send('hardhat_setCode', [feeManagerAddress, FeeManagerHEX]))
    const decompressorAddress = '0x313370000000000000000000000000000000000F'
    assert(await provider.send('hardhat_setCode', [decompressorAddress, DecompressorHEX]))
    assert(await provider.send('hardhat_setStorageAt', [factoryAddress, '0x0', '0x000000000000000000000000' + decompressorAddress.slice(2)]))
    assert(await provider.send('hardhat_setStorageAt', [factoryAddress, '0x1', '0x000000000000000000000000' + feeManagerAddress.slice(2)]))
    assert(await provider.send('hardhat_mine', ['0x1']))
  }

  private async _getAddressAndCost(context: DeploymentContext, factoryAddress: string, signer: ethers.Wallet) {
    const factory = new this.hre.ethers.Contract(factoryAddress, FactoryABI, signer)
    let r
    if (this.config.mode === 'create') {
      r = await factory.getCreateAddress(signer.address, context.codeHash)
    } else if (this.config.mode === 'create2') {
      r = await factory.getCreate2Address(context.codeHash, this.config.salt)
    } else {
      throw new Error('Unexpected config.cdeploy.mode')
    }
    return [r.addr as string, r.l1GasCost.toString() as string]
  }

  private async _executeFactoryTx(context: DeploymentContext, factoryAddress: string, signer: ethers.Wallet) {
    console.log('_executeFactoryTx')
    let tx: TransactionRequest
    if (this.config.mode === 'create') {
      tx = {
        to:   factoryAddress,
        data: `0x01${context.compressedCode.slice(2)}`,
      }
    } else if (this.config.mode === 'create2') {
      tx = {
        to:   factoryAddress,
        data: `0x00${this.config.salt!.slice(2)}${context.compressedCode.slice(2)}`,
      }
    } else {
      throw new Error(`Unexpected mode: ${this.config.mode}`)
    }
    tx.gasLimit = this.config.gasLimit
    const txResponse = await signer.sendTransaction(tx)
    const txReceipt = await txResponse.wait()
    if (!txReceipt) {
      throw new HardhatPluginError(
        PLUGIN_NAME,
        `Unxpectedly the receipt of the deploy tx is missing`,
      )
    }
    return txReceipt
  }
}

function assert(v: any) {
  if (!v) {
    throw new HardhatPluginError(PLUGIN_NAME, 'Assert failed')
  }
}
