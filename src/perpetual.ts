import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"
import {
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    Trade as TradeEvent,
    UpdatePositionAccount as UpdatePositionAccountEvent,
    UpdateState as UpdateStateEvent
} from '../generated/mai-v3-graph/Perpetual'

import {
    Mint as MintEvent,
    Burn as BurnEvent
} from '../generated/templates/shareToken/ERC20'

import {
    fetchPerpetual,
    fetchUser,
    ZERO_BD,
    BI_18,
    ADDRESS_ZERO,
    convertToDecimal
} from './utils'

import { User, Token, Perpetual, Transaction, DepositCollateral, LiquidityPosition, Trade, Position, ClosedPosition, PerpHourData} from '../generated/schema'

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
    trade.side = event.params.side
    trade.price = convertToDecimal(event.params.price, BI_18)
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
}

