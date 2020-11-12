import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, Perpetual, PriceBucket, PriceHourData, ShareToken, PerpetualVote, LiquidityHourData, McdexLiquidityHourData} from '../generated/schema'

import { CreatePerpetual } from '../generated/Factory/Factory'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'


import { 
    Perpetual as PerpetualTemplate,
    ShareToken as shareTokenTemplate,
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
    ZERO_BI
} from './utils'

export function handleNewPerpetual(event: CreatePerpetual): void {
    let factory = Factory.load(event.address.toHexString())
    if (factory === null) {
        factory = new Factory(event.address.toHexString())
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalLiquidityUSD = ZERO_BD
        factory.txCount = ZERO_BI

        // create price bucket for save eth price
        let bucket = new PriceBucket('1')
        bucket.ethPrice = ZERO_BD
        bucket.save()
    }
    factory.perpetualCount = factory.perpetualCount.plus(ONE_BI)
    factory.save()

    let perp = new Perpetual(event.params.perpetual.toHexString())
    perp.collateralAddress = event.params.collateral.toHexString()
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.voteAddress = event.params.vote.toHexString()
    perp.shareAddress = event.params.shareToken.toHexString()
    perp.operatorAddress = event.params.operator.toHexString()
    perp.factory = factory.id

    //TODO 
    perp.symbol = ""
    perp.collateralName = ""
    perp.spread = ZERO_BD
    perp.feeRate = ZERO_BD
    perp.maintanceMargin = ZERO_BD
    perp.initMargin = ZERO_BD
    perp.minMaintanceMargin = ZERO_BD

    perp.state = 0
    perp.createdAtTimestamp = ZERO_BI
    perp.createdAtBlockNumber = ZERO_BI

    // create share token
    let shareToken = new ShareToken(event.params.shareToken.toHexString())
    shareToken.perpetual = perp.id
    shareToken.totalSupply = ZERO_BD
    perp.shareToken = shareToken.id

    // create share token
    let perpetualVote = new PerpetualVote(event.params.shareToken.toHexString())
    perpetualVote.perpetual = perp.id
    perp.perpetualVote = perpetualVote.id 

    shareToken.save()
    perpetualVote.save()
    perp.save()

    // create the tracked contract based on the template
    PerpetualTemplate.create(event.params.perpetual)
    shareTokenTemplate.create(event.params.shareToken)
    VoteTemplate.create(event.params.vote)
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

    let callResult = ethContract.try_price()
    if(callResult.reverted){
        log.warning("Get try_price reverted at block: {}", [block.number.toString()])
    } else {
        price = convertToDecimal(callResult.value, BI_18)
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
        mcdexLiquidityHourData.liquidityAmount = factory.totalLiquidity
        mcdexLiquidityHourData.liquidityAmountUSD = factory.totalLiquidityUSD
        mcdexLiquidityHourData.totalVolume = factory.totalVolume
        mcdexLiquidityHourData.totalVolumeUSD = factory.totalVolumeUSD
        mcdexLiquidityHourData.timestamp = hourStartUnix
        mcdexLiquidityHourData.save()
    }

    let perpetuals = factory.perpetuals
    for (let index = 0; index < perpetuals.length; index++) {
        const perpAddress = perpetuals[index]
        let perp = Perpetual.load(perpAddress)
        if (perp.state != 0) {
            return
        }
        if (isETHCollateral(perp.collateralAddress)) {
            perp.totalVolumeUSD = perp.totalVolume.times(bucket.ethPrice)
            perp.totalLiquidityUSD = perp.totalLiquidity.times(bucket.ethPrice)
        }
        perp.save()

        // perp price
        let hourPerpID = perpAddress
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
        let priceHourData = PriceHourData.load(hourPerpID)
        if (priceHourData === null) {
            priceHourData = new PriceHourData(hourPerpID)
            let oracleContract = OracleContract.bind(perp.oracleAddress)
            let price = ZERO_BD
            let callResult = oracleContract.try_price()
            if(callResult.reverted){
                log.warning("Get try_price reverted at block: {}", [block.number.toString()])
            } else {
                price = convertToDecimal(callResult.value, BI_18)
            }
            priceHourData.price = price
            priceHourData.timestamp = hourStartUnix
            priceHourData.save()
        }

        // liquidity data
        let liquidityHourData = LiquidityHourData.load(hourPerpID)
        if (liquidityHourData === null) {
            liquidityHourData = new LiquidityHourData(hourPerpID)
            liquidityHourData.liquidityAmount = perp.totalLiquidity
            liquidityHourData.liquidityAmountUSD = perp.totalLiquidityUSD
            liquidityHourData.timestamp = hourStartUnix
            liquidityHourData.save()
        }
    }
}