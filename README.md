# Flash Loan Arbitrage Bot (Demo Version)

This repository contains a mock implementation of a Flash Loan Arbitrage Bot for educational and demonstration purposes. It simulates the interaction with Sui blockchain, DEXes, and arbitrage detection/execution without actually connecting to real services or using real funds.

## ⚠️ Important Note

This is a **SIMULATED DEMO VERSION** and does not contain proprietary code or connect to real blockchain networks. All functionality is mocked to demonstrate the concept of a flash loan arbitrage bot without revealing sensitive implementation details or making real transactions.

## What is Flash Loan Arbitrage?

Flash loan arbitrage is a trading strategy that:

1. Takes out an uncollateralized loan (a "flash loan")
2. Uses the borrowed funds to exploit price differences between exchanges
3. Repays the loan (plus fees) in the same transaction
4. Keeps the profit from the arbitrage

This requires no initial capital, making it accessible to anyone with the technical knowledge to implement it.

## Features

This mock implementation demonstrates:

- Connecting to mock blockchain RPC nodes
- Simulating token swaps and flash loans
- Detecting simulated arbitrage opportunities across DEXes
- Simulating arbitrage executions
- In-memory database for storing tokens, pools, and opportunities

## Project Structure

```
src/
├── config/            # Configuration for DEXes and tokens
├── database/          # Mock database implementation
├── executor/          # Transaction executors and DEX integrations
├── orchestrator/      # Arbitrage opportunity detection and execution
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
   git clone https://github.com/yourusername/flashloanbot-mock.git
   cd flashloanbot-mock
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

### Running the Demo

Start the arbitrage bot in demo mode:

```
npm start
```

By default, the demo will run for 5 minutes, simulating scanning for and executing arbitrage opportunities between mocked DEXes.

### Environment Variables

You can customize the demo behavior with these environment variables:

- `DEMO_RUN_TIME_MINS`: How long to run the demo in minutes (default: 5)
- `DEMO_EXECUTE_SWAP`: Set to "true" to execute simulated swaps (default: false)
- `DEBUG`: Set to "true" for more detailed logging

Example:
```
DEBUG=true DEMO_RUN_TIME_MINS=10 DEMO_EXECUTE_SWAP=true npm start
```

## Disclaimer

This is purely a demonstration project. The code is simplified and does not represent a production-ready system. In a real arbitrage bot:

1. You would need proper risk management
2. Extensive testing would be required
3. Significant optimizations would be necessary
4. Real RPC nodes and wallet connections would be used
5. Actual flash loan providers would be integrated

## License

This project is licensed under the MIT License - see the LICENSE file for details. 