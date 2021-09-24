import {TypedMap} from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '0x708C17D0901B76cc5CF8F67e1a2E198077FD8641'

// Notice lower case in config
// added ["USDT", "USDC", "DAI"]
export let USDTokens: string[] = [
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
]

// !!!!!!!!!!!!!!  Notice Lower Case  !!!!!!!!!!!!!!
// TokenList: tokens need to get price
export let TokenList: string[] = [
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1","0x4e352cf164e64adcbad318c3a1e222e9eba4ce42"
]
// OracleList: oracles of each token upper, Notice: index must same with its token
export let OracleList: string[] = [
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8","0xe9727d80F0A0b8c7372a3e5820b6802FADb1E83B"
]

// certified pool address to name
export let CertifiedPools = new TypedMap<string, string>();
CertifiedPools.set("0xab324146c49b23658e5b3930e641bdbdf089cbac", "USDC Pool")