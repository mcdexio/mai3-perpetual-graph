import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { McdexHourData, McdexDayData} from '../generated/schema'

import {
    FACTORY,
} from './utils'


export function updateFactoryData(volumeUSD: BigDecimal, valueLockedUSD: BigDecimal, blockTimestamp: BigInt):void {
    let timestamp = blockTimestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourID = FACTORY
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
    let mcdexHourData = McdexHourData.load(hourID)
    if (mcdexHourData === null) {
        mcdexHourData = new McdexHourData(hourID)
        mcdexHourData.timestamp = hourStartUnix
        mcdexHourData.totalValueLockedUSD = valueLockedUSD
        mcdexHourData.totalVolumeUSD = volumeUSD
    } else {
        mcdexHourData.totalVolumeUSD += volumeUSD
        mcdexHourData.totalValueLockedUSD += valueLockedUSD
    }
    mcdexHourData.save()

    let dayIndex = timestamp / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayID = FACTORY
        .concat('-')
        .concat(BigInt.fromI32(dayIndex).toString())
    let mcdexDayData = McdexDayData.load(dayID)
    if (mcdexDayData === null) {
        mcdexDayData = new McdexHourData(dayID)
        mcdexDayData.timestamp = dayStartUnix
        mcdexDayData.totalValueLockedUSD = valueLockedUSD
        mcdexDayData.totalVolumeUSD = volumeUSD
    } else {
        mcdexDayData.totalValueLockedUSD += valueLockedUSD
        mcdexDayData.totalVolumeUSD += volumeUSD
    }
    mcdexDayData.save()
}
