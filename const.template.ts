
export const READER_ADDRESS = '{{reader_address}}'


// Notice lower case in config
// added ["USDC", "sUSD", "USX"]
export let USDTokens:string[] = [
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
    "0xa970af1a584579b618be4d69ad6f73459d112f95",
    "0xcd14c3a2ba27819b352aae73414a26e2b366dc50"
]

// !!!!!!!!!!!!!!  Notice Lower Case  !!!!!!!!!!!!!!
// TokenList: tokens need to get price
export let TokenList:string[] = [
    "{{eth_token}}",
]
// OracleList: oracles of each token upper, Notice: index must same with its token
export let OracleList:string[] = [
    "{{eth_oracle}}",
]