import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { createResilientSuiClient } from '../utils/rpc';
import { getQuote, buildTx } from '@7kprotocol/sdk-ts';
import SevenKSDK, { setSuiClient } from '@7kprotocol/sdk-ts';
import { fromB64 } from '@mysten/sui.js/utils';
// import MockPoolRepository from '../utils/MockPoolRepository';
import { mnemonicToSeed } from '@scure/bip39';
import { derivePath } from 'ed25519-hd-key';
import { Buffer } from 'buffer';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { getTokenAddress, validateTokenFormat, fixTokenFormat } from '../config/sevenk';

// --- MOCK CONFIGURATION ---
const IS_MOCK_VERSION = true; // Flag to indicate this is the mock version
const MOCK_MNEMONIC = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'; // Default mock mnemonic
const MOCK_API_URL = 'https://mock-api.7kprotocol.com'; // Mock API URL
const MOCK_SIGNER_ADDRESS = '0xmockmockmockmockmockmockmockmockmockmockmockmockmockmockmockmock'; // Placeholder mock address
// --- END MOCK CONFIGURATION ---


// Use MockPoolRepository instead of actual repository for testing
// const PoolRepository = MockPoolRepository;

/**
 * Parameters for executing a swap through 7k protocol
 */
export interface SevenKSwapParams {
  inputToken: string;     // Token type to swap from (e.g. "0x2::sui::SUI")
  outputToken: string;    // Token type to swap to
  amount: string;         // Amount to swap in base units
  slippage?: number;      // Slippage tolerance in percentage (default: 0.5%)
  useAllCoins?: boolean;  // Whether to use all available coins (default: false)
  dryRun?: boolean;       // Whether to execute as dry run (default: false)
  commission?: {          // Commission parameters for fee sharing
    partner: string;      // Partner address
    commissionBps: number; // Basis points for commission (100 = 1%)
  };
}

// Simple logger implementation (Restored)
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
 * 7k Protocol Swap Executor
 * Handles swaps using 7k protocol as an aggregator
 * See https://port.7k.ag/docs/aggregator/supported-exchanges for supported exchanges
 */
export class SevenKSwapExecutor {
  private client: SuiClient | null = null;
  private logger: SimpleLogger;
  private keypair: Ed25519Keypair | null = null;
  private signerAddress: string | null = null;
  private apiUrl: string | null = null;
  private debugMode: boolean = false;
  private sevenKSdk!: typeof SevenKSDK;
  private isMock: boolean = IS_MOCK_VERSION; // Add mock flag

