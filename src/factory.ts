import { BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, Perpetual, PriceBucket, PriceHourData, ShareToken, VoteContract, LiquidityHourData, McdexLiquidityHourData} from '../generated/schema'

import { CreatePerpetual } from '../generated/Factory/Factory'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'


import { 
    Perpetual as PerpetualTemplate,
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
    ZERO_BI
} from './utils'

export function handleNewPerpetual(event: CreatePerpetual): void {
    let factory = Factory.load(event.address.toHexString())
    if (factory === null) {
        factory = new Factory(event.address.toHexString())
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalVolume = ZERO_BD
        factory.totalLiquidity =ZERO_BD
        factory.totalLiquidityUSD = ZERO_BD
        factory.txCount = ZERO_BI
        factory.perpetuals = []

        // create price bucket for save eth price
        let bucket = new PriceBucket('1')
        bucket.ethPrice = ZERO_BD
        bucket.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
        bucket.save()
    }
    factory.perpetualCount = factory.perpetualCount.plus(ONE_BI)
    factory.perpetuals.push(event.params.perpetual.toHexString())
    factory.save()

    let perp = new Perpetual(event.params.perpetual.toHexString())
    perp.oracleAddress = event.params.oracle.toHexString()
    perp.voteAddress = event.params.governor.toHexString()
    perp.shareAddress = event.params.shareToken.toHexString()
    perp.operatorAddress = event.params.operator.toHexString()
    perp.factory = factory.id

    //TODO
    perp.collateralAddress = event.params.shareToken.toHexString()

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

    perp.state = 0
    perp.createdAtTimestamp = ZERO_BI
    perp.createdAtBlockNumber = ZERO_BI

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
        mcdexLiquidityHourData.liquidityAmount = factory.totalLiquidity
        mcdexLiquidityHourData.liquidityAmountUSD = factory.totalLiquidityUSD
        mcdexLiquidityHourData.totalVolume = factory.totalVolume
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
        let hourPerpID = perpAddress
        .concat('-')
        .concat(BigInt.fromI32(hourIndex).toString())
        let priceHourData = PriceHourData.load(hourPerpID)
        if (priceHourData === null) {
            priceHourData = new PriceHourData(hourPerpID)
            let oracleContract = OracleContract.bind(Address.fromString(perp.oracleAddress))
            let price = ZERO_BD
            let callResult = oracleContract.try_priceTWAPShort()
            if(callResult.reverted){
                log.warning("Get try_priceTWAPShort reverted at block: {}", [block.number.toString()])
            } else {
                price = convertToDecimal(callResult.value.value0, BI_18)
            }
            priceHourData.price = price
            priceHourData.timestamp = hourStartUnix
            priceHourData.save()
        }

        // liquidity data
        let liquidityHourData = LiquidityHourData.load(hourPerpID)
        if (liquidityHourData === null) {
            liquidityHourData = new LiquidityHourData(hourPerpID)
            liquidityHourData.liquidityAmount = perp.liquidityAmount
            liquidityHourData.liquidityAmountUSD = perp.liquidityAmountUSD
            liquidityHourData.timestamp = hourStartUnix
            liquidityHourData.save()
        }
    }
}