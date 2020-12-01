import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Perpetual, TradeMinuteData, TradeHourData, TradeDayData, TradeSevenDayData} from '../generated/schema'
import {
    Trade as TradeEvent,
} from '../generated/templates/Perpetual/Perpetual'

import {
    BI_18,
    convertToDecimal
} from './utils'

export function updateTradeMinuteData(perp: Perpetual, event: TradeEvent): TradeMinuteData {
    let timestamp = event.block.timestamp.toI32()
    let minuteIndex = timestamp / 60
    let minuteStartUnix = minuteIndex * 60
    let minutePerpID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(minuteIndex).toString())
    let tradeMinuteData = TradeMinuteData.load(minutePerpID)
    let price = convertToDecimal(event.params.priceLimit, BI_18)
    let amount = convertToDecimal(event.params.positionAmount, BI_18)

    if (tradeMinuteData === null) {
        tradeMinuteData = new TradeMinuteData(minutePerpID)
        tradeMinuteData.perpetual = perp.id
        tradeMinuteData.timestamp = minuteStartUnix
        tradeMinuteData.open = price
        tradeMinuteData.low = price
        tradeMinuteData.high = price
        tradeMinuteData.close = price
        tradeMinuteData.volume = amount.times(price)
    } else {
        tradeMinuteData.close = price
        if (tradeMinuteData.high < price) {
            tradeMinuteData.high = price
        } else if(tradeMinuteData.low > price) {
            tradeMinuteData.low = price
        }
        tradeMinuteData.volume = tradeMinuteData.volume.plus(amount.times(price))
    }
    tradeMinuteData.save()
    return tradeMinuteData as TradeMinuteData
}

export function updateTradeHourData(perp: Perpetual, event: TradeEvent): TradeHourData {
    let timestamp = event.block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPerpID = event.address
        .toHexString()
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let tradeHourData = TradeHourData.load(hourPerpID)
    let price = convertToDecimal(event.params.priceLimit, BI_18)
    let amount = convertToDecimal(event.params.positionAmount, BI_18)

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
    let price = convertToDecimal(event.params.priceLimit, BI_18)
    let amount = convertToDecimal(event.params.positionAmount, BI_18)

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
    let price = convertToDecimal(event.params.priceLimit, BI_18)
    let amount = convertToDecimal(event.params.positionAmount, BI_18)

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