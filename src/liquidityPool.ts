import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual} from '../generated/schema'

import { 
    CreateMarket as CreateMarketEvent,
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    AddLiquidatity as AddLiquidatityEvent,
    RemoveLiquidatity as RemoveLiquidatityEvent,
    Trade as TradeEvent,
    LiquidateByAMM as LiquidateByAMMEvent,
    LiquidateByTrader as LiquidateByTraderEvent,
} from '../generated/templates/LiquidityPool/LiquidityPool'

import { updateTradeDayData, updateTradeSevenDayData, updateTradeHourData } from './dataUpdate'

import {
    ZERO_BD,
    ONE_BI,
    ZERO_BI,
    BI_18,
    fetchUser,
    fetchMarginAccount,
    fetchLiquidityAccount,
    convertToDecimal,
} from './utils'

export function handleCreateMarket(event: CreateMarketEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let factory = Factory.load(liquidityPool.factory)
    factory.perpetualCount = factory.perpetualCount.plus(ONE_BI)
    let perpetuals = factory.perpetuals
    perpetuals.push(event.params.marketIndex.toHexString())
    factory.perpetuals = perpetuals
    factory.save()

    let perp = new Perpetual(event.params.marketIndex.toHexString())
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.factory = factory.id
    perp.liquidityPool = liquidityPool.id

    perp.totalVolumeUSD = ZERO_BD
    perp.totalVolume = ZERO_BD
    perp.totalFee = ZERO_BD
    perp.txCount = ZERO_BI
    perp.lastPrice = ZERO_BD

    perp.state = 0
    perp.createdAtTimestamp = event.block.timestamp
    perp.createdAtBlockNumber = event.block.number
    perp.save()
}

export function handleDeposit(event: DepositEvent): void {
    //todo marketIndex
    let perp = Perpetual.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
    let amount = convertToDecimal(event.params.amount, BI_18)
    marginAccount.collateralAmount += amount
    marginAccount.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
    //todo marketIndex
    let perp = Perpetual.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
    let amount = convertToDecimal(event.params.amount, BI_18)
    marginAccount.collateralAmount -= amount
    marginAccount.save()
}

export function handleAddLiquidatity(event: AddLiquidatityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool as LiquidityPool)
    if (account.collateralAmount != ZERO_BD) {
        liquidityPool.liquidityProviderCount += ONE_BI
    }
    let amount = convertToDecimal(event.params.addedCash, BI_18)
    account.collateralAmount += amount
    account.shareAmount += convertToDecimal(event.params.mintedShare, BI_18)
    liquidityPool.liquidityAmount += amount
    account.save()
    liquidityPool.save()
}

export function handleRemoveLiquidatity(event: RemoveLiquidatityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool as LiquidityPool)
    let shareAmount = convertToDecimal(event.params.burnedShare, BI_18)
    let cash = convertToDecimal(event.params.returnedCash, BI_18)
    account.shareAmount -= shareAmount
    account.collateralAmount -= cash
    if (account.shareAmount == ZERO_BD) {
        liquidityPool.liquidityProviderCount -= ONE_BI
    }
    liquidityPool.liquidityAmount -= (cash)
    account.save()
    liquidityPool.save()
} 

export function handleTrade(event: TradeEvent): void {
    // TODO marketIndex 
    if (event.address.toHexString() == event.params.trader.toHexString()) {
        return
    }
    let perp = Perpetual.load(event.address.toHexString())

    // update trade data
    updateTradeHourData(perp as Perpetual, event)
    updateTradeDayData(perp as Perpetual, event)
    updateTradeSevenDayData(perp as Perpetual, event)
}