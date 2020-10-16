import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { Perpetual, User } from '../generated/schema'

import { Perpetual as PerpetualContract } from '../generated/mai-v3-graph/Perpetual'
import { AMM as AMMContract } from '../generated/mai-v3-graph/AMM'

import { shareToken as shareTokenTemplate } from '../generated/templates'


export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

// added ["USDT", "USDC", "DAI"]
export let USDTokens:string[] = [
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "0x6b175474e89094c44da98b954eedeac495271d0f"
]

export function isUSDCollateral(collateral: string): boolean {
  for (let i = 0; i < USDTokens.length; i++) {
    if (collateral == USDTokens[i]) {
      return true
    }
  }
  return false
}

export function fetchPerpetual(address: Address): Perpetual {
    let perp = Perpetual.load(address.toHexString())
    if (perp === null) {
      perp = new Perpetual(address.toHexString())
      perp.collateral = ADDRESS_ZERO
      perp.oracle = "https://eth-usd-aggregator.chain.link/eth-usd"
      perp.amm = fetchAmmAdress(address)
      perp.operator = ADDRESS_ZERO

      perp.spread = ZERO_BD
      perp.feeRate = ZERO_BD
      perp.maintanceMargin = ZERO_BD
      perp.initMargin = ZERO_BD
      perp.minMaintanceMargin = ZERO_BD

      perp.state = 0
      perp.lastPrice = ZERO_BD

      perp.createdAtTimestamp = ZERO_BI
      perp.createdAtBlockNumber = ZERO_BI

      // contract state: Normal, Emergency, Shutdown
      perp.state = 0
    
      // contract param
      perp.redeemingLockPeriod = ZERO_BD
      perp.entranceFeeRate = ZERO_BD
      perp.streamingFeeRate = ZERO_BD

      // create the tracked contract based on the template
      shareTokenTemplate.create(address)

      perp.save()
    }
    return perp as Perpetual
}

export function fetchUser(address: Address): User {
  let user = User.load(address.toHexString())
  if (user === null) {
    user = new User(address.toHexString())
    user.save()
  }
  return user as User
}

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function convertToDecimal(amount: BigInt, decimals: BigInt): BigDecimal {
  if (decimals == ZERO_BI) {
    return amount.toBigDecimal()
  }
  return amount.toBigDecimal().div(exponentToBigDecimal(decimals))
}

export function fetchAmmAdress(address: Address): string {
  let contract = PerpetualContract.bind(address)
  let ammAddress = ADDRESS_ZERO
  let ammResult = contract.try_amm()
  if (!ammResult.reverted) {
    ammAddress = ammResult.value.toHexString()
  }

  return ammAddress
}

export function fetchTokenAddress(address: Address): string {
  let contract = AMMContract.bind(address)
  let tokenAddress = ADDRESS_ZERO
  let tokenResult = contract.try_shareTokenAddress()
  if (!tokenResult.reverted) {
    tokenAddress = tokenResult.value
  }

  return tokenAddress
}

export function fetchCollateral(address: Address): string {
  let contract = PerpetualContract.bind(address)
  let collateral = ''
  let result = contract.try_collateral()
  if (!result.reverted) {
    collateral = result.value.toHexString()
  }
  return collateral
}