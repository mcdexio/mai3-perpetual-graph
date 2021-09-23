import {
    Transfer as TransferEvent,
} from '../generated/Factory/ERC20'

import {Factory, LiquidityPool, Collateral} from '../generated/schema'
import { updateMcdexTVLData } from './factoryData'


import {
    convertToDecimal,
    FACTORY,
    isLiquidityPool,
    isUSDToken,
} from './utils'

export function handleTransfer(event: TransferEvent): void {
    let collateralEntity = Collateral.load(event.address.toHexString())
    let from = event.params.from.toHexString()
    let to = event.params.toHexString()
    let value = convertToDecimal(event.params.value, collateralEntity.decimals)
    let liquidityPools = collateralEntity.liquidityPools
    if (isLiquidityPool(liquidityPools as string[], from)) {
        collateralEntity.totalBalance -= value
        let pool = LiquidityPool.load(from)
        pool.collateralAmount -= value
        pool.save()
        collateralEntity.save()
        if (isUSDToken(event.address.toHexString())) {
            let factory = Factory.load(FACTORY)
            factory.totalValueLockedUSD -= value
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }

        // TODO other token which is not usd
    }

    if (isLiquidityPool(liquidityPools as string[], to)) {
        collateralEntity.totalBalance += value
        let pool = LiquidityPool.load(to)
        pool.collateralAmount += value
        pool.save()
        collateralEntity.save()

        if (isUSDToken(event.address.toHexString())) {
            let factory = Factory.load(FACTORY)
            factory.totalValueLockedUSD += value
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }
        // TODO other token which is not usd
    }
}
