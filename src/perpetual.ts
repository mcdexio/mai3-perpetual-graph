import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"
import {
    Deposit as DepositEvent,
    Withdraw as WithdrawEvent,
    AddLiquidatity as AddLiquidatityEvent,
    RemoveLiquidatity as RemoveLiquidatityEvent,
    TradePosition as TradePositionEvent,
} from '../generated/templates/Perpetual/Perpetual'

import { updateTradeDayData, updateTradeSevenDayData, updateTradeHourData } from './dataUpdate'

import {
    fetchUser,
    fetchLiquidityAccount,
    ZERO_BD,
    ONE_BD,
    BI_18,
    convertToDecimal,
} from './utils'

import { Perpetual, DepositCollateral, Trade, MarginAccount, ClosedPosition} from '../generated/schema'

export function handleDeposit(event: DepositEvent): void {
    let perp = Perpetual.load(event.address.toHexString)
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
    depositCollateral.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
    let perp = Perpetual.load(event.address)
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

export function handleAddLiquidatity(event: AddLiquidatityEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, perp)
    if (account.collateralAmount != ZERO_BD) {
        perp.liquidityProviderCount += ONE_BD
    }
    let amount = convertToDecimal(event.params.amount, BI_18)
    account.collateralAmount += amount
    account.shareAmount += convertToDecimal(event.params.shareToMint, BI_18)
    perp.liquidityAmount += amount
    account.save()
    perp.save()
}

export function handleRemoveLiquidatity(event: RemoveLiquidatityEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let account = fetchLiquidityAccount(user, perp)
    let shareAmount = convertToDecimal(event.params.amount, BI_18)
    let oldShareAmount = account.shareAmount
    let oldCollateral = account.collateralAmount
    account.shareAmount -= shareAmount
    account.collateralAmount = account.collateralAmount.times(account.shareAmount.div(oldShareAmount))
    if (account.collateralAmount == ZERO_BD) {
        perp.liquidityProviderCount -= ONE_BD
    }
    perp.liquidityAmount -= (oldCollateral.minus(account.collateralAmount))
    account.save()
    perp.save()
}

export function handleTradePosition(event: TradePositionEvent): void {
    let perp = Perpetual.load(event.address)
    let user = fetchUser(event.params.trader)
    let transactionHash = event.transaction.hash.toHexString()
    let trade = new Trade(
        transactionHash
        .concat('-')
        .concat(event.logIndex.toString())
    )
    trade.perpetual = perp.id
    trade.trader = user.id
    trade.amount = convertToDecimal(event.params.positionAmount, BI_18)
    if (event.params.side == 1) {
        trade.amount = -trade.amount
    }
    trade.price = convertToDecimal(event.params.priceLimit, BI_18)
    trade.isClose = false
    trade.transactionHash = transactionHash
    trade.blockNumber = event.block.number
    trade.timestamp = event.block.timestamp
    trade.logIndex = event.logIndex
    perp.lastPrice = trade.price
    perp.save()
    trade.save()

    // user position
    // let id = event.address.toHexString()
    //     .concat('-')
    //     .concat(event.params.trader.toHexString())
    // let margin = MarginAccount.load(id)
    // if (margin === null) {
    //     margin = new MarginAccount(id)
    //     margin.user = user.id
    //     margin.perpetual = perp.id
    // } else {
    //     let size = convertToDecimal(event.params.positionAmount, BI_18)
    //     if (margin.position > ZERO_BD && size < ZERO_BD) != event.params.account.side || size < position.amount)  {
    //         let closedPosition = new ClosedPosition(
    //             transactionHash
    //             .concat('-')
    //             .concat(event.logIndex.toString())
    //         )
    //         closedPosition.user = user.id
    //         closedPosition.perpetual = perp.id
    //         if (position.side != event.params.account.side) {
    //             closedPosition.amount = position.amount
    //         } else {
    //             closedPosition.amount = position.amount.minus(size)
    //         }
    //         closedPosition.entryPrice = position.entryPrice
    //         closedPosition.exitPrice = convertToDecimal(event.params.price, BI_18)
    //         closedPosition.pnl = closedPosition.amount.plus(closedPosition.exitPrice.minus(closedPosition.entryPrice))
    //         closedPosition.side = position.side
    //         closedPosition.transactionHash = transactionHash
    //         closedPosition.blockNumber = event.block.number
    //         closedPosition.timestamp = event.block.timestamp
    //         closedPosition.logIndex = event.logIndex
    //         closedPosition.save()
    //     }
    // }

    // margin.amount = convertToDecimal(event.params.positionAmount, BI_18)
    // margin.entryPrice = convertToDecimal(event.params.price, BI_18)
    // margin.entryValue = convertToDecimal(event.params.account.entryValue, BI_18)
    // margin.side = event.params.account.side
    // margin.transactionHash = transactionHash
    // margin.blockNumber = event.block.number
    // margin.timestamp = event.block.timestamp
    // margin.logIndex = event.logIndex
    // margin.save()

    // update trade data
    updateTradeHourData(perp, event)
    updateTradeDayData(perp, event)
    updateTradeSevenDayData(perp, event)
}