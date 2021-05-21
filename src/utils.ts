import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { Perpetual, LiquidityPool, PriceBucket, User, MarginAccount, LiquidityAccount, VoteAccount, Governor } from '../generated/schema'

import { ERC20 as ERC20Contract } from '../generated/Factory/ERC20'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'
import { USDTokens, TokenList, OracleList } from './const'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)
export let OPERATOR_EXP = BigInt.fromI32(10*24*60*60)

export const FACTORY = "mcdex"

export let PoolBlackLists:string[] = [
    "0x7244e362a489fc2efe89526822b9b7d8b8571b39",
    "0xa46ba896abbf47ce6c5723d6a9d1f5e1f1e858c5",
    "0x219b240c9734269259e0172f451429eebff2aa2a",
    "0x03cba525ec7f9466e445120752a7121c7a173399",
    "0xe7d163a646b0c49f8dff750c441d6a957e83e53d",
    "0x712e8a6c9f27ebcb5cc291d3551d96a058b836f4",
    "0x8f1bec2645c891b1b816087e15b7d5cb360ff281",
    "0xc79c57fde5ef31e01103aeaac36de4466c649346",
    "0x84d229f4be07c2cf47d289e8eede5fee5c2e7c94",
    "0x3b83467f4dc0b706e3b0dec3cbdf28279f93b870",
    "0xbc99ea250880d192bda5fec9aaf24f677c151467",
    "0x6e8fad94ba07a4b23030fd7f9a702118c150f40a",
    "0x2165a41db0feb9be7e34166bef013fa6f3f62670",
    "0xf345f9e7f8591ad7efb544f08cd07214f3b469b1",
    "0x80f357b69893b27edd9600ed8d878c2e36a71727",
    "0x15c42d39a2012ed5dccc024acc9e6c7d105ea0d7",
    "0xb3bd8ebcb3ad6ee029e686f85527da08401bc787",
    "0xb2fa7aed78a254325797fa2d50eefe3592fd902a",
    "0x4b2ee3ab805a450aef95f94a231e45e4f7444cc4",
    "0x82de7ff93c03e182bf86359bea65cbcfa0413649",
    "0x99950b27b73ef88393dbda3c4c8b54eeed992130",
    "0x91eb55091c67c9a7d2af075f6d3e404cf9e2ef7e",
    "0x1e4a306bd27ccc59dc5cf241497498eecb8b204c",
    "0xb1eb15518f6d72e749095a71f137ab8ee0b71e53",
    "0x932c31563836d0e8af5e75d886e857f0599cca51",
    "0xf4b675b8a227df875d34e38f8ece282a355eb6ba",
    "0x5e3ed91fa5b9854cafc1cf186715fac44c7ed92e",
    "0x8745c2ca715c7e180697d8abc580163d5cbc87da",
]


export enum PerpetualState {
  INVALID, INITIALIZING, NORMAL, EMERGENCY, CLEARED
}

export enum TradeType {
  NORMAL, LIQUIDATEBYAMM, LIQUIDATEBYTRADER
}

export enum LiquidityType {
  ADD, REMOVE
}

export function isBlackPool(pool: string): boolean {
  for (let i = 0; i < PoolBlackLists.length; i++) {
    if (pool == PoolBlackLists[i]) {
      return true
    }
  }
  return false
}

export function isUSDToken(collateral: string): boolean {
  for (let i = 0; i < USDTokens.length; i++) {
    if (collateral == USDTokens[i]) {
      return true
    }
  }
  return false
}

export function isCollateralAdded(collaterals: string[], collateral: string): boolean {
  for (let i = 0; i < collaterals.length; i++) {
    if (collateral == collaterals[i]) {
      return true
    }
  }
  return false
}

export function fetchUser(address: Address): User {
  let user = User.load(address.toHexString())
  if (user === null) {
    user = new User(address.toHexString())
    user.save()
  }
  return user as User
}

export function fetchPerpetual(liquidityPool: LiquidityPool, perpetualIndex: BigInt): Perpetual {
  let id = liquidityPool.id.concat('-').concat(perpetualIndex.toString())
  let perp = Perpetual.load(id)
  if (perp === null) {
    perp = new Perpetual(id)
    perp.index = perpetualIndex
    perp.oracleAddress = ''
    perp.collateralName = liquidityPool.collateralName
    perp.collateralAddress = liquidityPool.collateralAddress
    perp.operatorAddress = ''
    perp.factory = liquidityPool.factory
    perp.liquidityPool = liquidityPool.id
    perp.underlying = ''
    perp.symbol = ''
    perp.oldSymbol = ''

    perp.totalVolumeUSD = ZERO_BD
    perp.totalVolume = ZERO_BD
    perp.totalFee = ZERO_BD
    perp.txCount = ZERO_BI
    perp.liqCount = ZERO_BI
    perp.position = ZERO_BD
    perp.openInterest = ZERO_BD
    perp.lastPrice = ZERO_BD
    perp.lastMarkPrice = ZERO_BD
    perp.lastUnitAcc = ZERO_BD
    perp.unitAccumulativeFunding = ZERO_BD
    perp.lpFee = ZERO_BD
    perp.lpFunding = ZERO_BD
    perp.lpTotalPNL = ZERO_BD
    perp.lpPositionPNL = ZERO_BD
    perp.lpPenalty = ZERO_BD

    if (liquidityPool.isRun) {
      perp.state = PerpetualState.NORMAL
      perp.isRun = true
    } else {
      perp.state = PerpetualState.INITIALIZING
      perp.isRun = false
    }
    perp.createdAtTimestamp = ZERO_BI
    perp.createdAtBlockNumber = ZERO_BI
    perp.save()

    // update pool perpetualIDs
    let perpetualIDs = liquidityPool.perpetualIDs
    perpetualIDs.push(id)
    liquidityPool.perpetualIDs = perpetualIDs
    liquidityPool.save()
  }
  return perp as Perpetual
}

