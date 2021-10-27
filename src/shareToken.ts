import {
    Transfer as TransferEvent,
} from '../generated/templates/ShareToken/ShareToken'

import { ShareToken, LiquidityPool } from '../generated/schema'

import {
    ZERO_BD,
    ADDRESS_ZERO,
    fetchUser,
    fetchLiquidityAccount,
    BI_18,
    convertToDecimal,
} from './utils'

export function handleTransfer(event: TransferEvent): void {
    let contract = ShareToken.load(event.address.toHexString()) as ShareToken
    let liquidityPool = LiquidityPool.load(contract.liquidityPool) as LiquidityPool
    let from = fetchUser(event.params.from)
    let to = fetchUser(event.params.to)

    let value = convertToDecimal(event.params.value, BI_18)
    if (from.id == ADDRESS_ZERO) {
        contract.totalSupply = contract.totalSupply.plus(value)
    }

    if (to.id == ADDRESS_ZERO) {
        contract.totalSupply = contract.totalSupply.minus(value)
    }

    let deltaEntryCollateralAmount = ZERO_BD
    let deltaEntryPoolMargin = ZERO_BD
    if (from.id != ADDRESS_ZERO) {
        let fromAccount = fetchLiquidityAccount(from, liquidityPool)
        if (to.id != ADDRESS_ZERO) {
            deltaEntryCollateralAmount = fromAccount.entryCollateralAmount.times(value).div(fromAccount.shareAmount)
            deltaEntryPoolMargin = fromAccount.entryPoolMargin.times(value).div(fromAccount.shareAmount)
            fromAccount.entryCollateralAmount = fromAccount.entryCollateralAmount.minus(deltaEntryCollateralAmount)
            fromAccount.entryPoolMargin = fromAccount.entryPoolMargin.minus(deltaEntryPoolMargin)
        }

        fromAccount.shareAmount = fromAccount.shareAmount.minus(value)
        fromAccount.save()
    }

    if (to.id != ADDRESS_ZERO) {
        let toAccount = fetchLiquidityAccount(to, liquidityPool)
        toAccount.shareAmount = toAccount.shareAmount.plus(value)
        if (from.id != ADDRESS_ZERO) {
            toAccount.entryCollateralAmount = toAccount.entryCollateralAmount.plus(deltaEntryCollateralAmount)
            toAccount.entryPoolMargin = toAccount.entryPoolMargin.plus(deltaEntryPoolMargin)
        }
        toAccount.save()
    }

    contract.save()
}
