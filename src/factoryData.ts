import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { McdexHourData, McdexDayData, McdexDaoHourData} from '../generated/schema'

export function updateFactoryData(volumeUSD: BigDecimal, valueLockedUSD: BigDecimal, blockTimestamp: BigInt):void {
    let timestamp = blockTimestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourID = BigInt.fromI32(hourIndex).toString()
    let mcdexHourData = McdexHourData.load(hourID)
    if (mcdexHourData === null) {
        mcdexHourData = new McdexHourData(hourID)
        mcdexHourData.timestamp = hourStartUnix
        mcdexHourData.totalVolumeUSD = volumeUSD
    } else {
        mcdexHourData.totalVolumeUSD += volumeUSD
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
        mcdexDayData.totalVolumeUSD = volumeUSD
    } else {
        mcdexDayData.totalVolumeUSD += volumeUSD
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