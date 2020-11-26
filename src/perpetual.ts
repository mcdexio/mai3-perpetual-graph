import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"
import {
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    AddLiquidatity as AddLiquidatityEvent,
    RemoveLiquidatity as RemoveLiquidatityEvent,
    Trade as TradeEvent,
    LiquidateByAMM as LiquidateByAMMEvent,
    LiquidateByTrader as LiquidateByTraderEvent,
    OpenPositionByTrade as OpenPositionByTradeEvent,
    ClosePositionByTrade as ClosePositionByTradeEvent,
    OpenPositionByLiquidation as OpenPositionByLiquidationEvent,
    ClosePositionByLiquidation as ClosePositionByLiquidationEvent,
} from '../generated/templates/Perpetual/Perpetual'

import { updateTradeDayData, updateTradeSevenDayData, updateTradeHourData } from './dataUpdate'

import {
    fetchUser,
    fetchLiquidityAccount,
    fetchMarginAccount,
    ZERO_BD,
    ONE_BD,
    BI_18,
    convertToDecimal,
} from './utils'

import { Perpetual, Trade, MarginAccount} from '../generated/schema'

export function handleDeposit(event: DepositEvent): void {
    let perp = Perpetual.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp)
    let amount = convertToDecimal(event.params.balance, BI_18)
    marginAccount.collateralAmount += amount
    marginAccount.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp)
    let amount = convertToDecimal(event.params.balance, BI_18)
    marginAccount.collateralAmount -= amount
    marginAccount.save()
}

export function handleAddLiquidatity(event: AddLiquidatityEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, perp)
    if (account.collateralAmount != ZERO_BD) {
        perp.liquidityProviderCount += ONE_BD
    }
    let amount = convertToDecimal(event.params.addedCash, BI_18)
    account.collateralAmount += amount
    account.shareAmount += convertToDecimal(event.params.mintedShare, BI_18)
    perp.liquidityAmount += amount
    account.save()
    perp.save()
}

export function handleRemoveLiquidatity(event: RemoveLiquidatityEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, perp)
    let shareAmount = convertToDecimal(event.params.burnedShare, BI_18)
    let cash = convertToDecimal(event.params.returnedCash, BI_18)
    account.shareAmount -= shareAmount
    account.collateralAmount -= cash
    if (account.shareAmount == ZERO_BD) {
        perp.liquidityProviderCount -= ONE_BD
    }
    perp.liquidityAmount -= (cash)
    account.save()
    perp.save()
}

export function handleTrade(event: TradeEvent): void {
    let perp = Perpetual.load(event.address)
    //TODO trade fee

    // update trade data
    updateTradeHourData(perp, event)
    updateTradeDayData(perp, event)
    updateTradeSevenDayData(perp, event)
}

export function handleLiquidateByAMM(event: LiquidateByAMMEvent): void {
    //TODO trade fee

}

export function handleLiquidateByTrader(event: LiquidateByTraderEvent): void {

}

export function handleOpenPositionByTrade(event: OpenPositionByTradeEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let trade = new Trade(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )

    trade.perpetual = perp.id
    trade.trader = user.id
    trade.amount = convertToDecimal(event.params.amount, BI_18)
    trade.price = convertToDecimal(event.params.price, BI_18)
    trade.isClose = false
    trade.type = 0 // position by trade
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.logIndex = event.logIndex
    perp.lastPrice = trade.price
    perp.save()
    trade.save()

    // user margin account
    let account = fetchMarginAccount(user, perp)
    account.position += trade.amount
    account.entryValue += trade.amount.times(trade.price)
    account.entryPrice = account.entryValue.div(account.position)
    account.save()
}

export function handleClosePositionByTrade(event: ClosePositionByTradeEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let account = fetchMarginAccount(user, perp)
    let transactionHash = event.transaction.hash.toHexString()
    let trade = new Trade(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )

    trade.perpetual = perp.id
    trade.trader = user.id
    trade.amount = convertToDecimal(event.params.amount, BI_18)
    trade.price = convertToDecimal(event.params.price, BI_18)
    trade.isClose = true
    trade.type = 0 // position by trade
    let fundingLoss = convertToDecimal(event.params.fundingLoss, BI_18)
    trade.pnl = trade.amount.times(trade.price.minus(account.entryPrice)).minus(fundingLoss)
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.logIndex = event.logIndex
    perp.lastPrice = trade.price
    perp.save()
    trade.save()

    // user margin account
    account.position -= trade.amount
    account.entryValue -= trade.amount.times(trade.price)
    account.entryPrice = account.entryValue.div(account.position)
    account.save()
}

export function handleOpenPositionByLiquidation(event: OpenPositionByLiquidationEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let trade = new Trade(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )

    trade.perpetual = perp.id
    trade.trader = user.id
    trade.amount = convertToDecimal(event.params.amount, BI_18)
    trade.price = convertToDecimal(event.params.price, BI_18)
    trade.isClose = false
    trade.type = 1 // position by trade
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.logIndex = event.logIndex
    perp.lastPrice = trade.price
    perp.save()
    trade.save()

    // user margin account
    let account = fetchMarginAccount(user, perp)
    account.position += trade.amount
    account.entryValue += trade.amount.times(trade.price)
    account.entryPrice = account.entryValue.div(account.position)
    account.save()    
}

export function handleClosePositionByLiquidation(event: ClosePositionByLiquidationEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let account = fetchMarginAccount(user, perp)
    let transactionHash = event.transaction.hash.toHexString()
    let trade = new Trade(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )

    trade.perpetual = perp.id
    trade.trader = user.id
    trade.amount = convertToDecimal(event.params.amount, BI_18)
    trade.price = convertToDecimal(event.params.price, BI_18)
    trade.isClose = true
    trade.type = 1 // position by trade
    let fundingLoss = convertToDecimal(event.params.fundingLoss, BI_18)
    trade.pnl = trade.amount.times(trade.price.minus(account.entryPrice)).minus(fundingLoss)
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.logIndex = event.logIndex
    perp.lastPrice = trade.price
    perp.save()
    trade.save()

    // user margin account
    account.position -= trade.amount
    account.entryValue -= trade.amount.times(trade.price)
    account.entryPrice = account.entryValue.div(account.position)
    account.save()    
}