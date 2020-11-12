import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Perpetual, ShareToken, VoteContract, LiquidityAccount,
     Proposal, Vote, ProposalShareTokenSnapshot, Delegate, ProposalDelegateSnapshot} from '../generated/schema'

import { 
    Proposal as ProposalEvent,
    Vote as VoteEvent,
    SetDelegate as SetDelegateEvent,
} from '../generated/templates/Vote/Vote'

import {
    fetchUser,
    ZERO_BD,
} from './utils'

export function handleProposal(event: ProposalEvent): void {
    let voteContract = VoteContract.load(event.address.toHexString())
    let proposalId = event.address.toHexString()
        .concat("-")
        .concat(event.params.id.toString())
    let proposal = new Proposal(proposalId)
    let user = fetchUser(event.transaction.from)
    proposal.contract = voteContract.id
    proposal.proposer = user.id
    proposal.timestamp = event.block.timestamp
    proposal.type = event.params.type
    proposal.beginBlock = event.params.beginBlock
    proposal.endBlock = event.params.endBlock
    proposal.save()

    // create share token snapshot and delegate snapshot for vote
    let perpetual = Perpetual.load(voteContract.perpetual)
    let share = ShareToken.load(perpetual.shareToken)
    let liquidityAccounts = share.liquidityAccounts
    for (let index = 0; index < liquidityAccounts.length; index++) {
        const id = liquidityAccounts[index]
        let liquidityAccount = LiquidityAccount.load(id)
        let snapshotId = proposalId.concat('-').concat(liquidityAccount.user)
        let shareSnapshot = new ProposalShareTokenSnapshot(snapshotId)
        shareSnapshot.user = liquidityAccount.user
        shareSnapshot.proposal = proposal.id
        shareSnapshot.totalSupply = share.totalSupply
        shareSnapshot.shareAmount = liquidityAccount.shareAmount
        shareSnapshot.save()
    }
    
    let delegates = voteContract.delegates
    for (let index = 0; index < delegates.length; index++) {
        const id = delegates[index]
        let delegate = Delegate.load(id)
        let snapshotId = proposalId.concat('-').concat(delegate.user)
        let snapshot = new ProposalDelegateSnapshot(snapshotId)
        snapshot.proposal = proposal.id
        snapshot.delegate = delegate.user
        snapshot.principals = delegate.principals
        snapshot.save()
    }
}
  
export function handleVote(event: VoteEvent): void {
    let user = fetchUser(event.params.voter)
    let proposalId = event.params.id.toString()
    let vote = new Vote(proposalId.concat('-').concat(user.id))
    vote.timestamp = event.block.timestamp
    vote.voter = user.id;
    vote.proposal = proposalId
    vote.content = event.params.voteContent

    // total share amount
    let shareAmount = ZERO_BD
    let id = vote.proposal.concat('-').concat(user.id)
    let shareTokenSnapshot = ProposalShareTokenSnapshot.load(id)
    if (shareTokenSnapshot != null) {
        shareAmount += shareTokenSnapshot.shareAmount
    }

    // delegate
    let snapshotId = vote.proposal.concat('-').concat(user.id)
    let delegateSnapshot = ProposalDelegateSnapshot.load(snapshotId)
    let principals = delegateSnapshot.principals
    for (let index = 0; index < principals.length; index++) {
        const principal = principals[index];
        let id = vote.proposal.concat('-').concat(principal)
        let shareTokenSnapshot = ProposalShareTokenSnapshot.load(id)
        if (shareTokenSnapshot != null) {
            shareAmount += shareTokenSnapshot.shareAmount
        }
    }
    vote.shareAmount = shareAmount
    vote.save()

    for (let index = 0; index < principals.length; index++) {
        const principal = principals[index];
        let id = vote.proposal.concat('-').concat(principal)
        let shareTokenSnapshot = ProposalShareTokenSnapshot.load(id)
        if (shareTokenSnapshot != null) {
            let principalVote = new Vote(proposalId.concat('-').concat(principal))
            principalVote.timestamp = vote.timestamp
            principalVote.voter = principal
            principalVote.proposal = proposalId
            principalVote.content = vote.content
            principalVote.shareAmount = shareAmount
            principalVote.delegate = vote.voter
            principalVote.delegateShareAmount = shareTokenSnapshot.shareAmount
            principalVote.save()
        }
    }
}

export function handleDelegate(event: SetDelegateEvent): void {
    let voteContract = VoteContract.load(event.address.toHexString())
    // new delegate
    let newDelegate = fetchUser(event.params.newDelegate.toHexString())
    let id = event.address.toHexString().
        concat('-').
        concat(newDelegate.id)
    
    let delegate = Delegate.load(id)
    if (delegate === null) {
        delegate = new Delegate(id)
        delegate.user = newDelegate.id
        delegate.contract = voteContract.id
        delegate.principals = []
    }
    let principals = delegate.principals
    principals.push(event.params.user.toHexString())
    delegate.principals = principals
    delegate.save()

    // old
    let oldDelegate = fetchUser(event.params.oldDelegate.toHexString())
    id = event.address.toHexString().
        concat('-').
        concat(oldDelegate.id)
    
    delegate = Delegate.load(id)
    if (delegate != null) {
        principals = []
        for (let index = 0; index < delegate.principals.length; index++) {
            const principal = delegate.principals[index]
            if (event.params.user.toHexString() != principal) {
                principals.push(principal)
            }
        }
        delegate.principals = principals
        delegate.save()
    }
    return
}