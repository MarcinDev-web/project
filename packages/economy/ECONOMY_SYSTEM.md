# Economy System Documentation

## Overview

Complete economy system for UGC 3D Platform with single currency (Coin), anti-P2W compliance, creator monetization, marketplace, and engagement fund.

## Architecture

### Core Components

1. **CurrencyExchangeRate** - Coin ↔ Fiat exchange rates
2. **AntiP2WCompliance** - Fair play verification system
3. **RevenueSplit** - Revenue distribution calculator
4. **CurrencySinks** - Supply control (burn + engagement fund)
5. **Marketplace** - UGC asset marketplace with royalties
6. **CreatorMonetization** - In-game shops, season passes, game passes
7. **WithdrawalSystem** - Creator payouts with KYC
8. **EngagementFund** - Rewards based on player engagement

## Usage Examples

### Basic Setup

```typescript
import {
  CurrencyManager,
  CurrencyExchangeRate,
  AntiP2WCompliance,
  RevenueSplit,
  CurrencySinks,
  Marketplace,
  CreatorMonetization,
  WithdrawalSystem,
  EngagementFund,
  PLATFORM_CURRENCY,
  GameMode,
  ItemCategory,
} from '@engine/economy';

// Initialize core systems
const currencyManager = new CurrencyManager();
const exchangeRate = new CurrencyExchangeRate({
  defaultCoinsPerFiat: 100,
  defaultFiatCurrency: 'USD',
});
const compliance = new AntiP2WCompliance();
const revenueSplit = new RevenueSplit();
const eventBus = currencyManager.events;

// Create wallets
const burnWallet = currencyManager.createWallet('burn_wallet');
const fundWallet = currencyManager.createWallet('fund_wallet');

// Initialize sinks
const sinks = new CurrencySinks(burnWallet, fundWallet, eventBus, {
  burnPercent: 50,
  fundPercent: 50,
});

// Initialize marketplace
const marketplace = new Marketplace(
  currencyManager,
  revenueSplit,
  sinks,
  compliance,
  eventBus,
  {
    listingFee: 10,
    transactionFeePercent: 10,
  }
);

// Initialize monetization
const monetization = new CreatorMonetization(
  currencyManager,
  revenueSplit,
  sinks,
  compliance,
  eventBus
);

// Initialize withdrawal system
const withdrawalSystem = new WithdrawalSystem(
  currencyManager,
  exchangeRate,
  eventBus,
  {
    minWithdrawalAmount: 1000,
    exchangeRate,
  }
);

// Initialize engagement fund
const engagementFund = new EngagementFund(
  currencyManager,
  compliance,
  eventBus,
  fundWallet
);
```

### Register Game

```typescript
// Register game for compliance tracking
compliance.registerGame('my-game', GameMode.CASUAL, 'creator123');
compliance.verifyGame('my-game'); // Mark as verified fair
```

### Create Shop Item

```typescript
monetization.setShopItem('my-game', {
  itemId: 'cool-skin',
  itemDefinition: {
    itemId: 'cool-skin',
    category: ItemCategory.COSMETIC,
    name: 'Cool Skin',
  },
  price: { currency: PLATFORM_CURRENCY, amount: 100 },
  available: true,
});

// Player purchases item
const result = monetization.purchaseItem('my-game', 'cool-skin', 'player-wallet-id');
// Creator receives 70% (70 coins), platform 25%, processing 5%
```

### Marketplace Transaction

```typescript
// Creator lists asset
const listingId = marketplace.listItem(
  'creator123',
  {
    itemId: 'asset1',
    category: ItemCategory.COSMETIC,
    name: 'Asset',
  },
  { currency: PLATFORM_CURRENCY, amount: 500 },
  'game-id' // Optional: for royalties
);

// Another creator purchases
const purchase = marketplace.purchaseItem(listingId, 'buyer-wallet-id', 'game-creator-id');
// Asset creator: 60% (300), game creator: 20% (100), platform: 20% (100)
```

### Withdrawal

```typescript
// Submit KYC
withdrawalSystem.submitKYC('creator123', {
  fullName: 'John Doe',
  email: 'john@example.com',
  taxId: '123-45-6789',
  bankAccount: 'encrypted-bank-details',
});

// Verify KYC (admin action)
withdrawalSystem.verifyKYC('creator123');

// Request withdrawal
const requestId = withdrawalSystem.requestWithdrawal(
  'creator123',
  { currency: PLATFORM_CURRENCY, amount: 5000 },
  'USD'
);
// Converts 5000 coins → 50 USD (at 100 coins/USD rate)

// Process withdrawal
withdrawalSystem.processWithdrawal(requestId);
```

### Engagement Fund Distribution

```typescript
// Update metrics
engagementFund.updateMetrics('game-id', {
  creatorId: 'creator123',
  totalPlayTime: 1000, // minutes
  uniquePlayers: 50,
  returnRate: 0.7,
  partyPlaySessions: 20,
  fairPlayScore: 0.95,
});

// Distribute fund (monthly)
const distributions = engagementFund.distributeFund();
// Rewards creators based on engagement metrics
```

## API Endpoints (To Be Implemented)

### Wallet Endpoints

- `GET /api/economy/wallet/:walletId` - Get wallet balance
- `POST /api/economy/wallet/:walletId/deposit` - Deposit coins
- `POST /api/economy/wallet/:walletId/withdraw` - Withdraw coins

### Marketplace Endpoints

- `GET /api/economy/marketplace/listings` - List all active listings
- `POST /api/economy/marketplace/list` - Create listing
- `POST /api/economy/marketplace/purchase/:listingId` - Purchase item

### Creator Endpoints

- `GET /api/economy/creator/:creatorId/shop/:gameId` - Get shop items
- `POST /api/economy/creator/:creatorId/shop/:gameId/item` - Add shop item
- `POST /api/economy/creator/:creatorId/purchase/:itemId` - Purchase item
- `GET /api/economy/creator/:creatorId/revenue` - Get revenue stats
- `POST /api/economy/creator/:creatorId/withdrawal` - Request withdrawal

### Compliance Endpoints

- `POST /api/economy/compliance/game` - Register game
- `POST /api/economy/compliance/game/:gameId/verify` - Verify game
- `POST /api/economy/compliance/item/check` - Check item compliance

## Database Schema (To Be Implemented)

### Tables

- `wallets` - Wallet balances
- `transactions` - Transaction history
- `marketplace_listings` - Marketplace listings
- `kyc_records` - KYC information
- `withdrawal_requests` - Withdrawal requests
- `engagement_metrics` - Engagement metrics per game
- `revenue_splits` - Revenue split records

## Telemetry Integration

Engagement fund requires telemetry data:

- Player session start/stop
- Checkpoint activations
- Trial completions
- Party play sessions
- Return rate calculations

Integrate with `@engine/world-server` telemetry system.

## Testing

Run tests:

```bash
cd packages/economy
pnpm test
```

Test coverage:
- ✅ CurrencyExchangeRate
- ✅ AntiP2WCompliance  
- ✅ RevenueSplit
- ✅ CurrencySinks
- ⏳ Marketplace (partial)
- ⏳ CreatorMonetization (partial)
- ⏳ WithdrawalSystem (partial)
- ⏳ EngagementFund (partial)

## Next Steps

1. Complete test coverage for all components
2. Implement REST API endpoints
3. Add database persistence layer
4. Create UI dashboard for creators
5. Integrate with telemetry system
6. Add monitoring and analytics

