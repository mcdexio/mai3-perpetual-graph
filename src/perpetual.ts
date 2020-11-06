import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"
import {
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    Trade as TradeEvent,
    UpdatePositionAccount as UpdatePositionAccountEvent
} from '../generated/mai-v3-graph/Perpetual'

import { updateTradeDayData, updateTradeSevenDayData, updateTradeHourData } from './dataUpdate'

import {
    fetchPerpetual,
    fetchUser,
    ZERO_BD,
    BI_18,
    ADDRESS_ZERO,
    convertToDecimal
} from './utils'

import { User, Token, Perpetual, DepositCollateral, LiquidityPosition, Trade, Position, ClosedPosition} from '../generated/schema'

export function handleDeposit(event: DepositEvent): void {
    let perp = fetchPerpetual(event.address)
    let user = fetchUser(event.params.trader)
    let id = perp.collateral
            .concat("-")
            .concat(event.params.trader.toHexString())
    let depositCollateral = DepositCollateral.load(id)
    if (depositCollateral === null) {
        depositCollateral = new DepositCollateral(id)
        depositCollateral.collateral = perp.collateral
        depositCollateral.user = user.id
        depositCollateral.collateralTokenbalance = convertToDecimal(event.params.balance, BI_18)
    }
}

export function handleWithdraw(event: WithdrawEvent): void {
    let perp = fetchPerpetual(event.address)
    let user = fetchUser(event.params.trader)
    let id = perp.collateral
            .concat("-")
            .concat(event.params.trader.toHexString())
    let depositCollateral = DepositCollateral.load(id)
    if (depositCollateral === null) {
        depositCollateral = new DepositCollateral(id)
        depositCollateral.collateral = perp.collateral
        depositCollateral.user = user.id
        depositCollateral.collateralTokenbalance = convertToDecimal(event.params.balance, BI_18)
    }
}

export function handleTrade(event: TradeEvent): void {
    let perp = fetchPerpetual(event.address)
    let user = fetchUser(event.params.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let trade = new Trade(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    trade.perpetual = perp.id
    trade.trader = user.id
    trade.amount = convertToDecimal(event.params.amount, BI_18)
    if (event.params.side == 1) {
        trade.amount = -trade.amount
    }
    trade.price = convertToDecimal(event.params.price, BI_18)
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.logIndex = event.logIndex
    perp.lastPrice = trade.price
    perp.save()
    trade.save()

    // update trade data
    updateTradeHourData(perp, event)
    updateTradeDayData(perp, event)
    updateTradeSevenDayData(perp, event)
}

export function handleUpdatePositionAccount(event: UpdatePositionAccountEvent): void {
    let perp = fetchPerpetual(event.address)
    let user = fetchUser(event.params.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let id = event.address.toHexString()
        .concat('-')
        .concat(event.params.trader.toHexString())
    let position = Position.load(id)
    if (position === null) {
        position = new Position(id)
        position.user = user.id
        position.perpetual = perp.id
    } else {
        let size = convertToDecimal(event.params.account.size, BI_18)
        if (position.side != event.params.account.side || size < position.amount)  {
            let closedPosition = new ClosedPosition(
                transactionHash
                .concat('-')
                .concat(event.logIndex.toString())
            )
            closedPosition.user = user.id
            closedPosition.perpetual = perp.id
            if (position.side != event.params.account.side) {
                closedPosition.amount = position.amount
            } else {
                closedPosition.amount = position.amount.minus(size)
            }
            closedPosition.entryPrice = position.entryPrice
            closedPosition.exitPrice = convertToDecimal(event.params.price, BI_18)
            closedPosition.pnl = closedPosition.amount.plus(closedPosition.exitPrice.minus(closedPosition.entryPrice))
            closedPosition.side = position.side
            closedPosition.transactionHash = transactionHash
            closedPosition.blockNumber = event.block.number
            closedPosition.timestamp = event.block.timestamp
            closedPosition.logIndex = event.logIndex
            closedPosition.save()
        }
    }

    position.amount = convertToDecimal(event.params.account.size, BI_18)
    position.entryPrice = convertToDecimal(event.params.price, BI_18)
    position.entryValue = convertToDecimal(event.params.account.entryValue, BI_18)
    position.side = event.params.account.side
    position.transactionHash = transactionHash
    position.blockNumber = event.block.number
    position.timestamp = event.block.timestamp
    position.logIndex = event.logIndex
    position.save()
}