import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, ShareToken, Trade, PriceBucket, User, MarginAccount, Liquidate } from '../generated/schema'

import { 
    CreatePerpetual as CreatePerpetualEvent,
    RunLiquidityPool as RunLiquidityPoolEvent,
    SetNormalState as SetNormalStateEvent,
    SetEmergencyState as SetEmergencyStateEvent,
    SetClearedState as SetClearedStateEvent,
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    AddLiquidity as AddLiquidityEvent,
    RemoveLiquidity as RemoveLiquidityEvent,
    Trade as TradeEvent,
    Liquidate as LiquidateEvent,
    UpdatePoolMargin as UpdatePoolMarginEvent,
    UpdateUnitAccumulativeFunding as UpdateUnitAccumulativeFundingEvent,
} from '../generated/templates/LiquidityPool/LiquidityPool'

import { updateTradeDayData, updateTradeSevenDayData, updateTradeHourData, updatePoolHourData, updatePoolDayData } from './dataUpdate'

import {
    ZERO_BD,
    ONE_BI,
    ZERO_BI,
    BI_18,
    PerpetualState,
    TradeType,
    fetchUser,
    fetchMarginAccount,
    fetchLiquidityAccount,
    convertToDecimal,
    isUSDCollateral,
    isETHCollateral,
    splitCloseAmount,
    splitOpenAmount,
    fetchPerpetual,
    fetchOracleUnderlying,
    ONE_BD,
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

export function handleRunLiquidityPool(event: RunLiquidityPoolEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    liquidityPool.isRun = true
    liquidityPool.save()
}

export function handleSetNormalState(event: SetNormalStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.NORMAL
    perp.save()
}

export function handleSetEmergencyState(event: SetEmergencyStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.EMERGENCY
    perp.settledAtTimestamp = event.block.timestamp
    perp.settledAtBlockNumber = event.block.number
    perp.save()
}

export function handleSetClearedState(event: SetClearedStateEvent): void {
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
    marginAccount.cashBalance += amount
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
    marginAccount.cashBalance -= amount
    marginAccount.save()
}

export function handleAddLiquidity(event: AddLiquidityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool as LiquidityPool)
    if (account.collateralAmount != ZERO_BD) {
        liquidityPool.liquidityProviderCount += ONE_BI
    }
    let cash = convertToDecimal(event.params.addedCash, BI_18)
    account.collateralAmount += cash
    // shareAmount update on shareToken transfer event
    // account.shareAmount += convertToDecimal(event.params.mintedShare, BI_18)
    account.save()
    liquidityPool.txCount += ONE_BI
    liquidityPool.save()

    // update deltaMargin
    updatePoolHourData(liquidityPool as LiquidityPool, event.block.timestamp, cash)
    updatePoolDayData(liquidityPool as LiquidityPool, event.block.timestamp, cash)
}

export function handleRemoveLiquidity(event: RemoveLiquidityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool as LiquidityPool)
    let cash = convertToDecimal(-event.params.returnedCash, BI_18)
    // shareAmount update on shareToken transfer event
    // account.shareAmount -= convertToDecimal(event.params.burnedShare, BI_18)
    account.collateralAmount += cash
    if (account.shareAmount == ZERO_BD) {
        liquidityPool.liquidityProviderCount -= ONE_BI
    }
    account.save()
    liquidityPool.txCount += ONE_BI
    liquidityPool.save()

    // update deltaMargin
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
    let transactionHash = event.transaction.hash.toHexString()
    let price = convertToDecimal(event.params.price, BI_18)
    newTrade(perp as Perpetual, trader, account, event.params.position, price, ZERO_BI, transactionHash, event.logIndex, event.block.number, event.block.timestamp, TradeType.NORMAL)
    
    perp.lastPrice = price
    perp.position += convertToDecimal(-event.params.position, BI_18)
    perp.save()

    // update trade data
    updateTradeHourData(perp as Perpetual, event)
    updateTradeDayData(perp as Perpetual, event)
    updateTradeSevenDayData(perp as Perpetual, event)
}

export function handleLiquidate(event: LiquidateEvent): void {
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id)
    let trader = fetchUser(event.params.trader)
    let account = fetchMarginAccount(trader, perp as Perpetual)
    let transactionHash = event.transaction.hash.toHexString()

    let price = convertToDecimal(event.params.price, BI_18)
    // trader
    newTrade(perp as Perpetual, trader, account, event.params.amount, price, ZERO_BI, transactionHash, event.logIndex, event.block.number, event.block.timestamp, TradeType.LIQUIDATE)

    // liquidator
    if (event.params.liquidator.toHexString() == event.address.toHexString()) {
        // liquidator is AMM
        perp.position += convertToDecimal(-event.params.amount, BI_18)
    } else {
        // liquidator is user
        let liquidator = fetchUser(event.params.liquidator)
        let liquidatorAccount = fetchMarginAccount(liquidator, perp as Perpetual)
        newTrade(perp as Perpetual, liquidator, liquidatorAccount, event.params.amount, price, ZERO_BI, transactionHash, event.logIndex, event.block.number, event.block.timestamp, TradeType.LIQUIDATE)
    }

    // new liquidate
    let liquidate = new Liquidate(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    liquidate.perpetual = perp.id
    liquidate.trader = event.params.trader.toHexString()
    liquidate.liquidator = event.params.liquidator.toHexString()
    liquidate.amount = convertToDecimal(event.params.amount, BI_18)
    liquidate.price = price
    liquidate.transactionHash = transactionHash
    liquidate.blockNumber = event.block.number
    liquidate.timestamp = event.block.timestamp
    liquidate.logIndex = event.logIndex
    liquidate.save()

    perp.lastPrice = price
    perp.liqCount += ONE_BI
    perp.save()
}

