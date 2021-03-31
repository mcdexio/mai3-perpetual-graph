import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { McdexHourData, McdexDayData, McdexDaoHourData} from '../generated/schema'
import { ZERO_BD } from "./utils"

export function updateMcdexTradeVolumeData(volumeUSD: BigDecimal, blockTimestamp: BigInt):void {
    let timestamp = blockTimestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourID = BigInt.fromI32(hourIndex).toString()
    let mcdexHourData = McdexHourData.load(hourID)
    if (mcdexHourData === null) {
        mcdexHourData = new McdexHourData(hourID)
        mcdexHourData.timestamp = hourStartUnix
        mcdexHourData.totalVolumeUSD = volumeUSD
        mcdexHourData.totalValueLockedUSD = ZERO_BD
    } else {
        mcdexHourData.totalVolumeUSD += volumeUSD
    }
    mcdexHourData.save()

    let dayIndex = timestamp / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayID = BigInt.fromI32(dayIndex).toString()
    let mcdexDayData = McdexDayData.load(dayID)
    if (mcdexDayData === null) {
        mcdexDayData = new McdexDayData(dayID)
        mcdexDayData.timestamp = dayStartUnix
        mcdexDayData.totalVolumeUSD = volumeUSD
        mcdexDayData.totalValueLockedUSD = ZERO_BD
    } else {
        mcdexDayData.totalVolumeUSD += volumeUSD
    }
    mcdexDayData.save()
}

export function updateMcdexTVLData(valueLockedUSD: BigDecimal, blockTimestamp: BigInt):void {
    let timestamp = blockTimestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourID = BigInt.fromI32(hourIndex).toString()
    let mcdexHourData = McdexHourData.load(hourID)
    if (mcdexHourData === null) {
        mcdexHourData = new McdexHourData(hourID)
        mcdexHourData.timestamp = hourStartUnix
        mcdexHourData.totalVolumeUSD = ZERO_BD
    }
    mcdexHourData.totalValueLockedUSD = valueLockedUSD
    mcdexHourData.save()

    let dayIndex = timestamp / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayID = BigInt.fromI32(dayIndex).toString()
    let mcdexDayData = McdexDayData.load(dayID)
    if (mcdexDayData === null) {
        mcdexDayData = new McdexDayData(dayID)
        mcdexDayData.timestamp = dayStartUnix
        mcdexDayData.totalVolumeUSD = ZERO_BD
    }
    mcdexDayData.totalValueLockedUSD = valueLockedUSD
    mcdexDayData.save()
}


export function updateMcdexDaodata(valueUSD: BigDecimal, blockTimestamp: BigInt):void {
    let timestamp = blockTimestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourID = BigInt.fromI32(hourIndex).toString()
    let mcdexDaoHourData = McdexDaoHourData.load(hourID)
    if (mcdexDaoHourData === null) {
        mcdexDaoHourData = new McdexDaoHourData(hourID)
        mcdexDaoHourData.timestamp = hourStartUnix
        mcdexDaoHourData.capturedValueUSD = valueUSD
    } else {
        mcdexDaoHourData.capturedValueUSD += valueUSD
    }
    mcdexDaoHourData.save()
}