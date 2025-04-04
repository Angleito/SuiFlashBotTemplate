/**
 * Simple Navi Protocol Flashloan Example
 *
 * This example demonstrates how to execute a flashloan using the Navi Protocol on the Sui blockchain.
 * It shows the complete lifecycle of a flashloan transaction:
 * 1. Initializing the SDK and connecting to the blockchain
 * 2. Setting up the flashloan parameters
 * 3. Creating a transaction block with the flashloan operation
 * 4. Performing an action with the borrowed funds (in this case, just logging)
 * 5. Repaying the flashloan
 * 6. Executing the transaction
 *
 * This example is intended for educational purposes and to demonstrate integration with Navi Protocol.
 */

import 'dotenv/config'; // Load environment variables
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { NAVISDKClient } from 'navi-sdk';
import { flashloan, repayFlashLoan } from 'navi-sdk/dist/libs/PTB';
import { PoolConfig } from 'navi-sdk/dist/types';
// Import necessary modules and constants
// Note: We're using the real Navi Protocol package ID and pool IDs from the API
import { Logger } from '../utils/logger';

// Initialize logger with a descriptive context
const logger = Logger.getInstance('NaviFlashloanExample');

/**
 * Main function to execute a Navi Protocol flashloan
 */
async function executeNaviFlashloan() {
  try {
    logger.info("=== Starting Navi Protocol Flashloan Example ===");

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

    // Configure the token to borrow (USDC in this example)
    // Using real Navi Protocol pool IDs from the API
    const coinSymbol = 'USDC';
    logger.info(`Target Token: ${coinSymbol}`);

    // Define the pool configuration for USDC using environment variables
    // Pool ID 1 corresponds to USDC in the Navi Protocol pools
    const poolId = process.env.NAVI_USDC_POOL_ID || '0x14d8b80d3d3d7dab5a658e696ff994489b6b6a6f01f146099e9a435c04794b03';
    const coinType = process.env.NAVI_USDC_COIN_TYPE || '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';

    const selectedPoolConfig: PoolConfig = {
      poolId,
      type: coinType,
      assetId: '1',
      fee: '0',
      rewardFundId: '0x0'
    };

    logger.info(`Using Pool Config:`, {
      poolId: selectedPoolConfig.poolId,
      tokenType: selectedPoolConfig.type
    });

    // Configure the amount to borrow (1 USDC in this example)
    const USDC_DECIMALS = 6; // USDC has 6 decimal places
    const borrowAmountUnits = 1; // Borrow 1 USDC
    const borrowAmount = borrowAmountUnits * (10 ** USDC_DECIMALS);
    logger.info(`Borrow Amount: ${borrowAmountUnits} ${coinSymbol} (${borrowAmount} base units)`);

    // Gas budget for the transaction
    const gasBudget = process.env.GAS_BUDGET ? parseInt(process.env.GAS_BUDGET, 10) : 50000000;
    logger.info(`Gas Budget: ${gasBudget}`);
    // -------- END CONFIGURATION --------

    // -------- INITIALIZE SDK CLIENT --------
    logger.info("Initializing Sui client and Navi SDK...");

    // Initialize Sui client
    const suiClient = new SuiClient({ url: rpcUrl });

    // Initialize Navi SDK client
    // Using the latest package ID from the Navi Protocol API or environment variable
    const packageId = process.env.NAVI_PACKAGE_ID || '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';
    logger.info(`Using Navi Protocol package ID: ${packageId}`);

    const naviClient = new NAVISDKClient({
      networkType: network as 'mainnet' | 'testnet' | 'devnet',
      fullnodeUrl: rpcUrl,
      mnemonic,
      packageId // Latest package ID from API
    });

    // Get the first account from the SDK
    const account = naviClient.accounts[0];
    const sender = account.address;
    logger.info(`Using sender address: ${sender}`);
    // -------- END INITIALIZE SDK CLIENT --------

    // -------- CREATE TRANSACTION BLOCK --------
    logger.info("Creating transaction block...");
    const txb = new TransactionBlock();
    txb.setSender(sender);

    // Step 1: Execute flashloan - borrow funds
    logger.info(`Executing flashloan to borrow ${borrowAmountUnits} ${coinSymbol}...`);
    const [borrowedBalance, receipt] = flashloan(
      txb as any,
      selectedPoolConfig as PoolConfig,
      borrowAmount
    );
    logger.info("Flashloan borrow operation added to transaction block.");

    // Step 2: This is where you would typically perform operations with the borrowed funds
    // For example, swap tokens, provide liquidity, etc.
    // In this example, we're just logging that we received the funds
    logger.info("In a real scenario, you would perform operations with the borrowed funds here.");
    logger.info("For example: swap tokens, provide liquidity, execute arbitrage, etc.");

    // Step 3: Repay the flashloan
    logger.info("Adding flashloan repayment operation...");
    repayFlashLoan(
      txb as any,
      selectedPoolConfig as PoolConfig,
      receipt,
      borrowedBalance
    );
    logger.info("Flashloan repayment operation added to transaction block.");

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
      signer: account.keypair as unknown as Ed25519Keypair,
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

    logger.info("=== Navi Protocol Flashloan Example Completed ===");
    return result;

  } catch (error: any) {
    // Handle any errors that occur during execution
    logger.error("Error executing Navi flashloan:", {
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Execute the flashloan example if this file is run directly
if (require.main === module) {
  executeNaviFlashloan()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

// Export the function for use in other files or tests
export { executeNaviFlashloan };
