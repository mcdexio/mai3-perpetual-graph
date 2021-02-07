import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, PriceBucket, PriceMinData, Price15MinData, PriceHourData, PriceDayData, PriceSevenDayData, ShareToken, Governor } from '../generated/schema'

import { CreateLiquidityPool } from '../generated/Factory/Factory'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'
import { Reader as ReaderContract } from '../generated/Factory/Reader'

import { updatePoolHourData, updatePoolDayData } from './dataUpdate'


import { 
    LiquidityPool as LiquidityPoolTemplate,
    ShareToken as ShareTokenTemplate,
    Governor as GovernorTemplate
} from '../generated/templates'

import {
    ZERO_BD,
    ONE_BI,
    BI_18,
    PerpetualState,
    isETHCollateral,
    convertToDecimal,
    fetchCollateralSymbol,
    ZERO_BI,
    isUSDCollateral
} from './utils'

import {
    ETH_ORACLE,
    FACTORY_ADDRESS,
    READER_ADDRESS,
    HANDLER_BLOCK
} from './const'

export function handleCreateLiquidityPool(event: CreateLiquidityPool): void {
    let factory = Factory.load(event.address.toHexString())
    if (factory === null) {
        factory = new Factory(event.address.toHexString())
        factory.liquidityPoolCount = ZERO_BI
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalLiquidityUSD = ZERO_BD
        factory.txCount = ZERO_BI
        factory.latestBlock = ZERO_BI
        factory.liquidityPools = []
        factory.perpetuals = []

        // create price bucket for save eth price
        let bucket = new PriceBucket('1')
        bucket.ethPrice = ZERO_BD
        bucket.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
        bucket.save()
    }
    factory.liquidityPoolCount = factory.liquidityPoolCount.plus(ONE_BI)
    let liquidityPools = factory.liquidityPools
    liquidityPools.push(event.params.liquidityPool.toHexString())
    factory.liquidityPools = liquidityPools
    factory.save()

    let liquidityPool = new LiquidityPool(event.params.liquidityPool.toHexString())
    liquidityPool.voteAddress = event.params.governor.toHexString()
    liquidityPool.shareAddress = event.params.shareToken.toHexString()
    liquidityPool.operatorAddress = event.params.operator.toHexString()
    liquidityPool.factory = factory.id
    liquidityPool.collateralAddress = event.params.collateral.toHexString()
    liquidityPool.collateralName = fetchCollateralSymbol(event.params.collateral)
    liquidityPool.collateralDecimals = event.params.collateralDecimals
    liquidityPool.poolMargin = ZERO_BD
    liquidityPool.poolMarginUSD = ZERO_BD
    liquidityPool.liquidityProviderCount = ZERO_BI
    liquidityPool.createdAtTimestamp = event.block.timestamp
    liquidityPool.createdAtBlockNumber = event.block.number
    liquidityPool.isRun = false
    liquidityPool.liquidityHisCount = ZERO_BI
    liquidityPool.perpetualIDs = []

    // create share token
    let shareToken = new ShareToken(event.params.shareToken.toHexString())
    shareToken.liquidityPool = liquidityPool.id
    shareToken.totalSupply = ZERO_BD
    liquidityPool.shareToken = shareToken.id

    // create vote
    let governor = new Governor(event.params.governor.toHexString())
    governor.liquidityPool = liquidityPool.id
    governor.totalVotes = ZERO_BD
    governor.totalReward = ZERO_BD
    governor.rewardRate = ZERO_BD
    governor.periodFinish = ZERO_BI
    governor.proposalCount = ZERO_BI
    liquidityPool.governor = governor.id 

    shareToken.save()
    governor.save()
    liquidityPool.save()

    // create the tracked contract based on the template
    LiquidityPoolTemplate.create(event.params.liquidityPool)
    ShareTokenTemplate.create(event.params.shareToken)
    GovernorTemplate.create(event.params.governor)
}

export function handleSyncPerpData(block: ethereum.Block): void {
    let factory = Factory.load(FACTORY_ADDRESS)
    if (factory === null) {
        return
    }
    factory.latestBlock = block.number
    factory.save()

    // update per hour for efficiency
    let timestamp = block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let bucket = PriceBucket.load('1')
    if (bucket != null && bucket.timestamp != hourStartUnix) {
        // update eth price
        let ethOracle = Address.fromString(ETH_ORACLE)
        let ethContract = OracleContract.bind(ethOracle)
        let price = ZERO_BD

        let callResult = ethContract.try_priceTWAPShort()
        if(callResult.reverted){
            log.warning("Get try_price reverted at block: {}", [block.number.toString()])
            return
        } else {
            price = convertToDecimal(callResult.value.value0, BI_18)
        }
        if (price > ZERO_BD) {
            bucket.ethPrice = price
            bucket.timestamp = hourStartUnix
            bucket.save()
        }
    } else {
        if (block.number < BigInt.fromI32(HANDLER_BLOCK)) {
            return
        }
    } 

    // update liquity pool's liquidity amount in USD
    let liquidityPools = factory.liquidityPools as string[]
    for (let index = 0; index < liquidityPools.length; index++) {
        let poolIndex = liquidityPools[index]
        let liquidityPool = LiquidityPool.load(poolIndex)
        // update poolMargin
        let poolMargin = ZERO_BD
        let contract = ReaderContract.bind(Address.fromString(READER_ADDRESS))
        let callResult = contract.try_getPoolMargin(Address.fromString(poolIndex))
        if (!callResult.reverted) {
            poolMargin = convertToDecimal(callResult.value.value1, BI_18)
        }
        updatePoolHourData(liquidityPool as LiquidityPool, block.timestamp, poolMargin)
        updatePoolDayData(liquidityPool as LiquidityPool, block.timestamp, poolMargin)
    }

    // update perpetual's trade volume amount in USD and oracle price data
    let perpetuals = factory.perpetuals as string[]
    for (let index = 0; index < perpetuals.length; index++) {
        let perpIndex = perpetuals[index]
        let perp = Perpetual.load(perpIndex)
        if (perp.state != PerpetualState.NORMAL) {
            continue
        }
        if (isUSDCollateral(perp.collateralAddress)) {
            perp.totalVolumeUSD = perp.totalVolume
        } else if (isETHCollateral(perp.collateralAddress)) {
            let ethPrice = ZERO_BD
            if (bucket.ethPrice != ZERO_BD) {
                ethPrice = bucket.ethPrice as BigDecimal
            }
            if (ethPrice > ZERO_BD) {
                perp.totalVolumeUSD = perp.totalVolume.times(ethPrice)
            }
        }
        perp.save()

        // perp price
        updatePriceData(perp.oracleAddress, timestamp)
    }
}

