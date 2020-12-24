import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, Trade} from '../generated/schema'

import { 
    CreatePerpetual as CreatePerpetualEvent,
    Finalize as FinalizeEvent,
    EnterNormalState as EnterNormalStateEvent,
    EnterEmergencyState as EnterEmergencyStateEvent,
    EnterClearedState as EnterClearedStateEvent,
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    AddLiquidity as AddLiquidityEvent,
    RemoveLiquidity as RemoveLiquidityEvent,
    Trade as TradeEvent,
    Liquidate as LiquidateEvent,
} from '../generated/templates/LiquidityPool/LiquidityPool'

import { updateTradeDayData, updateTradeSevenDayData, updateTradeHourData, updatePoolHourData, updatePoolDayData } from './dataUpdate'

import {
    ZERO_BD,
    ONE_BI,
    ZERO_BI,
    BI_18,
    PerpetualState,
    fetchUser,
    fetchMarginAccount,
    fetchLiquidityAccount,
    convertToDecimal,
    splitCloseAmount,
    splitOpenAmount,
    fetchPerpetual,
    fetchOracleUnderlying,
} from './utils'

export function handleCreatePerpetual(event: CreatePerpetualEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let factory = Factory.load(liquidityPool.factory)
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.operatorAddress = event.params.operator.toHexString()
    perp.underlying = fetchOracleUnderlying(event.params.oracle)
    perp.save()

    factory.perpetualCount = factory.perpetualCount.plus(ONE_BI)
    let perpetuals = factory.perpetuals
    perpetuals.push(perp.id)
    factory.perpetuals = perpetuals
    factory.save()
}

export function handleFinalize(event: FinalizeEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    liquidityPool.isFinalized = true
    liquidityPool.save()
}

export function handleEnterNormalState(event: EnterNormalStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.NORMAL
    perp.save()
}

export function handleEnterEmergencyState(event: EnterEmergencyStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.EMERGENCY
    perp.settledAtTimestamp = event.block.timestamp
    perp.settledAtBlockNumber = event.block.number
    perp.save()
}

export function handleEnterClearedState(event: EnterClearedStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.CLEARED
    perp.save()
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
    liquidityPool.poolMargin += amount
    account.save()
    liquidityPool.save()

    updatePoolHourData(liquidityPool as LiquidityPool, event.block.timestamp, amount)
    updatePoolDayData(liquidityPool as LiquidityPool, event.block.timestamp, amount)
}

export function handleRemoveLiquidity(event: RemoveLiquidityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool as LiquidityPool)
    let shareAmount = convertToDecimal(event.params.burnedShare, BI_18)
    let cash = convertToDecimal(-event.params.returnedCash, BI_18)
    account.shareAmount -= shareAmount
    account.collateralAmount += cash
    if (account.shareAmount == ZERO_BD) {
        liquidityPool.liquidityProviderCount -= ONE_BI
    }
    liquidityPool.poolMargin -= (cash)
    account.save()
    liquidityPool.save()

    updatePoolHourData(liquidityPool as LiquidityPool, event.block.timestamp, cash)
    updatePoolDayData(liquidityPool as LiquidityPool, event.block.timestamp, cash)
} 

export function handleTrade(event: TradeEvent): void {
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id)
    let trader = fetchUser(event.params.trader)
    let account = fetchMarginAccount(trader, perp as Perpetual)
    let close = splitCloseAmount(account.position, event.params.position)
    let open = splitOpenAmount(account.position, event.params.position)
    let transactionHash = event.transaction.hash.toHexString()
    let price = convertToDecimal(event.params.price, BI_18)

    // save close trade
    if (close != ZERO_BI) {
        let percent = close.abs() / event.params.position.abs()
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
        let percent = open.abs() / event.params.position.abs()
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
    account.position += event.params.position
    let amount = convertToDecimal(event.params.position, BI_18)
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

