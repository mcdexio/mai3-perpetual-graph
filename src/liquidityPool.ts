import {BigInt, BigDecimal, ethereum, log, Address} from "@graphprotocol/graph-ts"

import {
    Factory,
    LiquidityPool,
    Perpetual,
    Trade,
    AccHourData,
    PoolHourData,
    User,
    MarginAccount,
    Liquidate,
    LiquidityHistory,
    FundingRateMinData,
    FundingRateHourData
} from '../generated/schema'

import {
    CreatePerpetual as CreatePerpetualEvent,
    SetOracle as SetOracleEvent,
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
    Settle as SettleEvent,
    ClaimOperator as ClaimOperatorEvent,
    OperatorCheckIn as OperatorCheckInEvent,
    UpdatePrice as UpdatePriceEvent,
    AddAMMKeeper as AddAMMKeeperEvent,
    RemoveAMMKeeper as RemoveAMMKeeperEvent,
    UpdateFundingRate as UpdateFundingRateEvent,
    TransferFeeToOperator,
    TransferFeeToOperator1,
    TransferFeeToVault
} from '../generated/templates/LiquidityPool/LiquidityPool'
import { BTC_PERPETUAL, DaoPools, ETH_PERPETUAL } from "./const"

import {
    updateTrade15MinData,
    updateTradeDayData,
    updateTradeSevenDayData,
    updateTradeHourData,
    updatePoolHourData,
    updatePoolDayData,
    updateOpenInterestDayData
} from './dataUpdate'
import {updateMcdexTradeVolumeData, updateMcdexTVLData} from './factoryData'

import {
    ZERO_BD,
    ONE_BI,
    OPERATOR_EXP,
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
    FACTORY,
    getTokenPrice,
    setETHPrice,
    setBTCPrice,
    getCollateralBalance,
} from './utils'

export function handleCreatePerpetual(event: CreatePerpetualEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let factory = Factory.load(liquidityPool.factory) as Factory
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.operatorAddress = event.params.operator.toHexString()
    perp.underlying = fetchOracleUnderlying(event.params.oracle)
    perp.name = perp.underlying.concat('-').concat(perp.collateralName)
    perp.createdAtTimestamp = event.block.timestamp
    perp.createdAtBlockNumber = event.block.number
    perp.save()

    factory.perpetualCount = factory.perpetualCount.plus(ONE_BI)
    let perpetuals = factory.perpetuals as string[]
    perpetuals.push(perp.id)
    factory.perpetuals = perpetuals
    factory.save()
}

export function handleRunLiquidityPool(event: RunLiquidityPoolEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    liquidityPool.isRun = true
    let perpIDs = liquidityPool.perpetualIDs as string[]
    for (let index = 0; index < perpIDs.length; index++) {
        let id = perpIDs[index]
        let perp = Perpetual.load(id) as Perpetual
        perp.isRun = true
        perp.save()
    }
    liquidityPool.save()
}

export function handleSetNormalState(event: SetNormalStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.NORMAL
    perp.save()
}

export function handleSetOracle(event: SetOracleEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.oracleAddress = event.params.newOracle.toHexString()
    perp.underlying = fetchOracleUnderlying(event.params.newOracle)
    perp.save()
}

export function handleSetEmergencyState(event: SetEmergencyStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    perp.state = PerpetualState.EMERGENCY
    perp.settledAtTimestamp = event.block.timestamp
    perp.settledAtBlockNumber = event.block.number
    perp.save()
}

export function handleSettle(event: SettleEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    // update amm position and openInterest
    if (event.params.trader.toHexString() == event.address.toHexString()) {
        perp.position = ZERO_BD
        perp.openInterest = ZERO_BD
        perp.save()
        return
    }
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
    marginAccount.position = ZERO_BD
    marginAccount.save()
}

export function handleSetClearedState(event: SetClearedStateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
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
}

export function handleWithdraw(event: WithdrawEvent): void {
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id) as Perpetual
    let user = fetchUser(event.params.trader)
    let marginAccount = fetchMarginAccount(user, perp as Perpetual)
}

