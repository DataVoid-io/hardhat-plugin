# DataVoid Hardhat Plugin

A [hardhat](https://hardhat.org) plugin to deploy your smart contracts via DataVoid Compression Engine across multiple Ethereum Virtual Machine (EVM) chains to save on gas fees.

## Required Plugins

- [ethers](https://www.npmjs.com/package/ethers) v6
- [@nomicfoundation/hardhat-ethers](https://www.npmjs.com/package/@nomicfoundation/hardhat-ethers)

## Supported networks

The current available networks are:

- **Local**
  - `hardhat`
  - `localhost`
- **EVM-Based Test Networks**
  - `arbitrumSepolia`
  - `optimismSepolia`

## Installation

With `npm` versions `>=7`:

```console
npm i --save-dev @datavoid/hardhat-plugin
```

With `npm` version `6`:

```console
npm install --save-dev @datavoid/hardhat-plugin @nomicfoundation/hardhat-ethers ethers
```

With `yarn`:

```console
yarn add --dev @datavoid/hardhat-plugin @nomicfoundation/hardhat-ethers ethers
```

Import the plugin in your `hardhat.config.ts`:

```ts
import '@datavoid/hardhat-plugin'
```

Or if you are using plain JavaScript, in your `hardhat.config.js`:

```js
require('@datavoid/hardhat-plugin')
```

## Use in a deploy script

Use
`await hardhat.datavoid.deployContract(contractName, constructorArgs, options)` in your deploy scripts to deploy a contract.

### Options

All the options are optional.

- `mode`: `'create'` | `'create2'` (default: `'create'`)
- `salt`: a 12-byte hex-string (required for mode `create2`)
- `gasLimit`: a gas limit (default 1_500_000)
- `value`: a deploy tx value
- `provider`: a custom provider
- `signer`: a custom signer
- `verbose`: enable internal logs

### Example deploy script

```ts
import hardhat, { ethers } from 'hardhat'

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000)
  const unlockTime = currentTimestampInSeconds + 60
  const lockedAmount = ethers.parseEther('0.0001')

  const result = await hardhat.datavoid.deployContract('Lock', [unlockTime], {
    mode:     'create2',
    salt:     '0xf53ec45060bd4d7b7a93f81c',
    value:    lockedAmount,
    gasLimit: 1_200_000,
    verbose:  true,
  })
  console.log(`Deployed to ${result.address} with L1 cost ${result.l1Cost}`)

  const owner = await result.contract.owner()
  console.log('Deployed with owner:', owner)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
```

## Use as a task

For the simpliest case when you have just one smart contract, this plugin provides the `dvdeploy` task,
which allows you to deploy the contract via DataVoid compression engine across multiple EVM chains using a simple configuration:

```console
npx hardhat dvdeploy
```

### Configuration

In case you want to use the `dvdeploy` task, you need to add the following configuration to your `hardhat.networks.ts` file:

```ts
const config: HardhatUserConfig = {
  // ...
  dvdeploy: {
    contract: 'YOUR_CONTRACT_NAME_TO_BE_DEPLOYED',
    constructorArgsPath: 'PATH_TO_CONSTRUCTOR_ARGS_FILE', // optional
    mode: 'DEPLOYMENT_MODE', // 'create' | 'create2'
    salt: 'HEX_SALT', // required if mode is 'create2'
    signer: 'SIGNER_PRIVATE_KEY',
    networks: ['LIST_OF_NETWORKS'],
    rpcUrls: ['LIST_OF_RPC_URLS'],
    gasLimit: 1_500_000, // optional; default value is 1_500_000
  },
}
```

Or if you are plain JavaScript, in your `hardhat.config.js`:

```js
module.exports = {
  // ...
  dvdeploy: {
    contract: 'YOUR_CONTRACT_NAME_TO_BE_DEPLOYED',
    constructorArgsPath: 'PATH_TO_CONSTRUCTOR_ARGS_FILE', // optional
    mode: 'DEPLOYMENT_MODE', // 'create' | 'create2'
    salt: 'HEX_SALT', // required if mode is 'create2'
    signer: 'SIGNER_PRIVATE_KEY',
    networks: ['LIST_OF_NETWORKS'],
    rpcUrls: ['LIST_OF_RPC_URLS'],
    gasLimit: 1_500_000, // optional; default value is 1_500_000
  },
}
```

The parameters `constructorArgsPath` and `gasLimit` are optional.

The `salt` parameter is a 12-byte hex-string used to create the contract address. If you have previously deployed the same contract with the identical `salt` and constructor arguments, the contract creation transaction will fail due to [EIP-684](https://github.com/ethereum/EIPs/issues/684).

### Example config

```ts
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@datavoid/hardhat-plugin'

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  dvdeploy: {
    contract: 'MyContract',
    constructorArgsPath: './constructor-args.ts',
    mode: 'create2',
    salt: '0xf53ec45060bd4d7b7a93f81c',
    signer: vars.get('PRIVATE_KEY', ''),
    networks: [
      'hardhat',
      'localhost',
      'optimismSepolia',
    ],
    rpcUrls: [
      'hardhat',
      'http://127.0.0.1:8545/',
      'https://sepolia.optimism.io/',
    ],
    gasLimit: 1_200_000,
  },
}

export default config
```

> [!NOTE]
> We recommend using [Hardhat configuration variables](https://hardhat.org/hardhat-runner/docs/guides/configuration-variables) introduced in Hardhat version [`2.19.0`](https://github.com/NomicFoundation/hardhat/releases/tag/hardhat%402.19.0) to set the private key of your signer.

### Constructor arguments

The constructor arguments file must export an array of constructor arguments:

```ts
export default [
  'arg1',
  'arg2',
  // ...
]
```

> BigInt literals (e.g. `100_000_000_000_000_000_000n`) can be used for the constructor arguments if you set `target: ES2020` in your `tsconfig.json` file. See also [here](./tsconfig.json) for an example.

If you are using common JavaScript:

```js
module.exports = [
  'arg1',
  'arg2',
  // ...
]
```

## Caveats

### msg.sender

When deploying with this plugin, `msg.sender` will not be the deployer address in a contract constructor as you might expect, but a DataVoid Factory Contract address.

Be careful if you have code like this:

```solidity
contract Lock {
  address payable public owner;

  constructor() payable {
    owner = payable(msg.sender);
  }
}
```