export function fetchMarginAccount(user: User, perpetual: Perpetual): MarginAccount {
  let id = perpetual.id.concat('-').concat(user.id)
  let account = MarginAccount.load(id)
  if (account === null) {
    account = new MarginAccount(id)
    account.user = user.id
    account.perpetual = perpetual.id
    account.position = ZERO_BD
    account.entryValue = ZERO_BD
    account.entryFunding = ZERO_BD
    account.save()
  }
  return account as MarginAccount
}

export function fetchLiquidityAccount(user: User, liquidityPool: LiquidityPool): LiquidityAccount {
  let id = liquidityPool.id.concat('-').concat(user.id)
  let account = LiquidityAccount.load(id)
  if (account === null) {
    account = new LiquidityAccount(id)
    account.user = user.id
    account.liquidityPool = liquidityPool.id
    account.shareAmount = ZERO_BD
    account.collateralAmount = ZERO_BD
    account.save()
  }
  return account as LiquidityAccount
}

export function fetchVoteAccount(user: User, governor: Governor): VoteAccount {
  let id = governor.id.concat('-').concat(user.id)
  let account = VoteAccount.load(id)
  if (account === null) {
    account = new VoteAccount(id)
    account.user = user.id
    account.governor = governor.id
    account.votes = ZERO_BD
    account.reward = ZERO_BD
    account.save()
  }
  return account as VoteAccount
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

export function AbsBigDecimal(x: BigDecimal): BigDecimal {
  if (x >= ZERO_BD) {
    return x
  }
  return -x
}

export function NegBigDecimal(x: BigDecimal): BigDecimal {
  return -x
}

export function hasSameSign(x: BigDecimal, y: BigDecimal): boolean {
  if (x==ZERO_BD || y==ZERO_BD) {
    return true
  }
  if (x > ZERO_BD && y > ZERO_BD) {
    return true
  }
  if (x < ZERO_BD && y < ZERO_BD) {
    return true
  }
  return false
}

export function splitCloseAmount(amount: BigDecimal, delta: BigDecimal): BigDecimal {
  if (hasSameSign(amount, delta)) {
    return ZERO_BD
  } else if (AbsBigDecimal(amount) >= AbsBigDecimal(delta)) {
    return delta
  } else {
    return -amount
  }
}
export function splitOpenAmount(amount: BigDecimal, delta: BigDecimal): BigDecimal {
  if (hasSameSign(amount, delta)) {
    return delta
  } else if (AbsBigDecimal(amount) >= AbsBigDecimal(delta)) {
    return ZERO_BD
  } else {
    return amount+delta
  }
}

export function fetchCollateralSymbol(address: Address): string {
  let contract = ERC20Contract.bind(address)
  let collateral = ''
  let result = contract.try_symbol()
  if (!result.reverted) {
    collateral = result.value
  }
  return collateral
}

export function fetchOracleUnderlying(address: Address): string {
  let contract = OracleContract.bind(address)
  let underlying = ''
  let result = contract.try_underlyingAsset()
  if (!result.reverted) {
    underlying = result.value
  }
  return underlying
}

function getPriceFromOracle(oracle: string): BigDecimal {
  let contract = OracleContract.bind(Address.fromString(oracle))
  let callResult = contract.try_priceTWAPShort()
  if(callResult.reverted){
      log.warning("try_priceTWAPShort reverted. oracle: {}", [oracle])
      return ZERO_BD
  }

  return convertToDecimal(callResult.value.value0, BI_18)
}

export function updateTokenPrice(timestamp: i32): void {
  // update token price every 10 min
  let index = timestamp / 600
  let startUnix = index * 600

  for (let i = 0; i < TokenList.length; i++) {
      let priceBucket = PriceBucket.load(TokenList[i])
      if (priceBucket == null) {
          priceBucket = new PriceBucket(TokenList[i])
          priceBucket.price = getPriceFromOracle(OracleList[i])
          priceBucket.timestamp = startUnix
          priceBucket.save()
          continue
      }

      if (priceBucket.timestamp != startUnix) {
          let price = getPriceFromOracle(OracleList[i])
          priceBucket.price = price
          priceBucket.timestamp = startUnix
          priceBucket.save()
      }
  }
}

export function getTokenPrice(token: string): BigDecimal {
  if (isUSDToken(token)) {
    return ONE_BD
  }

  let priceBucket = PriceBucket.load(token)
  if (priceBucket == null) {
    return ZERO_BD
  }
  return priceBucket.price
}
