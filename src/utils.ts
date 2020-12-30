import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { Perpetual, LiquidityPool, User, MarginAccount, LiquidityAccount, VoteAccount } from '../generated/schema'

import { ERC20 as ERC20Contract } from '../generated/Factory/ERC20'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'


export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

// Notice lower case
export const FACTORY_ADDRESS = '0xddcb02044bf4eb0e312a2278cca744304005ea6f'

// oracle address for get price
export const ETH_ORACLE = '0x2dcca2b995651158fe129ddd23d658410cea8254'

export const ETH_ADDRESS = '0xfa53fd78b5176b4d772194511cc16c02c7f183f9'

// Notice lower case
// added ["USDT", "USDC", "DAI"]
export let USDTokens:string[] = [
  "0x8b2c4fa78fba24e4cbb4b0ca7b06a29130317093",
]

export enum PerpetualState {
  INVALID, INITIALIZING, NORMAL, EMERGENCY, CLEARED
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
  return collateral==ETH_ADDRESS
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

    perp.totalVolumeUSD = ZERO_BD
    perp.totalVolume = ZERO_BD
    perp.totalFee = ZERO_BD
    perp.txCount = ZERO_BI
    perp.lastPrice = ZERO_BD
    perp.unitAccumulativeFunding = ZERO_BD

    if (liquidityPool.isRun) {
      perp.state = PerpetualState.NORMAL
    } else {
      perp.state = PerpetualState.INITIALIZING
    }
    perp.createdAtTimestamp = ZERO_BI
    perp.createdAtBlockNumber = ZERO_BI
    perp.save()
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
    account.position = ZERO_BI
    account.entryPrice = ZERO_BD
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

export function fetchVoteAccount(user: User, liquidityPool: LiquidityPool): VoteAccount {
  let id = liquidityPool.id.concat('-').concat(user.id)
  let account = VoteAccount.load(id)
  if (account === null) {
    account = new VoteAccount(id)
    account.user = user.id
    account.liquidityPool = liquidityPool.id
    account.votes = ZERO_BD
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

export function hasSameSign(x: BigInt, y: BigInt): boolean {
  if (x==ZERO_BI || y==ZERO_BI) {
    return true
  }
  if (x > ZERO_BI && y > ZERO_BI) {
    return true
  }
  if (x < ZERO_BI && y < ZERO_BI) {
    return true
  }
  return false
}

export function splitCloseAmount(amount: BigInt, delta: BigInt): BigInt {
  if (hasSameSign(amount, delta)) {
    return ZERO_BI
  } else if (amount.abs() >= delta.abs()) {
    return delta
  } else {
    return -amount
  }
}
export function splitOpenAmount(amount: BigInt, delta: BigInt): BigInt {
  if (hasSameSign(amount, delta)) {
    return delta
  } else if (amount.abs() >= delta.abs()) {
    return ZERO_BI
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