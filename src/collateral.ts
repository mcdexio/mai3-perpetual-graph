import {
    Transfer as TransferEvent,
} from '../generated/Factory/ERC20'

import {Factory, LiquidityPool, Collateral} from '../generated/schema'
import { CertifiedPools } from './const'
import { updateMcdexTVLData } from './factoryData'


import {
    convertToDecimal,
    FACTORY,
    getTokenPrice,
    isLiquidityPool,
    ZERO_BD,
} from './utils'

export function handleTransfer(event: TransferEvent): void {
    let token = event.address.toHexString()
    let collateralEntity = Collateral.load(token) as Collateral
    let from = event.params.from.toHexString()
    let to = event.params.to.toHexString()
    let value = convertToDecimal(event.params.value, collateralEntity.decimals)
    let liquidityPools = collateralEntity.liquidityPools
    if (isLiquidityPool(liquidityPools as string[], from)) {
        collateralEntity.totalBalance -= value
        let pool = LiquidityPool.load(from) as LiquidityPool
        pool.collateralAmount -= value
        collateralEntity.save()

        let token_price = getTokenPrice(token)
        if (token_price > ZERO_BD) {
            let factory = Factory.load(FACTORY) as Factory
            let oldCollateralUSD = pool.collateralUSD
            pool.collateralUSD = pool.collateralAmount.times(token_price)
            factory.totalValueLockedUSD -= oldCollateralUSD
            factory.totalValueLockedUSD += pool.collateralUSD
            // capture protocol revenue
            if ((to == factory.vaultAddress) || (to == pool.operatorAddress && CertifiedPools.isSet(from))) {
                factory.totalProtocolRevenueUSD += value.times(token_price)
            }
            factory.save()
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }
        pool.save()
    }

    if (isLiquidityPool(liquidityPools as string[], to)) {
        collateralEntity.totalBalance += value
        let pool = LiquidityPool.load(to) as LiquidityPool
        pool.collateralAmount += value
        collateralEntity.save()

        let token_price = getTokenPrice(token)
        if (token_price > ZERO_BD) {
            let factory = Factory.load(FACTORY) as Factory
            let oldCollateralUSD = pool.collateralUSD
            pool.collateralUSD = pool.collateralAmount.times(token_price)
            factory.totalValueLockedUSD -= oldCollateralUSD
            factory.totalValueLockedUSD += pool.collateralUSD
            factory.save()
            updateMcdexTVLData(factory.totalValueLockedUSD, event.block.timestamp)
        }
        pool.save()
    }
}
