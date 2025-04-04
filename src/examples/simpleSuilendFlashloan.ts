/**
 * Simple SuiLend Protocol Flashloan Example
 *
 * This example demonstrates how to execute a flashloan using the SuiLend Protocol on the Sui blockchain.
 * It shows the complete lifecycle of a flashloan transaction:
 * 1. Initializing the SDK and connecting to the blockchain
 * 2. Setting up the flashloan parameters
 * 3. Creating a transaction block with the flashloan operation
 * 4. Performing an action with the borrowed funds (in this case, just logging)
 * 5. Repaying the flashloan
 * 6. Executing the transaction
 *
 * This example is intended for educational purposes and to demonstrate integration with SuiLend Protocol.
 */

import 'dotenv/config'; // Load environment variables
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import { SuilendClient } from '@suilend/sdk';
import { Logger } from '../utils/logger';

// Initialize logger with a descriptive context
const logger = Logger.getInstance('SuilendFlashloanExample');

/**
 * Main function to execute a SuiLend Protocol flashloan
 */
async function executeSuilendFlashloan() {
  try {
    logger.info("=== Starting SuiLend Protocol Flashloan Example ===");

    // -------- CONFIGURATION --------
    // Network configuration - can be 'mainnet', 'testnet', or 'devnet'
    const network = process.env.SUI_NETWORK || 'testnet';
    logger.info(`Target Network: ${network}`);

    // RPC endpoint - use environment variable or default to public endpoint
    const rpcUrl = process.env.SUI_RPC_URL ||
      (network === 'mainnet'
        ? 'https://fullnode.mainnet.sui.io:443'
        : 'https://fullnode.testnet.sui.io:443');
    logger.info(`Using RPC URL: ${rpcUrl}`);

    // Get mnemonic from environment variables
    const mnemonic = process.env.SUI_MNEMONIC;
    if (!mnemonic) {
      logger.error("Error: SUI_MNEMONIC environment variable is not set. Please set it in your .env file.");
      return;
    }
    logger.info("Successfully loaded wallet mnemonic from environment variables.");

    // SuiLend lending market ID - use the real contract ID or from environment variables
    const lendingMarketId = process.env.SUILEND_LENDING_MARKET_ID || '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904';
    logger.info(`Using SuiLend lending market ID: ${lendingMarketId}`);

    // SuiLend lending market type - use the real contract type or from environment variables
    const lendingMarketType = process.env.SUILEND_LENDING_MARKET_TYPE ||
      '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904::lending_market::LendingMarket';
    logger.info(`Using SuiLend lending market type: ${lendingMarketType}`);

    // Configure the token to borrow (USDC in this example)
    const coinType = process.env.SUILEND_COIN_TYPE || '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN'; // USDC
    logger.info(`Target Token: ${coinType}`);

    // Configure the amount to borrow (1 USDC in this example)
    const USDC_DECIMALS = 6; // USDC has 6 decimal places
    const borrowAmountUnits = 1; // Borrow 1 USDC
    const borrowAmount = borrowAmountUnits * (10 ** USDC_DECIMALS);
    logger.info(`Borrow Amount: ${borrowAmountUnits} USDC (${borrowAmount} base units)`);

    // Gas budget for the transaction
    const gasBudget = process.env.GAS_BUDGET ? parseInt(process.env.GAS_BUDGET, 10) : 50000000;
    logger.info(`Gas Budget: ${gasBudget}`);
    // -------- END CONFIGURATION --------

    // -------- INITIALIZE SDK CLIENT --------
    logger.info("Initializing Sui client and SuiLend SDK...");

    // Initialize Sui client
    const suiClient = new SuiClient({ url: rpcUrl });

    // Create keypair from mnemonic
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
    const sender = keypair.toSuiAddress();
    logger.info(`Using sender address: ${sender}`);

    // Initialize SuiLend client
    const suilendClient = await SuilendClient.initialize(
      lendingMarketId,
      lendingMarketType,
      suiClient
    );
    logger.info("SuiLend client initialized successfully");
    // -------- END INITIALIZE SDK CLIENT --------

    // -------- CREATE TRANSACTION BLOCK --------
    logger.info("Creating transaction block...");
    const txb = new Transaction();
    txb.setSender(sender);

    // Step 1: Create a temporary obligation for the flashloan
    logger.info("Creating temporary obligation for flashloan...");
    const obligationId = suilendClient.createObligation(txb);

    // Step 2: Find the reserve array index for the coin type we want to borrow
    const reserveArrayIndex = suilendClient.findReserveArrayIndex(coinType);
    if (Number(reserveArrayIndex) === -1) {
      logger.error(`Error: Reserve for ${coinType} not found in the lending market.`);
      return;
    }
    logger.info(`Found reserve at index: ${reserveArrayIndex}`);

    // Step 3: Execute flashloan - borrow funds
    logger.info(`Executing flashloan to borrow ${borrowAmountUnits} USDC...`);

    // Borrow the funds
    const borrowResult = txb.moveCall({
      target: `${suilendClient.lendingMarket.packageId}::lending_market::borrow`,
      typeArguments: [lendingMarketType, coinType],
      arguments: [
        txb.object(suilendClient.lendingMarket.id),
        txb.pure.u64(reserveArrayIndex),
        txb.pure.id(obligationId),
        txb.pure.u64(borrowAmount),
        txb.object(SUI_CLOCK_OBJECT_ID)
      ]
    });

    // Step 4: This is where you would typically perform operations with the borrowed funds
    // For example, swap tokens, provide liquidity, execute arbitrage, etc.
    logger.info("In a real scenario, you would perform operations with the borrowed funds here.");
    logger.info("For example: swap tokens, provide liquidity, execute arbitrage, etc.");

    // Step 5: Repay the flashloan
    logger.info("Adding flashloan repayment operation...");
    txb.moveCall({
      target: `${suilendClient.lendingMarket.packageId}::lending_market::repay`,
      typeArguments: [lendingMarketType, coinType],
      arguments: [
        txb.object(suilendClient.lendingMarket.id),
        txb.pure.u64(reserveArrayIndex),
        txb.pure.id(obligationId),
        borrowResult,
        txb.pure.u64(borrowAmount),
        txb.object(SUI_CLOCK_OBJECT_ID)
      ]
    });

    // Set the gas budget for the transaction
    txb.setGasBudget(gasBudget);
    // -------- END CREATE TRANSACTION BLOCK --------

    // -------- EXECUTE TRANSACTION --------
    logger.info("Building and executing transaction...");

    // Build the transaction
    const builtTx = await txb.build({ client: suiClient });

    // Sign and execute the transaction
    const result = await suiClient.signAndExecuteTransactionBlock({
      transactionBlock: builtTx,
      signer: keypair,
      options: {
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      },
      requestType: "WaitForLocalExecution"
    });

    // Log the transaction result
    logger.info("Transaction executed successfully!", {
      digest: result.digest,
      status: result.effects?.status?.status || "Unknown"
    });

    // Log the transaction URL for block explorer
    const explorerUrl = network === 'mainnet'
      ? `https://explorer.sui.io/txblock/${result.digest}?network=mainnet`
      : `https://explorer.sui.io/txblock/${result.digest}?network=testnet`;
    logger.info(`View transaction in explorer: ${explorerUrl}`);
    // -------- END EXECUTE TRANSACTION --------

    logger.info("=== SuiLend Protocol Flashloan Example Completed ===");
    return result;

  } catch (error: any) {
    // Handle any errors that occur during execution
    logger.error("Error executing SuiLend flashloan:", {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Execute the flashloan example if this file is run directly
if (require.main === module) {
  executeSuilendFlashloan()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

// Export the function for use in other files or tests
export { executeSuilendFlashloan };
