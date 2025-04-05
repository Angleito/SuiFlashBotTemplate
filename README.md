# Sui Flashloan Examples

This repository contains professional examples of flash loan implementations on the Sui blockchain. It demonstrates integration with various protocols and showcases real-world use cases for flash loans in decentralized finance (DeFi) applications.

The examples are designed to be educational and to demonstrate technical proficiency with Sui blockchain development, particularly focusing on flash loan mechanics and DeFi integrations.

## What is Flash Loan Arbitrage?

Flash loan arbitrage is a trading strategy that:

1. Takes out an uncollateralized loan (a "flash loan")
2. Uses the borrowed funds to exploit price differences between exchanges
3. Repays the loan (plus fees) in the same transaction
4. Keeps the profit from the arbitrage

This requires no initial capital, making it accessible to anyone with the technical knowledge to implement it.

## Features

This repository demonstrates:

- Integration with real Sui blockchain protocols
- Implementation of flash loans with various DeFi protocols
- Professional TypeScript code structure and patterns
- Comprehensive error handling and logging
- Unit and integration testing

## Included Examples

### 1. Navi Protocol Flash Loan

A complete implementation of a flash loan using the Navi Protocol. This example demonstrates:

- Connecting to the Navi Protocol
- Executing a flash loan transaction
- Handling the borrowed funds
- Repaying the loan in the same transaction

### 2. SuiLend Protocol Flash Loan

A complete implementation of a flash loan using the SuiLend Protocol. This example demonstrates:

- Connecting to the SuiLend Protocol
- Creating a temporary obligation for the flashloan
- Borrowing funds from a specific reserve
- Performing operations with the borrowed funds
- Repaying the loan in the same transaction

## Project Structure

```
src/
├── config/            # Configuration for protocols and tokens
├── examples/          # Example implementations
│   ├── simpleNaviFlashloan.ts  # Navi Protocol flash loan example
│   └── simpleSuilendFlashloan.ts  # SuiLend Protocol flash loan example
├── tests/             # Test files for the examples
│   ├── simpleNaviFlashloan.test.ts  # Tests for Navi Protocol example
│   └── simpleSuilendFlashloan.test.ts  # Tests for SuiLend Protocol example
├── types/             # TypeScript type definitions
├── utils/             # Utility functions and helpers
└── main.ts            # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/sui-flashloan-examples.git
   cd sui-flashloan-examples
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

4. Set up your environment variables by copying the example file:
   ```
   cp .env.example .env
   ```
   Then edit the `.env` file to add your Sui wallet mnemonic and other configuration options.

### Running the Examples

#### Navi Protocol Flash Loan Example

Run the Navi Protocol flash loan example:

```
npm run navi:flashloan
```

This will execute a complete flash loan cycle using the Navi Protocol on the Sui blockchain.

#### SuiLend Protocol Flash Loan Example

Run the SuiLend Protocol flash loan example:

```
npm run suilend:flashloan
```

This will execute a complete flash loan cycle using the SuiLend Protocol on the Sui blockchain.

### Testing

Run the test suite to verify the examples:

```
npm test
```

### Environment Variables

The examples use the following environment variables:

- `SUI_NETWORK`: The Sui network to connect to (`mainnet`, `testnet`, or `devnet`)
- `SUI_RPC_URL`: The RPC URL for the Sui network
- `SUI_MNEMONIC`: Your wallet mnemonic (12 or 24 words)
- `GAS_BUDGET`: Gas budget for transactions (default: 50000000)
- `NODE_ENV`: Set to `development` for additional logging

**Navi Protocol Configuration:**
- `NAVI_PACKAGE_ID`: The ID of the Navi Protocol package
- `NAVI_USDC_POOL_ID`: The ID of the Navi Protocol USDC pool to use for flashloans
- `NAVI_USDC_COIN_TYPE`: The coin type for USDC in the Navi Protocol

**SuiLend Protocol Configuration:**
- `SUILEND_LENDING_MARKET_ID`: The ID of the SuiLend lending market
- `SUILEND_LENDING_MARKET_TYPE`: The type of the SuiLend lending market
- `SUILEND_COIN_TYPE`: The coin type to borrow from SuiLend

Example `.env` file:
```
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_MNEMONIC=your twelve word mnemonic phrase goes here
GAS_BUDGET=50000000
NODE_ENV=development

# Navi Protocol Configuration
NAVI_PACKAGE_ID=0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f
NAVI_USDC_POOL_ID=0x14d8b80d3d3d7dab5a658e696ff994489b6b6a6f01f146099e9a435c04794b03
NAVI_USDC_COIN_TYPE=0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN

# SuiLend Protocol Configuration
SUILEND_LENDING_MARKET_ID=0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904
SUILEND_LENDING_MARKET_TYPE=0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904::lending_market::LendingMarket
SUILEND_COIN_TYPE=0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN
```

## About the Protocols

### Navi Protocol

[Navi Protocol](https://naviprotocol.io/) is a leading lending protocol on the Sui blockchain that provides flash loan functionality. Flash loans allow users to borrow assets without collateral, as long as the loan is repaid within the same transaction.

Key features of Navi Protocol:

- Uncollateralized flash loans
- Support for multiple tokens (USDC, USDT, WETH, etc.)
- Low fees
- Simple API for developers

For more information, visit the [Navi Protocol documentation](https://naviprotocol.gitbook.io/).

### SuiLend Protocol

[SuiLend](https://www.suilend.com/) is a decentralized lending protocol built on the Sui blockchain. It allows users to borrow and lend assets, including flash loans that can be borrowed and repaid within the same transaction.

Key features of SuiLend Protocol:

- Lending and borrowing platform
- Uncollateralized flash loans
- Support for multiple tokens
- Obligation-based lending system
- Comprehensive SDK for developers

For more information, visit the [SuiLend documentation](https://github.com/solendprotocol/suilend).

## Disclaimer

This repository contains examples for educational purposes. While the code demonstrates real integrations with blockchain protocols, it should not be used in production without proper review and risk management:

1. Always implement proper error handling and recovery mechanisms
2. Conduct thorough testing on testnet before mainnet deployment
3. Implement monitoring and alerting systems
4. Consider gas optimization for production environments
5. Secure sensitive information like private keys and mnemonics

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.