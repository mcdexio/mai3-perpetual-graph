
import { LiquidityPool } from '../generated/schema'

import { 
    AllocateSymbol as AllocateSymbolEvent,
} from '../generated/SymbolService/SymbolService'

import {
    fetchPerpetual,
    isBlackPool,
} from './utils'

export function handleAllocateSymbol(event: AllocateSymbolEvent): void {
    if (isBlackPool(event.params.liquidityPool.toHexString())) {
        return
    }
    let liquidityPool = LiquidityPool.load(event.params.liquidityPool.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    let symbol = event.params.symbol.toString()
    let symbolLen = symbol.length
    if (symbolLen < 5) {
        for (let index = 0; index < 5-symbolLen; index++) {
            symbol = "0".concat(symbol)
        }
    }
    if (perp.oldSymbol == '') {
        perp.oldSymbol = perp.symbol
    } else {
        perp.oldSymbol = perp.oldSymbol.concat('-').concat(perp.symbol)
    }
    perp.symbol = symbol
    perp.save()
}
