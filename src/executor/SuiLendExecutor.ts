import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { createResilientSuiClient } from '../utils/rpc';
import { fromB64 } from '@mysten/sui.js/utils';
import { SuilendClient } from '@suilend/sdk';
import { mnemonicToSeed } from '@scure/bip39';
import { derivePath } from 'ed25519-hd-key';
import { Buffer } from 'buffer';
import { getTokenAddress, validateTokenFormat, fixTokenFormat } from '../config/sevenk';

// Custom error classes for better error handling
class SuiLendExecutorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuiLendExecutorError';
  }
}

class TokenFormatError extends SuiLendExecutorError {
  constructor(token: string, message: string) {
    super(`Invalid token format for '${token}': ${message}`);
    this.name = 'TokenFormatError';
  }
}

class KeypairInitializationError extends SuiLendExecutorError {
  constructor(message: string) {
    super(`Failed to initialize keypair: ${message}`);
    this.name = 'KeypairInitializationError';
  }
}

class PriceDiscoveryError extends SuiLendExecutorError {
  constructor(inputToken: string, outputToken: string, message: string) {
    super(`Price discovery failed for ${inputToken}/${outputToken}: ${message}`);
    this.name = 'PriceDiscoveryError';
  }
}

// Import or create a simple logger implementation
class SimpleLogger {
  private context: string;
  private debugMode: boolean;
  private logTimestamps: boolean;

  constructor(context: string, debugMode: boolean = false, logTimestamps: boolean = true) {
    this.context = context;
    this.debugMode = debugMode;
    this.logTimestamps = logTimestamps;
  }

  private getTimestamp(): string {
    return this.logTimestamps ? `[${new Date().toISOString()}] ` : '';
  }

  info(message: string, metadata?: any): void {
    console.log(`${this.getTimestamp()}[${this.context}] INFO: ${message}`, metadata || '');
  }

  warn(message: string, metadata?: any): void {
    console.warn(`${this.getTimestamp()}[${this.context}] WARN: ${message}`, metadata || '');
  }

  error(message: string, metadata?: any): void {
    console.error(`${this.getTimestamp()}[${this.context}] ERROR: ${message}`, metadata || '');
  }

  debug(message: string, metadata?: any): void {
    if (this.debugMode) {
      console.debug(`${this.getTimestamp()}[${this.context}] DEBUG: ${message}`, metadata || '');
    }
  }

  trace(message: string, metadata?: any): void {
    if (this.debugMode) {
      console.debug(`${this.getTimestamp()}[${this.context}] TRACE: ${message}`, metadata || '');
    }
  }
}

/**
 * Parameters for executing operations through SuiLend
 */
export interface SuiLendSwapParams {
  inputToken: string;     // Token type to swap from (e.g. "0x2::sui::SUI")
  outputToken: string;    // Token type to swap to
  amount: string;         // Amount to swap in base units
  slippage?: number;      // Slippage tolerance in percentage (default: 0.5%)
  useAllCoins?: boolean;  // Whether to use all available coins (default: false)
  dryRun?: boolean;       // Whether to execute as dry run (default: false)
}

/**
 * Result of price discovery operation
 */
export interface PriceDiscoveryResult {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  expectedOutput: string;
  exchangeRate: string;
  minReceived?: string;
  priceImpact?: string;
  fee?: string;
  source: string;
  _isFallback?: boolean;
  _error?: string;
  routeInfo?: any;
}

/**
 * SuiLend Executor
 * Handles swaps and price discovery using SuiLend protocol
 */
export class SuiLendExecutor {
  private client: SuiClient | null = null;
  private suilendClient: SuilendClient | null = null;
  private logger: SimpleLogger;
  private keypair: Ed25519Keypair | null = null;
  private signerAddress: string | null = null;
  private debugMode: boolean = false;
  private lendingMarketId: string | null = null;
  private lendingMarketType: string | null = null;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // ms

