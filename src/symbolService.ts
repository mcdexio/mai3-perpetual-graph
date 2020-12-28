
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
    if (perp.symbol == "") {
        perp.symbol = event.params.symbol.toString()
    } else {
        perp.symbol = perp.symbol.concat('-').concat(event.params.symbol.toString())
    }
    perp.save()
}