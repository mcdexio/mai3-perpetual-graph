import {ethereum, log, Address} from "@graphprotocol/graph-ts"

import {Factory, LiquidityPool, ShareToken, Governor, Collateral} from '../generated/schema'

import {CreateLiquidityPool} from '../generated/Factory/Factory'


import {
    LiquidityPool as LiquidityPoolTemplate,
    ShareToken as ShareTokenTemplate,
    Governor as GovernorTemplate,
    Collateral as CollateralTemplate
} from '../generated/templates'

import {
    ZERO_BD,
    ONE_BI,
    fetchCollateralSymbol,
    ZERO_BI,
    FACTORY,
    isCollateralAdded,
    OPERATOR_EXP,
} from './utils'

export function handleCreateLiquidityPool(event: CreateLiquidityPool): void {
    let factory = Factory.load(FACTORY)
    if (factory === null) {
        factory = new Factory(FACTORY)
        factory.liquidityPoolCount = ZERO_BI
        factory.perpetualCount = ZERO_BI
        factory.totalVolumeUSD = ZERO_BD
        factory.totalValueLockedUSD = ZERO_BD
        factory.txCount = ZERO_BI
        factory.perpetuals = []
        factory.collaterals = []
        factory.timestamp = event.block.timestamp.toI32() / 3600 * 3600
    }
    factory.liquidityPoolCount = factory.liquidityPoolCount.plus(ONE_BI)
    let collateral = event.params.collateral.toHexString()
    let collaterals = factory.collaterals as string[]
    if (!isCollateralAdded(collaterals as string[], collateral)) {
        collaterals.push(collateral)
        factory.collaterals = collaterals
    }
    factory.save()

    let collateralAddress = event.params.collateral.toHexString()
    let liquidityPool = new LiquidityPool(event.params.liquidityPool.toHexString())
    liquidityPool.voteAddress = event.params.governor.toHexString()
    liquidityPool.shareAddress = event.params.shareToken.toHexString()
    liquidityPool.operatorAddress = event.params.operator.toHexString()
    liquidityPool.operatorExpiration = event.block.timestamp + OPERATOR_EXP
    liquidityPool.factory = factory.id
    liquidityPool.collateralAddress = collateralAddress
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
    governor.preRewardRate = ZERO_BD
    governor.changeRewardBlock = ZERO_BI
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

    // use collateral transfer to get tvl
    let collateralEntity = Collateral.load(collateralAddress)
    if (collateralEntity === null) {
        collateralEntity = new Collateral(collateralAddress)
        collateralEntity.decimals = event.params.collateralDecimals
        collateralEntity.liquidityPools = []
        collateralEntity.totalBalance = ZERO_BD
        CollateralTemplate.create(event.params.collateral)
    }
    let liquidityPools = collateralEntity.liquidityPools as string[]
    liquidityPools.push(event.params.liquidityPool.toHexString())
    collateralEntity.liquidityPools = liquidityPools
    collateralEntity.save()
}
