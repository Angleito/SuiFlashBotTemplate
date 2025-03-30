/**
 * Mock suilend.ts - Contains configuration for SuiLend protocol integration
 * This is a simplified mock version for demonstration purposes
 */

export const SUILEND_MARKET_IDS = {
  MAIN: '0x4b0f0231d751d0a7af57efb580dad4f5333a1ccf4eecf00ef7e5029f7e6d8612'
};

export const SUILEND_MARKET_TYPES = {
  MAIN: '0xecf53ce25533b68ec201082873a4b52936e35019fd62e1dddcd6f59c6cb95ab7::lending_market::LendingMarket'
};

export const SUILEND_ASSET_TYPES = {
  SUI: '0x2::sui::SUI',
  USDC: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d2177914::coin::COIN'
};

export default {
  SUILEND_MARKET_IDS,
  SUILEND_MARKET_TYPES,
  SUILEND_ASSET_TYPES
};
