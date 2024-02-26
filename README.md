# DataVoid Hardhat Plugin

A [hardhat](https://hardhat.org) plugin to deploy your smart contracts via DataVoid Compression Engine across multiple Ethereum Virtual Machine (EVM) chains to save on gas fees.

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

## Required Plugins

- [ethers](https://www.npmjs.com/package/ethers) v6
- [@nomicfoundation/hardhat-ethers](https://www.npmjs.com/package/@nomicfoundation/hardhat-ethers)

## Tasks

This plugin provides the `cdeploy` task, which allows you to deploy your smart contracts via DataVoid compression engine across multiple EVM chains while saving on gas fees:

```console
npx hardhat cdeploy
```

## Configuration

You need to add the following configurations to your `hardhat.config.ts` file:
```ts
const config: HardhatUserConfig = {
  // ...
  cdeploy: {
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
  cdeploy: {
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

The parameters `constructorArgsPath` and `gasLimit` are _optional_.

The `salt` parameter is a 12-byte hex-string used to create the contract address. If you have previously deployed the same contract with the identical `salt`, the contract creation transaction will fail due to [EIP-684](https://github.com/ethereum/EIPs/issues/684).

### Example config

```ts
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@datavoid/hardhat-plugin'

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  cdeploy: {
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

## Supported networks

The current available networks are:

- **Local**
  - `hardhat`
  - `localhost`
- **EVM-Based Test Networks**
  - `arbitrumSepolia`
  - `optimismSepolia`

