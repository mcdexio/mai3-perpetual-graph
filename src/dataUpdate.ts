import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Perpetual, LiquidityPool, TradeHourData, TradeDayData, TradeSevenDayData, PoolHourData, PoolDayData, ShareToken, PriceBucket} from '../generated/schema'
import {
    Trade as TradeEvent,
} from '../generated/templates/LiquidityPool/LiquidityPool'

import {
    ZERO_BD,
    BI_18,
    convertToDecimal,
    isUSDCollateral,
    isETHCollateral,
} from './utils'

export function updateTradeHourData(perp: Perpetual, event: TradeEvent): TradeHourData {
    let timestamp = event.block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPerpID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let tradeHourData = TradeHourData.load(hourPerpID)
    let price = convertToDecimal(event.params.price, BI_18)
    let amount = convertToDecimal(event.params.position, BI_18)
    if (amount < ZERO_BD) {
        amount = -amount
    }
    if (tradeHourData === null) {
        tradeHourData = new TradeHourData(hourPerpID)
        tradeHourData.perpetual = perp.id
        tradeHourData.timestamp = hourStartUnix
        tradeHourData.open = price
        tradeHourData.low = price
        tradeHourData.high = price
        tradeHourData.close = price
        tradeHourData.volume = amount.times(price)
    } else {
        tradeHourData.close = price
        if (tradeHourData.high < price) {
            tradeHourData.high = price
        } else if(tradeHourData.low > price) {
            tradeHourData.low = price
        }
        tradeHourData.volume = tradeHourData.volume.plus(amount.times(price))
    }
    tradeHourData.save()
    return tradeHourData as TradeHourData
}

export function updateTradeDayData(perp: Perpetual, event: TradeEvent): TradeDayData {
    let timestamp = event.block.timestamp.toI32()
    let dayIndex = timestamp / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayPerpID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(dayIndex).toString())
    let tradeDayData = TradeDayData.load(dayPerpID)
    let price = convertToDecimal(event.params.price, BI_18)
    let amount = convertToDecimal(event.params.position, BI_18)
    if (amount < ZERO_BD) {
        amount = -amount
    }
    if (tradeDayData === null) {
        tradeDayData = new TradeDayData(dayPerpID)
        tradeDayData.perpetual = perp.id
        tradeDayData.timestamp = dayStartUnix
        tradeDayData.open = price
        tradeDayData.low = price
        tradeDayData.high = price
        tradeDayData.close = price
        tradeDayData.volume = amount.times(price)
    } else {
        tradeDayData.close = price
        if (tradeDayData.high < price) {
            tradeDayData.high = price
        } else if(tradeDayData.low > price) {
            tradeDayData.low = price
        }
        tradeDayData.volume = tradeDayData.volume.plus(amount.times(price))
    }
    tradeDayData.save()
    return tradeDayData as TradeDayData
}

export function updateTradeSevenDayData(perp: Perpetual, event: TradeEvent): TradeSevenDayData {
    let timestamp = event.block.timestamp.toI32()
    let dayIndex = timestamp / (3600*24*7)
    let dayStartUnix = dayIndex * (3600*24*7)
    let dayPerpID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(dayIndex).toString())
    let tradeSevenDayData = TradeSevenDayData.load(dayPerpID)
    let price = convertToDecimal(event.params.price, BI_18)
    let amount = convertToDecimal(event.params.position, BI_18)
    if (amount < ZERO_BD) {
        amount = -amount
    }
    if (tradeSevenDayData === null) {
        tradeSevenDayData = new TradeSevenDayData(dayPerpID)
        tradeSevenDayData.perpetual = perp.id
        tradeSevenDayData.timestamp = dayStartUnix
        tradeSevenDayData.open = price
        tradeSevenDayData.low = price
        tradeSevenDayData.high = price
        tradeSevenDayData.close = price
        tradeSevenDayData.volume = amount.times(price)
    } else {
        tradeSevenDayData.close = price
        if (tradeSevenDayData.high < price) {
            tradeSevenDayData.high = price
        } else if(tradeSevenDayData.low > price) {
            tradeSevenDayData.low = price
        }
        tradeSevenDayData.volume = tradeSevenDayData.volume.plus(amount.times(price))
    }
    tradeSevenDayData.save()
    return tradeSevenDayData as TradeSevenDayData
}

