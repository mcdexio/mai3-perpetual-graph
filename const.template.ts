
import { TypedMap } from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '{{reader_address}}'
export const READER_V4_ADDRESS = '{{reader_v4_address}}'
export const READER_V5_ADDRESS = '{{reader_v5_address}}'
export const DAO_VAULT_ADDRESS = '{{dao_vault_address}}'

export const READER_V4_BLOCK = {{reader_v4_block}}
export const READER_V5_BLOCK = {{reader_v5_block}}


// oracle address for get price
export const ETH_ORACLE = '{{eth_oracle}}'

// blocknumber for blockHandler
export const HANDLER_BLOCK = {{handler_block}}

// !!!!!!!!!!!!!!  Notice Lower Case  !!!!!!!!!!!!!!
// oracle map (token, oracle)
export let OracleMap = new TypedMap<string, string>()
OracleMap.set('{{eth_token}}', '{{eth_oracle}}')
  
// Notice lower case in config
// added ["USDT", "USDC", "DAI"]
export let USDTokens:string[] = [
    "{{usdc_token}}",
]