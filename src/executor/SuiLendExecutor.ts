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

// Import or create a simple logger implementation
class SimpleLogger {
  private context: string;
  private debugMode: boolean;

  constructor(context: string, debugMode: boolean = false) {
    this.context = context;
    this.debugMode = debugMode;
  }

  info(message: string, metadata?: any): void {
    console.log(`[${this.context}] INFO: ${message}`, metadata || '');
  }

  warn(message: string, metadata?: any): void {
    console.warn(`[${this.context}] WARN: ${message}`, metadata || '');
  }

  error(message: string, metadata?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, metadata || '');
  }

  debug(message: string, metadata?: any): void {
    if (this.debugMode) {
      console.debug(`[${this.context}] DEBUG: ${message}`, metadata || '');
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

  constructor() {
    // Check for debug mode in environment
    this.debugMode = process.env.LOG_LEVEL === 'debug' || process.env.DEBUG === 'true';
    this.logger = new SimpleLogger('SuiLendExecutor', this.debugMode);
    
    // Get lending market ID from environment or use default
    this.lendingMarketId = process.env.SUILEND_LENDING_MARKET_ID || null;
    this.lendingMarketType = process.env.SUILEND_LENDING_MARKET_TYPE || null;
  }

  /**
   * Creates a keypair from a mnemonic phrase
   * @param mnemonic The mnemonic seed phrase
   * @param path Optional derivation path (defaults to m/44'/784'/0'/0'/0')
   * @returns Ed25519Keypair
   */
  private async mnemonicToKeypair(mnemonic: string, path: string = "m/44'/784'/0'/0'/0'"): Promise<Ed25519Keypair> {
    // Convert mnemonic to seed bytes
    const seedBytes = await mnemonicToSeed(mnemonic);

    // Derive the private key using the path
    const { key } = derivePath(path, Buffer.from(seedBytes).toString('hex'));

    // Create and return keypair
    return Ed25519Keypair.fromSecretKey(key);
  }

  /**
   * Initialize the executor with RPC client and keypair
   */
  async initialize(): Promise<void> {
    try {
      // Initialize SUI client
      this.client = await createResilientSuiClient();

      this.logger.info('Initializing SuiLend executor');

      // Initialize keypair if private key is available
      const privateKeyData = process.env.PRIVATE_KEY;
      if (!privateKeyData) {
        this.logger.error('No private key found in environment');
        throw new Error('No private key found in environment');
      }

      try {
        this.logger.info('Attempting to parse private key', { 
          dataLength: privateKeyData.length,
          dataType: this.detectKeyType(privateKeyData)
        });

        // Handle different key formats
        if (privateKeyData.startsWith('suiprivkey')) {
          // Base64 format with prefix
          const privateKeyBase64 = privateKeyData.replace('suiprivkey', '');
          this.logger.info('Parsing base64 private key');
          let privateKeyBytes = fromB64(privateKeyBase64);
          if (privateKeyBytes.length > 32) {
            privateKeyBytes = privateKeyBytes.slice(0, 32);
          }
          this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
        } else if (/^[0-9a-fA-F]{64}$/.test(privateKeyData)) {
          // Raw hex format (64 characters)
          this.logger.info('Parsing hex private key');
          this.keypair = Ed25519Keypair.fromSecretKey(
            Uint8Array.from(Buffer.from(privateKeyData, 'hex'))
          );
        } else if (privateKeyData.includes(' ')) {
          // Mnemonic format (space-separated words)
          this.logger.info('Parsing mnemonic phrase');
          this.keypair = await this.mnemonicToKeypair(privateKeyData);
        } else {
          throw new Error('Unrecognized private key format');
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
        throw new Error(`Invalid private key format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Check if lending market ID and type are provided
      if (!this.lendingMarketId || !this.lendingMarketType) {
        this.logger.warn('Lending market ID or type not provided, using default values');
        
        // Try to get default market ID and type from SuiLend SDK constants
        this.lendingMarketId = process.env.SUILEND_LENDING_MARKET_ID;
        this.lendingMarketType = process.env.SUILEND_LENDING_MARKET_TYPE;
      }

      // Skip SuiLend client initialization for now and use fallback approach
      this.logger.warn('Skipping SuiLend client initialization, using fallback approach for price discovery');

      this.logger.info('SuiLend executor initialized with RPC client');
    } catch (error) {
      this.logger.error('Error initializing SuiLend executor', error);
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
      // First try to get from database
      const dbAddress = await getTokenAddress(symbolOrAddress);
      if (dbAddress) {
        this.logger.info(`Using token address from database: ${dbAddress}`);
        return dbAddress;
      }

      // If not found in database, try to fix the format
      this.logger.warn(`Token ${symbolOrAddress} not found in database, attempting to fix format`);
      const fixedAddress = fixTokenFormat(symbolOrAddress);

      if (fixedAddress !== symbolOrAddress) {
        this.logger.info(`Fixed token address format: ${symbolOrAddress} → ${fixedAddress}`);
      }

      return fixedAddress;
    } catch (error) {
      this.logger.error(`Error getting token address for ${symbolOrAddress}`, error);
      // Return the original as last resort
      return symbolOrAddress;
    }
  }

  /**
   * Get price information for a token pair
   * @param params Token pair and amount parameters
   * @returns Price discovery information
   */
  async getPriceInfo(params: SuiLendSwapParams): Promise<any> {
    if (!this.client) {
      await this.initialize();
    }

    try {
      // Get properly formatted token addresses
      let inputToken = params.inputToken;
      let outputToken = params.outputToken;

      // If token formats are invalid, try to get them from database
      if (!validateTokenFormat(inputToken)) {
        inputToken = await this.getProperTokenAddress(inputToken);
      }

      if (!validateTokenFormat(outputToken)) {
        outputToken = await this.getProperTokenAddress(outputToken);
      }

      // Validate the final token formats
      if (!validateTokenFormat(inputToken)) {
        throw new Error(`Invalid input token format: ${inputToken}`);
      }

      if (!validateTokenFormat(outputToken)) {
        throw new Error(`Invalid output token format: ${outputToken}`);
      }

      this.logger.info('Getting price info for token pair', {
        inputToken,
        outputToken,
        amount: params.amount
      });

      // Using the fallback approach directly for now
      return this.getFallbackPriceInfo(inputToken, outputToken, params.amount);
    } catch (error) {
      this.logger.error('Error getting price info', error);
      throw error;
    }
  }

  /**
   * Generate a fallback price quote when SuiLend API is unavailable
   * @param inputToken Input token type
   * @param outputToken Output token type
   * @param amount Amount to swap
   * @returns A simulated price info response
   */
  private async getFallbackPriceInfo(inputToken: string, outputToken: string, amount: string): Promise<any> {
    this.logger.info('Generating fallback price info', {
      inputToken,
      outputToken,
      amount
    });

    try {
      // Basic price estimation for common pairs
      const inputAmount = parseFloat(amount);
      let exchangeRate = 1.0;  // Default exchange rate

      // Apply some basic logic for common pairs
      if (
        (inputToken.includes('::sui::SUI') && outputToken.includes('::usdc::')) ||
        (inputToken.includes('::sui::SUI') && outputToken.includes('coin::COIN') && outputToken.includes('5d4b302'))
      ) {
        // SUI to USDC: $1 = ~20 SUI (example rate)
        exchangeRate = 0.05;
      } else if (
        (outputToken.includes('::sui::SUI') && inputToken.includes('::usdc::')) ||
        (outputToken.includes('::sui::SUI') && inputToken.includes('coin::COIN') && inputToken.includes('5d4b302'))
      ) {
        // USDC to SUI: 1 USDC = ~20 SUI
        exchangeRate = 20;
      } else if (
        (inputToken.includes('::btc::') || inputToken.includes('BTC')) && 
        (outputToken.includes('::usdc::') || outputToken.includes('USDC'))
      ) {
        // BTC to USDC: 1 BTC = ~65,000 USDC (example rate)
        exchangeRate = 65000;
      } else if (
        (outputToken.includes('::btc::') || outputToken.includes('BTC')) && 
        (inputToken.includes('::usdc::') || inputToken.includes('USDC'))
      ) {
        // USDC to BTC: 1 USDC = ~0.000015 BTC
        exchangeRate = 0.000015;
      } else {
        // For other pairs, apply a small random variance
        exchangeRate = 1.0 + (Math.random() * 0.1 - 0.05);
      }

      // Calculate expected output
      const expectedOutput = inputAmount * exchangeRate;

      // Return simulated price info
      return {
        inputToken,
        outputToken,
        inputAmount: amount,
        expectedOutput: expectedOutput.toString(),
        exchangeRate: exchangeRate.toString(),
        source: 'suilend_fallback',
        _isFallback: true
      };
    } catch (error) {
      this.logger.error('Error generating fallback price info', error);
      
      // Return a basic fallback as last resort
      return {
        inputToken,
        outputToken,
        inputAmount: amount,
        expectedOutput: amount,  // 1:1 exchange rate as fallback
        exchangeRate: '1.0',
        source: 'suilend_fallback',
        _isFallback: true,
        _error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
      // Get properly formatted token addresses
      if (!validateTokenFormat(inputToken)) {
        inputToken = await this.getProperTokenAddress(inputToken);
      }

      if (!validateTokenFormat(outputToken)) {
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
      
      this.logger.info(`Token pair ${inputToken}/${outputToken} cannot be traded through SuiLend`);
      return false;
    } catch (error) {
      this.logger.error(`Error checking if token pair ${inputToken}/${outputToken} can be traded`, error);
      return false;
    }
  }
}

export default SuiLendExecutor; 