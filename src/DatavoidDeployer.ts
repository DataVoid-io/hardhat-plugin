import { ethers } from 'ethers'
import type { BigNumberish } from 'ethers/src.ts/utils'
import { TransactionReceipt, TransactionRequest } from 'ethers/src.ts/providers/provider'
import { HardhatRuntimeEnvironment } from 'hardhat/types/runtime'
import { HardhatEthersProvider } from '@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider'
import { DEFAULT_GASLIMIT, ENCODER_API_URL } from './constants'
import { NETWORK_ID_BY_CHAIN_ID, NetworkId, NETWORKS } from './networks'
import FactoryHEX from './contracts/Factory.json'
import FeeManagerHEX from './contracts/FeeManager.json'
import DecompressorHEX from './contracts/Decompressor.json'
import FactoryABI from './abi/Factory.json'

export type DatavoidDeployerOptions = {
  mode?: 'create' | 'create2'
  salt?: string | null
  gasLimit?: BigNumberish | null
  value?: BigNumberish | null
  provider?: HardhatEthersProvider | ethers.JsonRpcProvider
  signer?: ethers.Signer | null
  verbose?: boolean
}

export class DatavoidError extends Error {
}

export type DatavoidDeployerResult = {
  chainId: string
  networkId: string
  contractName: string
  txHash: string
  txHashLink: string
  address: string
  l1Cost: string
  addressLink: string
  receipt: TransactionReceipt
  deployed: boolean
  contract: ethers.Contract
}

export class DatavoidDeployer {
  private hre: HardhatRuntimeEnvironment
  private contractName: string
  private constructorArgs: any[]
  private options: DatavoidDeployerOptions
  private mode: 'create' | 'create2'
  private salt: string | null | undefined
  private provider: HardhatEthersProvider | ethers.JsonRpcProvider
  private signer?: ethers.Signer
  private codeHash: string = ''
  private compressedCode: string = ''
  private chainId?: bigint
  private networkId?: NetworkId
  private signerAddress?: string
  private factoryAddress?: string

  constructor(hre: HardhatRuntimeEnvironment, contractName: string, constructorArgs: any[], options?: DatavoidDeployerOptions) {
    this.hre = hre
    this.contractName = contractName
    this.constructorArgs = constructorArgs
    this.options = options ? { ...options } : {}
    this.mode = this.options.mode ?? 'create'
    this.salt = this.options.salt
    this._checkModeAndSalt()
    this.provider = this.options.provider ?? this.hre.ethers.provider
  }

  async init() {
    const contract = await this.hre.ethers.getContractFactory(this.contractName)
    const deployTx = await contract.getDeployTransaction(...this.constructorArgs)
    const code = deployTx.data
    this.codeHash = ethers.keccak256(code)
    this._log('Code hash:', this.codeHash)
    this.compressedCode = await this._getCompressedCode(code)
    this.signer = (this.options.signer ?? (await this.hre.ethers.getSigners())[0]).connect(this.provider)
    const network = await this.provider.getNetwork()
    this.chainId = network.chainId
    this.networkId = NETWORK_ID_BY_CHAIN_ID[network.chainId.toString()]
    if (!this.networkId) {
      throw new DatavoidError(`Not supported chain id: ${network.chainId}`)
    }
    this.signerAddress = await this.signer.getAddress()
    this.factoryAddress = NETWORKS[this.networkId].factoryAddress
    if (!this.factoryAddress) {
      throw new DatavoidError(`Unexpected: factoryAddress for ${network} is not known`)
    }
  }

  async deploy(): Promise<DatavoidDeployerResult> {
    this._log(`Deploying to ${this.chainId} ${this.networkId} as ${this.signerAddress}`)
    await this._prepareProvider()
    const [address, cost] = await this._getAddressAndCost()
    this._log('Address:', address)
    this._log('L1 cost:', cost)
    await this._checkAddressHasNoCode(address)
    try {
      const txReceipt = await this._executeFactoryTx()
      const result = await this._makeSuccessResult(address, cost, txReceipt as unknown as TransactionReceipt)
      this._log('Successfully deployed at tx', result.txHash)
      return result
    } catch (e) {
      this._log(`Exception: ${e}`)
      throw e
    }
  }

