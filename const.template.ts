import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '{{reader_address}}'

// Notice lower case in config
// added ["USDT", "BUSD", "USDT"]
export let USDTokens: string[] = [
    "{{usdc_token}}",
    "{{busd_token}}",
    "{{usdt_token}}",
]

export let ValueCaptureAddress = "{{value_capture_address}}"

export const ETH_ADDRESS = '{{eth_token}}'
export const BTC_ADDRESS = '{{btc_token}}'
export const ETH_PERPETUAL = '{{eth_perpetual}}'
export const BTC_PERPETUAL = '{{btc_perpetual}}'

// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("{{certified_usdc_pool}}", "{{certified_usdc_pool_name}}")