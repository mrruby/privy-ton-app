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

This is a React-based web application that integrates Privy authentication with TON blockchain functionality. The application demonstrates:

1. **Email-based authentication** using Privy SDK
2. **TON wallet creation** from user credentials
3. **Blockchain interactions** via TON Client

### Key Components

- **Entry Point**: `src/main.jsx` wraps the app in PrivyProvider with email-only authentication
- **Main Component**: `src/App.jsx` handles authentication flow, wallet creation, and balance checking
- **Environment**: Requires `VITE_PRIVY_APP_ID` in `.env` file

### Technology Stack

- **Frontend**: React 19 with Vite bundler
- **Styling**: Tailwind CSS v4 with Vite plugin
- **Authentication**: @privy-io/react-auth with extended chains
- **Blockchain**: @ton/core, @ton/crypto, @ton/ton packages
- **Polyfills**: Node.js polyfills configured for browser compatibility (required for TON libraries)

### Important Configuration

1. **Vite Config**: Includes node polyfills plugin for blockchain libraries and Tailwind CSS plugin
2. **Tailwind CSS**: Using v4 with @tailwindcss/vite plugin, imported via `@import "tailwindcss"`
3. **ESLint**: Modern flat config with React-specific rules
4. **No TypeScript**: Pure JavaScript implementation
5. **No Test Framework**: Testing infrastructure not yet configured

### Development Notes

- The app uses TON mainnet endpoint: `https://mainnet-v4.tonhubapi.com`
- Wallet creation derives from Privy user UUID using TON mnemonics
- UI includes proper loading states and error handling
- Responsive design with dark/light theme support