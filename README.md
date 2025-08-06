# Privy TON Test App

A test application demonstrating integration between Privy authentication and TON blockchain functionality. Built with React + Vite.

## Features

- Privy authentication integration
- TON blockchain connectivity
- React-based frontend with Vite for fast development
- Node.js polyfills for browser compatibility

## Prerequisites

- Node.js (v16 or higher)
- pnpm (v8 or higher)

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

## Tech Stack

- **Frontend Framework**: React 19
- **Build Tool**: Vite
- **Authentication**: Privy React Auth
- **Blockchain**: TON Core, TON Crypto
- **Package Manager**: pnpm

## Project Structure

```
privy-ton-app/
├── src/                # Source files
│   ├── App.jsx        # Main application component
│   ├── main.jsx       # Application entry point
│   └── assets/        # Static assets
├── public/            # Public static files
├── index.html         # HTML template
└── vite.config.js     # Vite configuration
```

## Configuration

The app uses Vite for bundling and development. Configuration can be found in `vite.config.js`.

## License

This is a test project for demonstration purposes.