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
    let contract = ShareToken.load(event.address.toHexString())
    let liquidityPool = LiquidityPool.load(contract.liquidityPool)
    let from = fetchUser(event.params.from)
    let to = fetchUser(event.params.to)

    let value = convertToDecimal(event.params.value, BI_18)
    if (from.id == ADDRESS_ZERO) {
        contract.totalSupply += value
    }

    if (to.id == ADDRESS_ZERO) {
        contract.totalSupply -= value
    }

    let deltaEntryCollateralAmount = ZERO_BD
    let deltaEntryPoolMargin = ZERO_BD
    if (from.id != ADDRESS_ZERO) {
        let fromAccount = fetchLiquidityAccount(from, liquidityPool as LiquidityPool)
        if (to.id != ADDRESS_ZERO) {
            deltaEntryCollateralAmount = fromAccount.entryCollateralAmount.times(value).div(fromAccount.shareAmount)
            deltaEntryPoolMargin = fromAccount.entryPoolMargin.times(value).div(fromAccount.shareAmount)
            fromAccount.entryCollateralAmount -= deltaEntryCollateralAmount
            fromAccount.entryPoolMargin -= deltaEntryPoolMargin
        }

        fromAccount.shareAmount -= value
        fromAccount.save()
    }

    if (to.id != ADDRESS_ZERO) {
        let toAccount = fetchLiquidityAccount(to, liquidityPool as LiquidityPool)
        if (from.id != ADDRESS_ZERO) {
            toAccount.entryCollateralAmount += deltaEntryCollateralAmount
            toAccount.entryPoolMargin += deltaEntryPoolMargin
        }
        toAccount.shareAmount += value

        toAccount.save()
    }

    contract.save()
}
