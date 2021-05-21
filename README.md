# mai v3 protocol subgraph

[MCDEX](https://mcdex.io/) is an AMM-based decentralized perpetual swap protocol. Perpetual swap is one of the most popular derivatives that has no expiration date, supports margin trading, and has its price soft pegged to index price.

[AMMDesign](https://mcdexio.github.io/documents/en/Shared-Liquidity-AMM-of-MAI-PROTOCOL-v3.pdf)

This subgraph dynamically tracks any pool created by the mcdex factory and tracks any perpetual created by liquidity pool. It tracks of the current state of perpetual contracts, and contains derived stats for things like historical data and Oracle prices.

- aggregated data across liquidity pools and perpetuals,
- data on individual pools and perpetuals,
- data on users
- historical data on Mcdex, pool margin etc.


## Install

update config/mainnet.json
update package.json settings to point to your own graph account.
```
yarn install
yarn prepare:mainnet
yarn codegen
yarn deploy-local
```
