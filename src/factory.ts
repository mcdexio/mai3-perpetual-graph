import { TypedMap, BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, Perpetual, TimeBucket, OraclePrice, PriceMinData, Price15MinData, PriceHourData, PriceDayData, PriceSevenDayData, ShareToken, Governor, CollateralBalance } from '../generated/schema'

import { CreateLiquidityPool, CreateLiquidityPool1, SetVaultFeeRate, Factory as FactoryContract } from '../generated/Factory/Factory'
import { Oracle as OracleContract } from '../generated/Factory/Oracle'
import { Reader as ReaderContract } from '../generated/Factory/Reader'
import { ReaderV004 as ReaderV004Contract } from '../generated/Factory/ReaderV004'
import { ERC20 as ERC20Contract } from '../generated/Factory/ERC20'


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
    convertToDecimal,
    fetchCollateralSymbol,
    ZERO_BI,
    FACTORY,
    getTokenPrice,
    isCollateralAdded,
    OPERATOR_EXP,
    updateTokenPrice,
} from './utils'

import {
    READER_V4_ADDRESS,
    READER_V5_ADDRESS,
    READER_ADDRESS,
    READER_V4_BLOCK,
    READER_V5_BLOCK,
    HANDLER_BLOCK,
    DAO_VAULT_ADDRESS
} from './const'

import { updateMcdexTVLData } from './factoryData'

export function handleSetVaultFeeRate(event: SetVaultFeeRate): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        factory = new Factory(FACTORY)
        factory.liquidityPoolCount = ZERO_BI
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalValueLockedUSD = ZERO_BD
        factory.totalVaultFeeUSD = ZERO_BD
        factory.txCount = ZERO_BI
        factory.latestBlock = ZERO_BI
        factory.liquidityPools = []
        factory.perpetuals = []

        // create bucket for save timestamp
        let bucket = new TimeBucket('1')
        bucket.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
        bucket.minTimestamp = event.block.timestamp.toI32()  / 60 * 60
        bucket.save()
    }
    factory.vaultFeeRate = convertToDecimal(event.params.newFeeRate, BI_18)
    factory.save()
}

export function handleCreateLiquidityPool(event: CreateLiquidityPool): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        factory = new Factory(FACTORY)
        factory.liquidityPoolCount = ZERO_BI
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalValueLockedUSD = ZERO_BD
        factory.totalVaultFeeUSD = ZERO_BD
        factory.vaultFeeRate = ZERO_BD
        let contract = FactoryContract.bind(event.address)
        let result = contract.try_getVaultFeeRate()
        if (!result.reverted) {
            factory.vaultFeeRate = convertToDecimal(result.value, BI_18)
        }
        factory.txCount = ZERO_BI
        factory.latestBlock = ZERO_BI
        factory.liquidityPools = []
        factory.perpetuals = []
        factory.collaterals = []

        // create bucket for save timestamp
        let bucket = new TimeBucket('1')
        bucket.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
        bucket.minTimestamp = event.block.timestamp.toI32()  / 60 * 60
        bucket.save()
    }
    factory.liquidityPoolCount = factory.liquidityPoolCount.plus(ONE_BI)
    let liquidityPools = factory.liquidityPools
    liquidityPools.push(event.params.liquidityPool.toHexString())
    factory.liquidityPools = liquidityPools
    let collateral = event.params.collateral.toHexString()
    let collaterals = factory.collaterals
    if (!isCollateralAdded(collaterals as string[], collateral)) {
        collaterals.push(collateral)
        factory.collaterals = collaterals
    }
    factory.save()

    let liquidityPool = new LiquidityPool(event.params.liquidityPool.toHexString())
    liquidityPool.voteAddress = event.params.governor.toHexString()
    liquidityPool.shareAddress = event.params.shareToken.toHexString()
    liquidityPool.operatorAddress = event.params.operator.toHexString()
    liquidityPool.operatorExpiration = event.block.timestamp + OPERATOR_EXP
    liquidityPool.factory = factory.id
    liquidityPool.collateralAddress = collateral
    liquidityPool.collateralName = fetchCollateralSymbol(event.params.collateral)
    liquidityPool.collateralDecimals = event.params.collateralDecimals
    liquidityPool.poolMargin = ZERO_BD
    liquidityPool.poolMarginUSD = ZERO_BD
    liquidityPool.lpExcessInsuranceFund = ZERO_BD
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

