import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, Trade} from '../generated/schema'

import { 
    CreateMarket as CreateMarketEvent,
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    AddLiquidity as AddLiquidityEvent,
    RemoveLiquidity as RemoveLiquidityEvent,
    Trade as TradeEvent,
    Liquidate as LiquidateEvent,
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
    convertToBigInt,
    splitAmount,
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
    let perp = Perpetual.load(event.marketIndex.toString())
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
    let amount = convertToDecimal(event.params.amount, BI_18)
    marginAccount.collateralAmount += amount
    marginAccount.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
    let perp = Perpetual.load(event.marketIndex.toString())
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
    let amount = convertToDecimal(event.params.amount, BI_18)
    marginAccount.collateralAmount -= amount
    marginAccount.save()
}

export function handleAddLiquidity(event: AddLiquidityEvent): void {
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

export function handleRemoveLiquidity(event: RemoveLiquidityEvent): void {
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
    let perp = Perpetual.load(event.marketIndex.toString())
    let trader = fetchUser(event.params.trader)
    let position = convertToBigInt(trader.position, BI_18)
    let splitResult = splitAmount(position, event.params.positionAmount)
    let transactionHash = event.transaction.hash.toHexString()

    // save close trade
    if (splitResult.close > ZERO_BI) {
        let percent = splitResult.close.abs() / event.params.positionAmount
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(event.logIndex.toString())
            .concat('-')
            .concat('0')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = convertToDecimal(splitResult.close, BI_18)
        trade.price = convertToDecimal(event.params.price, BI_18)
        trade.isClose = true
        trade.fee = convertToDecimal(event.params.fee*percent, BI_18)
        trade.type = 0 // position by trade
        trade.transactionHash = transactionHash
        trade.blockNumber = event.block.number
        trade.timestamp = event.block.timestamp
        trade.logIndex = event.logIndex
        perp.lastPrice = trade.price
        perp.save()
        trade.save()

        // user margin account
        let account = fetchMarginAccount(trader, perp as Perpetual)
        account.position += trade.amount
        account.entryValue += trade.amount.times(trade.price)
        if (account.position == ZERO_BD) {
            account.entryPrice = ZERO_BD
        } else {
            account.entryPrice = account.entryValue.div(account.position)
        }
        account.save()
    }

    if (splitResult.open > ZERO_BI) {
        let percent = splitResult.open.abs() / event.params.positionAmount
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(event.logIndex.toString())
            .concat('-')
            .concat('1')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = convertToDecimal(splitResult.open, BI_18)
        trade.price = convertToDecimal(event.params.price, BI_18)
        trade.isClose = false
        trade.fee = convertToDecimal(event.params.fee*percent, BI_18)
        trade.type = 0 // position by trade
        trade.transactionHash = transactionHash
        trade.blockNumber = event.block.number
        trade.timestamp = event.block.timestamp
        trade.logIndex = event.logIndex
        perp.lastPrice = trade.price
        perp.save()
        trade.save()

        // user margin account
        let account = fetchMarginAccount(trader, perp as Perpetual)
        account.position += trade.amount
        account.entryValue += trade.amount.times(trade.price)
        if (account.position == ZERO_BD) {
            account.entryPrice = ZERO_BD
        } else {
            account.entryPrice = account.entryValue.div(account.position)
        }
        account.save()
    }

    // update trade data
    updateTradeHourData(perp as Perpetual, event)
    updateTradeDayData(perp as Perpetual, event)
    updateTradeSevenDayData(perp as Perpetual, event)
}


export function handleLiquidate(event: LiquidateEvent): void {
    //TODO trade fee

}

