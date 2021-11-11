import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '0x93a9182883C1019e1dBEbB5d40C140e7680cd151'
export const NETWORK = 'bsc'

// Notice lower case in config
// added ["USDT", "BUSD", "USDT", "USX"]
export let USDTokens: string[] = [
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "0xe9e7cea3dedca5984780bafc599bd69add087d56",
    "0x55d398326f99059ff775485246999027b3197955",
    "0xb5102cee1528ce2c760893034a4603663495fd72",
    "0x5801d0e1c7d977d78e4890880b8e579eb4943276",
    "0xfe19f0b51438fd612f6fd59c1dbb3ea319f433ba",
]

export const ETH_ADDRESS = '0x2170ed0880ac9a755fd29b2688956bd959f933f8'
export const BTC_ADDRESS = '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'
export const ETH_PERPETUAL = '0xdb282bbace4e375ff2901b84aceb33016d0d663d-1'
export const BTC_PERPETUAL = '0xdb282bbace4e375ff2901b84aceb33016d0d663d-0'

// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("0xdb282bbace4e375ff2901b84aceb33016d0d663d", "BUSD Pool")
// for bsc
CertifiedPools.set("0xf6b2d76c248af20009188139660a516e5c4e0532", "ETH Pool")
CertifiedPools.set("0x2ea001032b0eb424120b4dec51bf02db0df46c78", "BTCB Pool")
CertifiedPools.set("0x0a848c92295369794d38dfa1e4d26612cad2dfa8", "USX Pool")