function updatePriceData(oracle: String, timestamp: i32): void {
    let price = ZERO_BD
    let contract = OracleContract.bind(Address.fromString(oracle))
    let callResult = contract.try_priceTWAPShort()
    if (!callResult.reverted) {
        price = convertToDecimal(callResult.value.value0, BI_18)
    }

    if (price == ZERO_BD) {
        return
    }

    // 15Min
    let minIndex = timestamp / 60
    let minStartUnix = minIndex * 60
    let minPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(minIndex).toString())
    let priceMinData = PriceMinData.load(minPriceID)
    if (priceMinData === null) {
        priceMinData = new PriceMinData(minPriceID)
        priceMinData.oracle = oracle
        priceMinData.open = price
        priceMinData.close = price
        priceMinData.high = price
        priceMinData.low = price
        priceMinData.timestamp = minStartUnix
    } else {
        priceMinData.close = price
        if (priceMinData.high < price) {
            priceMinData.high = price
        } else if(priceMinData.low > price) {
            priceMinData.low = price
        }
    }
    priceMinData.save()

    // 15Min
    let fifminIndex = timestamp / (60*15)
    let fifminStartUnix = fifminIndex * (60*15)
    let fifminPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(fifminIndex).toString())
    let price15MinData = Price15MinData.load(fifminPriceID)
    if (price15MinData === null) {

        price15MinData = new Price15MinData(fifminPriceID)
        price15MinData.oracle = oracle
        price15MinData.open = price
        price15MinData.close = price
        price15MinData.high = price
        price15MinData.low = price
        price15MinData.timestamp = fifminStartUnix
    } else {
        price15MinData.close = price
        if (price15MinData.high < price) {
            price15MinData.high = price
        } else if(price15MinData.low > price) {
            price15MinData.low = price
        }
    }
    price15MinData.save()

    // hour
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(hourIndex).toString())
    let priceHourData = PriceHourData.load(hourPriceID)
    if (priceHourData === null) {
        priceHourData = new PriceHourData(hourPriceID)
        priceHourData.oracle = oracle
        priceHourData.open = price
        priceHourData.close = price
        priceHourData.high = price
        priceHourData.low = price
        priceHourData.timestamp = hourStartUnix
    } else {
        priceHourData.close = price
        if (priceHourData.high < price) {
            priceHourData.high = price
        } else if(priceHourData.low > price) {
            priceHourData.low = price
        }
    }
    priceHourData.save()

    // day
    let dayIndex = timestamp / (3600*24)
    let dayStartUnix = dayIndex * (3600*24)
    let dayPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(dayIndex).toString())
    let priceDayData = PriceDayData.load(dayPriceID)
    if (priceDayData === null) {
        priceDayData = new PriceDayData(dayPriceID)
        priceDayData.oracle = oracle
        priceDayData.open = price
        priceDayData.close = price
        priceDayData.high = price
        priceDayData.low = price
        priceDayData.timestamp = dayStartUnix
    } else {
        priceDayData.close = price
        if (priceDayData.high < price) {
            priceDayData.high = price
        } else if(priceDayData.low > price) {
            priceDayData.low = price
        }
    }
    priceDayData.save()

    // seven day
    let sevenDayIndex = timestamp / (3600*24*7)
    let sevenDayStartUnix = sevenDayIndex * (3600*24*7)
    let sevenDayPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(sevenDayIndex).toString())
    let priceSevenDayData = PriceSevenDayData.load(sevenDayPriceID)
    if (priceSevenDayData === null) {
        priceSevenDayData = new PriceSevenDayData(sevenDayPriceID)
        priceSevenDayData.oracle = oracle
        priceSevenDayData.open = price
        priceSevenDayData.close = price
        priceSevenDayData.high = price
        priceSevenDayData.low = price
        priceSevenDayData.timestamp = sevenDayStartUnix
    } else {
        priceSevenDayData.close = price
        if (priceSevenDayData.high < price) {
            priceSevenDayData.high = price
        } else if(priceSevenDayData.low > price) {
            priceSevenDayData.low = price
        }
    }
    priceSevenDayData.save()
}