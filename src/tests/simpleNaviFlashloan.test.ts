/**
 * Tests for the Simple Navi Protocol Flashloan Example
 */

import { executeNaviFlashloan } from '../examples/simpleNaviFlashloan';
import { NAVISDKClient } from 'navi-sdk';
import { flashloan, repayFlashLoan } from 'navi-sdk/dist/libs/PTB';
import { SuiClient } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Mock the dependencies
jest.mock('navi-sdk');
jest.mock('navi-sdk/dist/libs/PTB');
jest.mock('@mysten/sui.js/client');
jest.mock('@mysten/sui.js/transactions');
jest.mock('@mysten/sui.js/keypairs/ed25519');
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

describe('Simple Navi Flashloan Example', () => {
  // Setup mocks before each test
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock NAVISDKClient
    (NAVISDKClient as jest.Mock).mockImplementation(() => ({
      accounts: [
        {
          address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          keypair: {} // This will be cast to Ed25519Keypair in the code
        }
      ]
    }));

    // Mock flashloan function
    (flashloan as jest.Mock).mockImplementation(() => [
      { kind: 'Result', index: 0 }, // borrowedBalance
      { kind: 'Result', index: 1 }  // receipt
    ]);

    // Mock repayFlashLoan function
    (repayFlashLoan as jest.Mock).mockImplementation(() => [
      { kind: 'Result', index: 2 }  // remainingBalance
    ]);

    // Mock TransactionBlock
    (TransactionBlock as jest.Mock).mockImplementation(() => ({
      setSender: jest.fn(),
      setGasBudget: jest.fn(),
      build: jest.fn().mockResolvedValue({})
    }));

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
    const result = await executeNaviFlashloan();

    // Verify that the NAVISDKClient was initialized correctly
    expect(NAVISDKClient).toHaveBeenCalledWith({
      networkType: 'testnet',
      fullnodeUrl: 'https://fullnode.testnet.sui.io:443',
      mnemonic: 'test test test test test test test test test test test test'
    });

    // Verify that the flashloan function was called
    expect(flashloan).toHaveBeenCalled();

    // Verify that the repayFlashLoan function was called
    expect(repayFlashLoan).toHaveBeenCalled();

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
    await expect(executeNaviFlashloan()).rejects.toThrow('Transaction execution failed');
  });
});