// for old created pools, will be deleted 
export function handleCreateLiquidityPool1(event: CreateLiquidityPool1): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        factory = new Factory(FACTORY)
        factory.liquidityPoolCount = ZERO_BI
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalValueLockedUSD = ZERO_BD
        factory.totalVaultFeeUSD = ZERO_BD
        factory.vaultFeeRate = ZERO_BD
        let contract = FactoryContract.bind(event.address)
        let result = contract.try_getVaultFeeRate()
        if (!result.reverted) {
            factory.vaultFeeRate = convertToDecimal(result.value, BI_18)
        }
        factory.txCount = ZERO_BI
        factory.latestBlock = ZERO_BI
        factory.liquidityPools = []
        factory.perpetuals = []
        factory.collaterals = []

        // create bucket for save timestamp
        let bucket = new TimeBucket('1')
        bucket.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
        bucket.minTimestamp = event.block.timestamp.toI32()  / 60 * 60
        bucket.save()
    }
    factory.liquidityPoolCount = factory.liquidityPoolCount.plus(ONE_BI)
    let liquidityPools = factory.liquidityPools
    liquidityPools.push(event.params.liquidityPool.toHexString())
    factory.liquidityPools = liquidityPools
    let collateral = event.params.collateral.toHexString()
    let collaterals = factory.collaterals
    if (!isCollateralAdded(collaterals as string[], collateral)) {
        collaterals.push(collateral)
        factory.collaterals = collaterals
    }
    factory.save()

    let liquidityPool = new LiquidityPool(event.params.liquidityPool.toHexString())
    liquidityPool.voteAddress = event.params.governor.toHexString()
    liquidityPool.shareAddress = event.params.shareToken.toHexString()
    liquidityPool.operatorAddress = event.params.operator.toHexString()
    liquidityPool.operatorExpiration = event.block.timestamp + OPERATOR_EXP
    liquidityPool.factory = factory.id
    liquidityPool.collateralAddress = collateral
    liquidityPool.collateralName = fetchCollateralSymbol(event.params.collateral)
    liquidityPool.collateralDecimals = event.params.collateralDecimals
    liquidityPool.poolMargin = ZERO_BD
    liquidityPool.poolMarginUSD = ZERO_BD
    liquidityPool.lpExcessInsuranceFund = ZERO_BD
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
    // update per hour for efficiency
    let timestamp = block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    let bucket = TimeBucket.load('1')
    if (bucket == null) {
        return 
    }
    let isFirstOfHourlyBucket = false
    if (bucket.timestamp != hourStartUnix) {
        // update token price
        updateTokenPrice(timestamp)
        bucket.timestamp = hourStartUnix
        isFirstOfHourlyBucket = true
    } else {
        if (block.number < BigInt.fromI32(HANDLER_BLOCK)) {
            return
        }
        let minStartUnix = (timestamp / 60) * 60
        if (bucket.minTimestamp == minStartUnix) {
            return
        }

        bucket.minTimestamp = minStartUnix
    }
    bucket.save()

    let factory = Factory.load(FACTORY)
    if (factory === null) {
        return
    }
    factory.latestBlock = block.number

    /*=============================== hour datas begin ==================================*/ 
    if (isFirstOfHourlyBucket) {
        // update liquity pool's liquidity amount in USD
        let liquidityPools = factory.liquidityPools as string[]
        let totalValueLockedUSD = ZERO_BD
        let collateralMap = new TypedMap<String, boolean>()
        let reader_address = READER_ADDRESS
        if (block.number < BigInt.fromI32(READER_V4_BLOCK)) {
            reader_address = READER_V4_ADDRESS
        } else if  (block.number < BigInt.fromI32(READER_V5_BLOCK)) {
            reader_address = READER_V5_ADDRESS
        }
        for (let index = 0; index < liquidityPools.length; index++) {
            let poolIndex = liquidityPools[index]
            let liquidityPool = LiquidityPool.load(poolIndex)
            // update poolMargin
            let poolMargin = ZERO_BD
            
            if (block.number < BigInt.fromI32(READER_V4_BLOCK)) {
                let contract = ReaderV004Contract.bind(Address.fromString(reader_address))
                let callResult = contract.try_getPoolMargin(Address.fromString(poolIndex))
                if (!callResult.reverted) {
                    poolMargin = convertToDecimal(callResult.value.value1, BI_18)
                }
            } else {
                let contract = ReaderContract.bind(Address.fromString(reader_address))
                let callResult = contract.try_getPoolMargin(Address.fromString(poolIndex))
                if (!callResult.reverted) {
                    poolMargin = convertToDecimal(callResult.value.value1, BI_18)
                }
            }

            updatePoolHourData(liquidityPool as LiquidityPool, block.timestamp, poolMargin)
            updatePoolDayData(liquidityPool as LiquidityPool, block.timestamp, poolMargin)

            // TODO consider using token transfer event to get collateral balance
            // update mcdex totalValueLocked
            let erc20Contract = ERC20Contract.bind(Address.fromString(liquidityPool.collateralAddress))
            let erc20Result = erc20Contract.try_balanceOf(Address.fromString(poolIndex))
            let balance = ZERO_BD
            if (!erc20Result.reverted) {
                balance = convertToDecimal(erc20Result.value, liquidityPool.collateralDecimals)
            }

            let tokenPrice = getTokenPrice(liquidityPool.collateralAddress)
            totalValueLockedUSD += balance.times(tokenPrice)

            // mcdex dao asset
            if (!collateralMap.isSet(liquidityPool.collateralAddress)) {
                collateralMap.set(liquidityPool.collateralAddress, true)
                let vaultResult = erc20Contract.try_balanceOf(Address.fromString(DAO_VAULT_ADDRESS))
                let vaultBalance = ZERO_BD
                if (!vaultResult.reverted) {
                    vaultBalance = convertToDecimal(vaultResult.value, liquidityPool.collateralDecimals)
                }
                updateDaoBalance(liquidityPool.collateralName, liquidityPool.collateralAddress, vaultBalance)
            }
        }

        updateMcdexTVLData(totalValueLockedUSD, block.timestamp)
        factory.totalValueLockedUSD = totalValueLockedUSD
    }
    /*=============================== hour datas end ==================================*/ 
    factory.save()

    /*=============================== price minute datas  ==================================*/ 
    // update perpetual's oracle price data
    let perpetuals = factory.perpetuals as string[]
    let oracleMap = new TypedMap<String, boolean>()
    for (let index = 0; index < perpetuals.length; index++) {
        let perpIndex = perpetuals[index]
        let perp = Perpetual.load(perpIndex)
        if (perp.state != PerpetualState.NORMAL) {
            continue
        }
        // perp price
        if (!oracleMap.isSet(perp.oracleAddress)) {
            oracleMap.set(perp.oracleAddress, true)
            updatePriceData(perp.oracleAddress, timestamp)
        }
    }
    /*=============================== price minute datas end ==================================*/ 
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

    // save oracle index price
    let oraclePrice = OraclePrice.load(oracle)
    if (oraclePrice === null) {
        oraclePrice = new OraclePrice(oracle)
    }
    oraclePrice.price = price
    oraclePrice.save()

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

function updateDaoBalance(name: string, token: string, balance: BigDecimal): void {
    let id = token.concat('-').concat(DAO_VAULT_ADDRESS)
    let collateralBalance = CollateralBalance.load(id)
    if (collateralBalance == null) {
        collateralBalance = new CollateralBalance(id)
        collateralBalance.collateralName = name
        collateralBalance.collateralAddress = token
        collateralBalance.account = DAO_VAULT_ADDRESS
    }
    collateralBalance.balance = balance
    collateralBalance.save()
}