export function handleAddLiquidity(event: AddLiquidityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool as LiquidityPool)
    if (account.shareAmount == ZERO_BD) {
        liquidityPool.liquidityProviderCount = liquidityPool.liquidityProviderCount.plus(ONE_BI)
    }
    let cash = convertToDecimal(event.params.addedCash, BI_18)
    account.entryCollateralAmount = account.entryCollateralAmount.plus(cash)
    account.entryPoolMargin = account.entryPoolMargin.plus(convertToDecimal(event.params.addedPoolMargin, BI_18))
    // shareAmount update on shareToken transfer event
    // account.shareAmount += convertToDecimal(event.params.mintedShare, BI_18)
    account.save()
    liquidityPool.liquidityHisCount = liquidityPool.liquidityHisCount.plus(ONE_BI)

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

    // update tvl
    if (event.block.timestamp > liquidityPool.collateralUpdateTimestamp.plus(BigInt.fromI32(86400))) {
        let factory = Factory.load(FACTORY) as Factory
        let tokenPrice = getTokenPrice(liquidityPool.collateralAddress)
        let balance = getCollateralBalance(liquidityPool.collateralAddress, event.address, liquidityPool.collateralDecimals)
        liquidityPool.collateralAmount = balance
        if (tokenPrice > ZERO_BD) {
            let oldCollateralUSD = liquidityPool.collateralUSD
            liquidityPool.collateralUSD = liquidityPool.collateralAmount.times(tokenPrice)
            factory.totalValueLockedUSD = factory.totalValueLockedUSD.minus(oldCollateralUSD)
            factory.totalValueLockedUSD = factory.totalValueLockedUSD.plus(liquidityPool.collateralUSD)
            factory.save()
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }
    }
    liquidityPool.save()
}

export function handleRemoveLiquidity(event: RemoveLiquidityEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, liquidityPool)
    let cash = convertToDecimal(event.params.returnedCash.neg(), BI_18)
    // shareAmount update on shareToken transfer event
    // account.shareAmount -= convertToDecimal(event.params.burnedShare, BI_18)
    let oldShareAmount = account.shareAmount.plus(convertToDecimal(event.params.burnedShare, BI_18))
    account.entryCollateralAmount = account.entryCollateralAmount.times(account.shareAmount).div(oldShareAmount)
    account.entryPoolMargin = account.entryPoolMargin.times(account.shareAmount).div(oldShareAmount)
    if (account.shareAmount == ZERO_BD) {
        liquidityPool.liquidityProviderCount = liquidityPool.liquidityProviderCount.minus(ONE_BI)
    }
    account.save()
    liquidityPool.liquidityHisCount = liquidityPool.liquidityHisCount.plus(ONE_BI)

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

    // update tvl
    if (event.block.timestamp > liquidityPool.collateralUpdateTimestamp.plus(BigInt.fromI32(86400))) {
        let factory = Factory.load(FACTORY) as Factory
        let tokenPrice = getTokenPrice(liquidityPool.collateralAddress)
        let balance = getCollateralBalance(liquidityPool.collateralAddress, event.address, liquidityPool.collateralDecimals)
        liquidityPool.collateralAmount = balance
        if (tokenPrice > ZERO_BD) {
            let oldCollateralUSD = liquidityPool.collateralUSD
            liquidityPool.collateralUSD = liquidityPool.collateralAmount.times(tokenPrice)
            factory.totalValueLockedUSD = factory.totalValueLockedUSD.minus(oldCollateralUSD)
            factory.totalValueLockedUSD = factory.totalValueLockedUSD.plus(liquidityPool.collateralUSD)
            factory.save()
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }
    }
    liquidityPool.save()
}

export function updateOpenInterest(oldPosition: BigDecimal, newPosition: BigDecimal): BigDecimal {
    let deltaPosition = ZERO_BD
    if (oldPosition > ZERO_BD) {
        deltaPosition = deltaPosition.minus(oldPosition)
    }

    if (newPosition > ZERO_BD) {
        deltaPosition = deltaPosition.plus(newPosition)
    }
    return deltaPosition
}

export function handleUpdatePrice(event: UpdatePriceEvent): void {
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id) as Perpetual
    let markPrice = convertToDecimal(event.params.markPrice, BI_18)
    if (perp.lastMarkPrice != markPrice) {
        perp.beforeLastMarkPrice = perp.lastMarkPrice
        perp.lastMarkPrice = markPrice
        perp.save()
    }

    // set ETH/BTC price for TVL compute which pool use ETH/BTC as collateral
    if (id == ETH_PERPETUAL) {
        setETHPrice(markPrice, event.params.markPriceUpdateTime)
    } else if (id == BTC_PERPETUAL) {
        setBTCPrice(markPrice, event.params.markPriceUpdateTime)
    }
}

