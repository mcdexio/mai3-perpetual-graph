
import { LiquidityPool } from '../generated/schema'

import { 
    AllocateSymbol as AllocateSymbolEvent,
} from '../generated/SymbolService/SymbolService'

import {
    fetchPerpetual,
} from './utils'

export function handleAllocateSymbol(event: AllocateSymbolEvent): void {
    let liquidityPool = LiquidityPool.load(event.params.liquidityPool.toHexString())
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.perpetualIndex)
    let symbol = event.params.symbol.toString()
    let symbolLen = symbol.length
    if (symbolLen < 5) {
        for (let index = 0; index < 5-symbolLen; index++) {
            symbol = "0".concat(symbol)
        }
    }
    if (perp.symbol == "") {
        perp.symbol = symbol
    } else {
        perp.symbol = perp.symbol.concat('-').concat(symbol)
    }
    perp.save()
}