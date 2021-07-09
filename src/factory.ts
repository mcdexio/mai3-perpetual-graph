import { TypedMap, BigInt, BigDecimal, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Factory, LiquidityPool, ShareToken, Governor, CollateralBalance } from '../generated/schema'

import { CreateLiquidityPool, SetVaultFeeRate, Factory as FactoryContract } from '../generated/Factory/Factory'
import { Reader as ReaderContract } from '../generated/Factory/Reader'
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
    READER_ADDRESS,
    DAO_VAULT_ADDRESS,
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
        factory.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
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
        factory.timestamp = event.block.timestamp.toI32()  / 3600 * 3600
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
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        return
    }

    // update token price and pool margin every hour
    let timestamp = block.timestamp.toI32()
    let hourIndex = timestamp / 3600
    let hourStartUnix = hourIndex * 3600
    if (factory.timestamp == hourStartUnix) {
        return
    } 
    factory.timestamp = hourStartUnix
    factory.latestBlock = block.number

    /*=============================== hour datas begin ==================================*/ 
    // update token price
    updateTokenPrice(timestamp)
    // update liquity pool's liquidity amount in USD
    let liquidityPools = factory.liquidityPools as string[]
    let totalValueLockedUSD = ZERO_BD
    let collateralMap = new TypedMap<String, boolean>()
    let reader_address = READER_ADDRESS
    for (let index = 0; index < liquidityPools.length; index++) {
        let poolIndex = liquidityPools[index]
        let liquidityPool = LiquidityPool.load(poolIndex)
        // update poolMargin
        let poolMargin = ZERO_BD
        
        let contract = ReaderContract.bind(Address.fromString(reader_address))
        let callResult = contract.try_getPoolMargin(Address.fromString(poolIndex))
        if (!callResult.reverted) {
            poolMargin = convertToDecimal(callResult.value.value1, BI_18)
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
    /*=============================== hour datas end ==================================*/ 
    factory.save()
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