export function handleTransferFeeToOperator1(event: TransferFeeToOperator1): void {
    // for old transfer event, transferToVault event not exists, get vaultFee by operator fee 
    let id = event.address.toHexString()
    if (DaoPools.isSet(id)) {
        let liquidityPool = LiquidityPool.load(id) as LiquidityPool
        let token_price = getTokenPrice(liquidityPool.collateralAddress)
        if (token_price > ZERO_BD) {
            let factory = Factory.load(FACTORY) as Factory
            // add dao pool operatorFee to protocol revenue
            let operatorFee = convertToDecimal(event.params.operatorFee, BI_18)
            let vaultFee = operatorFee.times(BigDecimal.fromString('0.6'))
            factory.totalProtocolRevenueUSD = factory.totalProtocolRevenueUSD.plus(operatorFee.times(token_price)).plus(vaultFee.times(token_price))
            factory.save()
        }
    }
}

export function handleTransferFeeToOperator(event: TransferFeeToOperator): void {
    let id = event.address.toHexString()
    if (DaoPools.isSet(id)) {
        let liquidityPool = LiquidityPool.load(id) as LiquidityPool
        let token_price = getTokenPrice(liquidityPool.collateralAddress)
        if (token_price > ZERO_BD) {
            let factory = Factory.load(FACTORY) as Factory
            // add dao pool operatorFee to protocol revenue
            let operatorFee = convertToDecimal(event.params.operatorFee, BI_18)
            factory.totalProtocolRevenueUSD = factory.totalProtocolRevenueUSD.plus(operatorFee.times(token_price))
            factory.save()
        }
    }
}

export function handleTransferFeeToVault(event: TransferFeeToVault): void {
    let id = event.address.toHexString()
    let liquidityPool = LiquidityPool.load(id) as LiquidityPool
    let token_price = getTokenPrice(liquidityPool.collateralAddress)
    if (token_price > ZERO_BD) {
        let factory = Factory.load(FACTORY) as Factory
        // add vault fee to protocol revenue
        let vaultFee = convertToDecimal(event.params.vaultFee, BI_18)
        factory.totalProtocolRevenueUSD = factory.totalProtocolRevenueUSD.plus(vaultFee.times(token_price))
        factory.save()
    }  
}

export function handleTrade(event: TradeEvent): void {
    let factory = Factory.load(FACTORY) as Factory
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id) as Perpetual

    let trader = fetchUser(event.params.trader)
    let account = fetchMarginAccount(trader, perp as Perpetual)
    let transactionHash = event.transaction.hash.toHexString()
    let price = convertToDecimal(event.params.price, BI_18)
    let position = convertToDecimal(event.params.position, BI_18)
    let fee = convertToDecimal(event.params.fee, BI_18)
    let lpFee = convertToDecimal(event.params.lpFee, BI_18)
    perp.lpFee = perp.lpFee.plus(lpFee)
    perp.lpFunding = perp.lpFunding.plus(perp.position.times(perp.lastUnitAcc.minus(perp.unitAccumulativeFunding)))
    perp.lpTotalPNL = perp.lpTotalPNL.plus(perp.position.times(price.minus(perp.lastPrice)))
    perp.lpPositionPNL = perp.lpPositionPNL.plus(perp.position.times(perp.lastMarkPrice.minus(perp.beforeLastMarkPrice)))
    newTrade(perp as Perpetual, trader, account, position, price, perp.lastMarkPrice, fee, transactionHash, event.logIndex, event.block.number, event.block.timestamp, TradeType.NORMAL)
    computeAmmEntryValue(perp as Perpetual, position.neg(), price)

    let oldPosition = perp.position
    perp.position = perp.position.plus(position.neg())
    perp.openInterest = perp.openInterest.plus(updateOpenInterest(oldPosition, perp.position))

    perp.lastPrice = price
    perp.lastUnitAcc = perp.unitAccumulativeFunding
    let volume = AbsBigDecimal(position).times(price)
    let volumeUSD = ZERO_BD
    perp.totalVolume = perp.totalVolume.plus(volume)
    perp.totalFee = perp.totalFee.plus(fee)
    // to USD
    let tokenPrice = getTokenPrice(liquidityPool.collateralAddress)
    volumeUSD = volume.times(tokenPrice)
    perp.totalVolumeUSD = perp.totalVolumeUSD.plus(volumeUSD)
    factory.totalVolumeUSD = factory.totalVolumeUSD.plus(volumeUSD)
    factory.totalSupplySideRevenueUSD = factory.totalSupplySideRevenueUSD.plus(lpFee.times(tokenPrice))
    perp.save()

    // update tvl
    if (event.block.timestamp > liquidityPool.collateralUpdateTimestamp.plus(BigInt.fromI32(86400))) {
        let balance = getCollateralBalance(liquidityPool.collateralAddress, event.address, liquidityPool.collateralDecimals)
        liquidityPool.collateralAmount = balance
        if (tokenPrice > ZERO_BD) {
            let oldCollateralUSD = liquidityPool.collateralUSD
            liquidityPool.collateralUSD = liquidityPool.collateralAmount.times(tokenPrice)
            factory.totalValueLockedUSD = factory.totalValueLockedUSD.minus(oldCollateralUSD)
            factory.totalValueLockedUSD = factory.totalValueLockedUSD.plus(liquidityPool.collateralUSD)
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }
        liquidityPool.save()
    }
    factory.save()

    // update trade data
    updateTrade15MinData(perp as Perpetual, price, AbsBigDecimal(position), event.block.timestamp)
    updateTradeHourData(perp as Perpetual, price, AbsBigDecimal(position), event.block.timestamp)
    updateTradeDayData(perp as Perpetual, price, AbsBigDecimal(position), event.block.timestamp)
    updateTradeSevenDayData(perp as Perpetual, price, AbsBigDecimal(position), event.block.timestamp)
    // update factory trade data
    updateMcdexTradeVolumeData(volumeUSD, event.block.timestamp)
    updateOpenInterestDayData(perp as Perpetual, event.block.timestamp)
}

