import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, PriceBucket, PriceHourData, PriceDayData, PriceSevenDayData, ShareToken, VoteToken, VoteContract, McdexLiquidityHourData} from '../generated/schema'

import { CreateLiquidityPool } from '../generated/Factory/Factory'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'
import { updatePoolHourData, updatePoolDayData } from './dataUpdate'


import { 
    LiquidityPool as LiquidityPoolTemplate,
    ShareToken as ShareTokenTemplate,
    VoteToken as VoteTokenTemplate,
    Vote as VoteTemplate
} from '../generated/templates'

import {
    ZERO_BD,
    ONE_BI,
    ETH_ORACLE,
    BI_18,
    PerpetualState,
    FACTORY_ADDRESS,
    isETHCollateral,
    convertToDecimal,
    fetchCollateralSymbol,
    ZERO_BI,
    isUSDCollateral
} from './utils'

export function handleCreateLiquidityPool(event: CreateLiquidityPool): void {
    let factory = Factory.load(event.address.toHexString())
    if (factory === null) {
        factory = new Factory(event.address.toHexString())
        factory.liquidityPoolCount = ZERO_BI
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalLiquidityUSD = ZERO_BD
        factory.txCount = ZERO_BI
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
    liquidityPool.poolMargin = ZERO_BD
    liquidityPool.poolMarginUSD = ZERO_BD
    liquidityPool.liquidityProviderCount = ZERO_BI
    liquidityPool.createdAtTimestamp = event.block.timestamp
    liquidityPool.createdAtBlockNumber = event.block.number
    liquidityPool.isRun = false
    liquidityPool.voteCount = ZERO_BI
    liquidityPool.liquidityHisCount = ZERO_BI

    // create share token
    let shareToken = new ShareToken(event.params.shareToken.toHexString())
    shareToken.liquidityPool = liquidityPool.id
    shareToken.totalSupply = ZERO_BD
    liquidityPool.shareToken = shareToken.id

    // create vote token
    let voteToken = new VoteToken(event.params.shareToken.toHexString())
    voteToken.liquidityPool = liquidityPool.id
    voteToken.totalSupply = ZERO_BD
    liquidityPool.voteToken = voteToken.id

    // create vote
    let vote = new VoteContract(event.params.governor.toHexString())
    vote.liquidityPool = liquidityPool.id
    liquidityPool.vote = vote.id 

    shareToken.save()
    voteToken.save()
    vote.save()
    liquidityPool.save()

    // create the tracked contract based on the template
    LiquidityPoolTemplate.create(event.params.liquidityPool)
    ShareTokenTemplate.create(event.params.shareToken)
    VoteTokenTemplate.create(event.params.shareToken)
    VoteTemplate.create(event.params.governor)
}

export function handleSyncPerpData(block: ethereum.Block): void {
    // update per hour for efficiency
    let timestamp = block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let bucket = PriceBucket.load('1')
    if (bucket === null || bucket.timestamp == hourStartUnix) {
        return
    }

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
    bucket.ethPrice = price
    bucket.timestamp = hourStartUnix
    bucket.save()

    let factory = Factory.load(FACTORY_ADDRESS)
    if (factory === null) {
        return
    }

    // update liquity pool's liquidity amount in USD
    let liquidityPools = factory.liquidityPools as string[]
    for (let index = 0; index < liquidityPools.length; index++) {
        let poolIndex = liquidityPools[index]
        let liquidityPool = LiquidityPool.load(poolIndex)
        // update poolMargin
        let poolMargin = ZERO_BD
        updatePoolHourData(liquidityPool as LiquidityPool, timestamp, poolMargin, false)
        updatePoolDayData(liquidityPool as LiquidityPool, timestamp, poolMargin, false)
    }

    // update perpetual's trade volume amount in USD and oracle price data
    let perpetuals = factory.perpetuals as string[]
    for (let index = 0; index < perpetuals.length; index++) {
        let perpIndex = perpetuals[index]
        let perp = Perpetual.load(perpIndex)
        if (perp.state != PerpetualState.NORMAL) {
            return
        }
        if (isUSDCollateral(perp.collateralAddress)) {
            perp.totalVolumeUSD = perp.totalVolume
        } else if (isETHCollateral(perp.collateralAddress)) {
            let ethPrice = ZERO_BD
            if (bucket.ethPrice != null) {
                ethPrice = bucket.ethPrice as BigDecimal
            }
            perp.totalVolumeUSD = perp.totalVolume.times(ethPrice)
        }
        perp.save()

        // perp price
        updatePriceData(perp.oracleAddress, timestamp)
    }

    let id = FACTORY_ADDRESS.concat('-').concat(BigInt.fromI32(hourIndex).toString())
    let mcdexLiquidityHourData = McdexLiquidityHourData.load(id)
    if (mcdexLiquidityHourData === null) {
        mcdexLiquidityHourData = new McdexLiquidityHourData(id)
        mcdexLiquidityHourData.poolMarginUSD = factory.totalLiquidityUSD
        mcdexLiquidityHourData.totalVolumeUSD = factory.totalVolumeUSD
        mcdexLiquidityHourData.timestamp = hourStartUnix
        mcdexLiquidityHourData.save()
    }
}

function updatePriceData(oracle: String, timestamp: i32): void {
    let price = ZERO_BD

    // hour
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let hourPriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(hourIndex).toString())
    let priceHourData = PriceHourData.load(hourPriceID)
    if (priceHourData === null) {
        let contract = OracleContract.bind(Address.fromString(oracle))
        let callResult = contract.try_priceTWAPShort()
        if (!callResult.reverted) {
            price = convertToDecimal(callResult.value.value0, BI_18)
        }
        priceHourData = new PriceHourData(hourPriceID)
        priceHourData.oracle = oracle
        priceHourData.price = price
        priceHourData.timestamp = hourStartUnix
        priceHourData.save()
    }

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
        priceDayData.price = price
        priceDayData.timestamp = dayStartUnix
        priceDayData.save()
    }

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
        priceSevenDayData.price = price
        priceSevenDayData.timestamp = sevenDayStartUnix
        priceSevenDayData.save()
    }
}