import {
    Transfer as TransferEvent,
    DelegateChanged as DelegateChangedEvent,
} from '../generated/templates/VoteToken/VoteToken'

import { VoteToken, Delegate, LiquidityPool } from '../generated/schema'

import {
    ADDRESS_ZERO,
    fetchUser,
    fetchVoteAccount,
    BI_18,
    convertToDecimal,
} from './utils'

export function handleTransfer(event: TransferEvent): void {
    let contract = VoteToken.load(event.address.toHexString())
    let liquidityPool = LiquidityPool.load(contract.liquidityPool)
    let from = fetchUser(event.params.from)
    let to = fetchUser(event.params.to)

    let value = convertToDecimal(event.params.amount, BI_18)
    if (from.id == ADDRESS_ZERO) {
        contract.totalSupply += value
    }

    if (to.id == ADDRESS_ZERO) {
        contract.totalSupply -= value
    }

    if (from.id != ADDRESS_ZERO) {
        let fromAccount = fetchVoteAccount(from, liquidityPool as LiquidityPool)
        fromAccount.votes -= value
        fromAccount.save()
    }

    if (to.id != ADDRESS_ZERO) {
        let toAccount = fetchVoteAccount(to, liquidityPool as LiquidityPool)
        toAccount.votes += value
        toAccount.save()
    }

    contract.save()
}

export function handleDelegate(event: DelegateChangedEvent): void {
    let contract = VoteToken.load(event.address.toHexString())
    // new delegate
    let newDelegate = fetchUser(event.params.toDelegate)
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
    let oldDelegate = fetchUser(event.params.fromDelegate)
    id = event.address.toHexString().
        concat('-').
        concat(oldDelegate.id)
    
    delegate = Delegate.load(id)
    if (delegate != null) {
        let oldprincipals = delegate.principals as string[]
        let newPrincipals: string[] = []
        for (let index = 0; index < oldprincipals.length; index++) {
            let principal = oldprincipals[index]
            if (event.params.delegator.toHexString() != principal) {
                newPrincipals.push(principal)
            }
        }
        delegate.principals = newPrincipals
        delegate.save()
    }
    return
}