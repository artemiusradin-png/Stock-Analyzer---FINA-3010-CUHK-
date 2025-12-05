#!/usr/bin/env python3
"""
Interactive Brokers (IBKR) Python Bridge Connection Script
This script demonstrates how to connect to IBKR TWS or IB Gateway using ib_insync
"""

import asyncio
from ib_insync import IB, Stock, util
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IBKRConnection:
    def __init__(self, host='127.0.0.1', port=7497, client_id=1):
        """
        Initialize IBKR connection
        
        Args:
            host (str): Host address (default: 127.0.0.1 for local)
            port (int): Port number (7497 for TWS live, 7496 for TWS paper trading, 4002 for IB Gateway live, 4001 for IB Gateway paper)
            client_id (int): Client ID (must be unique)
        """
        self.host = host
        self.port = port
        self.client_id = client_id
        self.ib = IB()
        
    async def connect(self):
        """Connect to IBKR TWS/Gateway"""
        try:
            logger.info(f"Connecting to IBKR at {self.host}:{self.port} with client ID {self.client_id}")
            await self.ib.connectAsync(self.host, self.port, clientId=self.client_id)
            logger.info("Successfully connected to IBKR!")
            
            # Get account summary
            account_summary = self.ib.accountSummary()
            logger.info(f"Account summary: {len(account_summary)} items found")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to IBKR: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from IBKR"""
        if self.ib.isConnected():
            self.ib.disconnect()
            logger.info("Disconnected from IBKR")
    
    async def get_account_info(self):
        """Get account information"""
        try:
            if not self.ib.isConnected():
                logger.error("Not connected to IBKR")
                return None
                
            # Get account summary
            account_summary = self.ib.accountSummary()
            logger.info("Account Summary:")
            for item in account_summary:
                logger.info(f"  {item.tag}: {item.value} {item.currency}")
                
            return account_summary
            
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            return None
    
    async def get_market_data(self, symbol, exchange='SMART'):
        """Get market data for a symbol"""
        try:
            if not self.ib.isConnected():
                logger.error("Not connected to IBKR")
                return None
                
            # Create contract
            contract = Stock(symbol, exchange, 'USD')
            
            # Qualify the contract
            qualified_contracts = await self.ib.qualifyContractsAsync(contract)
            if not qualified_contracts:
                logger.error(f"No qualified contracts found for {symbol}")
                return None
                
            contract = qualified_contracts[0]
            logger.info(f"Qualified contract: {contract}")
            
            # Request market data
            ticker = self.ib.reqMktData(contract, '', False, False)
            
            # Wait for data
            await asyncio.sleep(2)
            
            if ticker.last:
                logger.info(f"Last price for {symbol}: ${ticker.last}")
                logger.info(f"Bid: ${ticker.bid}, Ask: ${ticker.ask}")
                logger.info(f"Volume: {ticker.volume}")
                
            return ticker
            
        except Exception as e:
            logger.error(f"Error getting market data for {symbol}: {e}")
            return None
    
    async def get_positions(self):
        """Get current positions"""
        try:
            if not self.ib.isConnected():
                logger.error("Not connected to IBKR")
                return None
                
            positions = self.ib.positions()
            logger.info(f"Current positions: {len(positions)}")
            
            for position in positions:
                logger.info(f"  {position.contract.symbol}: {position.position} shares")
                
            return positions
            
        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return None

async def main():
    """Main function to demonstrate IBKR connection"""
    
    # Connection settings
    # For TWS: port 7497 (live), 7496 (paper)
    # For IB Gateway: port 4002 (live), 4001 (paper)
    
    ibkr = IBKRConnection(
        host='127.0.0.1',
        port=7497,  # Change to 7496 for paper trading
        client_id=1
    )
    
    try:
        # Connect to IBKR
        if await ibkr.connect():
            
            # Get account information
            await ibkr.get_account_info()
            
            # Get current positions
            await ibkr.get_positions()
            
            # Get market data for AAPL
            await ibkr.get_market_data('AAPL')
            
            # Keep connection alive for a bit
            await asyncio.sleep(5)
        
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        
    finally:
        # Disconnect
        await ibkr.disconnect()

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())
