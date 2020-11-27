import { log, BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'

import { ShareToken, Perpetual, User, MarginAccount, LiquidityAccount } from '../generated/schema'

import { Perpetual as PerpetualContract } from '../generated/mai-v3-graph/Perpetual'
import { AMM as AMMContract } from '../generated/mai-v3-graph/AMM'

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_18 = BigInt.fromI32(18)

// Notice lower case
export const FACTORY_ADDRESS = '0x50660a46fdec8d7c316403e21004eaec7a9e7227'

// oracle address for get price
export const ETH_ORACLE = '0xE2e3EF79dC428D2B5FDaf6483Df44c5fFc77ABF9'

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

export function fetchLiquidityAccount(user: User, perp: Perpetual): LiquidityAccount {
  let id = perp.id.concat('-').concat(user.id)
  let account = LiquidityAccount.load(id)
  if (account === null) {
    account = new LiquidityAccount(id)
    account.user = user.id
    account.perpetual = perp.id
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