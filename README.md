# Privy TON App with Omniston Integration

A React-based web application that demonstrates seamless integration between Privy authentication, TON blockchain functionality, and Omniston swap protocol. The app showcases email-based authentication, automated wallet creation, and multi-DEX token swapping capabilities.

## Key Features

- **Email Authentication**: Simple email-based login using Privy SDK
- **Automated TON Wallet Creation**: Generates TON wallets from Privy credentials
- **Token Swapping**: Integrated Omniston protocol for swapping tokens across multiple DEXes
- **Token Portfolio View**: Displays all token balances in user's wallet
- **Real-time Trade Tracking**: Monitors swap status from initiation to completion
- **Responsive UI**: Modern interface with Tailwind CSS v4

## Prerequisites

- Node.js (v16 or higher)
- pnpm (v8 or higher)
- Privy App ID (get one at https://privy.io)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd privy-ton-app
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Privy App ID:
```
VITE_PRIVY_APP_ID=your_privy_app_id_here
VITE_TON_API_KEY=your_toncenter_api_key (optional)
```

## Running the Application

### Development mode
```bash
pnpm dev
```
This will start the development server at `http://localhost:5173` with hot module replacement.

### Build for production
```bash
pnpm build
```

### Preview production build
```bash
pnpm preview
```

### Linting
```bash
pnpm lint
```

## Architecture Overview

### Core Components

- **Entry Point** (`src/main.tsx`): Wraps the app with PrivyProvider, QueryClientProvider, and OmnistonProvider
- **Main App** (`src/App.tsx`): Handles authentication flow and routing
- **Wallet Dashboard** (`src/components/wallet/WalletDashboard.tsx`): Main interface with wallet and swap tabs
- **Swap Interface** (`src/components/swap/SwapInterface.tsx`): Token swapping UI with Omniston integration
- **Token Balance** (`src/components/wallet/TokenBalance.tsx`): Displays individual token balances

### Custom Hooks

- `useEmailAuth`: Manages email authentication flow with Privy
- `useTonWallet`: Handles wallet creation, balance checking, and deployment
- `useOmnistonSwap`: Manages swap quotes, execution, and tracking with Privy signing
- `useAssets`: Fetches available tokens from STON.fi API
- `useTokenBalances`: Efficiently fetches all token balances using TonAPI
- `useWalletDeploy`: Handles wallet contract deployment

### Key Features Implementation

#### 1. Email Authentication
Users log in with their email address. Privy handles the authentication flow and provides access to the embedded wallet.

#### 2. TON Wallet Creation
When a user logs in for the first time, the app automatically creates a TON wallet using their Privy credentials. The wallet address is derived deterministically from the user's Privy account.

#### 3. Token Swapping via Omniston
- Fetches real-time quotes from multiple DEXes
- Builds optimized swap routes
- Signs transactions using Privy's extended chains functionality
- Tracks trade execution until completion
- Automatically switches to wallet tab after successful swap

#### 4. Wallet Management
- Displays TON balance and all token balances
- Shows wallet deployment status
- Provides instructions for undeployed wallets
- Auto-refreshes balances after transactions

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite with TypeScript support
- **Styling**: Tailwind CSS v4 (using @tailwindcss/vite plugin)
- **Authentication**: @privy-io/react-auth with extended chains support
- **Blockchain**: 
  - @ton/core, @ton/crypto, @ton/ton for TON blockchain interaction
  - @ton-api/client for efficient token balance queries
- **Swap Protocol**: 
  - @ston-fi/omniston-sdk-react for swap functionality
  - @ston-fi/api for token information
- **State Management**: TanStack Query (React Query)
- **Polyfills**: vite-plugin-node-polyfills for browser compatibility

## Project Structure

```
privy-ton-app/
├── src/
│   ├── components/
│   │   ├── auth/         # Authentication components
│   │   ├── swap/         # Swap interface components
│   │   ├── ui/          # Reusable UI components
│   │   └── wallet/      # Wallet management components
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── public/              # Static files
├── .env.example         # Environment variables template
├── CLAUDE.md            # AI assistant instructions
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Environment Configuration

The app supports the following environment variables:

- `VITE_PRIVY_APP_ID` (required): Your Privy application ID
- `VITE_TON_API_KEY` (optional): TonCenter API key for enhanced rate limits

## API Endpoints

- **TON RPC**: `https://toncenter.com/api/v2/jsonRPC`
- **Omniston WebSocket**: `wss://omni-ws.ston.fi`
- **Privy Wallet API**: `https://auth.privy.io/api/v1/wallets/{walletId}`

## Known Limitations

### TON Transaction Signing with Privy
- Privy embedded wallets don't directly expose the wallet's public key
- The app fetches the public key via Privy's REST API for transaction building
- Transaction signing uses Privy's `useSignRawHash` hook from extended chains
- Wallet deployment must be handled separately before swaps can be executed

### Current Implementation
- The swap functionality has been fully implemented with Privy signing
- Wallet deployment is handled by a dedicated hook
- All transactions are signed using Privy's SDK without requiring a backend

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run linter
pnpm lint

# Type check
pnpm tsc --noEmit
```

## Contributing

This is a demonstration project showcasing the integration of Privy authentication with TON blockchain and Omniston swap protocol. Feel free to fork and adapt for your own needs.

## License

This is a test project for demonstration purposes.