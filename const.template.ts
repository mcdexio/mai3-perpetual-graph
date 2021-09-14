import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '{{reader_address}}'


// Notice lower case in config
// added ["USDT", "USDC", "DAI"]
export let USDTokens: string[] = [
    "{{usdc_token}}",
]

// !!!!!!!!!!!!!!  Notice Lower Case  !!!!!!!!!!!!!!
// TokenList: tokens need to get price
export let TokenList: string[] = [
    "{{eth_token}}","{{mcb_token}}"
]
// OracleList: oracles of each token upper, Notice: index must same with its token
export let OracleList: string[] = [
    "{{eth_oracle}}","{{mcb_oracle}}"
]

// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("{{certified_usdc_pool}}", "{{certified_usdc_pool_name}}")