  private _checkModeAndSalt() {
    if (this.mode !== 'create' && this.mode !== 'create2') {
      throw new DatavoidError(`Invalid mode: ${this.mode}. Supported modes are: create, create2.`)
    }
    if (this.mode === 'create2' && !/^0x([\da-f]{2}){12}$/.test(this.salt || '')) {
      throw new DatavoidError(`Salt is required for mode=create2 and must be a 12-byte hex-string.`)
    }
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
      throw new DatavoidError(`DataVoid API: encoder: status is not OK (${result.error})`)
    }
    this._log('Compression efficiency:', (result.efficiency ?? 0) / 1000000, '%')
    return result.encoded as string
  }

  private async _prepareProvider() {
    if (this.networkId !== 'hardhat' && this.networkId !== 'localhost') {
      return
    }
    this._log('Installing Factory on a local provider at', this.factoryAddress)
    assert(await this.provider.send('hardhat_setBalance', [this.signerAddress, '0x' + 10000_000000000000000000n.toString(16)]))
    assert(await this.provider.send('hardhat_setCode', [this.factoryAddress, FactoryHEX]))
    const feeManagerAddress = '0x3133700000000000000000000000000000000002'
    assert(await this.provider.send('hardhat_setCode', [feeManagerAddress, FeeManagerHEX]))
    const decompressorAddress = '0x313370000000000000000000000000000000000F'
    assert(await this.provider.send('hardhat_setCode', [decompressorAddress, DecompressorHEX]))
    assert(await this.provider.send('hardhat_setStorageAt', [this.factoryAddress, '0x0', '0x000000000000000000000000' + decompressorAddress.slice(2)]))
    assert(await this.provider.send('hardhat_setStorageAt', [this.factoryAddress, '0x1', '0x000000000000000000000000' + feeManagerAddress.slice(2)]))
    assert(await this.provider.send('hardhat_mine', ['0x1']))
  }

  private async _getAddressAndCost() {
    if (!this.factoryAddress) {
      throw new Error('Unexpected')
    }
    const factory = new this.hre.ethers.Contract(this.factoryAddress, FactoryABI, this.signer)
    let r
    if (this.mode === 'create') {
      r = await factory.getCreateAddress(this.signerAddress, this.codeHash)
    } else if (this.mode === 'create2') {
      r = await factory.getCreate2Address(this.codeHash, this.salt)
    } else {
      throw new Error('Unexpected config.dvdeploy.mode')
    }
    return [r.addr as string, r.l1GasCost.toString() as string]
  }

  async _checkAddressHasNoCode(address: string) {
    if (await this.provider.getCode(address) !== '0x') {
      throw new DatavoidError(
        `The address of the contract you want to deploy already has existing bytecode on ${this.chainId} ${this.networkId}.`
        + `\nIt is very likely that you have deployed this contract before with the same salt parameter value.`
        + `\nPlease try using a different salt value.`,
      )
    }
  }

  private async _executeFactoryTx() {
    if (!this.signer) {
      throw new Error('Unexpected')
    }
    this._log('Sending create tx')
    let tx: TransactionRequest
    if (this.mode === 'create') {
      tx = {
        to:   this.factoryAddress,
        data: `0x01${this.compressedCode.slice(2)}`,
      }
    } else if (this.mode === 'create2') {
      tx = {
        to:   this.factoryAddress,
        data: `0x00${this.salt!.slice(2)}${this.compressedCode.slice(2)}`,
      }
    } else {
      throw new Error(`Unexpected mode: ${this.mode}`)
    }
    if (this.options.gasLimit) {
      tx.gasLimit = this.options.gasLimit ?? DEFAULT_GASLIMIT
    }
    if (this.options.value) {
      tx.value = this.options.value
    }
    const txResponse = await this.signer.sendTransaction(tx)
    const txReceipt = await txResponse.wait()
    if (!txReceipt) {
      throw new DatavoidError(`Unxpectedly the receipt of the deploy tx is missing`)
    }
    return txReceipt
  }

  private async _makeSuccessResult(address: string, cost: string, txReceipt: TransactionReceipt): Promise<DatavoidDeployerResult> {
    const explorerUrl = NETWORKS[this.networkId!].explorerUrl
    return {
      chainId:      this.chainId!.toString(),
      networkId:    this.networkId!,
      contractName: this.contractName,
      txHash:       txReceipt.hash,
      txHashLink:   `${explorerUrl}tx/${txReceipt.hash}`,
      address,
      l1Cost:       cost,
      addressLink:  `${explorerUrl}address/${address}`,
      receipt:      txReceipt,
      deployed:     true,
      contract:     await this.hre.ethers.getContractAt(this.contractName, address, this.signer),
    }
  }

  private _log(...args: any[]) {
    if (!this.options.verbose) {
      return
    }
    console.log('DataVoid:', ...args)
  }
}

function assert(v: any) {
  if (!v) {
    throw new DatavoidError('Assert failed')
  }
}
