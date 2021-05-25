import {
    TradeSuccess as TradeSuccessEvent,
    TradeFailed as TradeFailedEvent,
} from '../generated/Broker/Broker'

import { MatchOrder, MatchOrderFailed, LiquidityPool } from '../generated/schema'

import {
    fetchUser,
    BI_18,
    convertToDecimal,
    fetchPerpetual
} from './utils'

export function handleTradeSuccess(event: TradeSuccessEvent): void {
    let liquidityPool = LiquidityPool.load(event.params.order.liquidityPool.toHexString())
    if (liquidityPool === null) {
        return
    }
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.order.perpetualIndex)
    let trader = fetchUser(event.params.order.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let order = new MatchOrder(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    order.perpetual = perp.id
    order.trader = trader.id
    order.orderHash = event.params.orderHash.toHexString()
    order.amount = convertToDecimal(event.params.amount, BI_18)
    order.type = 1
    order.gas = convertToDecimal(event.params.gasReward, BI_18)
    order.transactionHash = transactionHash
    order.blockNumber = event.block.number
    order.timestamp = event.block.timestamp
    order.logIndex = event.logIndex
    order.save()
}

export function handleTradeFailed(event: TradeFailedEvent): void {
    let liquidityPool = LiquidityPool.load(event.params.order.liquidityPool.toHexString())
    if (liquidityPool === null) {
        return
    }
    let perp = fetchPerpetual(liquidityPool as LiquidityPool, event.params.order.perpetualIndex)
    let trader = fetchUser(event.params.order.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let order = new MatchOrderFailed(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    order.perpetual = perp.id
    order.reason = event.params.reason.toHexString()
    order.trader = trader.id
    order.orderHash = event.params.orderHash.toHexString()
    order.amount = convertToDecimal(event.params.amount, BI_18)
    order.type = 1
    order.gas = convertToDecimal(event.params.gasReward, BI_18)
    order.transactionHash = transactionHash
    order.blockNumber = event.block.number
    order.timestamp = event.block.timestamp
    order.logIndex = event.logIndex
    order.save()
}
