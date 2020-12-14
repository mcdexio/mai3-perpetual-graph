import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, PriceBucket, PriceMinuteData, PriceHourData, AccHourData, PriceDayData, PriceSevenDayData, ShareToken, VoteContract, LiquidityHourData, McdexLiquidityHourData} from '../generated/schema'

import { CreateLiquidityPool } from '../generated/Factory/Factory'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'


import { 
    LiqidityPool as LiqidityPoolTemplate,
    ShareToken as ShareTokenTemplate,
    Vote as VoteTemplate
} from '../generated/templates'

import {
    ZERO_BD,
    ONE_BI,
    ETH_ORACLE,
    BI_18,
    FACTORY_ADDRESS,
    isETHCollateral,
    convertToDecimal,
    fetchCollateralSymbol,
    ZERO_BI
} from './utils'

export function handleCreateLiquidityPool(event: CreateLiquidityPool): void {
    let factory = Factory.load(event.address.toHexString())
    if (factory === null) {
        factory = new Factory(event.address.toHexString())
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalLiquidityUSD = ZERO_BD
        factory.txCount = ZERO_BI
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

    let liqidityPool = new LiquidityPool(event.params.liquidityPool.toHexString())
    liqidityPool.voteAddress = event.params.governor.toHexString()
    liqidityPool.shareAddress = event.params.shareToken.toHexString()
    liqidityPool.operatorAddress = event.params.operator.toHexString()
    liqidityPool.factory = factory.id
    liqidityPool.collateralAddress = event.params.collateral.toHexString()
    liqidityPool.collateralName = fetchCollateralSymbol(event.params.collateral)
    liqidityPool.liquidityAmount = ZERO_BD
    liqidityPool.liquidityAmountUSD = ZERO_BD
    liqidityPool.liquidityProviderCount = ZERO_BI
    liqidityPool.createdAtTimestamp = event.block.timestamp
    liqidityPool.createdAtBlockNumber = event.block.number

    // create share token
    let shareToken = new ShareToken(event.params.shareToken.toHexString())
    shareToken.liqidityPool = liqidityPool.id
    shareToken.totalSupply = ZERO_BD
    liqidityPool.shareToken = shareToken.id

    // create share token
    let perpetualVote = new VoteContract(event.params.governor.toHexString())
    perpetualVote.liqidityPool = liqidityPool.id
    liqidityPool.vote = perpetualVote.id 

    shareToken.save()
    perpetualVote.save()
    liqidityPool.save()

    // create the tracked contract based on the template
    LiqidityPoolTemplate.create(event.params.liquidityPool)
    ShareTokenTemplate.create(event.params.shareToken)
    VoteTemplate.create(event.params.governor)
}

export function handleNewPerpetual(event: CreatePerpetual): void {
    let factory = Factory.load(event.address.toHexString())
    if (factory === null) {
        factory = new Factory(event.address.toHexString())
        factory.perpetualCount = ZERO_BI
        factory.liquidityPoolCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalLiquidityUSD = ZERO_BD
        factory.txCount = ZERO_BI
        factory.perpetuals = []
        factory.liquidityPools = []

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

    let perp = new Perpetual(event.params.perpetual.toHexString())
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.voteAddress = event.params.governor.toHexString()
    perp.shareAddress = event.params.shareToken.toHexString()
    perp.operatorAddress = event.params.operator.toHexString()
    perp.factory = factory.id
    perp.collateralAddress = event.params.collateral.toHexString()

    perp.totalVolumeUSD = ZERO_BD
    perp.totalVolume = ZERO_BD
    perp.totalFee = ZERO_BD
    perp.txCount = ZERO_BI

    perp.liquidityAmount = ZERO_BD
    perp.liquidityAmountUSD = ZERO_BD
    perp.liquidityProviderCount = ZERO_BI


    perp.symbol = ""
    perp.collateralName = ""
    perp.spread = ZERO_BD
    perp.feeRate = ZERO_BD
    perp.maintanceMargin = ZERO_BD
    perp.initMargin = ZERO_BD
    perp.minMaintanceMargin = ZERO_BD
    perp.lastPrice = ZERO_BD

    perp.state = 0
    perp.createdAtTimestamp = event.block.timestamp
    perp.createdAtBlockNumber = event.block.number

    // create share token
    let shareToken = new ShareToken(event.params.shareToken.toHexString())
    shareToken.perpetual = perp.id
    shareToken.totalSupply = ZERO_BD
    perp.shareToken = shareToken.id

    // create share token
    let perpetualVote = new VoteContract(event.params.governor.toHexString())
    perpetualVote.perpetual = perp.id
    perp.vote = perpetualVote.id 

    shareToken.save()
    perpetualVote.save()
    perp.save()

    // create the tracked contract based on the template
    PerpetualTemplate.create(event.params.perpetual)
    ShareTokenTemplate.create(event.params.shareToken)
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

    let id = FACTORY_ADDRESS.concat('-').concat(BigInt.fromI32(hourIndex).toString())
    let mcdexLiquidityHourData = McdexLiquidityHourData.load(id)
    if (mcdexLiquidityHourData === null) {
        mcdexLiquidityHourData = new McdexLiquidityHourData(id)
        mcdexLiquidityHourData.liquidityAmountUSD = factory.totalLiquidityUSD
        mcdexLiquidityHourData.totalVolumeUSD = factory.totalVolumeUSD
        mcdexLiquidityHourData.timestamp = hourStartUnix
        mcdexLiquidityHourData.save()
    }

    let perpetuals = factory.perpetuals as string[]
    for (let index = 0; index < perpetuals.length; index++) {
        let perpAddress = perpetuals[index]
        let perp = Perpetual.load(perpAddress)
        if (perp.state != 0) {
            return
        }
        if (isETHCollateral(perp.collateralAddress)) {
            let ethPrice = ZERO_BD
            if (bucket.ethPrice != null) {
                ethPrice = bucket.ethPrice as BigDecimal
            }
            perp.totalVolumeUSD = perp.totalVolume.times(ethPrice)
            perp.liquidityAmountUSD = perp.liquidityAmount.times(ethPrice)
        }
        perp.save()

        // perp price
        updatePriceData(perp.oracleAddress, timestamp)

        // liquidity data
        let hourPerpID = perpAddress
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
        let liquidityHourData = LiquidityHourData.load(hourPerpID)
        if (liquidityHourData === null) {
            liquidityHourData = new LiquidityHourData(hourPerpID)
            liquidityHourData.liquidityAmount = perp.liquidityAmount
            liquidityHourData.liquidityAmountUSD = perp.liquidityAmountUSD
            liquidityHourData.timestamp = hourStartUnix
            liquidityHourData.save()
        }

        // acc data
        let accHourData = AccHourData.load(hourPerpID)
        if (accHourData === null) {
            accHourData = new AccHourData(hourPerpID)
            let acc = ZERO_BD

            let perpContract = PerpetualTemplate.bind(perpAddress)
            let callResult = perpContract.try_fundingState()
            if(callResult.reverted){
                log.warning("Get try_price reverted at block: {}", [block.number.toString()])
                return
            } else {
                acc = convertToDecimal(callResult.value.value0, BI_18)
            }
            accHourData.perpetual = perpAddress
            accHourData.acc = acc
            accHourData.timestamp = hourStartUnix
            accHourData.save()
        }
    }
}

function updatePriceData(oracle: String, timestamp: i32): void {
    let price = ZERO_BD

    // minute
    let minuteIndex = timestamp / 60
    let minuteStartUnix = minuteIndex * 60
    let minutePriceID = oracle
    .concat('-')
    .concat(BigInt.fromI32(minuteIndex).toString())
    let priceMinuteData = PriceMinuteData.load(minutePriceID)
    if (priceMinuteData === null) {
        priceMinuteData = new PriceMinuteData(minutePriceID)
        let oracleContract = OracleContract.bind(Address.fromString(oracle))
        let callResult = oracleContract.try_priceTWAPShort()
        if(callResult.reverted){
            log.warning("Get try_priceTWAPShort reverted at blocktime: {}", [timestamp.toString()])
        } else {
            price = convertToDecimal(callResult.value.value0, BI_18)
        }
        priceMinuteData.oracle = oracle
        priceMinuteData.price = price
        priceMinuteData.timestamp = minuteStartUnix
        priceMinuteData.save()
    }

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