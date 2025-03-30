/**
 * Test script to demonstrate SuiLend executor functionality
 */

import { SuiLendExecutor } from '../executor/SuiLendExecutor';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('Starting SuiLend integration test...');

  try {
    const suilendExecutor = new SuiLendExecutor();
    await suilendExecutor.initialize();
    
    const priceInfo = await suilendExecutor.getPriceInfo({
      inputToken: 'SUI',
      outputToken: 'USDC',
      amount: '1000000000'
    });

    console.log('SuiLend price info:', priceInfo);
  } catch (error) {
    console.error('Error during SuiLend test:', error);
  }
}

main().catch(console.error);
