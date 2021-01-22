import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, Trade, AccHourData, PoolHourData, User, MarginAccount, Liquidate, LiquidityHistory } from '../generated/schema'

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
    TransferExcessInsuranceFundToLP as TransferExcessInsuranceFundToLPEvent,
    UpdateUnitAccumulativeFunding as UpdateUnitAccumulativeFundingEvent,
} from '../generated/templates/LiquidityPool/LiquidityPool'

import { updateTrade15MinData, updateTradeDayData, updateTradeSevenDayData, updateTradeHourData, updatePoolHourData, updatePoolDayData } from './dataUpdate'

import {
    ZERO_BD,
    ONE_BI,
    ZERO_BI,
    BI_18,
    PerpetualState,
    TradeType,
    LiquidityType,
    fetchUser,
    fetchMarginAccount,
    fetchLiquidityAccount,
    convertToDecimal,
    splitCloseAmount,
    splitOpenAmount,
    fetchPerpetual,
    fetchOracleUnderlying,
    AbsBigDecimal,
    NegBigDecimal,
} from './utils'

export function handleCreatePerpetual(event: CreatePerpetualEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let factory = Factory.load(liquidityPool.factory)
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.operatorAddress = event.params.operator.toHexString()
    perp.underlying = fetchOracleUnderlying(event.params.oracle)
    perp.createdAtTimestamp = event.block.timestamp
    perp.createdAtBlockNumber = event.block.number
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
    let perpIDs = liquidityPool.perpetualIDs as string[]
    for (let index = 0; index < perpIDs.length; index++) {
        let id = perpIDs[index]
        let perp = Perpetual.load(id)
        perp.isRun = true
        perp.save()
    }
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
    if (account.shareAmount == ZERO_BD) {
        liquidityPool.liquidityProviderCount += ONE_BI
    }
    let cash = convertToDecimal(event.params.addedCash, BI_18)
    account.collateralAmount += cash
    // shareAmount update on shareToken transfer event
    // account.shareAmount += convertToDecimal(event.params.mintedShare, BI_18)
    account.save()
    liquidityPool.liquidityHisCount += ONE_BI
    liquidityPool.save()

    let transactionHash = event.transaction.hash.toHexString()
    let liquidityHistory = new LiquidityHistory(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    liquidityHistory.liquidityPool = liquidityPool.id
    liquidityHistory.trader = user.id
    liquidityHistory.collateral = cash
    liquidityHistory.type = LiquidityType.ADD
    liquidityHistory.transactionHash = transactionHash
    liquidityHistory.blockNumber = event.block.number
    liquidityHistory.timestamp = event.block.timestamp
    liquidityHistory.logIndex = event.logIndex
    liquidityHistory.save()
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
    liquidityPool.liquidityHisCount += ONE_BI
    liquidityPool.save()

    let transactionHash = event.transaction.hash.toHexString()
    let liquidityHistory = new LiquidityHistory(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    liquidityHistory.liquidityPool = liquidityPool.id
    liquidityHistory.trader = user.id
    liquidityHistory.collateral = cash
    liquidityHistory.type = LiquidityType.REMOVE
    liquidityHistory.transactionHash = transactionHash
    liquidityHistory.blockNumber = event.block.number
    liquidityHistory.timestamp = event.block.timestamp
    liquidityHistory.logIndex = event.logIndex
    liquidityHistory.save()
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
    let position = convertToDecimal(event.params.position, BI_18)
    let fee = convertToDecimal(event.params.totalFee, BI_18)
    let lpFee = convertToDecimal(event.params.lpFee, BI_18)
    let { poolHourData } = getPoolHourData(event.block.timestamp, event.address.toHexString(), ZERO_BD)
    poolHourData.lpFee += lpFee
    poolHourData.fundingPayment += perp.position * (perp.entryUnitAcc - perp.unitAccumulativeFunding)
    poolHourData.tradePNL += perp.position * (price - perp.entryPrice)
    poolHourData.save()
    newTrade(perp as Perpetual, trader, account, position, price, fee, transactionHash, event.logIndex, event.block.number, event.block.timestamp, TradeType.NORMAL)
    
    perp.lastPrice = price
    perp.position += convertToDecimal(-event.params.position, BI_18)
    perp.entryPrice = price
    perp.entryUnitAcc = perp.unitAccumulativeFunding
    perp.save()

    // update trade data
    updateTrade15MinData(perp as Perpetual, event)
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

    // new liquidate
    let liquidate = new Liquidate(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    liquidate.perpetual = perp.id
    liquidate.trader = event.params.trader.toHexString()
    liquidate.liquidator = event.params.liquidator.toHexString()
    let amount = convertToDecimal(event.params.amount, BI_18)
    liquidate.price = price
    liquidate.amount = amount
    let penalty = convertToDecimal(event.params.penalty, BI_18)
    liquidate.penalty = penalty
    let lpPenalty = convertToDecimal(event.params.penaltyToLP, BI_18)
    liquidate.penaltyToLP = lpPenalty
    liquidate.transactionHash = transactionHash
    liquidate.blockNumber = event.block.number
    liquidate.timestamp = event.block.timestamp
    liquidate.logIndex = event.logIndex

    let type = TradeType.LIQUIDATEBYAMM
    // liquidator
    if (event.params.liquidator.toHexString() == event.address.toHexString()) {
        let { poolHourData } = getPoolHourData(event.block.timestamp, event.address.toHexString(), ZERO_BD)
        poolHourData.lpPenalty += lpPenalty
        poolHourData.fundingPayment += perp.position * (perp.entryUnitAcc - perp.unitAccumulativeFunding)
        poolHourData.tradePNL += perp.position * (price - perp.entryPrice)
        poolHourData.save()
        // liquidator is AMM
        perp.position += convertToDecimal(-event.params.amount, BI_18)
        perp.entryPrice = price
        perp.entryUnitAcc = perp.unitAccumulativeFunding
        liquidate.type = 0
    } else {
        // liquidator is user
        liquidate.type = 1
        type = TradeType.LIQUIDATEBYTRADER
        let liquidator = fetchUser(event.params.liquidator)
        let liquidatorAccount = fetchMarginAccount(liquidator, perp as Perpetual)
        newTrade(perp as Perpetual, liquidator, liquidatorAccount, amount, price, NegBigDecimal(penalty), transactionHash, event.logIndex, event.block.number, event.block.timestamp, type)
    }
    
    // trader
    newTrade(perp as Perpetual, trader, account, amount, price, penalty, transactionHash, event.logIndex, event.block.number, event.block.timestamp, type)

    liquidate.save()

    perp.lastPrice = price
    perp.liqCount += ONE_BI
    perp.save()
}

export function handleTransferExcessInsuranceFundToLP(event: TransferExcessInsuranceFundToLPEvent): void {
    let { poolHourData } = getPoolHourData(event.block.timestamp, event.address.toHexString(), ZERO_BD)
    poolHourData.excessInsuranceFund += convertToDecimal(event.params.amount, BI_18)
    poolHourData.save()
}

export function getPoolHourData(timestamp: BigInt, poolID: String, poolMargin: BigDecimal): { poolHourData: PoolHourData; isNew: boolean } {
    let hourIndex = timestamp.toI32() / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPoolID = poolID
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let poolHourData = PoolHourData.load(hourPoolID)
    let lastHourPoolID = poolID
        .concat('-')
        .concat(BigInt.fromI32(hourIndex - ONE_BI).toString())
    let lastPoolHourData = PoolHourData.load(lastHourPoolID)
    let isNew: boolean = false
    if (poolHourData === null) {
        poolHourData = new PoolHourData(hourPoolID)
        poolHourData.liquidityPool = poolID
        poolHourData.poolMargin = poolMargin
        poolHourData.poolMarginUSD = ZERO_BD
        poolHourData.netAssetValue = ZERO_BD
        poolHourData.timestamp = hourStartUnix
        if (lastPoolHourData == null) {
            poolHourData.poolMargin = ZERO_BD
            poolHourData.poolMarginUSD = ZERO_BD
            poolHourData.netAssetValue = ZERO_BD
            poolHourData.lpFee = ZERO_BD
            poolHourData.fundingPayment = ZERO_BD
            poolHourData.tradePNL = ZERO_BD
            poolHourData.lpPenalty = ZERO_BD
            poolHourData.excessInsuranceFund = ZERO_BD
        } else {
            // copy last hour data
            poolHourData.poolMargin = lastPoolHourData.poolMargin
            poolHourData.poolMarginUSD = lastPoolHourData.poolMarginUSD
            poolHourData.netAssetValue = lastPoolHourData.netAssetValue
            poolHourData.lpFee = lastPoolHourData.lpFee
            poolHourData.fundingPayment = lastPoolHourData.fundingPayment
            poolHourData.tradePNL = lastPoolHourData.tradePNL
            poolHourData.lpPenalty = lastPoolHourData.lpPenalty
            poolHourData.excessInsuranceFund = lastPoolHourData.excessInsuranceFund
        }
        isNew = true
    }
    return {poolHourData, isNew}
}

function newTrade(perp: Perpetual, trader: User, account: MarginAccount, amount: BigDecimal, price: BigDecimal, fee: BigDecimal,
    transactionHash: String, logIndex: BigInt, blockNumber: BigInt, timestamp: BigInt, type: TradeType ): void {
    let close = splitCloseAmount(account.position, amount)
    let open = splitOpenAmount(account.position, amount)
    // close position
    if (close != ZERO_BD) {
        let percent = AbsBigDecimal(close) / AbsBigDecimal(amount)
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(logIndex.toString())
            .concat('-')
            .concat('0')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = close
        trade.price = price
        trade.isClose = true
        let pnlPercent = AbsBigDecimal(close.div(account.position))
        let pnl1 = NegBigDecimal(close).times(price).minus(account.entryValue.times(pnlPercent))
        let fundingPnl = account.entryFunding.times(pnlPercent).minus(NegBigDecimal(close).times(perp.unitAccumulativeFunding))
        trade.pnl = pnl1 + fundingPnl
        trade.fee = fee.times(percent)
        trade.type = type
        trade.transactionHash = transactionHash
        trade.blockNumber = blockNumber
        trade.timestamp = timestamp
        trade.logIndex = logIndex
        trade.save()
        // entry value and entry funding
        let position = account.position.plus(close)
        let oldPosition = account.position
        account.cashBalance -= price.times(close)
        account.cashBalance += perp.unitAccumulativeFunding.times(position)
        account.entryFunding = account.entryFunding.times(position).div(oldPosition)
        account.entryValue = account.entryValue.times(position).div(oldPosition)
        account.position = position

        perp.txCount += ONE_BI
    }

    // open position
    if (open != ZERO_BD) {
        let percent = AbsBigDecimal(open) / AbsBigDecimal(amount)
        let trade = new Trade(
            transactionHash
            .concat('-')
            .concat(logIndex.toString())
            .concat('-')
            .concat('1')
        )
        trade.perpetual = perp.id
        trade.trader = trader.id
        trade.amount = open
        trade.price = price
        trade.isClose = false
        trade.pnl = ZERO_BD
        trade.fee = fee.times(percent)
        trade.type = type
        trade.transactionHash = transactionHash
        trade.blockNumber = blockNumber
        trade.timestamp = timestamp
        trade.logIndex = logIndex
        trade.save()

        // entry value and entry funding
        let position = account.position.plus(open)
        account.cashBalance -= price.times(open)
        account.cashBalance += perp.unitAccumulativeFunding.times(open)
        account.entryFunding = account.entryFunding.plus(perp.unitAccumulativeFunding.times(open))
        account.entryValue = account.entryValue.plus(price.times(open))
        account.position = position

        perp.txCount += ONE_BI
    }
    
    account.save()
}

export function handleUpdatePoolMargin(event: UpdatePoolMarginEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let poolMargin = convertToDecimal(event.params.poolMargin, BI_18)
    // update poolMargin
    updatePoolHourData(liquidityPool as LiquidityPool, event.block.timestamp, poolMargin, true)
    updatePoolDayData(liquidityPool as LiquidityPool, event.block.timestamp, poolMargin, true)
}

export function handleUpdateUnitAccumulativeFunding(event: UpdateUnitAccumulativeFundingEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    let acc = convertToDecimal(event.params.unitAccumulativeFunding, BI_18)
    perp.unitAccumulativeFunding = acc
    perp.save()

    let timestamp = event.block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPerpID = perp.id
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let accHourData = AccHourData.load(hourPerpID)
    if (accHourData === null) {
        accHourData = new AccHourData(hourPerpID)
        accHourData.perpetual = perp.id
        accHourData.acc = acc
        accHourData.timestamp = hourStartUnix
        accHourData.save()
    }
}