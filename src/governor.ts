import { BigInt, ethereum, log, Address } from "@graphprotocol/graph-ts"

import { Governor, Proposal, Vote } from '../generated/schema'

import { 
    ProposalCreated as ProposalCreatedEvent,
    ProposalExecuted as ProposalExecutedEvent,
    VoteCast as VoteCastEvent,
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
    ZERO_BI,
} from './utils'

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
    proposal.quorumVotes = convertToDecimal(event.params.quorumVotes, BI_18)
    proposal.for = ZERO_BD
    proposal.against = ZERO_BD
    proposal.isExecuted = false
    proposal.executedBlockNumber = ZERO_BI
    proposal.save()

    governor.proposalCount += ONE_BI
    governor.save()
}
  
export function handleVote(event: VoteCastEvent): void {
    let user = fetchUser(event.params.account)
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
}

export function handleProposalExecuted(event: ProposalExecutedEvent): void {
    let proposalId = event.address.toHexString()
        .concat("-")
        .concat(event.params.id.toString())
    let proposal = Proposal.load(proposalId)
    proposal.isExecuted = true
    proposal.executedBlockNumber = event.block.number
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
    governor.rewardRate = convertToDecimal(event.params.currentRate, BI_18)
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
