import {
    TradeSuccess as TradeSuccessEvent,
} from '../generated/Broker/Broker'

import { MatchOrder, Perpetual } from '../generated/schema'

import {
    fetchUser,
    BI_18,
    convertToDecimal,
} from './utils'

export function handleTradeSuccess(event: TradeSuccessEvent): void {
    let perp = Perpetual.load(event.params.order.perpetual.toHexString())
    let trader = fetchUser(event.params.order.trader.toHexString())
    let transactionHash = event.transaction.hash.toHexString()
    let order = new MatchOrder(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    order.perpetual = perp.id
    order.trader = trader.id
    order.orderHash = event.params.orderHash.toHexString()
    order.amount = event.params.amount
    order.type = event.params.orderType
    order.gas = convertToDecimal(event.params.gasReward, BI_18)
    order.transactionHash = transactionHash
    order.blockNumber = event.block.number
    order.timestamp = event.block.timestamp
    order.logIndex = event.logIndex
    order.save()
}
