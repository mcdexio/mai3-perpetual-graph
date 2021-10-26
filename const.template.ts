import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '{{reader_address}}'

// Notice lower case in config
// added ["USDT", "BUSD", "USDT", "USX"]
export let USDTokens: string[] = [
    "{{usdc_token}}",
    "{{busd_token}}",
    "{{usdt_token}}",
    "{{usx_token}}",
    "{{usdo_token}}",
]

export let ValueCaptureAddress = "{{value_capture_address}}"

export const ETH_ADDRESS = '{{eth_token}}'
export const BTC_ADDRESS = '{{btc_token}}'
export const ETH_PERPETUAL = '{{eth_perpetual}}'
export const BTC_PERPETUAL = '{{btc_perpetual}}'

// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("{{certified_usdc_pool}}", "{{certified_usdc_pool_name}}")
// for bsc
CertifiedPools.set("0xf6b2d76c248af20009188139660a516e5c4e0532", "ETH Pool")
CertifiedPools.set("0x2ea001032b0eb424120b4dec51bf02db0df46c78", "BTCB Pool")
CertifiedPools.set("0x0a848c92295369794d38dfa1e4d26612cad2dfa8", "USX Pool")