export function handleLiquidate(event: LiquidateEvent): void {
    let factory = Factory.load(FACTORY) as Factory
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.perpetualIndex.toString())
    let perp = Perpetual.load(id) as Perpetual
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
    liquidate.markPrice = perp.lastMarkPrice
    liquidate.amount = amount
    let penalty = convertToDecimal(event.params.penalty, BI_18)
    liquidate.penalty = penalty
    let lpPenalty = convertToDecimal(event.params.penaltyToLP, BI_18)
    liquidate.penaltyToLP = lpPenalty
    liquidate.transactionHash = transactionHash
    liquidate.blockNumber = event.block.number
    liquidate.timestamp = event.block.timestamp
    liquidate.logIndex = event.logIndex

    let volume = AbsBigDecimal(amount).times(price)
    let volumeUSD = ZERO_BD
    // to USD
    let tokenPrice = getTokenPrice(liquidityPool.collateralAddress)
    volumeUSD = volume.times(tokenPrice)

    let type = TradeType.LIQUIDATEBYAMM
    // liquidator
    if (event.params.liquidator.toHexString() == event.address.toHexString()) {
        // liquidator is AMM
        liquidate.type = 0
        perp.lpPenalty = perp.lpPenalty.plus(lpPenalty)
        perp.lpFunding = perp.lpFunding.plus(perp.position.times(perp.lastUnitAcc.minus(perp.unitAccumulativeFunding)))
        perp.lpTotalPNL = perp.lpTotalPNL.plus(perp.position.times(price.minus(perp.lastPrice)))
        perp.lpPositionPNL = perp.lpPositionPNL.plus(perp.position.times(perp.lastMarkPrice.minus(perp.beforeLastMarkPrice)))
        // liquidator is AMM
        let oldPosition = perp.position
        // notice: call computeAmmEntryValue before position change
        computeAmmEntryValue(perp as Perpetual, amount.neg(), price)
        perp.position = perp.position.plus(amount.neg())
        perp.openInterest = perp.openInterest.plus(updateOpenInterest(oldPosition, perp.position))
        perp.lastPrice = price
        perp.lastUnitAcc = perp.unitAccumulativeFunding
        
        // update perpetual trade volume
        perp.totalVolume = perp.totalVolume.plus(volume)
        perp.totalVolumeUSD = perp.totalVolumeUSD.plus(volumeUSD)
        factory.totalVolumeUSD = factory.totalVolumeUSD.plus(volumeUSD)
        factory.totalSupplySideRevenueUSD = factory.totalSupplySideRevenueUSD.plus(lpPenalty.times(tokenPrice))
        // update trade data
        updateTrade15MinData(perp as Perpetual, price, AbsBigDecimal(amount), event.block.timestamp)
        updateTradeHourData(perp as Perpetual, price, AbsBigDecimal(amount), event.block.timestamp)
        updateTradeDayData(perp as Perpetual, price, AbsBigDecimal(amount), event.block.timestamp)
        updateTradeSevenDayData(perp as Perpetual, price, AbsBigDecimal(amount), event.block.timestamp)
        updateOpenInterestDayData(perp as Perpetual, event.block.timestamp)
        // update factory trade data
        updateMcdexTradeVolumeData(volumeUSD, event.block.timestamp)
    } else {
        // liquidator is user
        liquidate.type = 1
        type = TradeType.LIQUIDATEBYTRADER
        let liquidator = fetchUser(event.params.liquidator)
        let liquidatorAccount = fetchMarginAccount(liquidator, perp as Perpetual)
        newTrade(perp as Perpetual, liquidator, liquidatorAccount, amount, price, perp.lastMarkPrice, penalty.neg(), transactionHash, event.logIndex, event.block.number, event.block.timestamp, type)
    }

    // trader
    newTrade(perp as Perpetual, trader, account, amount, price, perp.lastMarkPrice, penalty, transactionHash, event.logIndex, event.block.number, event.block.timestamp, type)

    liquidate.save()

    perp.liqCount = perp.liqCount.plus(ONE_BI)
    perp.save()
    factory.save()
}

