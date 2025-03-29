/**
 * Mock sevenk.ts - Contains token configuration for 7k protocol integration
 * This is a simplified mock version for demonstration purposes
 */

// Simple mapping of token symbols to their addresses (simulated data)
const TOKEN_MAP: Record<string, string> = {
  'SUI': '0x2::sui::SUI',
  'USDC': '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN',
  'USDT': '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN',
  'WETH': '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN',
  'BTC': '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN',
  'WBTC': '0x5f8c8d4b1591b9dcfd3a21dd123bb7c5c0d4992dc1a2653e37d7351b3e577ee5::coin::COIN',
  'CELO': '0x8d112837c412ec5aa1cf35878d9b15d94e62c48097c638940cd15d41ccc4c1b1::coin::COIN'
};

/**
 * Get the token address from a symbol
 * @param symbolOrAddress The token symbol or address
 * @returns The token address or null if not found
 */
export async function getTokenAddress(symbolOrAddress: string): Promise<string | null> {
  console.log(`[MOCK] getTokenAddress called for: ${symbolOrAddress}`);
  
  // If it's already an address with the correct format, return it
  if (validateTokenFormat(symbolOrAddress)) {
    return symbolOrAddress;
  }
  
  // Try to find by uppercase symbol in the mock map
  const upperSymbol = symbolOrAddress.toUpperCase();
  if (TOKEN_MAP[upperSymbol]) {
    return TOKEN_MAP[upperSymbol];
  }
  
  return null;
}

/**
 * Check if a token address has the correct format
 * @param tokenAddress The token address to validate
 * @returns True if correctly formatted
 */
export function validateTokenFormat(tokenAddress: string): boolean {
  // Format expected: 0x<hex>::<module>::<name>
  const validFormatRegex = /^0x[a-fA-F0-9]+::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+$/;
  return validFormatRegex.test(tokenAddress);
}

/**
 * Attempt to fix token address format if it doesn't match expected pattern
 * @param tokenAddress The token address to fix
 * @returns The fixed token address
 */
export function fixTokenFormat(tokenAddress: string): string {
  // If already valid, return as is
  if (validateTokenFormat(tokenAddress)) {
    return tokenAddress;
  }
  
  // Remove whitespace
  let fixed = tokenAddress.trim();
  
  // If it's a valid hex address without the module and name, append with a default
  if (/^0x[a-fA-F0-9]+$/.test(fixed)) {
    return `${fixed}::coin::COIN`;
  }
  
  // If it looks like an address but is missing '0x' prefix
  if (/^[a-fA-F0-9]+::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+$/.test(fixed)) {
    return `0x${fixed}`;
  }
  
  // Return original if we can't fix it
  return tokenAddress;
}

/**
 * Add a new token to the registry (mock implementation)
 * @param symbol The token symbol
 * @param address The token address
 * @returns True if successful
 */
export async function addToken(symbol: string, address: string): Promise<boolean> {
  console.log(`[MOCK] Simulating adding token: ${symbol} at ${address}`);
  // In a real implementation, this would add to a database
  return true;
}

export default {
  getTokenAddress,
  validateTokenFormat,
  fixTokenFormat,
  addToken
}; 