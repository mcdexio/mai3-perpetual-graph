import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { Perpetual, LiquidityPool, User, MarginAccount, LiquidityAccount, VoteAccount, Governor } from '../generated/schema'

import { ERC20 as ERC20Contract } from '../generated/Factory/ERC20'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

export const FACTORY = "mcdex"
// Notice lower case
export let ETHTokens:string[] = [
  "0xdea04ead9bce0ba129120c137117504f6dfaf78f",
  "0x1520d5561dfb209c6df5149cb6146f6b18d7ad2a",
  "0x726e650f0bdf5bd57b4a3e23f81973d3c225a94c"
]

// Notice lower case
// added ["USDT", "USDC", "DAI"]
export let USDTokens:string[] = [
  "0x8b2c4fa78fba24e4cbb4b0ca7b06a29130317093",
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

export function isUSDCollateral(collateral: string): boolean {
  for (let i = 0; i < USDTokens.length; i++) {
    if (collateral == USDTokens[i]) {
      return true
    }
  }
  return false
}

export function isETHCollateral(collateral: string): boolean {
  for (let i = 0; i < ETHTokens.length; i++) {
    if (collateral == ETHTokens[i]) {
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
    perp.entryPrice = ZERO_BD
    perp.entryUnitAcc = ZERO_BD
    perp.lastPrice = ZERO_BD
    perp.unitAccumulativeFunding = ZERO_BD

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
    account.cashBalance = ZERO_BD
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