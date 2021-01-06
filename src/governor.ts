import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { LiquidityPool, Governor, VoteAccount,
     Proposal, Vote, ProposalVotesSnapshot, Delegate, ProposalDelegateSnapshot} from '../generated/schema'

import { 
    ProposalCreated as ProposalCreatedEvent,
    ProposalExecuted as ProposalExecutedEvent,
    VoteCast as VoteCastEvent,
    DelegateChanged as DelegateChangedEvent,
} from '../generated/templates/Governor/Governor'

import {
    fetchUser,
    BI_18,
    convertToDecimal,
    ONE_BI,
    ZERO_BD,
} from './utils'

export function handleDelegate(event: DelegateChangedEvent): void {
    let governor = Governor.load(event.address.toHexString())
    // new delegate
    let newDelegate = fetchUser(event.params.toDelegate)
    let id = event.address.toHexString().
        concat('-').
        concat(newDelegate.id)
    
    let delegate = Delegate.load(id)
    if (delegate === null) {
        delegate = new Delegate(id)
        delegate.user = newDelegate.id
        delegate.governor = governor.id
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

export function handleProposalCreated(event: ProposalCreatedEvent): void {
    let governor = Governor.load(event.address.toHexString())
    let proposalId = event.address.toHexString()
        .concat("-")
        .concat(event.params.id.toString())
    let proposal = new Proposal(proposalId)
    let user = fetchUser(event.params.proposer)
    proposal.governor = governor.id
    proposal.proposer = user.id
    proposal.index = event.params.id
    proposal.target = event.params.target.toHexString()
    proposal.signature = event.params.signature
    proposal.calldatas = event.params.calldatas
    proposal.timestamp = event.block.timestamp
    proposal.description = event.params.description
    proposal.startBlock = event.params.startBlock
    proposal.endBlock = event.params.endBlock
    proposal.for = ZERO_BD
    proposal.against = ZERO_BD
    proposal.isExecuted = false
    proposal.save()

    // create share token snapshot and delegate snapshot for vote
    let liquidityPool = LiquidityPool.load(governor.liquidityPool)
    liquidityPool.proposalCount += ONE_BI
    liquidityPool.save()
    let voteAccounts = liquidityPool.voteAccounts as VoteAccount[]
    for (let index = 0; index < voteAccounts.length; index++) {
        let voteAccount = voteAccounts[index]
        let snapshotId = proposalId.concat('-').concat(voteAccount.user)
        let votesSnapshot = new ProposalVotesSnapshot(snapshotId)
        votesSnapshot.user = voteAccount.user
        votesSnapshot.proposal = proposal.id
        votesSnapshot.totalSupply = governor.totalSupply
        votesSnapshot.votes = voteAccount.votes
        votesSnapshot.save()
    }
    
    let delegates = governor.delegates as Delegate[]
    for (let index = 0; index < delegates.length; index++) {
        let delegate = delegates[index]
        let snapshotId = proposalId.concat('-').concat(delegate.user)
        let snapshot = new ProposalDelegateSnapshot(snapshotId)
        snapshot.proposal = proposal.id
        snapshot.delegate = delegate.user
        snapshot.principals = delegate.principals
        snapshot.save()
    }
}
  
export function handleVote(event: VoteCastEvent): void {
    let user = fetchUser(event.params.voter)
    let proposalId = event.address.toHexString()
        .concat("-")
        .concat(event.params.proposalId.toString())
    let proposal = Proposal.load(proposalId)
    let vote = new Vote(proposalId.concat('-').concat(user.id))
    vote.timestamp = event.block.timestamp
    vote.voter = user.id;
    vote.proposal = proposalId
    vote.support = event.params.support
    vote.votes = convertToDecimal(event.params.votes, BI_18)
    if (vote.support) {
        proposal.for += vote.votes
    } else {
        proposal.against += vote.votes
    }
    proposal.save()
    vote.save()

    // delegate
    let snapshotId = vote.proposal.concat('-').concat(user.id)
    let delegateSnapshot = ProposalDelegateSnapshot.load(snapshotId)
    let principals = delegateSnapshot.principals as string[]

    for (let index = 0; index < principals.length; index++) {
        let principal = principals[index];
        let id = vote.proposal.concat('-').concat(principal)
        let votesSnapshot = ProposalVotesSnapshot.load(id)
        if (votesSnapshot != null) {
            let principalVote = new Vote(proposalId.concat('-').concat(principal))
            principalVote.timestamp = vote.timestamp
            principalVote.voter = principal
            principalVote.proposal = proposalId
            principalVote.votes = vote.votes
            principalVote.delegate = vote.voter
            principalVote.delegateVotes = votesSnapshot.votes
            principalVote.save()
        }
    }
}

export function handleProposalExecuted(event: ProposalExecutedEvent): void {
    let proposalId = event.address.toHexString()
        .concat("-")
        .concat(event.params.id.toString())
    let proposal = Proposal.load(proposalId)
    proposal.isExecuted = true
    proposal.save()
}