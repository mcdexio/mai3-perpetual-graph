import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '{{reader_address}}'
export const NETWORK = '{{network}}'

// Notice lower case in config
// added ["USDT", "BUSD", "USDT", "USX"]
export let USDTokens: string[] = [
    "{{usdc_token}}",
    "{{busd_token}}",
    "{{usdt_token}}",
    "{{usx_token}}",
    "{{usdo_token}}",
    "{{mim_token}}",
]

export const ETH_ADDRESS = '{{eth_token}}'
export const BTC_ADDRESS = '{{btc_token}}'
export const ETH_PERPETUAL = '{{eth_perpetual}}'
export const BTC_PERPETUAL = '{{btc_perpetual}}'

/************************ for bsc *******************************************/ 
// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("0xdb282bbace4e375ff2901b84aceb33016d0d663d", "BUSD Pool")
CertifiedPools.set("0xf6b2d76c248af20009188139660a516e5c4e0532", "ETH Pool")
CertifiedPools.set("0x2ea001032b0eb424120b4dec51bf02db0df46c78", "BTCB Pool")
CertifiedPools.set("0x0a848c92295369794d38dfa1e4d26612cad2dfa8", "USX Pool")
CertifiedPools.set("0x23cda00836e60d213d8e7b0c50c1e268e67b96f1", "USDO Pool")
CertifiedPools.set("0xd2bb2ff558ba807866db36d9d1e8d31ee7076862", "MIM Pool")

// dao operator's pool
export let DaoPools = new TypedMap<string, string>();
DaoPools.set("0xdb282bbace4e375ff2901b84aceb33016d0d663d", "BUSD Pool")
DaoPools.set("0xf6b2d76c248af20009188139660a516e5c4e0532", "ETH Pool")
DaoPools.set("0x2ea001032b0eb424120b4dec51bf02db0df46c78", "BTCB Pool")

/************************ for arb *******************************************/ 
// export let CertifiedPools = new TypedMap<string, string>();
// CertifiedPools.set("0xab324146c49b23658e5b3930e641bdbdf089cbac", "USDC Pool")

// dao operator's pool
// export let DaoPools = new TypedMap<string, string>();
// DaoPools.set("0xab324146c49b23658e5b3930e641bdbdf089cbac", "USDC Pool")

/************************ for arb test *******************************************/ 
// export let CertifiedPools = new TypedMap<string, string>();
// CertifiedPools.set("0xc32a2dfee97e2babc90a2b5e6aef41e789ef2e13", "USDC Pool")

// dao operator's pool
// export let DaoPools = new TypedMap<string, string>();
// DaoPools.set("0xc32a2dfee97e2babc90a2b5e6aef41e789ef2e13", "USDC Pool")