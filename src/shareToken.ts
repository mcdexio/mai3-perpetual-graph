import {
    Transfer as TransferEvent,
    DelegateChanged as DelegateChangedEvent,
} from '../generated/templates/ShareToken/ERC20'

import { ShareToken, Delegate } from '../generated/schema'

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

export function handleDelegate(event: DelegateChangedEvent): void {
    let contract = ShareToken.load(event.address.toHexString())
    // new delegate
    let newDelegate = fetchUser(event.params.toDelegate.toHexString())
    let id = event.address.toHexString().
        concat('-').
        concat(newDelegate.id)
    
    let delegate = Delegate.load(id)
    if (delegate === null) {
        delegate = new Delegate(id)
        delegate.user = newDelegate.id
        delegate.contract = contract.id
        delegate.principals = []
    }
    let principals = delegate.principals
    principals.push(event.params.delegator.toHexString())
    delegate.principals = principals
    delegate.save()

    // old
    let oldDelegate = fetchUser(event.params.fromDelegate.toHexString())
    id = event.address.toHexString().
        concat('-').
        concat(oldDelegate.id)
    
    delegate = Delegate.load(id)
    if (delegate != null) {
        principals = []
        for (let index = 0; index < delegate.principals.length; index++) {
            const principal = delegate.principals[index]
            if (event.params.delegator.toHexString() != principal) {
                principals.push(principal)
            }
        }
        delegate.principals = principals
        delegate.save()
    }
    return
}