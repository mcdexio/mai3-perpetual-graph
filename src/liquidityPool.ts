import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, Trade} from '../generated/schema'

import { 
    CreatePerpetual as CreatePerpetualEvent,
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
    splitCloseAmount,
    splitOpenAmount,
    fetchOracleUnderlying,
} from './utils'

export function handleCreatePerpetual(event: CreatePerpetualEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let factory = Factory.load(liquidityPool.factory)
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = new Perpetual(id)
    perp.index = event.params.perpetualIndex
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.collateralName = liquidityPool.collateralName
    perp.collateralAddress = liquidityPool.collateralAddress
    perp.operatorAddress = event.params.operator.toHexString()
    perp.factory = factory.id
    perp.liquidityPool = liquidityPool.id
    perp.underlying = fetchOracleUnderlying(event.params.oracle)
    perp.symbol = perp.underlying.concat('-').concat(perp.collateralName)


    perp.totalVolumeUSD = ZERO_BD
    perp.totalVolume = ZERO_BD
    perp.totalFee = ZERO_BD
    perp.txCount = ZERO_BI
    perp.lastPrice = ZERO_BD

    perp.state = 0
    perp.createdAtTimestamp = event.block.timestamp
    perp.createdAtBlockNumber = event.block.number
    perp.save()

    factory.perpetualCount = factory.perpetualCount.plus(ONE_BI)
    let perpetuals = factory.perpetuals
    perpetuals.push(id)
    factory.perpetuals = perpetuals
    factory.save()
}

export function handleDeposit(event: DepositEvent): void {
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id)
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
    let amount = convertToDecimal(event.params.amount, BI_18)
    marginAccount.collateralAmount += amount
    marginAccount.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id)
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
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id)
    let trader = fetchUser(event.params.trader)
    let account = fetchMarginAccount(trader, perp as Perpetual)
    let close = splitCloseAmount(account.position, event.params.positionAmount)
    let open = splitOpenAmount(account.position, event.params.positionAmount)
    let transactionHash = event.transaction.hash.toHexString()
    let price = convertToDecimal(event.params.price, BI_18)

    // save close trade
    if (close != ZERO_BI) {
        let percent = close.abs() / event.params.positionAmount.abs()
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(event.logIndex.toString())
            .concat('-')
            .concat('0')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = convertToDecimal(close, BI_18)
        trade.price = price
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
    }

    if (open != ZERO_BI) {
        let percent = open.abs() / event.params.positionAmount.abs()
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(event.logIndex.toString())
            .concat('-')
            .concat('1')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = convertToDecimal(open, BI_18)
        trade.price = price
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
    }

    // user margin account
    account.position += event.params.positionAmount
    let amount = convertToDecimal(event.params.positionAmount, BI_18)
    account.entryValue += amount.times(price)
    if (account.position == ZERO_BI) {
        account.entryPrice = ZERO_BD
    } else {
        account.entryPrice = account.entryValue.div(convertToDecimal(account.position, BI_18))
    }
    account.save()

    // update trade data
    updateTradeHourData(perp as Perpetual, event)
    updateTradeDayData(perp as Perpetual, event)
    updateTradeSevenDayData(perp as Perpetual, event)
}


export function handleLiquidate(event: LiquidateEvent): void {
    //TODO trade fee

}

