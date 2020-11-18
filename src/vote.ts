import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Perpetual, ShareToken, VoteContract, LiquidityAccount,
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
    
    let delegates = share.delegates
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
    let principals = delegateSnapshot.principals

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
            principalVote.votes = vote.votes
            principalVote.delegate = vote.voter
            principalVote.delegateVotes = shareTokenSnapshot.shareAmount
            principalVote.save()
        }
    }
}
