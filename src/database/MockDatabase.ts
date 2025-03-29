/**
 * MockDatabase.ts - Simulates database operations without requiring a real database connection
 * This file should be used in place of real database implementations in the mocked version
 */

import { TokenPair } from '../types/token';

// In-memory storage to simulate database tables
const mockStorage: Record<string, any[]> = {
  tokens: [
    { id: 1, symbol: 'SUI', name: 'Sui', address: '0x2::sui::SUI' },
    { id: 2, symbol: 'USDC', name: 'USD Coin', address: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN' },
    { id: 3, symbol: 'USDT', name: 'Tether', address: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN' },
    { id: 4, symbol: 'BTC', name: 'Bitcoin', address: '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN' },
  ],
  pools: [
    { 
      id: 1, 
      dex: 'MockDex', 
      poolId: '0xmockpool1', 
      tokenA: '0x2::sui::SUI', 
      tokenB: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN',
      lastUpdated: new Date().toISOString()
    },
    { 
      id: 2, 
      dex: 'MockDex', 
      poolId: '0xmockpool2', 
      tokenA: '0x2::sui::SUI', 
      tokenB: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN',
      lastUpdated: new Date().toISOString()
    },
    { 
      id: 3, 
      dex: 'SevenK', 
      poolId: '0xmockpool3', 
      tokenA: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN', 
      tokenB: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN',
      lastUpdated: new Date().toISOString()
    },
  ],
  tokenPairs: [
    { id: 1, tokenA: '0x2::sui::SUI', tokenB: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN' },
    { id: 2, tokenA: '0x2::sui::SUI', tokenB: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN' },
    { id: 3, tokenA: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN', tokenB: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab54c::coin::COIN' },
  ],
  arbitrageOpportunities: [],
};

// Simulated database delay (to make it feel more realistic)
const SIMULATED_DELAY_MS = 50;

// Utility to simulate async database operations
const simulateDelay = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY_MS));
};

export class MockDatabase {
  constructor() {
    console.log('[MOCK] Initialized mock database');
  }

  async connect(): Promise<void> {
    await simulateDelay();
    console.log('[MOCK] Connected to mock database');
  }

  async disconnect(): Promise<void> {
    await simulateDelay();
    console.log('[MOCK] Disconnected from mock database');
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    await simulateDelay();
    console.log(`[MOCK] Executing query: ${sql}`);
    console.log(`[MOCK] Query params: ${JSON.stringify(params)}`);
    
    // Find table name from the query (very basic parsing)
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1].toLowerCase() : null;
    
    if (table && mockStorage[table]) {
      console.log(`[MOCK] Returning data from mock storage table: ${table}`);
      return [...mockStorage[table]];
    }
    
    console.log('[MOCK] No matching table found, returning empty result');
    return [];
  }

  async getTokenBySymbol(symbol: string): Promise<any> {
    await simulateDelay();
    const upperSymbol = symbol.toUpperCase();
    const token = mockStorage.tokens.find(t => t.symbol.toUpperCase() === upperSymbol);
    return token || null;
  }

  async getTokenByAddress(address: string): Promise<any> {
    await simulateDelay();
    const token = mockStorage.tokens.find(t => t.address === address);
    return token || null;
  }

  async findPools(tokenA: string, tokenB: string): Promise<any[]> {
    await simulateDelay();
    return mockStorage.pools.filter(p => 
      (p.tokenA === tokenA && p.tokenB === tokenB) || 
      (p.tokenA === tokenB && p.tokenB === tokenA)
    );
  }

  async getTokenPairs(): Promise<TokenPair[]> {
    await simulateDelay();
    return mockStorage.tokenPairs.map(pair => ({
      tokenA: pair.tokenA,
      tokenB: pair.tokenB
    }));
  }

  async addArbitrageOpportunity(opportunity: any): Promise<void> {
    await simulateDelay();
    const newOpportunity = {
      id: mockStorage.arbitrageOpportunities.length + 1,
      ...opportunity,
      timestamp: new Date().toISOString()
    };
    mockStorage.arbitrageOpportunities.push(newOpportunity);
    console.log(`[MOCK] Added arbitrage opportunity: ${JSON.stringify(newOpportunity)}`);
  }

  // Add this method to allow external code to view stored data for debugging
  async getMockData(table: string): Promise<any[]> {
    if (mockStorage[table]) {
      return [...mockStorage[table]];
    }
    return [];
  }
}

// Singleton instance
export const mockDatabase = new MockDatabase();

export default MockDatabase; 