import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '0x708C17D0901B76cc5CF8F67e1a2E198077FD8641'


// Notice lower case in config
// added ["USDT", "USDC", "DAI"]
export let USDTokens: string[] = [
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
]

export const ETH_ADDRESS = '0x2170ed0880ac9a755fd29b2688956bd959f933f8'
export const BTC_ADDRESS = '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'
export const ETH_PERPETUAL = '0xdb282bbace4e375ff2901b84aceb33016d0d663d-1'
export const BTC_PERPETUAL = '0xdb282bbace4e375ff2901b84aceb33016d0d663d-0'

// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("0xab324146c49b23658e5b3930e641bdbdf089cbac", "USDC Pool")