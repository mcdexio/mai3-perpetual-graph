// Code generated - DO NOT EDIT.
import { TypedMap } from '@graphprotocol/graph-ts'

export const READER_ADDRESS = '0x3563cb8eDEB55f12861a3c194143874b05b1aB9e'
export const READER_V4_ADDRESS = '0x1605275a33b2ab2f00dc96e75190b3fe49272401'
export const READER_V5_ADDRESS = '0x1605275a33b2ab2f00dc96e75190b3fe49272401'
export const DAO_VAULT_ADDRESS = '0x1605275a33b2ab2f00dc96e75190b3fe49272401'

export const READER_V4_BLOCK = 23847386
export const READER_V5_BLOCK = 23847386


// oracle address for get price
export const ETH_ORACLE = '0x2dcca2b995651158fe129ddd23d658410cea8254'


// blocknumber for blockHandler
export const HANDLER_BLOCK = 1008525

// Notice lower case
export let ETHTokens:string[] = [
    "0xdea04ead9bce0ba129120c137117504f6dfaf78f",
    "0x1520d5561dfb209c6df5149cb6146f6b18d7ad2a",
    "0x726e650f0bdf5bd57b4a3e23f81973d3c225a94c"
]

// !!!!!!!!!!!!!!  Notice Lower Case  !!!!!!!!!!!!!!
// oracle map (token, oracle)
export let OracleMap = new TypedMap<string, string>()
OracleMap.set('0xfa53fd78b5176b4d772194511cc16c02c7f183f9', '0xbb05666820137b3b1344fe6802830515c015dd4f')
  
// Notice lower case
// added ["USDT", "USDC", "DAI"]
export let USDTokens:string[] = [
    "0x8b2c4fa78fba24e4cbb4b0ca7b06a29130317093",
]