  constructor() {
    // Check for debug mode in environment
    this.debugMode = process.env.LOG_LEVEL === 'debug' || process.env.DEBUG === 'true';
    this.logger = new SimpleLogger('SuiLendExecutor', this.debugMode, true);
    
    // Get lending market ID from environment or use default
    this.lendingMarketId = process.env.SUILEND_LENDING_MARKET_ID || null;
    this.lendingMarketType = process.env.SUILEND_LENDING_MARKET_TYPE || null;
    
    // Set retry parameters from environment or use defaults
    this.retryAttempts = parseInt(process.env.SUILEND_RETRY_ATTEMPTS || '3', 10);
    this.retryDelay = parseInt(process.env.SUILEND_RETRY_DELAY || '1000', 10);
  }

  /**
   * Creates a keypair from a mnemonic phrase
   * @param mnemonic The mnemonic seed phrase
   * @param path Optional derivation path (defaults to m/44'/784'/0'/0'/0')
   * @returns Ed25519Keypair
   */
  private async mnemonicToKeypair(mnemonic: string, path: string = "m/44'/784'/0'/0'/0'"): Promise<Ed25519Keypair> {
    try {
      this.logger.debug('Converting mnemonic to keypair', { path });
      
      // Convert mnemonic to seed bytes
      const seedBytes = await mnemonicToSeed(mnemonic);

      // Derive the private key using the path
      const { key } = derivePath(path, Buffer.from(seedBytes).toString('hex'));

      // Create and return keypair
      return Ed25519Keypair.fromSecretKey(key);
    } catch (error) {
      this.logger.error('Failed to convert mnemonic to keypair', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        path
      });
      throw new KeypairInitializationError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Initialize the executor with RPC client and keypair
   */
  async initialize(): Promise<void> {
    try {
      // Initialize SUI client
      this.logger.info('Initializing SUI client');
      this.client = await createResilientSuiClient();
      this.logger.info('SUI client initialized successfully');

      this.logger.info('Initializing SuiLend executor');

      // Initialize keypair if private key is available
      const privateKeyData = process.env.PRIVATE_KEY;
      if (!privateKeyData) {
        this.logger.error('No private key found in environment');
        throw new SuiLendExecutorError('No private key found in environment');
      }

      try {
        this.logger.debug('Attempting to parse private key', { 
          dataLength: privateKeyData.length,
          dataType: this.detectKeyType(privateKeyData)
        });

        // Handle different key formats
        if (privateKeyData.startsWith('suiprivkey')) {
          // Base64 format with prefix
          const privateKeyBase64 = privateKeyData.replace('suiprivkey', '');
          this.logger.debug('Parsing base64 private key');
          let privateKeyBytes = fromB64(privateKeyBase64);
          if (privateKeyBytes.length > 32) {
            this.logger.debug('Truncating private key bytes to 32 bytes');
            privateKeyBytes = privateKeyBytes.slice(0, 32);
          }
          this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
        } else if (/^[0-9a-fA-F]{64}$/.test(privateKeyData)) {
          // Raw hex format (64 characters)
          this.logger.debug('Parsing hex private key');
          this.keypair = Ed25519Keypair.fromSecretKey(
            Uint8Array.from(Buffer.from(privateKeyData, 'hex'))
          );
        } else if (privateKeyData.includes(' ')) {
          // Mnemonic format (space-separated words)
          this.logger.debug('Parsing mnemonic phrase');
          this.keypair = await this.mnemonicToKeypair(privateKeyData);
        } else {
          throw new KeypairInitializationError('Unrecognized private key format');
        }

        this.signerAddress = this.keypair.toSuiAddress();
        this.logger.info('Keypair initialized successfully', { 
          publicKey: this.keypair.toSuiAddress()
        });
      } catch (error) {
        this.logger.error('Failed to initialize keypair', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          keyType: this.detectKeyType(privateKeyData)
        });
        throw new KeypairInitializationError(error instanceof Error ? error.message : 'Unknown error');
      }

      // Check if lending market ID and type are provided
      if (!this.lendingMarketId || !this.lendingMarketType) {
        this.logger.warn('Lending market ID or type not provided, using default values');
        
        // Try to get default market ID and type from SuiLend SDK constants
        this.lendingMarketId = process.env.SUILEND_LENDING_MARKET_ID || null;
        this.lendingMarketType = process.env.SUILEND_LENDING_MARKET_TYPE || null;
        
        if (!this.lendingMarketId || !this.lendingMarketType) {
          this.logger.warn('No default lending market ID or type found, some operations may fail');
        } else {
          this.logger.debug('Using default lending market', {
            marketId: this.lendingMarketId,
            marketType: this.lendingMarketType
          });
        }
      }

      try {
        // Initialize SuilendClient if available
        this.logger.info('Attempting to initialize SuiLend client');
        if (SuilendClient) {
          // TODO: Replace with actual SuiLend SDK initialization once available
          // this.suilendClient = new SuilendClient(...);
          this.logger.info('SuiLend client initialization skipped, using fallback approach');
        } else {
          this.logger.warn('SuiLend SDK not available, using fallback approach');
        }
      } catch (error) {
        this.logger.warn('Error initializing SuiLend client, will use fallback approach', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      this.logger.info('SuiLend executor initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing SuiLend executor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Utility method to detect the type of private key
   */
  private detectKeyType(keyData: string): string {
    if (keyData.startsWith('suiprivkey')) {
      return 'base64 with prefix';
    } else if (/^[0-9a-fA-F]{64}$/.test(keyData)) {
      return 'hex';
    } else if (keyData.includes(' ')) {
      return 'mnemonic';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get a properly formatted token address
   * @param symbolOrAddress Token symbol or address
   * @returns Formatted token address or fixed version of input
   */
  async getProperTokenAddress(symbolOrAddress: string): Promise<string> {
    try {
      this.logger.debug(`Getting proper token address for: ${symbolOrAddress}`);
      
      // First try to get from database
      const dbAddress = await getTokenAddress(symbolOrAddress);
      if (dbAddress) {
        this.logger.debug(`Found token address in database: ${dbAddress} for ${symbolOrAddress}`);
        return dbAddress;
      }

      // If not found in database, try to fix the format
      this.logger.debug(`Token ${symbolOrAddress} not found in database, attempting to fix format`);
      const fixedAddress = fixTokenFormat(symbolOrAddress);

      if (fixedAddress !== symbolOrAddress) {
        this.logger.debug(`Fixed token address format: ${symbolOrAddress} → ${fixedAddress}`);
      }

      // Verify the fixed address is valid
      if (!validateTokenFormat(fixedAddress)) {
        this.logger.warn(`Fixed address still invalid: ${fixedAddress}`);
      }

      return fixedAddress;
    } catch (error) {
      this.logger.error(`Error getting token address for ${symbolOrAddress}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return the original as last resort
      return symbolOrAddress;
    }
  }

  /**
   * Get price information for a token pair
   * @param params Token pair and amount parameters
   * @returns Price discovery information
   */
  async getPriceInfo(params: SuiLendSwapParams): Promise<PriceDiscoveryResult> {
    if (!this.client) {
      this.logger.debug('Client not initialized, initializing now');
      await this.initialize();
    }

    try {
      this.logger.info('Starting price discovery', {
        input: params.inputToken,
        output: params.outputToken,
        amount: params.amount
      });

      // Get properly formatted token addresses
      let inputToken = params.inputToken;
      let outputToken = params.outputToken;

      // If token formats are invalid, try to get them from database
      if (!validateTokenFormat(inputToken)) {
        this.logger.debug(`Input token format invalid: ${inputToken}, attempting to fix`);
        inputToken = await this.getProperTokenAddress(inputToken);
      }

      if (!validateTokenFormat(outputToken)) {
        this.logger.debug(`Output token format invalid: ${outputToken}, attempting to fix`);
        outputToken = await this.getProperTokenAddress(outputToken);
      }

      // Validate the final token formats
      if (!validateTokenFormat(inputToken)) {
        this.logger.error(`Invalid input token format after correction attempts: ${inputToken}`);
        throw new TokenFormatError(inputToken, 'Could not convert to valid format');
      }

      if (!validateTokenFormat(outputToken)) {
        this.logger.error(`Invalid output token format after correction attempts: ${outputToken}`);
        throw new TokenFormatError(outputToken, 'Could not convert to valid format');
      }

      this.logger.info('Getting price info for validated token pair', {
        inputToken,
        outputToken,
        amount: params.amount
      });

      // Attempt SuiLend SDK price discovery first if available
      if (this.suilendClient) {
        try {
          this.logger.debug('Attempting SDK price discovery');
          // TODO: Implement actual SDK price discovery when available
          // const sdkResult = await this.suilendClient.getPrice(...);
          // return sdkResult;
          throw new Error('SDK implementation not available');
        } catch (error) {
          this.logger.warn('SDK price discovery failed, falling back to alternative method', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Using the fallback approach
      return await this.getFallbackPriceInfo(inputToken, outputToken, params.amount);
    } catch (error) {
      this.logger.error('Error in price discovery', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw specific errors
      if (error instanceof TokenFormatError || error instanceof PriceDiscoveryError) {
        throw error;
      }
      
      // Or wrap generic errors
      throw new PriceDiscoveryError(
        params.inputToken, 
        params.outputToken, 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Execute a price discovery operation with retry logic
   * @param operation The async operation to retry
   * @returns The result of the successful operation
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        this.logger.debug(`Attempt ${attempt}/${this.retryAttempts}`);
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Attempt ${attempt} failed`, {
          error: lastError.message,
          willRetry: attempt < this.retryAttempts
        });
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * attempt;
          this.logger.debug(`Waiting ${delay}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after maximum retry attempts');
  }

  /**
   * Generate a fallback price quote when SuiLend API is unavailable
   * This uses market data approximations for common pairs
   * @param inputToken Input token type
   * @param outputToken Output token type
   * @param amount Amount to swap
   * @returns A simulated price info response
   */
  private async getFallbackPriceInfo(
    inputToken: string, 
    outputToken: string, 
    amount: string
  ): Promise<PriceDiscoveryResult> {
    this.logger.info('Generating fallback price info', {
      inputToken,
      outputToken,
      amount
    });

    return await this.withRetry(async () => {
      try {
        // Basic price estimation for common pairs
        const inputAmount = parseFloat(amount);
        if (isNaN(inputAmount)) {
          throw new PriceDiscoveryError(inputToken, outputToken, `Invalid amount: ${amount}`);
        }
        
        let exchangeRate = 1.0;  // Default exchange rate
        let priceImpact = '0';
        let source = 'suilend_fallback';
        
        // Apply some basic logic for common pairs
        if (
          (inputToken.includes('::sui::SUI') && outputToken.includes('::usdc::')) ||
          (inputToken.includes('::sui::SUI') && outputToken.includes('coin::COIN') && outputToken.includes('5d4b302'))
        ) {
          // SUI to USDC: $1 = ~20 SUI (example rate)
          exchangeRate = 0.05;
          source = 'suilend_fallback_sui_usdc';
          this.logger.debug('Applied SUI to USDC exchange rate');
        } else if (
          (outputToken.includes('::sui::SUI') && inputToken.includes('::usdc::')) ||
          (outputToken.includes('::sui::SUI') && inputToken.includes('coin::COIN') && inputToken.includes('5d4b302'))
        ) {
          // USDC to SUI: 1 USDC = ~20 SUI
          exchangeRate = 20;
          source = 'suilend_fallback_usdc_sui';
          this.logger.debug('Applied USDC to SUI exchange rate');
        } else if (
          (inputToken.includes('::btc::') || inputToken.includes('BTC')) && 
          (outputToken.includes('::usdc::') || outputToken.includes('USDC'))
        ) {
          // BTC to USDC: 1 BTC = ~65,000 USDC (example rate)
          exchangeRate = 65000;
          source = 'suilend_fallback_btc_usdc';
          this.logger.debug('Applied BTC to USDC exchange rate');
        } else if (
          (outputToken.includes('::btc::') || outputToken.includes('BTC')) && 
          (inputToken.includes('::usdc::') || inputToken.includes('USDC'))
        ) {
          // USDC to BTC: 1 USDC = ~0.000015 BTC
          exchangeRate = 0.000015;
          source = 'suilend_fallback_usdc_btc';
          this.logger.debug('Applied USDC to BTC exchange rate');
        } else if (
          (inputToken.includes('::eth::') || inputToken.includes('ETH')) && 
          (outputToken.includes('::usdc::') || outputToken.includes('USDC'))
        ) {
          // ETH to USDC: 1 ETH = ~3,500 USDC (example rate)
          exchangeRate = 3500;
          source = 'suilend_fallback_eth_usdc';
          this.logger.debug('Applied ETH to USDC exchange rate');
        } else if (
          (outputToken.includes('::eth::') || outputToken.includes('ETH')) && 
          (inputToken.includes('::usdc::') || inputToken.includes('USDC'))
        ) {
          // USDC to ETH: 1 USDC = ~0.00029 ETH
          exchangeRate = 0.00029;
          source = 'suilend_fallback_usdc_eth';
          this.logger.debug('Applied USDC to ETH exchange rate');
        } else {
          // For other pairs, apply a small random variance
          exchangeRate = 1.0 + (Math.random() * 0.1 - 0.05);
          source = 'suilend_fallback_generic';
          this.logger.debug('Applied generic exchange rate with random variance');
        }

        // Calculate expected output
        const expectedOutput = inputAmount * exchangeRate;
        
        // Calculate price impact based on amount
        // For larger amounts, increase the price impact
        if (inputAmount > 1000) {
          priceImpact = (0.01 + (inputAmount / 100000) * 0.05).toFixed(4);
        } else {
          priceImpact = '0.005';
        }

        // Calculate minimum received with 0.5% slippage
        const slippage = 0.005;
        const minReceived = (expectedOutput * (1 - slippage)).toString();

        this.logger.info('Generated fallback price info successfully', {
          inputToken,
          outputToken,
          inputAmount: amount,
          expectedOutput: expectedOutput.toString(),
          exchangeRate: exchangeRate.toString(),
          priceImpact,
          source
        });

        // Return simulated price info
        return {
          inputToken,
          outputToken,
          inputAmount: amount,
          expectedOutput: expectedOutput.toString(),
          exchangeRate: exchangeRate.toString(),
          minReceived,
          priceImpact,
          fee: '0.003',  // 0.3% fee
          source,
          _isFallback: true,
          routeInfo: {
            pools: ['fallback_direct_pool'],
            path: [inputToken, outputToken]
          }
        };
      } catch (error) {
        this.logger.error('Error generating fallback price info', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          inputToken,
          outputToken,
          amount
        });
        
        if (error instanceof PriceDiscoveryError) {
          throw error;
        }
        
        // Return a basic fallback as last resort
        return {
          inputToken,
          outputToken,
          inputAmount: amount,
          expectedOutput: amount,  // 1:1 exchange rate as fallback
          exchangeRate: '1.0',
          source: 'suilend_fallback_error',
          _isFallback: true,
          _error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Check if a token pair can be traded using SuiLend
   * @param inputToken Input token type
   * @param outputToken Output token type
   * @returns True if the pair can be traded
   */
  async canTradePair(inputToken: string, outputToken: string): Promise<boolean> {
    if (!this.client) {
      await this.initialize();
    }

    try {
      this.logger.debug(`Checking if token pair can be traded: ${inputToken}/${outputToken}`);
      
      // Get properly formatted token addresses
      if (!validateTokenFormat(inputToken)) {
        this.logger.debug(`Input token format invalid: ${inputToken}, attempting to fix`);
        inputToken = await this.getProperTokenAddress(inputToken);
      }

      if (!validateTokenFormat(outputToken)) {
        this.logger.debug(`Output token format invalid: ${outputToken}, attempting to fix`);
        outputToken = await this.getProperTokenAddress(outputToken);
      }

      // For now, return true for common token pairs
      const commonInputTokens = ['0x2::sui::SUI', '::usdc::', '::usdt::', '::eth::', '::btc::'];
      const commonOutputTokens = ['0x2::sui::SUI', '::usdc::', '::usdt::', '::eth::', '::btc::'];
      
      const isCommonInput = commonInputTokens.some(token => inputToken.includes(token));
      const isCommonOutput = commonOutputTokens.some(token => outputToken.includes(token));
      
      if (isCommonInput && isCommonOutput) {
        this.logger.info(`Token pair ${inputToken}/${outputToken} can be traded through SuiLend`);
        return true;
      }
      
      // If SuilendClient is available, try to check with SDK
      if (this.suilendClient) {
        try {
          // TODO: Implement actual can trade check with SDK
          // return await this.suilendClient.canTrade(inputToken, outputToken);
        } catch (error) {
          this.logger.warn(`SDK check for tradable pair failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      this.logger.info(`Token pair ${inputToken}/${outputToken} cannot be traded through SuiLend`);
      return false;
    } catch (error) {
      this.logger.error(`Error checking if token pair ${inputToken}/${outputToken} can be traded`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }
}

export default SuiLendExecutor; 