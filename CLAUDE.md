# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server with hot reloading
- `pnpm build` - Create production build
- `pnpm preview` - Preview production build locally
- `pnpm lint` - Run ESLint for code quality checks

### Package Management
- Use `pnpm` for all package operations (not npm or yarn)
- `pnpm install` - Install dependencies
- `pnpm add <package>` - Add new dependency
- `pnpm add -D <package>` - Add development dependency

## Architecture Overview

This is a React-based web application that integrates Privy authentication with TON blockchain functionality and Omniston swap capabilities. The application demonstrates:

1. **Email-based authentication** using Privy SDK
2. **TON wallet creation** from user credentials
3. **Blockchain interactions** via TON Client
4. **Token swapping** via Omniston SDK across multiple DEXes

### Key Components

- **Entry Point**: `src/main.tsx` wraps the app in PrivyProvider, QueryClientProvider, and OmnistonProvider
- **Main Component**: `src/App.tsx` handles authentication routing
- **Wallet Dashboard**: `src/components/wallet/WalletDashboard.tsx` - main interface with wallet and swap tabs, displays all token balances
- **Swap Interface**: `src/components/swap/SwapInterface.tsx` - token swapping UI
- **Token Balance**: `src/components/wallet/TokenBalance.tsx` - displays individual token balance item
- **Custom Hooks**:
  - `useEmailAuth` - email authentication flow
  - `useTonWallet` - wallet management and balance
  - `usePrivyTonSigner` - bridges Privy signing with TON transactions
  - `useOmnistonSwap` - handles swap quotes, execution, and tracking
  - `useAssets` - fetches available assets from STON.fi API (shared by wallet and swap)
  - `useTokenBalances` - fetches all token balances for a wallet using TonAPI (efficient single call)
- **Utilities**:
  - `getTonClient` - creates TonClient instance with optional API key from environment
  - `getTonApiClient` - creates TonAPI client for efficient token balance queries
- **Environment**: 
  - Required: `VITE_PRIVY_APP_ID` for authentication
  - Optional: `VITE_TON_API_KEY` for TonCenter API
  - Optional: `VITE_TONAPI_KEY` for TonAPI (used for fetching token balances)

### Technology Stack

- **Frontend**: React 19 with Vite bundler and TypeScript
- **Styling**: Tailwind CSS v4 with Vite plugin
- **Authentication**: @privy-io/react-auth with extended chains
- **Blockchain**: @ton/core, @ton/crypto, @ton/ton packages
- **API Clients**: @ton-api/client for efficient token balance queries
- **Swap Protocol**: @ston-fi/omniston-sdk-react, @ston-fi/api
- **State Management**: TanStack Query (React Query)
- **Polyfills**: Node.js polyfills configured for browser compatibility (required for TON libraries)

### Important Configuration

1. **Vite Config**: Includes node polyfills plugin for blockchain libraries and Tailwind CSS plugin
2. **Tailwind CSS**: Using v4 with @tailwindcss/vite plugin, imported via `@import "tailwindcss"`
3. **TypeScript**: Full TypeScript implementation with strict type checking
4. **ESLint**: Modern flat config with React-specific rules
5. **No Test Framework**: Testing infrastructure not yet configured

### Development Notes

- The app uses TON mainnet endpoint: `https://toncenter.com/api/v2/jsonRPC`
- TonClient instances are created via `getTonClient()` utility which includes API key if available
- Omniston WebSocket endpoint: `wss://omni-ws.ston.fi`
- Wallet creation and signing handled entirely through Privy
- Swap functionality supports multiple DEXes via Omniston protocol
- UI includes proper loading states, error handling, and trade tracking
- Wallet displays all tokens with non-zero balances using Jetton contracts
- Responsive design with blue/indigo theme matching Omniston Quickstart Guide


# Omniston Quickstart Guide


> **Note for the agent**: When following this guide, skip running the dev server (`pnpm dev`). Instead, verify the project's correctness by checking for type errors using `pnpm build`.

This guide will walk you through creating a basic token swap app using the **Omniston** protocol to swap assets across different DEXes (STON.fi V1, STON.fi V2, DeDust, etc.). We'll integrate wallet connectivity with **TonConnect** (via `@tonconnect/ui-react`) to allow users to connect their TON wallet and perform a swap. The guide is beginner-friendly and assumes minimal React experience.

