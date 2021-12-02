import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { Perpetual, LiquidityPool, PriceBucket, User, MarginAccount, LiquidityAccount, VoteAccount, Governor, TokenReward } from '../generated/schema'

import { ERC20 as ERC20Contract } from '../generated/Factory/ERC20'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'
import { USDTokens, CertifiedPools, ETH_ADDRESS, BTC_ADDRESS, NETWORK } from './const'

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

export function isLiquidityPool(pools: string[], address: string): boolean {
  for (let i = 0; i < pools.length; i++) {
    if (address == pools[i]) {
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
    perp.entryValue = ZERO_BD
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
    perp.byAmmKeepers = []

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
    let perpetualIDs = liquidityPool.perpetualIDs as string[]
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
    account.save()
  }
  return account as VoteAccount
}

export function fetchTokenReward(token: string, governor: Governor): TokenReward {
  let id = governor.id.concat('-').concat(token)
  let tokenReward = TokenReward.load(id)
  if (tokenReward === null) {
    tokenReward = new TokenReward(id)
    tokenReward.token = token
    tokenReward.governor = governor.id
    tokenReward.liquidityPool = governor.liquidityPool
    tokenReward.totalReward = ZERO_BD
    tokenReward.rewardRate = ZERO_BD
    tokenReward.preRewardRate = ZERO_BD
    tokenReward.changeRewardBlock = ZERO_BI
    tokenReward.periodFinish = ZERO_BI
    tokenReward.save()
  }
  return tokenReward as TokenReward
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
  return x.neg()
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
    return amount.neg()
  }
}
export function splitOpenAmount(amount: BigDecimal, delta: BigDecimal): BigDecimal {
  if (hasSameSign(amount, delta)) {
    return delta
  } else if (AbsBigDecimal(amount) >= AbsBigDecimal(delta)) {
    return ZERO_BD
  } else {
    return amount.plus(delta)
  }
}

export function fetchCollateralSymbol(address: Address): string {
  let collateral = ''
  if (NETWORK == 'bsc') {
    collateral = getBscCollateralSymbol(address)
  }
  if (collateral == '') {
    // return 'UnKnown'
    let contract = ERC20Contract.bind(address)
    let result = contract.try_symbol()
    if (!result.reverted) {
      collateral = result.value
    }
  }
  return collateral
}

function getBscCollateralSymbol(address: Address): string {
  let str = address.toHexString()
  if (str == '0xb5102cee1528ce2c760893034a4603663495fd72') {
    return 'USX'
  } else if (str == '0x5801d0e1c7d977d78e4890880b8e579eb4943276') {
    return 'USDO'
  } else if (str == '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c') {
    return 'BTCB'
  } else if (str == '0xe9e7cea3dedca5984780bafc599bd69add087d56') {
    return 'BUSD'
  } else if (str == '0xa258b20c6e6220dcf7cd523ff39847fec7a6a0cf') {
    return 'SATS'
  } else if (str == '0x2170ed0880ac9a755fd29b2688956bd959f933f8') {
    return 'ETH'
  } else if (str == '0xfe19f0b51438fd612f6fd59c1dbb3ea319f433ba') {
    return 'MIM'
  } else if (str == '0xbde2494e797894c901744dd11146384980184d7e') {
    return 'TUSDC'
  } else if (str == '0x1b5a24e705fc84ec7aa27810dbab6349f7ba5cfc') {
    return 'XCB'
  }
  return ''
}

export function fetchOracleUnderlying(address: Address): string {
  let underlying = ''
  if (NETWORK == 'bsc') {
    underlying = getBscOracleUnderlying(address)
  }
  
  if (underlying == '') {
    // return 'UnKnown'
    let contract = OracleContract.bind(address)
    let result = contract.try_underlyingAsset()
    if (!result.reverted) {
      underlying = result.value
    }
  }

  return underlying
}

function getBscOracleUnderlying(address: Address): string {
  let str = address.toHexString()
  if (str == '0xabae7f0c78a1746a3cb169f805d206847c3a1c73') {
    return 'TEST'
  } else if (str == '0xcc8a884396a7b3a6e61591d5f8949076ed0c7353') {
    return 'BTC'
  } else if (str == '0xa04197e5f7971e7aef78cf5ad2bc65aac1a967aa') {
    return 'ETH'
  } else if (str == '0xce7822a60d78ae685a602985a978dcade249b387') {
    return 'BNB'
  } else if (str == '0x3cc7fcfd41dbd19740c9f7f3d45cdb2ab0171c83') {
    return 'USD'
  } else if (str == '0x5220184fdf08c62759a6de698eef88a4be6004eb') {
    return 'USD'
  } else if (str == '0x18f06dae7aca5343b9b399ee2b77a51df8f444fc') {
    return 'SPELL'
  } else if (str == '0x8cbdf855877434ca40cb2bb3089cfe5f8d7abec6') {
    return 'SQUID'
  } else if (str == '0x19f628705641bf035beab1494e1c19c3b2991419') {
    return 'USD'
  } else if (str == '0xa3f1fa35f38fb6dbe316a9ca08e4160834b85746') {
    return 'USD'
  } else if (str == '0xef11c18cdb39b99166b2a3d1c9a4397a36491d3f') {
    return 'BTC'
  }  
  return ''
}

export function setETHPrice(price: BigDecimal, timestamp: BigInt): void {
  let priceBucket = PriceBucket.load(ETH_ADDRESS)
  if (priceBucket == null) {
    priceBucket = new PriceBucket(ETH_ADDRESS)
  }
  priceBucket.price = price
  priceBucket.timestamp = timestamp.toI32()
  priceBucket.save()
}

export function setBTCPrice(price: BigDecimal, timestamp: BigInt): void {
  let priceBucket = PriceBucket.load(BTC_ADDRESS)
  if (priceBucket == null) {
    priceBucket = new PriceBucket(BTC_ADDRESS)
  }
  priceBucket.price = price
  priceBucket.timestamp = timestamp.toI32()
  priceBucket.save()

  // set SATS price
  if (NETWORK == 'bsc') {
    let satsBucket = PriceBucket.load('0xa258b20c6e6220dcf7cd523ff39847fec7a6a0cf')
    if (satsBucket == null) {
      satsBucket = new PriceBucket('0xa258b20c6e6220dcf7cd523ff39847fec7a6a0cf')
    }
    // SATS = BTC/1e8
    satsBucket.price = price.div(BigDecimal.fromString('100000000'))
    satsBucket.timestamp = timestamp.toI32()
    satsBucket.save() 
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

export function getPoolName(pool: string): string {
  if (CertifiedPools.isSet(pool)) {
    return CertifiedPools.get(pool) as string
  }

  return ""
}

export function getCollateralBalance(collateral: string, address: Address, decimals: BigInt): BigDecimal {
  let balance = ZERO_BD
  let contract = ERC20Contract.bind(Address.fromString(collateral))
  let result = contract.try_balanceOf(address)
  if (!result.reverted) {
    balance = convertToDecimal(result.value, decimals)
  }
  return balance
}