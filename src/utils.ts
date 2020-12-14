import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { ShareToken, Perpetual, LiquidityPool, User, MarginAccount, LiquidityAccount } from '../generated/schema'

import { Perpetual as PerpetualContract } from '../generated/mai-v3-graph/Perpetual'
import { ERC20 as ERC20Contract } from '../generated/mai-v3-graph/ERC20'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

// Notice lower case
export const FACTORY_ADDRESS = '0x9deac2cd86ffa4c0d59b62071e54844a632091b5'

// oracle address for get price
export const ETH_ORACLE = '0xb91Dfd6677E53AdE131352b825bF408385531e1d'

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

export function fetchCollateral(address: Address): string {
  let contract = PerpetualContract.bind(address)
  let collateral = ''
  let result = contract.try_collateral()
  if (!result.reverted) {
    collateral = result.value.toHexString()
  }
  return collateral
}

export function fetchCollateralSymbol(address: Address): string {
  let contract = ERC20Contract.bind(address)
  let collateral = ''
  let result = contract.try_symbol()
  if (!result.reverted) {
    collateral = result.value.toHexString()
  }
  return collateral
}