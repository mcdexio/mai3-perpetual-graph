import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { LiquidityPool, VoteToken, VoteContract, VoteAccount,
     Proposal, Vote, ProposalVoteTokenSnapshot, Delegate, ProposalDelegateSnapshot} from '../generated/schema'

import { 
    ProposalCreated as ProposalCreatedEvent,
    VoteCast as VoteCastEvent,
} from '../generated/templates/Vote/Vote'

import {
    fetchUser,
    BI_18,
    convertToDecimal,
    ONE_BI,
    ZERO_BD,
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
    proposal.index = event.params.id
    proposal.targets = event.params.targets.toHexString()
    proposal.signature = event.params.signature
    proposal.calldatas = event.params.calldatas
    proposal.timestamp = event.block.timestamp
    proposal.description = event.params.description
    proposal.startBlock = event.params.startBlock
    proposal.endBlock = event.params.endBlock
    proposal.for = ZERO_BD
    proposal.against = ZERO_BD
    proposal.save()

    // create share token snapshot and delegate snapshot for vote
    let liquidityPool = LiquidityPool.load(voteContract.liquidityPool)
    liquidityPool.proposalCount += ONE_BI
    liquidityPool.save()
    let voteToken = VoteToken.load(liquidityPool.voteToken)
    let voteAccounts = liquidityPool.voteAccounts as VoteAccount[]
    for (let index = 0; index < voteAccounts.length; index++) {
        let voteAccount = voteAccounts[index]
        let snapshotId = proposalId.concat('-').concat(voteAccount.user)
        let shareSnapshot = new ProposalVoteTokenSnapshot(snapshotId)
        shareSnapshot.user = voteAccount.user
        shareSnapshot.proposal = proposal.id
        shareSnapshot.totalSupply = voteToken.totalSupply
        shareSnapshot.votes = voteAccount.votes
        shareSnapshot.save()
    }
    
    let delegates = voteToken.delegates as Delegate[]
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
        let voteTokenSnapshot = ProposalVoteTokenSnapshot.load(id)
        if (voteTokenSnapshot != null) {
            let principalVote = new Vote(proposalId.concat('-').concat(principal))
            principalVote.timestamp = vote.timestamp
            principalVote.voter = principal
            principalVote.proposal = proposalId
            principalVote.votes = vote.votes
            principalVote.delegate = vote.voter
            principalVote.delegateVotes = voteTokenSnapshot.votes
            principalVote.save()
        }
    }
}