function newTrade(perp: Perpetual, trader: User, account: MarginAccount, amount: BigInt, priceBD: BigDecimal, fee: BigInt,
    transactionHash: String, logIndex: BigInt, blockNumber: BigInt, timestamp: BigInt, type: TradeType ): void {
    let close = splitCloseAmount(account.position, amount)
    let open = splitOpenAmount(account.position, amount)
    // close position
    if (close != ZERO_BI) {
        let percent = close.abs() / amount.abs()
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(logIndex.toString())
            .concat('-')
            .concat('0')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = convertToDecimal(close, BI_18)
        trade.price = priceBD
        trade.isClose = true
        trade.fee = convertToDecimal(fee*percent, BI_18)
        trade.type = type // position by trade
        trade.transactionHash = transactionHash
        trade.blockNumber = blockNumber
        trade.timestamp = timestamp
        trade.logIndex = logIndex
        trade.save()
        // entry price and entry funding
        let closeBD = convertToDecimal(close, BI_18)
        let position = account.position.plus(close)
        let positionBD = convertToDecimal(position, BI_18)
        let oldPositionBD = convertToDecimal(account.position, BI_18)
        account.cashBalance -= priceBD.times(closeBD)
        account.cashBalance += perp.unitAccumulativeFunding.times(positionBD)
        account.entryFunding = account.entryFunding.times(positionBD).div(oldPositionBD)
        account.entryValue = account.entryValue.times(positionBD).div(oldPositionBD)
        account.position = position

        perp.txCount += ONE_BI
    }

    // close position
    if (open != ZERO_BI) {
        let percent = open.abs() / amount.abs()
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(logIndex.toString())
            .concat('-')
            .concat('1')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = convertToDecimal(open, BI_18)
        trade.price = priceBD
        trade.isClose = false
        trade.fee = convertToDecimal(fee*percent, BI_18)
        trade.type = type // position by trade
        trade.transactionHash = transactionHash
        trade.blockNumber = blockNumber
        trade.timestamp = timestamp
        trade.logIndex = logIndex
        trade.save()

        // entry price and entry funding
        let openBD = convertToDecimal(open, BI_18)
        let position = account.position.plus(open)
        account.cashBalance -= priceBD.times(openBD)
        account.cashBalance += perp.unitAccumulativeFunding.times(openBD)
        account.entryFunding = account.entryFunding.plus(perp.unitAccumulativeFunding.times(openBD))
        account.entryValue = account.entryValue.plus(priceBD.times(openBD))
        account.position = position

        perp.txCount += ONE_BI
    }
    if (account.position != ZERO_BI) {
        let positionBD = convertToDecimal(account.position, BI_18)
        account.entryPrice = account.entryValue.div(positionBD)
    } else {
        account.entryPrice = ZERO_BD
    }
    account.save()
}

export function handleUpdatePoolMargin(event: UpdatePoolMarginEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let shareToken = ShareToken.load(liquidityPool.shareToken)
    let poolMargin = convertToDecimal(event.params.poolMargin, BI_18)
    let nav = poolMargin.div(shareToken.totalSupply)
    liquidityPool.poolMargin = poolMargin
    if (isUSDCollateral(liquidityPool.collateralAddress)) {
        liquidityPool.poolMarginUSD = liquidityPool.poolMargin
    } else if (isETHCollateral(liquidityPool.collateralAddress)) {
        let bucket = PriceBucket.load('1')
        let ethPrice = ZERO_BD
        if (bucket != null && bucket.ethPrice != null) {
            ethPrice = bucket.ethPrice as BigDecimal
        }
        liquidityPool.poolMarginUSD = liquidityPool.poolMargin.times(ethPrice)
    }
    liquidityPool.save()
    // update poolMargin
    let hourData = updatePoolHourData(liquidityPool as LiquidityPool, event.block.timestamp, ZERO_BD)
    hourData.poolMargin = poolMargin
    hourData.poolMarginUSD = liquidityPool.poolMarginUSD
    hourData.netAssetValue = nav
    hourData.save()
    let dayData = updatePoolDayData(liquidityPool as LiquidityPool, event.block.timestamp, ZERO_BD)
    dayData.poolMargin = poolMargin
    dayData.poolMarginUSD = liquidityPool.poolMarginUSD
    dayData.netAssetValue = nav
    dayData.save()
}

export function handleUpdateUnitAccumulativeFunding(event: UpdateUnitAccumulativeFundingEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.unitAccumulativeFunding = convertToDecimal(event.params.unitAccumulativeFunding, BI_18)
    perp.save()
}