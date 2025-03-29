/**
 * Mock Flash Loan Arbitrage Bot - Main Entry Point
 * This is a demo version that simulates arbitrage detection and execution without real blockchain interaction
 */

import { ArbitrageOrchestrator } from './orchestrator/ArbitrageOrchestrator';
import { mockDatabase } from './database/MockDatabase';
import { SevenKSwapExecutor } from './executor/SevenKSwapExecutor';

// Simple logging for demonstration
const log = {
  info: (message: string, meta?: any) => console.log(`[MAIN] INFO: ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[MAIN] WARN: ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[MAIN] ERROR: ${message}`, meta || '')
};

/**
 * Main application class for arbitrage detection and execution
 */
class MockFlashLoanArbitrageBot {
  private orchestrator: ArbitrageOrchestrator;
  private runningTime: number = 0;
  private timer: NodeJS.Timeout | null = null;
  
  constructor() {
    this.orchestrator = new ArbitrageOrchestrator();
    log.info('Mock Arbitrage Bot created');
  }
  
  /**
   * Initialize the bot systems
   */
  async initialize(): Promise<void> {
    try {
      log.info('Initializing Mock Arbitrage Bot');
      
      // First simulate connecting to the database
      await mockDatabase.connect();
      log.info('Database connection established');
      
      // Initialize the arbitrage orchestrator
      await this.orchestrator.initialize();
      log.info('Arbitrage orchestrator initialized');
      
      // Run a basic demo - test 7k swap functionality for key tokens
      await this.demoSevenKSwap();
      
      log.info('Mock Arbitrage Bot initialization completed successfully');
    } catch (error) {
      log.error('Error during Mock Arbitrage Bot initialization', error);
      throw error;
    }
  }
  
  /**
   * Demonstrate 7k swap functionality
   */
  private async demoSevenKSwap(): Promise<void> {
    try {
      log.info('Demonstrating 7K swap functionality');
      
      // Create a swap executor
      const swapExecutor = new SevenKSwapExecutor();
      await swapExecutor.initialize();
      
      // Example token pair (SUI to USDC)
      const inputToken = '0x2::sui::SUI';
      const outputToken = '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN'; // USDC
      
      // Check if route exists
      const routeExists = await swapExecutor.findRoute(inputToken, outputToken);
      
      if (routeExists) {
        log.info(`Route exists for ${inputToken} to ${outputToken}`);
        
        // Get a quote
        const quoteParams = {
          inputToken,
          outputToken,
          amount: '1000000000', // 1 SUI
          slippage: 0.5
        };
        
        const quote = await swapExecutor.getSwapQuote(quoteParams);
        log.info('Received swap quote', {
          inputAmount: quoteParams.amount,
          expectedOutput: quote.returnAmount,
          minimumOutput: quote.amountOutMin,
          price: quote.effectivePrice
        });
        
        // Execute a simulated swap if we're in full demo mode
        if (process.env.DEMO_EXECUTE_SWAP === 'true') {
          log.info('Executing simulated swap');
          const txDigest = await swapExecutor.executeSwap(quoteParams);
          log.info(`Swap executed successfully with tx digest: ${txDigest}`);
        }
      } else {
        log.warn(`No route found for ${inputToken} to ${outputToken}`);
      }
      
      log.info('7K swap demonstration completed');
    } catch (error) {
      log.error('Error during 7K swap demonstration', error);
    }
  }
  
  /**
   * Start the arbitrage bot
   * @param durationMinutes How long to run the bot (in minutes, 0 for indefinite)
   */
  async start(durationMinutes: number = 0): Promise<void> {
    try {
      log.info(`Starting Mock Arbitrage Bot${durationMinutes > 0 ? ` for ${durationMinutes} minutes` : ''}`);
      
      // Start the arbitrage scanner
      await this.orchestrator.startScanning();
      
      // Set a timer to stop the bot after the specified duration if provided
      if (durationMinutes > 0) {
        const durationMs = durationMinutes * 60 * 1000;
        this.timer = setTimeout(() => this.stop(), durationMs);
        
        // Track the running time
        this.runningTime = Date.now();
        
        log.info(`Bot will automatically stop after ${durationMinutes} minutes`);
      } else {
        log.info('Bot will run indefinitely until manually stopped');
      }
    } catch (error) {
      log.error('Error starting Mock Arbitrage Bot', error);
      throw error;
    }
  }
  
  /**
   * Stop the arbitrage bot
   */
  stop(): void {
    log.info('Stopping Mock Arbitrage Bot');
    
    // Stop the scanner
    this.orchestrator.stopScanning();
    
    // Clear the auto-stop timer if it exists
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    // Calculate and display the running time if applicable
    if (this.runningTime > 0) {
      const runTimeMs = Date.now() - this.runningTime;
      const runTimeMins = Math.round(runTimeMs / (60 * 1000) * 10) / 10;
      log.info(`Bot was running for ${runTimeMins} minutes`);
      this.runningTime = 0;
    }
    
    log.info('Mock Arbitrage Bot stopped');
  }
}

/**
 * Run the mock arbitrage bot application
 */
async function main() {
  const bot = new MockFlashLoanArbitrageBot();
  
  // Handle shutdown signals
  process.on('SIGINT', () => {
    log.info('Received SIGINT signal. Shutting down...');
    bot.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log.info('Received SIGTERM signal. Shutting down...');
    bot.stop();
    process.exit(0);
  });
  
  try {
    // Initialize the bot
    await bot.initialize();
    
    // Start the bot with a default run time (5 minutes in demo mode)
    const demoRunTimeMins = process.env.DEMO_RUN_TIME_MINS ? 
      parseInt(process.env.DEMO_RUN_TIME_MINS, 10) : 5;
    
    await bot.start(demoRunTimeMins);
    
    log.info(`Bot is running. Press Ctrl+C to stop.`);
  } catch (error) {
    log.error('Error running Mock Arbitrage Bot', error);
    process.exit(1);
  }
}

// Run the application if this is the main module
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main application:', error);
    process.exit(1);
  });
}

// Export for use in other modules
export { MockFlashLoanArbitrageBot }; 