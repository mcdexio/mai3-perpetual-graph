import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { LiquidityPool, Governor, VoteAccount,
     Proposal, Vote, ProposalVotesSnapshot, Delegate, ProposalDelegateSnapshot} from '../generated/schema'

import { 
    ProposalCreated as ProposalCreatedEvent,
    ProposalExecuted as ProposalExecutedEvent,
    VoteCast as VoteCastEvent,
    DelegateChanged as DelegateChangedEvent,
    Transfer as TransferEvent,
    RewardAdded as RewardAddedEvent,
    RewardRateChanged as RewardRateChangedEvent,
    RewardPaid as RewardPaidEvent,
} from '../generated/templates/Governor/Governor'

import {
    fetchUser,
    BI_18,
    convertToDecimal,
    ONE_BI,
    ZERO_BD,
    fetchVoteAccount,
    ADDRESS_ZERO,
} from './utils'

export function handleDelegate(event: DelegateChangedEvent): void {
    let delegator = event.params.delegator.toHexString()
    let fromDelegate = event.params.fromDelegate.toHexString()
    let toDelegate = event.params.toDelegate.toHexString()

    if (fromDelegate == toDelegate) {
        return
    }

    let governor = Governor.load(event.address.toHexString())
    
    // new delegate
    if (delegator != toDelegate) {
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
            let delegateIDs = governor.delegateIDs
            delegateIDs.push(id)
            governor.delegateIDs = delegateIDs
            governor.save()
        }
        let principals = delegate.principals
        principals.push(event.params.delegator.toHexString())
        delegate.principals = principals
        delegate.save()
    }


    // old delegate
    if (delegator != fromDelegate) {
        let oldDelegate = fetchUser(event.params.fromDelegate)
        let id = event.address.toHexString().
            concat('-').
            concat(oldDelegate.id)
        
        let delegate = Delegate.load(id)
        if (delegate != null) {
            let oldprincipals = delegate.principals as string[]
            let newPrincipals: string[] = []
            for (let index = 0; index < oldprincipals.length; index++) {
                let principal = oldprincipals[index]
                if (delegator != principal) {
                    newPrincipals.push(principal)
                }
            }
            delegate.principals = newPrincipals
            delegate.save()
        }
    }
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
    proposal.signatures = event.params.signatures
    proposal.calldatas = event.params.calldatas
    proposal.timestamp = event.block.timestamp
    proposal.description = event.params.description
    proposal.startBlock = event.params.startBlock
    proposal.endBlock = event.params.endBlock
    proposal.for = ZERO_BD
    proposal.against = ZERO_BD
    proposal.isExecuted = false
    proposal.save()

    // create vote account snapshots and delegate snapshots
    governor.proposalCount += ONE_BI
    governor.save()
    let voteAccountIDs = governor.voteAccountIDs as string[]
    for (let index = 0; index < voteAccountIDs.length; index++) {
        let id = voteAccountIDs[index]
        let voteAccount = VoteAccount.load(id)
        if (voteAccount != null) {
            let snapshotId = proposalId.concat('-').concat(voteAccount.user)
            let votesSnapshot = new ProposalVotesSnapshot(snapshotId)
            votesSnapshot.user = voteAccount.user
            votesSnapshot.proposal = proposal.id
            votesSnapshot.totalVotes = governor.totalVotes
            votesSnapshot.votes = voteAccount.votes
            votesSnapshot.save()
        }
    }
    
    let delegates = governor.delegateIDs as string[]
    for (let index = 0; index < delegates.length; index++) {
        let id = delegates[index]
        let delegate = Delegate.load(id)
        if (delegate != null) {
            let snapshotId = proposalId.concat('-').concat(delegate.user)
            let snapshot = new ProposalDelegateSnapshot(snapshotId)
            snapshot.proposal = proposal.id
            snapshot.delegate = delegate.user
            snapshot.principals = delegate.principals
            snapshot.save()
        }
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

export function handleTransfer(event: TransferEvent): void {
    let governor = Governor.load(event.address.toHexString())
    let from = fetchUser(event.params.from)
    let to = fetchUser(event.params.to)

    let value = convertToDecimal(event.params.value, BI_18)
    if (from.id == ADDRESS_ZERO) {
        governor.totalVotes += value
    }

    if (to.id == ADDRESS_ZERO) {
        governor.totalVotes -= value
    }

    if (from.id != ADDRESS_ZERO) {
        let fromAccount = fetchVoteAccount(from, governor as Governor)
        fromAccount.votes -= value
        fromAccount.save()
    }

    if (to.id != ADDRESS_ZERO) {
        let toAccount = fetchVoteAccount(to, governor as Governor)
        toAccount.votes += value
        toAccount.save()
    }

    governor.save()
}

export function handleRewardAdded(event: RewardAddedEvent): void {
    let governor = Governor.load(event.address.toHexString())
    governor.totalReward += convertToDecimal(event.params.reward, BI_18)
    governor.periodFinish = event.params.periodFinish
    governor.save()
}

export function handleRewardRateChanged(event: RewardRateChangedEvent): void {
    let governor = Governor.load(event.address.toHexString())
    governor.rewardRate += convertToDecimal(event.params.currentRate, BI_18)
    governor.periodFinish = event.params.periodFinish
    governor.save()
}

export function handleRewardPaid(event: RewardPaidEvent): void {
    let governor = Governor.load(event.address.toHexString())
    let user = fetchUser(event.params.user)
    let account = fetchVoteAccount(user, governor as Governor)
    account.reward += convertToDecimal(event.params.reward, BI_18)
    account.save()
}