
import { LiquidityPool } from '../generated/schema'

import { 
    AssignSymbol as AssignSymbolEvent,
} from '../generated/SymbolService/SymbolService'

import {
    fetchPerpetual,
} from './utils'

export function handleAssignSymbol(event: AssignSymbolEvent): void {
    let liquidityPool = LiquidityPool.load(event.params.liquidityPool.toHexString())
    let perp = fetchPerpetual(liquidityPool, event.params.perpetualIndex)
    if (perp.symbol == "") {
        perp.symbol = event.params.symbol.toString()
    } else {
        perp.symbol = perp.symbol.concat('-').concat(event.params.symbol.toString())
    }
    perp.save()
}