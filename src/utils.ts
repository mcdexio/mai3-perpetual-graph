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


export enum PerpetualState {
  INVALID, INITIALIZING, NORMAL, EMERGENCY, CLEARED
}

export enum TradeType {
  NORMAL, LIQUIDATEBYAMM, LIQUIDATEBYTRADER
}

export enum LiquidityType {
  ADD, REMOVE
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
    perp.beforeLastMarkPrice = ZERO_BD
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
    account.entryCollateralAmount = ZERO_BD
    account.entryPoolMargin = ZERO_BD
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
  // update token price every hour
  let index = timestamp / 3600
  let startUnix = index * 3600

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