import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { LiquidityPool, ShareToken, VoteContract, LiquidityAccount,
     Proposal, Vote, ProposalShareTokenSnapshot, Delegate, ProposalDelegateSnapshot} from '../generated/schema'

import { 
    ProposalCreated as ProposalCreatedEvent,
    VoteCast as VoteCastEvent,
} from '../generated/templates/Vote/Vote'

import {
    fetchUser,
    ZERO_BD,
    BI_18,
    convertToDecimal,
} from './utils'

export function handleProposalCreated(event: ProposalCreatedEvent): void {
    let voteContract = VoteContract.load(event.address.toHexString())
    let proposalId = event.address.toHexString()
        .concat("-")
        .concat(event.params.id.toString())
    let proposal = new Proposal(proposalId)
    let user = fetchUser(event.params.proposer)
    proposal.contract = voteContract.id
    proposal.proposer = user.id
    proposal.targets = event.params.targets.toHexString()
    proposal.signature = event.params.signature
    proposal.calldatas = event.params.calldatas
    proposal.timestamp = event.block.timestamp
    proposal.description = event.params.description
    proposal.startBlock = event.params.startBlock
    proposal.endBlock = event.params.endBlock
    proposal.save()

    // create share token snapshot and delegate snapshot for vote
    let liquidityPool = LiquidityPool.load(voteContract.liquidityPool)
    let share = ShareToken.load(liquidityPool.shareToken)
    let liquidityAccounts = liquidityPool.liquidityAccounts as LiquidityAccount[]
    for (let index = 0; index < liquidityAccounts.length; index++) {
        let liquidityAccount = liquidityAccounts[index]
        let snapshotId = proposalId.concat('-').concat(liquidityAccount.user)
        let shareSnapshot = new ProposalShareTokenSnapshot(snapshotId)
        shareSnapshot.user = liquidityAccount.user
        shareSnapshot.proposal = proposal.id
        shareSnapshot.totalSupply = share.totalSupply
        shareSnapshot.shareAmount = liquidityAccount.shareAmount
        shareSnapshot.save()
    }
    
    let delegates = share.delegates as Delegate[]
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
    let proposalId = event.params.proposalId.toString()
    let vote = new Vote(proposalId.concat('-').concat(user.id))
    vote.timestamp = event.block.timestamp
    vote.voter = user.id;
    vote.proposal = proposalId
    vote.support = event.params.support
    vote.votes = convertToDecimal(event.params.votes, BI_18)
    vote.save()

    // delegate
    let snapshotId = vote.proposal.concat('-').concat(user.id)
    let delegateSnapshot = ProposalDelegateSnapshot.load(snapshotId)
    let principals = delegateSnapshot.principals as string[]

    for (let index = 0; index < principals.length; index++) {
        let principal = principals[index];
        let id = vote.proposal.concat('-').concat(principal)
        let shareTokenSnapshot = ProposalShareTokenSnapshot.load(id)
        if (shareTokenSnapshot != null) {
            let principalVote = new Vote(proposalId.concat('-').concat(principal))
            principalVote.timestamp = vote.timestamp
            principalVote.voter = principal
            principalVote.proposal = proposalId
            principalVote.votes = vote.votes
            principalVote.delegate = vote.voter
            principalVote.delegateVotes = shareTokenSnapshot.shareAmount
            principalVote.save()
        }
    }
}
