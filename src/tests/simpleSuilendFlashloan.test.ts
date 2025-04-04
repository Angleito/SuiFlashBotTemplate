/**
 * Tests for the Simple SuiLend Protocol Flashloan Example
 */

import { executeSuilendFlashloan } from '../examples/simpleSuilendFlashloan';
import { SuilendClient } from '@suilend/sdk';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Mock the dependencies
jest.mock('@suilend/sdk');
jest.mock('@mysten/sui/client');
jest.mock('@mysten/sui/transactions');
jest.mock('@mysten/sui/keypairs/ed25519');
jest.mock('../utils/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })
  }
}));

// Mock environment variables
process.env.SUI_NETWORK = 'testnet';
process.env.SUI_RPC_URL = 'https://fullnode.testnet.sui.io:443';
process.env.SUI_MNEMONIC = 'test test test test test test test test test test test test';
process.env.SUILEND_LENDING_MARKET_ID = '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904';
process.env.SUILEND_LENDING_MARKET_TYPE = '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904::lending_market::LendingMarket';
process.env.SUILEND_COIN_TYPE = '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';

describe('Simple SuiLend Flashloan Example', () => {
  // Setup mocks before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock SuilendClient
    (SuilendClient.initialize as jest.Mock).mockResolvedValue({
      lendingMarket: {
        id: '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904',
        packageId: '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904'
      },
      createObligation: jest.fn().mockReturnValue('0xobligation1234567890abcdef1234567890abcdef'),
      findReserveArrayIndex: jest.fn().mockReturnValue(0)
    });

    // Mock Transaction
    (Transaction as jest.Mock).mockImplementation(() => ({
      setSender: jest.fn(),
      setGasBudget: jest.fn(),
      moveCall: jest.fn().mockReturnValue({ kind: 'Result', index: 0 }),
      pure: {
        u64: jest.fn().mockReturnValue({ kind: 'Pure' }),
        id: jest.fn().mockReturnValue({ kind: 'Pure' })
      },
      object: jest.fn().mockReturnValue({ kind: 'Object' }),
      build: jest.fn().mockResolvedValue({})
    }));

    // Mock Ed25519Keypair
    (Ed25519Keypair.deriveKeypair as jest.Mock).mockReturnValue({
      toSuiAddress: jest.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    });

    // Mock SuiClient
    (SuiClient as jest.Mock).mockImplementation(() => ({
      signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
        digest: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        effects: {
          status: { status: 'success' }
        }
      })
    }));
  });

  test('should execute a flashloan successfully', async () => {
    // Execute the flashloan
    const result = await executeSuilendFlashloan();

    // Verify that the SuilendClient was initialized correctly
    expect(SuilendClient.initialize).toHaveBeenCalledWith(
      '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904',
      '0xf4ff123a3730fa718761b05ec454d3eefc032ef0528627a0552916194c815904::lending_market::LendingMarket',
      expect.any(Object)
    );

    // Verify that the transaction was executed
    expect(result).toBeDefined();
    expect(result.digest).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    expect(result.effects?.status?.status).toBe('success');
  });

  test('should handle errors gracefully', async () => {
    // Mock the SuiClient to throw an error
    (SuiClient as jest.Mock).mockImplementation(() => ({
      signAndExecuteTransactionBlock: jest.fn().mockRejectedValue(
        new Error('Transaction execution failed')
      )
    }));

    // Execute the flashloan and expect it to throw
    await expect(executeSuilendFlashloan()).rejects.toThrow('Transaction execution failed');
  });
});
