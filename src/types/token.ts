/**
 * Basic token type definitions used throughout the project
 * This is a simplified version for the mock project
 */

/**
 * Represents a token by its address
 */
export interface Token {
  symbol: string;
  name: string; 
  address: string;
  decimals?: number;
}

/**
 * Represents a pair of tokens
 */
export interface TokenPair {
  tokenA: string;
  tokenB: string;
}

/**
 * Represents pricing information for a token
 */
export interface TokenPrice {
  token: string;
  priceUsd: number;
  timestamp: number;
}

/**
 * Represents a trading pool between two tokens
 */
export interface Pool {
  id: string;
  dex: string; 
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA?: string;
  reserveB?: string;
  lastUpdated: string;
}

/**
 * Represents an arbitrage opportunity between pools
 */
export interface ArbitrageOpportunity {
  id?: number; 
  tokenA: string;
  tokenB: string;
  entryPoolId: string;
  exitPoolId: string;
  entryDex: string;
  exitDex: string;
  profitableTrade: boolean;
  estimatedProfit: string;
  timestamp?: string;
}

// Note: In TypeScript, interfaces are only types, not values, so they can't be used in a default export
// Therefore, we simply export each type individually above 