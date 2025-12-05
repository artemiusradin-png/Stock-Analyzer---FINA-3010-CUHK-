# IBKR Python Bridge Setup Guide

## Prerequisites

### 1. Install TWS or IB Gateway

You need to have either **Trader Workstation (TWS)** or **IB Gateway** installed and running:

- **TWS**: Full-featured trading platform
- **IB Gateway**: Lightweight API-only interface (recommended for automated trading)

Download from: https://www.interactivebrokers.com/en/trading/tws.php

### 2. Python Package Installation

The required package is already installed:
```bash
pip3 install ib_insync
```

## Setup Steps

### Step 1: Configure TWS/IB Gateway

1. **Start TWS or IB Gateway**
2. **Enable API Connections**:
   - Go to `Configure` → `Settings` → `API` → `Settings`
   - Check "Enable ActiveX and Socket Clients"
   - Check "Download open orders on connection"
   - Set Socket port to `7497` (TWS live) or `7496` (TWS paper trading)
   - For IB Gateway: use ports `4002` (live) or `4001` (paper)
   - Add your IP address to "Trusted IPs" (use `127.0.0.1` for local connections)

### Step 2: Connection Ports

| Application | Environment | Port |
|-------------|-------------|------|
| TWS | Live Trading | 7497 |
| TWS | Paper Trading | 7496 |
| IB Gateway | Live Trading | 4002 |
| IB Gateway | Paper Trading | 4001 |

### Step 3: Run the Connection Script

```bash
python3 backend/dcf_service/clients/ibkr_connection.py
```

## Common Issues and Solutions

### 1. Connection Refused
- Ensure TWS/IB Gateway is running
- Check that API is enabled in settings
- Verify the correct port is being used

### 2. Authentication Issues
- Make sure you're logged into TWS/IB Gateway
- Check that your account has API access enabled

### 3. Paper Trading Setup
- Use port 7496 for TWS paper trading
- Use port 4001 for IB Gateway paper trading
- Ensure you're connected to the paper trading environment

## Testing the Connection

The `ibkr_connection.py` script will:
1. Connect to IBKR
2. Display account summary
3. Show current positions
4. Get market data for AAPL
5. Disconnect gracefully

## Next Steps

Once connected, you can:
- Place orders
- Get real-time market data
- Retrieve historical data
- Monitor positions and P&L
- Execute automated trading strategies

## Security Notes

- Never hardcode account credentials in your scripts
- Use paper trading for testing
- Always test strategies thoroughly before live trading
- Keep your API access secure