export function handleTransferExcessInsuranceFundToLP(event: TransferExcessInsuranceFundToLPEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    liquidityPool.lpExcessInsuranceFund = liquidityPool.lpExcessInsuranceFund.plus(convertToDecimal(event.params.amount, BI_18))
    liquidityPool.save()
}

export function getPoolHourData(timestamp: BigInt, poolID: string): PoolHourData {
    let hourIndex = timestamp.toI32() / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPoolID = poolID
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let poolHourData = PoolHourData.load(hourPoolID)
    if (poolHourData === null) {
        poolHourData = new PoolHourData(hourPoolID)
        poolHourData.liquidityPool = poolID
        poolHourData.timestamp = hourStartUnix
        let lastHourPoolID = poolID
            .concat('-')
            .concat(BigInt.fromI32(hourIndex - 1).toString())
        let lastPoolHourData = PoolHourData.load(lastHourPoolID)
        if (lastPoolHourData == null) {
            poolHourData.poolMargin = ZERO_BD
            poolHourData.poolMarginUSD = ZERO_BD
            poolHourData.netAssetValue = ZERO_BD
        } else {
            // copy last hour data
            poolHourData.poolMargin = lastPoolHourData.poolMargin
            poolHourData.poolMarginUSD = lastPoolHourData.poolMarginUSD
            poolHourData.netAssetValue = lastPoolHourData.netAssetValue
        }
    }
    return poolHourData as PoolHourData
}

function computeAmmEntryValue(perp: Perpetual, amount: BigDecimal, price: BigDecimal): void {
    let oldPosition = perp.position
    let close = splitCloseAmount(perp.position, amount)
    let open = splitOpenAmount(perp.position, amount)
    if (close != ZERO_BD) {
        let position = perp.position.plus(close)
        perp.entryValue = perp.entryValue.times(position).div(oldPosition)
    }

    if (open != ZERO_BD) {
        perp.entryValue = perp.entryValue.plus(price.times(open))
    }
}

function newTrade(perp: Perpetual, trader: User, account: MarginAccount, amount: BigDecimal, price: BigDecimal, markPrice: BigDecimal, fee: BigDecimal,
                  transactionHash: string, logIndex: BigInt, blockNumber: BigInt, timestamp: BigInt, type: TradeType): void {
    let oldPosition = account.position
    let close = splitCloseAmount(account.position, amount)
    let open = splitOpenAmount(account.position, amount)
    // close position
    if (close != ZERO_BD) {
        let percent = AbsBigDecimal(close.div(amount))
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
        trade.markPrice = markPrice
        trade.isClose = true
        let pnlPercent = AbsBigDecimal(close.div(account.position))
        let pnl1 = close.neg().times(price).minus(account.entryValue.times(pnlPercent))
        let fundingPnl = account.entryFunding.times(pnlPercent).minus(close.neg().times(perp.unitAccumulativeFunding))
        trade.pnl = pnl1.plus(fundingPnl)
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
        account.entryFunding = account.entryFunding.times(position).div(oldPosition)
        account.entryValue = account.entryValue.times(position).div(oldPosition)
        account.position = position

        perp.txCount = perp.txCount.plus(ONE_BI)
    }

    // open position
    if (open != ZERO_BD) {
        let percent = AbsBigDecimal(open.div(amount))
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
        trade.markPrice = markPrice
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
        account.entryFunding = account.entryFunding.plus(perp.unitAccumulativeFunding.times(open))
        account.entryValue = account.entryValue.plus(price.times(open))
        account.position = position

        perp.txCount = perp.txCount.plus(ONE_BI)
    }

    let newPosition = account.position
    perp.openInterest = perp.openInterest.plus(updateOpenInterest(oldPosition, newPosition))
    account.save()
}

