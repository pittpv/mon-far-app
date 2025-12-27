# 😄 Happy Vote MiniApp

A lightweight miniapp for **Farcaster** that lets users vote on how they feel — either "Happy" 😊 or "Sad" 😢 — once every 24 hours. Built on the **Monad** (originally) and Base blockchain using a Solidity smart contract.

## 📦 Features

- Two voting buttons: **"I'm Happy"** and **"I'm Sad"**
- Gas refunds for voting
- Cooldown expiration notification
- Real-time percentage counter showing happy/sad votes
- Users can only vote once per 24 hours (on-chain enforcement)
- Donate for author
- Support Monad, Base, Monad test networks

## 🆕 Updates

- [26.12.2025] Security update. Notification system improvements:
  - ✅ Fixed: Notifications now automatically restore after Vercel redeploy
  - ✅ Fixed: Automatic cleanup of expired vote records
  - ✅ Fixed: No duplicate notifications
  - ✅ Improved: Serverless environment support
- [24.12.2025] Gas refunds for voting, cooldown expiration notification, updated design, added basic network, bug fixes.
- [04.05.2025] WalletConnect
- [06.05.2025] Modern design, increased adaptability
- [09.05.2025] Dark theme with toggle

## 🧱 Smart Contract

### Monad

Mainnet `contracts/HappyVoteLeaderboard.sol`, [Verified](https://monadscan.com/address/0xdFFEFD8eF040702A4657a98f189860169104257A#code)

Testnet `contracts/HappyVote-Re-Genesis.sol`, [Verified](https://monad-testnet.socialscan.io/address/0x40198e59306181e69affa25c69c5ba50f8f4cd0e#contract)

### Base

Mainnet `contracts/HappyVoteLeaderboard.sol`, [Verified](https://repo.sourcify.dev/8453/0xAbb75Eb3E914418a85044Ad4D77886d116Ff454D)

## ✍️ Feedback

Any questions, bug report or feedback:

https://t.me/+DLsyG6ol3SFjM2Vk

https://x.com/pittpv
