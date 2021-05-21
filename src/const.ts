
import { TypedMap } from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '0x9ba69c0ef49AC2735Db933e450C0aaAA7B9E8C53'
export const READER_V4_ADDRESS = '0x1605275a33b2ab2f00dc96e75190b3fe49272401'
export const READER_V5_ADDRESS = '0x45b7dCcC99D111450e37cb13F5327c4AbC27E285'
export const DAO_VAULT_ADDRESS = '0x622D6efCACFe096b0d3f678f82Af5B730a7F434c'

export const READER_V4_BLOCK = 23848799
export const READER_V5_BLOCK = 24195783


// oracle address for get price
export const ETH_ORACLE = '0x84F9B276de73c6766aB714f095C93ef2aeE0952E'

// blocknumber for blockHandler
export const HANDLER_BLOCK = 24806000

// Notice lower case in config
// added ["USDT", "USDC", "DAI"]
export let USDTokens:string[] = [
    "0xd4ac81d9fd2b28363ebd1d88a8364ff3b3577e84",
]

// !!!!!!!!!!!!!!  Notice Lower Case  !!!!!!!!!!!!!!
// TokenList: tokens need to get price
export let TokenList:string[] = [
    "0x025435acd9a326fa25b4098887b38dd2cedf6422",
]
// OracleList: oracles of each token upper, Notice: index must same with its token
export let OracleList:string[] = [
    "0x84F9B276de73c6766aB714f095C93ef2aeE0952E",
]