export function handleUpdatePoolMargin(event: UpdatePoolMarginEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let poolMargin = convertToDecimal(event.params.poolMargin, BI_18)
    let collateralPrice = getTokenPrice(liquidityPool.collateralAddress)
    // update poolMargin
    updatePoolHourData(liquidityPool as LiquidityPool, event.block.timestamp, poolMargin, collateralPrice)
    updatePoolDayData(liquidityPool as LiquidityPool, event.block.timestamp, poolMargin, collateralPrice)
}

export function handleUpdateUnitAccumulativeFunding(event: UpdateUnitAccumulativeFundingEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool, event.params.perpetualIndex)
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

export function handleClaimOperator(event: ClaimOperatorEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    liquidityPool.operatorAddress = event.params.newOperator.toHexString()
    liquidityPool.operatorExpiration = event.block.timestamp.plus(OPERATOR_EXP)
    liquidityPool.save()
}

export function handleOperatorCheckIn(event: OperatorCheckInEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    liquidityPool.operatorExpiration = event.block.timestamp.plus(OPERATOR_EXP)
    liquidityPool.save()
}

export function handleAddAMMKeeper(event: AddAMMKeeperEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool, event.params.perpetualIndex)
    let keepers = perp.byAmmKeepers
    keepers.push(event.params.keeper.toHexString())
    perp.byAmmKeepers = keepers
    perp.save()
}

export function handleRemoveAMMKeeper(event: RemoveAMMKeeperEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool, event.params.perpetualIndex)
    let removedKeeper = event.params.keeper.toHexString()
    let ammKeepers = perp.byAmmKeepers
    let keepers: string[] = []
    for (let index = 0; index < ammKeepers.length; index++) {
        let keeper = ammKeepers[index]
        if (keeper != removedKeeper) {
            keepers.push(keeper)
        }
    }
    perp.byAmmKeepers = keepers
    perp.save()
}

export function handleUpdateFundingRate(event: UpdateFundingRateEvent): void {
    let liquidityPool = LiquidityPool.load(event.address.toHexString()) as LiquidityPool
    let perp = fetchPerpetual(liquidityPool, event.params.perpetualIndex)
    let timestamp = event.block.timestamp.toI32()
    let fundingRate = convertToDecimal(event.params.fundingRate, BI_18)
    let minIndex = timestamp / 60
    let minStartUnix = minIndex * 60
    let minPerpID = perp.id
        .concat('-')
        .concat(BigInt.fromI32(minIndex).toString())
    let fundingRateMinData = FundingRateMinData.load(minPerpID)
    if (fundingRateMinData === null) {
        fundingRateMinData = new FundingRateMinData(minPerpID)
        fundingRateMinData.perpetual = perp.id
        fundingRateMinData.timestamp = minStartUnix
        fundingRateMinData.fundingRate = fundingRate
    } else {
        fundingRateMinData.fundingRate = fundingRate
    }
    fundingRateMinData.save()

    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPerpID = perp.id
        .concat('-')
        .concat(BigInt.fromI32(hourStartUnix).toString())
    let fundingRateHourData = FundingRateHourData.load(hourPerpID)
    if (fundingRateHourData === null) {
        fundingRateHourData = new FundingRateHourData(hourPerpID)
        fundingRateHourData.perpetual = perp.id
        fundingRateHourData.timestamp = minStartUnix
        fundingRateHourData.fundingRate = fundingRate
    } else {
        fundingRateHourData.fundingRate = fundingRate
    }
    fundingRateHourData.save()
}