> **Note**: In this demo, we will leverage **Tailwind CSS** for styling instead of using custom CSS. The setup for Tailwind CSS is already included in the instructions below, so you don't need to set it up separately.

> **Note**: You can use any package manager (npm, yarn, pnpm, or bun) to set up your React project. In this tutorial, we'll demonstrate with **pnpm**.

---

## Table of Contents

1. [Introduction](omniston.md#id-1.-introduction)
2. [Setting Up the Project](omniston.md#id-2.-setting-up-the-project)
   1. [Create a React App](omniston.md#id-2.1-create-a-react-app)
   2. [Installing the Required Packages](omniston.md#id-2.2-installing-the-required-packages)
3. [Connecting the Wallet](omniston.md#id-3.-connecting-the-wallet)
   1. [Add nessary providers](omniston.md#id-3.1-add-nessary-providers)
   2. [Create the TonConnect Manifest](omniston.md#id-3.2-create-the-tonconnect-manifest)
   3. [Add the Connect Wallet Button](omniston.md#id-3.3-add-the-connect-wallet-button)
4. [Fetching Available Assets](omniston.md#id-4.-fetching-available-assets)
5. [Requesting a Quote](omniston.md#id-5.-requesting-a-quote)
6. [Building a Transaction](omniston.md#id-6.-building-a-transaction)
7. [Tracking Your Trade](omniston.md#id-7.-tracking-your-trade)
   1. [Install the TON Package](omniston.md#id-7.1-install-the-ton-package)
   2. [Using the useTrackTrade Hook](omniston.md#id-7.2-using-the-usetracktrade-hook)
8. [Testing Your Swap](omniston.md#id-8.-testing-your-swap)
9. [Conclusion](omniston.md#id-9.-conclusion)
10. [Live Demo](omniston.md#id-10.-live-demo)
11. [Advanced Example App](omniston.md#id-11.-advanced-example-app)

---

## 1. Introduction

In this quickstart, we will build a minimal React app to:

- Connect to a TON wallet (via **TonConnect UI**).
- Fetch available tokens from STON.fi and display them in dropdowns.
- Request a quote (RFQ) from Omniston for the best swap route (no separate "Simulate" step needed; Omniston fetches quotes automatically).
- Build and execute a swap transaction across multiple DEXes.
- Track the trade status until completion.

We will use:

- **`@ston-fi/omniston-sdk-react`** – React hooks to interact with Omniston (request quotes, track trades, etc.).
- **`@ston-fi/api`** – Fetch token lists from STON.fi (and potentially other data).
- **`@tonconnect/ui-react`** – Provides a React-based TON wallet connect button and utilities.
- **`@ton/core`** – TON low-level library used for advanced functionality.

---

## 2. Setting Up the Project

### 2.1 Create a React App

First, let's check if pnpm is installed on your system:

```bash
pnpm --version
```

If you see a version number (like `10.4.0`), pnpm is installed. If you get an error, you'll need to install pnpm first:

```bash
npm install -g pnpm
```

Now we'll create a new React project using **Vite**. However, you can use any React setup you prefer (Next.js, CRA, etc.).

Run the following command to create a new Vite-based React project:

```bash
pnpm create vite --template react-ts
```

When prompted, type your desired project name (e.g., omniston-swap-app):

```
Project name: » omniston-swap-app
```

Then enter the folder:

```bash
cd omniston-swap-app
```

***

### 2.2 Installing the Required Packages

Within your new React project directory, install the Omniston SDK, TonConnect UI, the TON core library, and STON.fi API library:

```bash
pnpm add @ston-fi/omniston-sdk-react @tonconnect/ui-react @ton/core @ston-fi/api
```

Next, install Tailwind CSS and its Vite plugin:

```bash
pnpm add tailwindcss @tailwindcss/vite
```

Additionally, install the Node.js polyfills plugin for Vite, which is necessary to provide Buffer and other Node.js APIs in the browser environment (required by TON libraries):

```bash
pnpm add vite-plugin-node-polyfills
```

Configure the Vite plugin by updating `vite.config.js` file:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills()],
})
```

Then, import Tailwind CSS in your main CSS file. Open `src/index.css` and replace any existing code with:

```css
@import "tailwindcss";
```

You can also remove `src/App.css` (we don't need it), and remove the import statement `import './App.css'` from `src/App.tsx`.

After making these changes, you can verify that your app still runs correctly by starting the development server:

```bash
pnpm install
pnpm dev
```

This should launch your app in development mode, typically at `http://localhost:5173`. You should see the Vite + React logo and text on a plain white background. Since we've removed the default styling (App.css), the page will look simpler than the default template.

If you see the logo and text, it means your Vite + React setup is working correctly. Make sure everything loads without errors before proceeding to the next step.

***

## 3. Connecting the Wallet

### 3.1 Add nessary providers

Open **src/main.tsx** (Vite's default entry point) and wrap your application with both the `TonConnectUIProvider` and `OmnistonProvider`. The `TonConnectUIProvider` makes the TonConnect context available to your app for wallet connectivity, while the `OmnistonProvider` enables Omniston's functionality throughout your application. Also, point the TonConnect provider to a manifest file (which we will create next) that describes your app to wallets.

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { Omniston, OmnistonProvider } from '@ston-fi/omniston-sdk-react';
import './index.css'
import App from './App.tsx'

const omniston = new Omniston({ apiUrl: "wss://omni-ws.ston.fi" });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TonConnectUIProvider 
      // For demo purposes, we're using a static manifest URL
      // Replace with your own: manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}
      manifestUrl="https://gist.githubusercontent.com/mrruby/243180339f492a052aefc7a666cb14ee/raw/">
      <OmnistonProvider omniston={omniston}>
        <App />
      </OmnistonProvider>
    </TonConnectUIProvider>
  </StrictMode>,
)
```

***

### 3.2 Create the TonConnect Manifest

In the **public** folder of your project, create a file named **tonconnect-manifest.json**. This manifest provides wallet apps with information about your application (like name and icon). You should customize this manifest for your own application. Here's an example:

```json
{
  "url": "https://omniston-demo.example.com",
  "name": "Omniston Swap Demo",
  "iconUrl": "https://omniston-demo.example.com/icon-192x192.png"
}
```

Make sure to update these fields for your application:
* **url**: The base URL where your app is served
* **name**: Your application's display name (this is what wallets will show to users)
* **iconUrl**: A link to your app's icon (should be a 180×180 PNG image)

Make sure this file is accessible. When the dev server runs, you should be able to fetch it in your browser at `http://localhost:5173/tonconnect-manifest.json`.

***

### 3.3 Add the Connect Wallet Button

In your main **App** component (e.g., **src/App.tsx**), import and include the `TonConnectButton`. For example:

```tsx
// src/App.tsx
import { TonConnectButton } from '@tonconnect/ui-react';

function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Omniston Swap Demo</h1>
      <TonConnectButton />
    </div>
  );
}

export default App;
```

***

## 4. Fetching Available Assets

Next, let's dynamically retrieve the list of tokens (assets) that can be swapped on STON.fi. We use the STON.fi API client (`@ston-fi/api`) for this. Here's a simplified example that filters assets by liquidity (high to medium). We'll store them in state and present them in From/To dropdowns.

First, add the necessary imports to what we have in `src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { StonApiClient, AssetTag, type AssetInfoV2 } from '@ston-fi/api';
```

Initialize the state variables in your App component:

```tsx
function App() {
  const [assets, setAssets] = useState<AssetInfoV2[]>([]);
  const [fromAsset, setFromAsset] = useState<AssetInfoV2 | undefined>();
  const [toAsset, setToAsset] = useState<AssetInfoV2 | undefined>();
  const [amount, setAmount] = useState('');
```

Add the asset fetching logic with useEffect:

```tsx
  // fetch assets on mount
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const client = new StonApiClient();
        // Filter out top liquidity tokens for brevity
        const condition = [
          AssetTag.LiquidityVeryHigh,
          AssetTag.LiquidityHigh,
          AssetTag.LiquidityMedium
        ].join(' | ');
        const assetList = await client.queryAssets({ condition });

        setAssets(assetList);
        if (assetList.length > 0) {
          setFromAsset(assetList[0]);
        }
        if (assetList.length > 1) {
          setToAsset(assetList[1]);
        }
      } catch (err) {
        console.error('Failed to fetch assets:', err);
      }
    };
    fetchAssets();
  }, []);
```

Create the main UI structure:

```tsx
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-indigo-700">Omniston Swap</h1>
          <TonConnectButton />
        </div>

        <div className="h-px bg-gray-200 w-full my-4"></div>
```

Add the token selection dropdowns:

```tsx
        {assets.length > 0 ? (
          <div className="space-y-6">
            {/* From */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-600 mb-1">
                From
              </label>
              <select
                value={fromAsset?.contractAddress || ''}
                onChange={(e) => {
                  const selected = assets.find(a => a.contractAddress === e.target.value);
                  setFromAsset(selected);
                }}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                {assets.map(asset => (
                  <option
                    key={asset.contractAddress}
                    value={asset.contractAddress}
                  >
                    {asset.meta?.symbol || asset.meta?.displayName || 'token'}
                  </option>
                ))}
              </select>
            </div>

            {/* To */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-600 mb-1">
                To
              </label>
              <select
                value={toAsset?.contractAddress || ''}
                onChange={(e) => {
                  const selected = assets.find(a => a.contractAddress === e.target.value);
                  setToAsset(selected);
                }}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              >
                {assets.map(asset => (
                  <option
                    key={asset.contractAddress}
                    value={asset.contractAddress}
                  >
                    {asset.meta?.symbol || asset.meta?.displayName || 'token'}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-600 mb-1">
                Amount
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
```

Add the loading state and close the component:

```tsx
        ) : (
          <div className="flex justify-center items-center py-10">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
              <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
              <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
            </div>
            <p className="ml-3 text-gray-600">Loading assets...</p>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-gray-500">
        Powered by Ston.fi
      </div>
    </div>
  );
}

export default App;
```

***

## 5. Requesting a Quote

We'll use the `useRfq` hook from `@ston-fi/omniston-sdk-react` to request a quote. It will fetch quotes automatically based on the parameters given.

Add additional imports to the top of the file:

```typescript
import { useRfq, SettlementMethod, Blockchain, GaslessSettlement } from "@ston-fi/omniston-sdk-react";
```

Add utility functions for converting token amounts:

```typescript
// Convert floating point string amount into integer base units string
// Essential for blockchain transactions which use integer arithmetic
function toBaseUnits(amount: string, decimals?: number) {
  return Math.floor(parseFloat(amount) * 10 ** (decimals ?? 9)).toString();
}

// Convert integer base units back to a fixed 2-decimal string for display
function fromBaseUnits(baseUnits: string, decimals?: number) {
  return (parseInt(baseUnits) / 10 ** (decimals ?? 9)).toFixed(2);
}
```


Set up the `useRfq` hook to automatically fetch quotes:

```tsx
function App() {
  ...
  const { data: quote, isLoading: quoteLoading, error: quoteError } = useRfq({
    settlementMethods: [SettlementMethod.SETTLEMENT_METHOD_SWAP],
    bidAssetAddress: fromAsset
      ? { blockchain: Blockchain.TON, address: fromAsset.contractAddress }
      : undefined,
    askAssetAddress: toAsset
      ? { blockchain: Blockchain.TON, address: toAsset.contractAddress }
      : undefined,
    amount: {
      bidUnits: fromAsset ? toBaseUnits(amount, fromAsset.meta?.decimals) : '0'
    },
    settlementParams: {
      gaslessSettlement: GaslessSettlement.GASLESS_SETTLEMENT_POSSIBLE,
      maxPriceSlippageBps: 500,
    },
  }, {
    enabled: !!fromAsset?.contractAddress && !!toAsset?.contractAddress && amount !== ''
  });
```

Add the quote display section to your tsx (insert after the amount input field):

```tsx
            {/* Quote section */}
            <div className="pt-4">
              {quoteLoading && <p>Loading quote...</p>}
              {quoteError && <p className="text-red-500">Error: {String(quoteError)}</p>}
              {quote && 'quote' in quote && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="font-semibold text-gray-700">Quote Info</p>
                  <p className="text-sm text-gray-600">Resolver: {quote.quote.resolverName}</p>
                  <p className="text-sm text-gray-600">Bid Units: {fromBaseUnits(quote.quote.bidUnits, fromAsset?.meta?.decimals)}  {fromAsset?.meta?.symbol}</p>
                  <p className="text-sm text-gray-600">Ask Units: {fromBaseUnits(quote.quote.askUnits, toAsset?.meta?.decimals)} {toAsset?.meta?.symbol}</p>
                </div>
              )}
            </div>
```

Any time the user changes the token or amount, `useRfq` automatically refreshes the quote.

***

## 6. Building a Transaction and Sending It

Once we have a quote, we can build the transaction that will execute the swap. We'll use the `useOmniston` hook to access the Omniston instance and build the transaction.

Replace imports for `@tonconnect/ui-react` and `@ston-fi/omniston-sdk-react` with:

```tsx
import { TonConnectButton, useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import {
  useRfq,
  SettlementMethod,
  Blockchain,
  GaslessSettlement,
  useOmniston,
  type QuoteResponseEvent_QuoteUpdated,
} from "@ston-fi/omniston-sdk-react";
```

Add wallet connection hooks and omniston instance:

```tsx
function App() {  
  // ... existing state variables ...
  const walletAddress = useTonAddress();
  const [tonConnect] = useTonConnectUI();
  const omniston = useOmniston();
```

Create the transaction building function:

```tsx
  // ... after useRfq hook ...
  async function buildTx(willTradedQuote: QuoteResponseEvent_QuoteUpdated | undefined) {
    if (!willTradedQuote || !walletAddress) {
      alert("Please connect your wallet and ensure a valid quote is loaded.");
      return null;
    }

    try {
      const tx = await omniston.buildTransfer({
        quote: willTradedQuote.quote,
        sourceAddress: {
          blockchain: Blockchain.TON,
          address: walletAddress, // the wallet sending the offer token
        },
        destinationAddress: {
          blockchain: Blockchain.TON,
          address: walletAddress, // the same wallet receiving the ask token
        },
        gasExcessAddress: {
          blockchain: Blockchain.TON,
          address: walletAddress, // excess gas returns to sender
        },
        useRecommendedSlippage: false, // Use recommended slippage from the quote
      });

      return tx.ton?.messages || [];
    } catch (err) {
      console.error("Error building transaction:", err);
      alert("Failed to build transaction. Check console for details.");
      return null;
    }
  }
```

Add the swap execution function:

```tsx
  async function handleSwap() {
    if (!quote || quote.type !== 'quoteUpdated') {
      alert("No valid quote available");
      return;
    }
    const willTradedQuote = quote;
    const messages = await buildTx(willTradedQuote);
    if (!messages) return;
    
    try {
      await tonConnect.sendTransaction({
        validUntil: Date.now() + 1000000,
        messages: messages.map((message) => ({
          address: message.targetAddress,
          amount: message.sendAmount,
          payload: message.payload,
        })),
      });
    } catch (err) {
      console.error("Error sending transaction:", err);
      alert("Failed to send transaction. Check console for details.");
    }
  }
```

Add the Execute Swap button (insert after in quote section):

```tsx
        {quote && 'quote' in quote && (
        <>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="font-semibold text-gray-700">Quote Info</p>
            <p className="text-sm text-gray-600">Resolver: {quote.quote.resolverName}</p>
            <p className="text-sm text-gray-600">Bid Units: {fromBaseUnits(quote.quote.bidUnits, fromAsset?.meta?.decimals)}  {fromAsset?.meta?.symbol}</p>
            <p className="text-sm text-gray-600">Ask Units: {fromBaseUnits(quote.quote.askUnits, toAsset?.meta?.decimals)} {toAsset?.meta?.symbol}</p>
          </div>
          <button
            onClick={handleSwap}
            className="mt-4 w-full bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-3 px-4 rounded-lg transition-all"
          >
            Execute Swap
          </button>
        </>
      )}
```

***

## 7. Tracking Your Trade

### 7.1 Install the TON Package

We'll track trades using the `useTrackTrade` hook from `@ston-fi/omniston-sdk-react`. First, ensure you have the `@ton/ton` package installed if you haven't already:

```bash
pnpm add @ton/ton
```

### 7.2 Using the useTrackTrade Hook

After you've built and sent the swap transaction, you can track its status with `useTrackTrade`. This hook takes the `quoteId` of the trade, your wallet address, and the outgoing transaction hash. It periodically checks the trade's on-chain status, letting you know if it's pending, settled, or partially filled.

Replace imports for `@ton/ton` and `@ston-fi/omniston-sdk-react` for trade tracking:

```tsx
import {
  useRfq,
  SettlementMethod,
  Blockchain,
  GaslessSettlement,
  useOmniston,
  useTrackTrade,
  type QuoteResponseEvent_QuoteUpdated,
  type TradeStatus,
} from "@ston-fi/omniston-sdk-react";
import { TonClient, Address, Cell, beginCell, storeMessage } from "@ton/ton";
```

Add state variables for tracking:

```tsx
function App() {
  // ... existing state variables ...
  const [outgoingTxHash, setOutgoingTxHash] = useState("");
  const [tradedQuote, setTradedQuote] = useState<QuoteResponseEvent_QuoteUpdated | null>(null);
```

Reset tracking state when inputs change:

```tsx
  // Reset outgoingTxHash and tradedQuote when inputs change
  useEffect(() => {
    setTradedQuote(null);
    setOutgoingTxHash("");
  }, [fromAsset, toAsset, amount]);
```

Update the useRfq hook to stop fetching quotes during trade execution:

```tsx
  const {
    data: quote,
    isLoading: quoteLoading,
    error: quoteError,
  } = useRfq({
    // ... existing useRfq configuration ...
  }, {
    enabled:
      !!fromAsset?.contractAddress &&
      !!toAsset?.contractAddress &&
      amount !== "" &&
      // add this to stop getting new quotes when we make a transaction
      !outgoingTxHash,
  });
```

Set up the trade tracking hook:

```tsx
  const {
    isLoading: trackingLoading,
    error: trackingError,
    data: tradeStatus,
  } = useTrackTrade({
    quoteId: tradedQuote?.quote?.quoteId || '',
    traderWalletAddress: {
      blockchain: Blockchain.TON,
      address: walletAddress || '',
    },
    outgoingTxHash,
  }, {
    enabled: !!tradedQuote?.quote?.quoteId && !!walletAddress && !!outgoingTxHash,
  });
```

Add helper function to translate trade results:

```tsx
  // Function to translate trade result to human-readable text
const getTradeResultText = (status: TradeStatus) => {
    if (!status?.status?.tradeSettled) return "";
    
    const result = status.status.tradeSettled.result;
    switch (result) {
      case "TRADE_RESULT_FULLY_FILLED":
        return "Trade completed successfully and fully filled";
      case "TRADE_RESULT_PARTIALLY_FILLED":
        return "Trade partially filled - something went wrong";
      case "TRADE_RESULT_ABORTED":
        return "Trade was aborted";
      case "TRADE_RESULT_UNKNOWN":
      case "UNRECOGNIZED":
      default:
        return "Unknown trade result";
    }
  };
```

Add utility functions for transaction hash extraction:

```tsx
    // Utility function to retry an async operation
    const retry = async (fn: () => Promise<string>, { retries = 5, delay = 1000 }): Promise<string> => {
      try {
        return await fn();
      } catch (error) {
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, { retries: retries - 1, delay });
      }
    };

    const getTxByBOC = async (exBoc: string, walletAddress: string): Promise<string> => {
      if (!exBoc || !walletAddress) {
        throw new Error('Missing required parameters for transaction tracking');
      }
  
      const client = new TonClient({
        endpoint: 'https://toncenter.com/api/v2/jsonRPC'
      });
  
      const myAddress = Address.parse(walletAddress);
  
      return retry(async () => {
        const transactions = await client.getTransactions(myAddress, {
          limit: 5,
        });
  
        for (const tx of transactions) {
          const inMsg = tx.inMessage;
          if (inMsg?.info.type === 'external-in') {
            const inBOC = inMsg?.body;
            if (typeof inBOC === 'undefined') {
              continue;
            }
  
            const extHash = Cell.fromBase64(exBoc).hash().toString('hex');
            const inHash = beginCell().store(storeMessage(inMsg)).endCell().hash().toString('hex');
  
            if (extHash === inHash) {
              return tx.hash().toString('hex');
            }
          }
        }
        throw new Error('Transaction not found');
      }, { retries: 30, delay: 1000 });
    }; 
```

Update the handleSwap function to capture transaction details:

```tsx
 async function handleSwap() {
    if (!quote || quote.type !== 'quoteUpdated') {
      alert("No valid quote available");
      return;
    }
    const messages = await buildTx(quote);
    if (!messages) return;
    
    try {
      setTradedQuote(quote);

      const res = await tonConnect.sendTransaction({
        validUntil: Date.now() + 1000000,
        messages: messages.map((message) => ({
          address: message.targetAddress,
          amount: message.sendAmount,
          payload: message.payload,
        })),
      });

      const exBoc = res.boc;
      const txHash = await getTxByBOC(exBoc, walletAddress);
      setOutgoingTxHash(txHash);

    } catch (err) {
      setTradedQuote(null);
      console.error("Error sending transaction:", err);
      alert("Failed to send transaction. Check console for details.");
    }
  }
```

Add the trade status display (insert after the divider line):

```tsx
        {/* Trade status */}
        {/* right after <div className="h-px bg-gray-200 w-full my-4"></div> */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          {trackingLoading && <p className="text-sm text-blue-600">Tracking trade...</p>}
          {trackingError && (
            <p className="text-sm text-orange-600">Trade tracking error: {String(trackingError)}</p>
          )}
          {tradeStatus?.status?.tradeSettled && (
            <p className="text-sm text-green-600">
              Trade Result: {getTradeResultText(tradeStatus)}
            </p>
          )}
        </div>
```

Update the error display in the quote section

```tsx
        {quoteError && !outgoingTxHash && <p className="text-red-500">Error: {String(quoteError)}</p>}
```

***

## 8. Testing Your Swap

1. Start the development server:

```bash
pnpm dev
```

2. Open your app in the browser at `http://localhost:5173`.
3. Connect your TON wallet via the "Connect Wallet" button.
4. Select tokens from the dropdowns and enter an amount.
5. Omniston automatically fetches and displays a quote. Confirm it's valid.
6. Click "Execute Swap" to finalize the transaction. Approve it in your wallet.
7. Once the swap completes on-chain, your wallet balances should update accordingly.

***

## 9. Conclusion

Congratulations! You've built a minimal React + Vite app with Tailwind CSS that:
- Connects to a TON wallet using TonConnect.
- Dynamically fetches available tokens from STON.fi.
- Requests real-time quotes (RFQs) from Omniston automatically.
- Builds and sends swap transactions.

Feel free to expand this demo with:
- Custom slippage settings.
- Better error-handling and success notifications.
- Additional settlement methods or cross-chain logic.
- Learn how to add referral fees to your Omniston swaps by reading the [Referral Fees guide](../omniston/omniston-referral-fees.md).

Happy building with Omniston! 

## 10. Live Demo

With this Replit demo, you can:
- Open the project directly in your browser
- Fork the Replit to make your own copy
- Run the application to see it in action
- Explore and modify the code to learn how it works
- Experiment with different features and UI changes

{% embed url="https://replit.com/@stonfi/omniston-swap-app?embed=true" %}

Alternatively, you can run this example locally by cloning the GitHub repository:

```bash
git clone https://github.com/mrruby/omniston-swap-app.git
cd omniston-swap-app
pnpm install
pnpm dev
```

This will start the development server and you can access the app at `http://localhost:5173`.

## 11. Advanced Example App

For those seeking a feature-rich, more advanced approach, we also have a Next.js Omniston Demo App that:
- Uses Next.js for a scalable framework  
- Utilizes hooks and providers for an elegant architecture  
- Demonstrates better error handling, robust state management, and additional STON.fi and Omniston features

You can explore the code in our repository:

[Omniston SDK Next.js Demo App](https://github.com/ston-fi/omniston-sdk/tree/main/examples/next-js-app)

Or see it in action at our live demo:

[Omniston Demo App](https://omniston.ston.fi/)