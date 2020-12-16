import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { Perpetual, LiquidityPool, User, MarginAccount, LiquidityAccount } from '../generated/schema'

import { ERC20 as ERC20Contract } from '../generated/Factory/ERC20'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

// Notice lower case
export const FACTORY_ADDRESS = '0xc705852e311e3b607dda9cbb2a14adfbfce21cd2'

// oracle address for get price
export const ETH_ORACLE = '0x2dccA2b995651158Fe129Ddd23D658410CEa8254'

// Notice lower case
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

export function isETHCollateral(collateral: string): boolean {
  return collateral==ADDRESS_ZERO
}

export function fetchUser(address: Address): User {
  let user = User.load(address.toHexString())
  if (user === null) {
    user = new User(address.toHexString())
    user.save()
  }
  return user as User
}

export function fetchMarginAccount(user: User, perpetual: Perpetual): MarginAccount {
  let id = perpetual.id.concat('-').concat(user.id)
  let account = MarginAccount.load(id)
  if (account === null) {
    account = new MarginAccount(id)
    account.user = user.id
    account.perpetual = perpetual.id
    account.collateralAmount = ZERO_BD
    account.cashBalance = ZERO_BD
    account.position = ZERO_BD
    account.entryPrice = ZERO_BD
    account.entryValue = ZERO_BD
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

export function convertToBigInt(amount: BigDecimal, decimals: BigInt): BigInt {
  if (decimals == ZERO_BI) {
    return amount.toString() as BigInt
  }
  return amount.times(exponentToBigDecimal(decimals)).toString() as BigInt
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