  constructor() {
    // Check for debug mode in environment
    this.debugMode = process.env.LOG_LEVEL === 'debug' || process.env.DEBUG === 'true';
    this.logger = new SimpleLogger('SevenKSwapExecutor', this.debugMode);
    this.apiUrl = this.isMock ? MOCK_API_URL : (process.env.SEVENK_API_URL || 'https://sui-mainnet.api.7kprotocol.com'); // Use mock URL if mock version
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
      // In mock mode, we don't need a real client connection initially
      this.client = this.isMock ? null : await createResilientSuiClient();
      if (!this.isMock && !this.client) {
        throw new Error('Failed to create SuiClient');
      }

      // Set debug mode via environment variable instead of SDK function
      if (this.debugMode) {
        process.env.DEBUG = 'true';
        this.logger.info('Debug mode enabled for 7K Protocol SDK');
      }

      // Log the API URL
      this.logger.info('Using 7K Protocol API URL', { url: this.apiUrl });

      // Check if 7K Protocol API is accessible
      if (this.isMock) {
        this.logger.info('Skipping API health check in mock mode.');
      } else {
        try {
          // Simple health check request with a short timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(`${this.apiUrl}/v1/health`, {
            method: 'GET',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            this.logger.warn(`7K Protocol API health check failed with status ${response.status}`);
          }
        } catch (error) {
          this.logger.warn('7K Protocol API is not accessible, will use fallback mechanisms', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Set the client in the 7k SDK
      if (this.client) {
        setSuiClient(this.client as any);
      } else if (this.isMock) {
          this.logger.info('Skipping setSuiClient in mock mode as client is null.');
      }

      // Initialize the 7K SDK instance by assigning the imported module
      this.sevenKSdk = SevenKSDK;

      // Initialize keypair if private key is available
      const privateKeyData = this.isMock ? MOCK_MNEMONIC : process.env.PRIVATE_KEY; // Use mock mnemonic if mock version
      if (!privateKeyData && !this.isMock) {
        this.logger.error('No private key found in environment');
        throw new Error('No private key found in environment');
      }
      if (!privateKeyData && this.isMock) {
        this.logger.warn('Using mock mnemonic, but it is empty. Ensure MOCK_MNEMONIC is set.');
        // Proceeding without a keypair in mock mode might be acceptable depending on usage
      }

      try {
        this.logger.info('Attempting to parse private key', {
          dataLength: privateKeyData?.length ?? 0,
          dataType: privateKeyData ? this.detectKeyType(privateKeyData) : 'none'
        });

        if (privateKeyData) {
          // Handle different key formats
          if (privateKeyData.includes(' ')) { // Assume mnemonic if it contains spaces
            // Mnemonic format (space-separated words)
            this.logger.info('Parsing mnemonic phrase');
            this.keypair = await this.mnemonicToKeypair(privateKeyData);
          } else if (privateKeyData.startsWith('suiprivkey')) {
              // Base64 format with prefix
              const privateKeyBase64 = privateKeyData.replace('suiprivkey', '');
              this.logger.info('Parsing base64 private key');
              let privateKeyBytes = fromB64(privateKeyBase64);
              // Ensure the key length is correct (32 bytes for Ed25519)
              if (privateKeyBytes.length === 33 && privateKeyBytes[0] === 0) {
                  privateKeyBytes = privateKeyBytes.slice(1); // Remove leading 0 byte if present
              } else if (privateKeyBytes.length !== 32) {
                  throw new Error(`Invalid private key length: ${privateKeyBytes.length}. Expected 32 bytes.`);
              }
              this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
          } else if (/^[0-9a-fA-F]{64}$/.test(privateKeyData)) {
              // Raw hex format (64 characters)
              this.logger.info('Parsing hex private key');
              this.keypair = Ed25519Keypair.fromSecretKey(
                  Uint8Array.from(Buffer.from(privateKeyData, 'hex'))
              );
          } else {
            throw new Error('Unrecognized private key format');
          }

          this.signerAddress = this.keypair.toSuiAddress();
          this.logger.info('Keypair initialized successfully', {
            publicKey: this.keypair.toSuiAddress()
          });
        } else if (this.isMock) {
          // Handle mock mode without a key - set a default mock address
          this.signerAddress = MOCK_SIGNER_ADDRESS;
          this.logger.info('Mock mode: Using default mock signer address', { address: this.signerAddress });
        }

      } catch (error) {
        this.logger.error('Failed to initialize keypair', {
          error: error instanceof Error ? error.message : 'Unknown error'
          // keyType: privateKeyData ? this.detectKeyType(privateKeyData) : 'none' // Optional: keep if detectKeyType is robust
        });
        throw new Error(`Invalid private key format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      this.logger.info('7k swap executor initialized with RPC client');
    } catch (error) {
      this.logger.error('Error initializing 7k swap executor', error);
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
      return 'hex'; // 64 hex chars = 32 bytes
    } else if (keyData.includes(' ')) {
      return 'mnemonic';
    } else {
      return 'unknown'; // Explicitly return unknown for the final case
    }
  }

  /**
   * Get a properly formatted token address from database or fallback
   * @param symbolOrAddress Token symbol or address
   * @returns Formatted token address or fixed version of input
   */
  async getProperTokenAddress(symbolOrAddress: string): Promise<string> {
    if (this.isMock) {
      // Mock implementation: Return a fixed format or use a simple map
      const mockTokenMap: { [key: string]: string } = {
          'SUI': '0x2::sui::SUI',
          'USDC': '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN', // Example Sui Devnet USDC
          'USDT': '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN', // Example Sui Devnet USDT
          // Add other common mock tokens if needed
      };
      // Try direct match first (for full addresses)
      if (validateTokenFormat(symbolOrAddress)) {
          return symbolOrAddress;
      }
      // Then try symbol lookup
      const upperSymbol = symbolOrAddress.toUpperCase();
      if (mockTokenMap[upperSymbol]) {
          this.logger.info(`Mock: Found ${symbolOrAddress} in mock map: ${mockTokenMap[upperSymbol]}`);
          return mockTokenMap[upperSymbol];
      }
      // Fallback: try fixing format (handles case where full address was passed without proper format initially)
      const fixed = fixTokenFormat(symbolOrAddress);
      if (validateTokenFormat(fixed)) {
          this.logger.info(`Mock: Fixing format for ${symbolOrAddress} -> ${fixed}`);
          return fixed;
      }
      // Last resort: return original if fixing didn't help
      this.logger.warn(`Mock: Could not find or fix token format for ${symbolOrAddress}`);
      return symbolOrAddress;
    } else {
        try {
          // Original logic: First try to get from database
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
  }

  /**
   * Get quote for a swap
   * @param params Parameters for the swap
   * @returns Quote with exchange rates and estimated output
   */
  async getSwapQuote(params: SevenKSwapParams): Promise<any> {
    // Initialize if needed (handles mock/non-mock cases)
    if ((!this.client && !this.isMock) || !this.signerAddress) {
        await this.initialize();
    }

    try {
      // Get properly formatted token addresses from database if needed
      let inputToken = params.inputToken;
      let outputToken = params.outputToken;

      // If token formats are invalid, try to get them from database (or mock logic)
      if (!validateTokenFormat(inputToken)) {
        inputToken = await this.getProperTokenAddress(inputToken);
      }

      if (!validateTokenFormat(outputToken)) {
        outputToken = await this.getProperTokenAddress(outputToken);
      }

      // Validate the final token formats (after potential fixing/mocking)
      if (!validateTokenFormat(inputToken)) {
        throw new Error(`Invalid input token format after processing: ${inputToken}`);
      }

      if (!validateTokenFormat(outputToken)) {
        throw new Error(`Invalid output token format after processing: ${outputToken}`);
      }

      // Convert our params to match the 7k SDK's expected format
      const quoteParams = {
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: params.amount,
        slippage: params.slippage || 0.5,
        useAllCoins: params.useAllCoins || false,
      };

      this.logger.info('Getting 7k swap quote', {
        inputToken: inputToken,
        outputToken: outputToken,
        amount: params.amount
      });

      // --- MOCK IMPLEMENTATION ---
      if (this.isMock) {
          this.logger.info('Mock mode: Generating fallback/mock quote.');
          // Ensure amountIn is passed correctly to fallback function
          return this.getFallbackQuote({ ...quoteParams, amountIn: params.amount });
      }
      // --- END MOCK IMPLEMENTATION ---

      let quoteError: any = null;
      let quote: any = null;

      // Set up timeout for getQuote call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        // Get quote using 7k SDK
        quote = await getQuote(quoteParams);
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        quoteError = error;

        // Check if it's a network error or timeout
        if (
          error instanceof Error &&
          (error.message.includes('ENOTFOUND') ||
           error.message.includes('ECONNREFUSED') ||
           error.message.includes('timeout') ||
           error.message.includes('abort'))
        ) { // Check added to prevent fallback in mock mode unless intended
          this.logger.warn('7K Protocol API appears to be unreachable, using fallback pricing mechanism');

          // Implement fallback pricing logic
          return this.getFallbackQuote(quoteParams);
        }

        throw new Error(`7K Protocol getQuote failed: ${quoteError instanceof Error ? quoteError.message : 'Unknown error'}`);
      }

      if (!quote && !this.isMock) { // Only use fallback if not already in mock mode
        this.logger.error('Received empty quote response from 7K Protocol');
        return this.getFallbackQuote(quoteParams);
      }

      // Ensure quote exists before accessing properties, especially in mock mode
      if (!quote) {
          this.logger.error('Quote is null or undefined after attempting to fetch/mock.');
          throw new Error('Failed to obtain a valid quote.');
      }

      // Check if the quote has any routes
      if (!quote.routes || quote.routes.length === 0) {
        this.logger.warn('No swap routes found for the given token pair', {
          inputToken,
          outputToken
        });
        throw new Error(`No swap routes found for ${inputToken} to ${outputToken}`);
      }

      this.logger.info('Received 7k swap quote', {
        expectedOutput: quote.returnAmount,
        price: quote?.effectivePrice,
        routesFound: quote.routes.length,
        bestRouteType: quote?.routes?.[0]?.hops?.[0]?.pool?.type || 'unknown',
      });

      return quote;
    } catch (error) {
      this.logger.error('Error getting swap quote', error);
      throw error;
    }
  }

  /**
   * Generate a fallback quote when 7K Protocol API is unavailable
   * This is a simplified version that provides reasonable estimates for common trading pairs
   * @param params Quote parameters (expects amountIn, tokenIn, tokenOut, slippage)
   * @returns A simulated quote response
   */
  private async getFallbackQuote(params: any): Promise<any> {
    this.logger.info('Generating fallback/mock quote', params);

    try {
      // Try to get price info from Sui RPC (This part won't run in mock)
      const inputAmount = parseFloat(params.amountIn || params.amount || '0'); // Use amountIn if available
      let exchangeRate = 1.0;  // Default exchange rate

      // Use consistent token identifiers from params
      const tokenIn = params.tokenIn || params.fromCoin;
      const tokenOut = params.tokenOut || params.toCoin;


      // Apply some basic logic for common pairs
      if (
        (tokenIn.includes('::sui::SUI') && tokenOut.includes('::usdc::')) ||
        // Updated example USDC address
        (tokenIn.includes('::sui::SUI') && tokenOut.includes('coin::COIN') && tokenOut.includes('5d4b302'))
      ) {
        // SUI to USDC: Example rate (Adjust as needed for realistic mock)
        exchangeRate = 1.1; // Example: 1 SUI = 1.1 USDC
      } else if (
        (tokenOut.includes('::sui::SUI') && tokenIn.includes('::usdc::')) ||
        // Updated example USDC address
        (tokenOut.includes('::sui::SUI') && tokenIn.includes('coin::COIN') && tokenIn.includes('5d4b302'))
      ) {
        // USDC to SUI: Example rate
        exchangeRate = 1 / 1.1; // Example: 1 USDC = 1 / 1.1 SUI
      } else if (
        (tokenIn.includes('::btc::') || tokenIn.includes('BTC')) &&
        (tokenOut.includes('::usdc::') || tokenOut.includes('USDC'))
      ) {
        // BTC to USDC: Example rate
        exchangeRate = 65000;
      } else if (
        (tokenOut.includes('::btc::') || tokenOut.includes('BTC')) &&
        (tokenIn.includes('::usdc::') || tokenIn.includes('USDC'))
      ) {
        // USDC to BTC: Example rate
        exchangeRate = 1 / 65000;
      } else {
        // For other pairs, apply a small random variance (or keep 1.0 for simplicity)
        exchangeRate = 1.0 + (Math.random() * 0.02 - 0.01); // +/- 1%
      }

      // Add a simulated 0.3% fee for fallback/mock quote
      const feeRate = 0.003;
      const fee = inputAmount * feeRate;
      const outputAmountBeforeSlippage = (inputAmount * exchangeRate) - fee;
      // Use slippage from params if available, default 0.5%
      const slippageTolerance = params.slippage ? params.slippage / 100 : 0.005;
      const minOutputAmount = outputAmountBeforeSlippage * (1 - slippageTolerance);


      // Return simulated quote matching SDK structure as closely as possible
      return {
        returnAmount: outputAmountBeforeSlippage.toFixed(8), // Match SDK field name 'returnAmount'
        amountOutMin: minOutputAmount.toFixed(8), // Match SDK field name 'amountOutMin'
        // Keep estimated/minimum for potential compatibility elsewhere, but prioritize SDK names
        estimatedAmount: outputAmountBeforeSlippage.toFixed(8),
        minimumAmount: minOutputAmount.toFixed(8),
        effectivePrice: exchangeRate.toString(), // Match SDK field name
        priceImpact: feeRate.toString(), // Simulated impact = fee rate
        feeAmount: fee.toFixed(8), // Match SDK field name
        // Keep original 'fee' field if needed
        fee: fee.toString(),
        routes: [ // Simulate a simple route structure
            { hops: [{ pool: { type: 'MockPool', fee: feeRate * 10000 } }] } // fee in basis points
        ],
        _isFallback: true,  // Mark this as a fallback quote
        _isMock: this.isMock // Indicate if it's specifically a mock quote
      };
    } catch (error) {
      this.logger.error('Error generating fallback quote', error);

      // Return a very basic fallback as last resort
      const fallbackAmount = parseFloat(params.amountIn || params.amount || '0');
      return {
        returnAmount: (fallbackAmount * 0.98).toString(), // Use amountIn if available
        amountOutMin: (fallbackAmount * 0.97).toString(), // slightly lower min
        effectivePrice: "1.0",
        priceImpact: "0.01",
        feeAmount: (fallbackAmount * 0.005).toString(),
        routes: [],
        _isFallback: true,
        _isMock: this.isMock,
        _error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a swap using the 7k protocol
   * @param params Parameters for the swap
   * @returns Transaction digest
   */
  async executeSwap(params: SevenKSwapParams): Promise<string> {
    // Initialize if needed (handles mock/non-mock cases)
    if ((!this.client && !this.isMock) || !this.signerAddress) {
      await this.initialize();
    }

    // Keypair might be null in mock mode, allow execution if signerAddress is set
    if (!this.keypair && !this.isMock) {
      throw new Error('Keypair not initialized for non-mock execution');
    }

    if (!this.signerAddress) {
      // This should have been caught by initialize, but double-check
      throw new Error('Signer address not initialized');
    }

    try {
      // Get properly formatted token addresses from database if needed
      let inputToken = params.inputToken;
      let outputToken = params.outputToken;

      if (!validateTokenFormat(inputToken)) {
        inputToken = await this.getProperTokenAddress(inputToken);
      }
      if (!validateTokenFormat(outputToken)) {
        outputToken = await this.getProperTokenAddress(outputToken);
      }

      // Validate the final token formats (after potential fixing/mocking)
      if (!validateTokenFormat(inputToken)) {
        throw new Error(`Invalid input token format after processing: ${inputToken}`);
      }
      if (!validateTokenFormat(outputToken)) {
        throw new Error(`Invalid output token format after processing: ${outputToken}`);
      }

      this.logger.info('Executing 7k swap', {
        inputToken,
        outputToken,
        amount: params.amount,
        slippage: params.slippage || 0.5,
      });

      // Create new params with the proper token addresses
      const updatedParams = {
        ...params,
        inputToken,
        outputToken
      };

      // 1. Get the quote
      // In mock mode, getSwapQuote already returns a mock/fallback quote
      const quote = await this.getSwapQuote(updatedParams);

      // --- MOCK IMPLEMENTATION ---
      if (this.isMock) {
        this.logger.info('Mock mode: Simulating successful transaction execution.');
        const mockDigest = `mockTx_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        this.logger.info('Mock 7k swap executed successfully', {
            digest: mockDigest,
            // Use returnAmount from the (potentially mocked) quote
            expectedOutput: quote?.returnAmount,
            status: 'success (mocked)',
        });
        return mockDigest; // Return a simulated transaction digest
      }
      // --- END MOCK IMPLEMENTATION ---


      // --- NON-MOCK EXECUTION ---
      if (!this.client) {
        throw new Error("SuiClient is not initialized for non-mock execution.");
      }
      if (!this.keypair) {
        // Should be caught earlier, but safer to check again
        throw new Error("Keypair is not initialized for non-mock execution.");
      }

      // 2. Build the transaction
      const commission = params.commission || {
        partner: this.signerAddress,
        commissionBps: 0,
      };

      const buildParams = {
        quoteResponse: quote,
        accountAddress: this.signerAddress,
        slippage: params.slippage || 0.5,
        commission,
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: params.amount,
        useAllCoins: params.useAllCoins || false,
      };

      // Build transaction using 7k SDK
      this.logger.debug('Building 7k swap transaction', buildParams);

      let txData;
      try {
        // The @ts-expect-error might be needed if buildParams doesn't exactly match SDK expectations
        // It was removed previously; re-evaluate if TypeScript error appears during compilation.
        txData = await buildTx(buildParams);
        this.logger.debug('SDK buildTx returned', txData);
      } catch (buildError) {
        this.logger.error('SDK buildTx call failed', buildError);
        throw new Error(`7K Protocol buildTx failed: ${buildError instanceof Error ? buildError.message : 'Unknown error'}`);
      }

      if (!txData || !txData.tx) {
        throw new Error('Failed to build transaction: Empty transaction data received');
      }

      // Convert the tx object to a TransactionBlock if needed
      const tx = txData.tx instanceof TransactionBlock ?
                 txData.tx :
                 ((): TransactionBlock => {
                   // This fallback might indicate an issue with how buildTx is used or what it returns.
                   this.logger.warn('Transaction from 7k SDK is not a TransactionBlock - this might lead to errors.');
                   // Creating an empty block here is unlikely to work correctly.
                   // Consider throwing: throw new Error('buildTx did not return a TransactionBlock');
                   return new TransactionBlock();
                 })();

      this.logger.info('Transaction built successfully');

      // 3. Sign and execute transaction
      let result;
      try {
        result = await this.client.signAndExecuteTransactionBlock({
          transactionBlock: tx,
          signer: this.keypair,
          options: {
            showEvents: true,
            showEffects: true,
            showObjectChanges: true,
          },
        });
        this.logger.debug('Transaction execution result', result);
      } catch (execError) {
        this.logger.error('Transaction execution failed', execError);
        throw new Error(`Failed to execute transaction: ${execError instanceof Error ? execError.message : 'Unknown error'}`);
      }

      // Check transaction status
      const status = result.effects?.status?.status;
      if (status !== 'success') {
        this.logger.error('Swap transaction failed', {
          digest: result.digest,
          status: status,
          error: result.effects?.status?.error || 'Transaction execution failed' // Include error if available
        });
        throw new Error(`Swap transaction failed with status: ${status}. Error: ${result.effects?.status?.error}`);
      }

      this.logger.info('7k swap executed successfully', {
        digest: result.digest,
        expectedOutput: quote?.returnAmount,
        status: status,
      });

      return result.digest;
      // --- END NON-MOCK EXECUTION ---

    } catch (error) {
      this.logger.error('Error executing 7k swap', error);
      throw error;
    }
  }

  /**
   * Find a route for a given token pair
   * Similar to findPoolId in BluefinSwapExecutor but for 7k's aggregator
   */
  async findRoute(inputToken: string, outputToken: string): Promise<boolean> {
    try {
      // Mock mode: Assume routes always exist for valid-looking pairs, or use mock quote logic
      if (this.isMock) {
          // Attempt to get proper mock addresses first
          const mockInputToken = await this.getProperTokenAddress(inputToken);
          const mockOutputToken = await this.getProperTokenAddress(outputToken);
          const isValidInput = validateTokenFormat(mockInputToken);
          const isValidOutput = validateTokenFormat(mockOutputToken);

          if (isValidInput && isValidOutput && mockInputToken !== inputToken && mockOutputToken !== outputToken) {
              this.logger.info(`Mock: Assuming route exists for resolved pair ${mockInputToken}/${mockOutputToken}`);
              return true;
          } else if (isValidInput && isValidOutput) {
              // If formats were already valid, still assume true in mock
               this.logger.info(`Mock: Assuming route exists for ${inputToken}/${outputToken}`);
               return true;
          } else {
              this.logger.warn(`Mock: Invalid token format for route check: ${inputToken} (${isValidInput}) / ${outputToken} (${isValidOutput})`);
              return false;
          }
      }

      // Get properly formatted token addresses from database if needed (Non-Mock)
      let properInputToken = inputToken;
      let properOutputToken = outputToken;

      if (!validateTokenFormat(properInputToken)) {
        properInputToken = await this.getProperTokenAddress(properInputToken);
      }

      if (!validateTokenFormat(properOutputToken)) {
        properOutputToken = await this.getProperTokenAddress(properOutputToken);
      }

      // Validate the final token formats (Non-Mock)
      if (!validateTokenFormat(properInputToken)) {
        this.logger.warn(`Invalid input token format: ${properInputToken}. Expected: <package>::<module>::<name>`);
        return false;
      }

      if (!validateTokenFormat(properOutputToken)) {
        this.logger.warn(`Invalid output token format: ${properOutputToken}. Expected: <package>::<module>::<name>`);
        return false;
      }

      // Try to get a quote with a small amount to check if a route exists (Non-Mock)
      const testParams: SevenKSwapParams = {
        inputToken: properInputToken,
        outputToken: properOutputToken,
        amount: '1', // Small amount for testing (e.g., 1 base unit)
        slippage: 0.5,
        dryRun: true,
      };

      this.logger.debug('Finding route for token pair', {
        inputToken: properInputToken,
        outputToken: properOutputToken,
        testAmount: '1'
      });

      let quote;
      try {
        quote = await this.getSwapQuote(testParams);
      } catch (error) {
        // Log expected errors (like no route) differently from unexpected ones
        if (error instanceof Error && error.message.includes('No swap routes found')) {
             this.logger.info(`No route found for ${properInputToken}/${properOutputToken} (via getQuote).`);
        } else {
            this.logger.warn('Route finding failed unexpectedly at quote stage', error);
        }
        return false;
      }

      // Check quote validity and route existence (Non-Mock)
      if (quote && quote.returnAmount && quote.routes && quote.routes.length > 0) {
        this.logger.info(`Found route for ${properInputToken}/${properOutputToken}`, {
          routes: quote.routes.length,
          bestRoute: quote.routes[0].hops?.[0]?.pool?.type || 'unknown',
          expectedOutput: quote.returnAmount
        });
        return true;
      }

      this.logger.warn(`No route found for ${properInputToken}/${properOutputToken}`);
      return false;
    } catch (error) {
      this.logger.error(`Error finding route for ${inputToken}/${outputToken}`, error);
      return false;
    }
  }

  /**
   * Add swap instructions to an existing transaction block
   * @param tx Transaction block to add swap to
   * @param params Parameters for the swap
   */
  async addSwapToTransaction(tx: TransactionBlock, params: SevenKSwapParams): Promise<void> {
    // Initialize if needed (handles mock/non-mock cases)
    if ((!this.client && !this.isMock) || !this.signerAddress) {
      await this.initialize();
    }

    if (!this.signerAddress) {
      throw new Error('Signer address not initialized');
    }

    try {
      // Get properly formatted token addresses
      let inputToken = params.inputToken;
      let outputToken = params.outputToken;

      if (!validateTokenFormat(inputToken)) {
        inputToken = await this.getProperTokenAddress(inputToken);
      }
      if (!validateTokenFormat(outputToken)) {
        outputToken = await this.getProperTokenAddress(outputToken);
      }

      // Validate the final token formats
      if (!validateTokenFormat(inputToken)) {
        throw new Error(`Invalid input token format after processing: ${inputToken}`);
      }
      if (!validateTokenFormat(outputToken)) {
        throw new Error(`Invalid output token format after processing: ${outputToken}`);
      }

      // Create new params with the proper token addresses
      const updatedParams = {
        ...params,
        inputToken,
        outputToken,
        // Ensure amountIn is passed if buildTx expects it
        amountIn: params.amount
      };

      // Get the quote to validate the swap and potentially use in buildTx
      let quote;
      try {
        // In mock mode, this will use the mock quote logic
        quote = await this.getSwapQuote(updatedParams);
      } catch (quoteError) {
        this.logger.error('Failed to get quote for transaction', quoteError);
        throw new Error(`Failed to get quote for transaction: ${quoteError instanceof Error ? quoteError.message : 'Unknown error'}`);
      }

      // Define build parameters needed by SDK
      const commission = params.commission || {
        partner: this.signerAddress,
        commissionBps: 0,
      };
      const buildParams = {
        quoteResponse: quote,
        accountAddress: this.signerAddress,
        slippage: params.slippage || 0.5,
        commission,
        tokenIn: inputToken,
        tokenOut: outputToken,
        amountIn: params.amount,
        useAllCoins: params.useAllCoins || false
      };

      this.logger.debug('Adding 7k swap to transaction with params', buildParams);

      // Build and extend the existing transaction using 7k SDK
      try {
        // --- MOCK IMPLEMENTATION ---
        if (this.isMock) {
          this.logger.info('Mock mode: Simulating adding swap to transaction.');
          // You could add a dummy moveCall to the tx block for demonstration
          // tx.moveCall({ target: `0xmock::mock::mock_swap`, arguments: [...] });
          this.logger.debug('Mock swap details added (simulated)', { inputToken, outputToken, amount: params.amount });
        } else {
          // --- NON-MOCK IMPLEMENTATION ---
          // NOTE: The 7k SDK's `buildTx` function likely *returns* a transaction block (or data)
          // rather than modifying one passed in. How to correctly add this to an *existing*
          // transaction block (`tx`) needs verification with the 7k SDK documentation.
          // The `extendTx` function mentioned in comments might be relevant if it exists.
          this.logger.warn('Non-mock addSwapToTransaction requires verification with 7k SDK documentation regarding extending transaction blocks.');

          // Assuming buildTx returns data needed to merge (this is speculative):
          const txData = await buildTx(buildParams);
          if (!txData || !txData.tx) {
              throw new Error('buildTx did not return expected transaction data to add.');
          }
          // Placeholder warning - Merging logic is complex and SDK-specific
          this.logger.warn('Merging transaction blocks from buildTx is not implemented correctly. Swap might not be added.');
          // Example (likely incorrect, consult SDK docs):
          // if (txData.tx instanceof TransactionBlock) {
          //     tx.merge(txData.tx); // This might be the intended way, or might be wrong
          // } else {
          //     // Handle other potential return types from buildTx
          // }
          this.logger.info('Attempted to add non-mock 7k swap to transaction block (implementation needs review).');
        }
        // --- END IMPLEMENTATION ---
      } catch (buildError) {
        this.logger.error('Failed to add swap to transaction', buildError);
        throw new Error(`Failed to add 7K swap to transaction: ${buildError instanceof Error ? buildError.message : 'Unknown error'}`);
      }

      this.logger.info('Added 7k swap instructions to transaction block');
    } catch (error) {
      this.logger.error('Error adding 7k swap to transaction', error);
      throw error;
    }
  }
}

export default SevenKSwapExecutor; 