export function updatePoolHourData(pool: LiquidityPool, timestamp: BigInt, poolMargin: BigDecimal, isRefresh: boolean): PoolHourData {
    let hourIndex = timestamp.toI32() / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPoolID = pool.id
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let poolHourData = PoolHourData.load(hourPoolID)
    if (poolHourData === null) {
        poolHourData = new PoolHourData(hourPoolID)
        poolHourData.liquidityPool = pool.id
        poolHourData.poolMargin = poolMargin
        poolHourData.poolMarginUSD = ZERO_BD
        poolHourData.netAssetValue = ZERO_BD
        poolHourData.timestamp = hourStartUnix
    } else if (!isRefresh) {
        return poolHourData as PoolHourData
    }
    let shareToken = ShareToken.load(pool.shareToken)
    let nav = ZERO_BD
    if (shareToken.totalSupply != ZERO_BD) {
        nav = poolMargin.div(shareToken.totalSupply)
    }
    pool.poolMargin = poolMargin
    if (isUSDCollateral(pool.collateralAddress)) {
        pool.poolMarginUSD = pool.poolMargin
    } else if (isETHCollateral(pool.collateralAddress)) {
        let bucket = PriceBucket.load('1')
        let ethPrice = ZERO_BD
        if (bucket != null && bucket.ethPrice != null) {
            ethPrice = bucket.ethPrice as BigDecimal
        }
        pool.poolMarginUSD = pool.poolMargin.times(ethPrice)
    }
    poolHourData.poolMarginUSD = pool.poolMarginUSD
    poolHourData.netAssetValue = nav
    pool.save()
    poolHourData.save()
    return poolHourData as PoolHourData
}

export function updatePoolDayData(pool: LiquidityPool, timestamp: BigInt, poolMargin: BigDecimal, isRefresh: boolean): PoolDayData {
    let dayIndex = timestamp.toI32() / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayPoolID = pool.id
        .concat('-')
        .concat(BigInt.fromI32(dayIndex).toString())
    let poolDayData = PoolDayData.load(dayPoolID)
    if (poolDayData === null) {
        poolDayData = new PoolDayData(dayPoolID)
        poolDayData.liquidityPool = pool.id
        poolDayData.poolMargin = poolMargin
        poolDayData.poolMarginUSD = ZERO_BD
        poolDayData.netAssetValue = ZERO_BD
        poolDayData.timestamp = dayStartUnix
    } else if (!isRefresh) {
        return poolDayData as PoolDayData
    }
    let shareToken = ShareToken.load(pool.shareToken)
    let nav = ZERO_BD
    if (shareToken.totalSupply != ZERO_BD) {
        nav = poolMargin.div(shareToken.totalSupply)
    }
    pool.poolMargin = poolMargin
    if (isUSDCollateral(pool.collateralAddress)) {
        pool.poolMarginUSD = pool.poolMargin
    } else if (isETHCollateral(pool.collateralAddress)) {
        let bucket = PriceBucket.load('1')
        let ethPrice = ZERO_BD
        if (bucket != null && bucket.ethPrice != null) {
            ethPrice = bucket.ethPrice as BigDecimal
        }
        pool.poolMarginUSD = pool.poolMargin.times(ethPrice)
    }
    poolDayData.poolMarginUSD = pool.poolMarginUSD
    poolDayData.netAssetValue = nav
    pool.save()
    poolDayData.save()
    return poolDayData as PoolDayData
}