import {
    Transfer as TransferEvent
} from '../generated/templates/ShareToken/ERC20'

import { User, ShareToken } from '../generated/schema'

import {
    ADDRESS_ZERO,
    fetchUser,
    fetchLiquidityAccount,
    BI_18,
    convertToDecimal,
} from './utils'

export function handleTransfer(event: TransferEvent): void {
    let contract = ShareToken.load(event.address.toHexString())
    let from = fetchUser(event.params.from)
    let to = fetchUser(event.params.to)

    let value = convertToDecimal(event.params.value, BI_18)
    if (from.id == ADDRESS_ZERO) {
        contract.totalSupply += value
    }

    if (to.id == ADDRESS_ZERO) {
        contract.totalSupply -= value
    }

    if (from.id != ADDRESS_ZERO) {
        let fromAccount = fetchLiquidityAccount(from, contract)
        fromAccount.shareAmount -= value
        fromAccount.save()
    }

    if (to.id != ADDRESS_ZERO) {
        let toAccount = fetchLiquidityAccount(to, contract)
        toAccount.shareAmount += value
        toAccount.save()
    }

    contract.save()
}
