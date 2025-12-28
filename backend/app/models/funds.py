"""Models for external account connections and balance snapshots"""
from datetime import datetime, timezone
from typing import Optional
import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from app.database import Base


class Institution(str, enum.Enum):
    """Supported financial institutions"""
    WEALTHSIMPLE = "wealthsimple"
    REVOLUT = "revolut"
    IBKR = "ibkr"
    TD = "td"


class ConnectionStatus(str, enum.Enum):
    """High-level connection state"""
    CONNECTED = "connected"
    REQUIRES_ACTION = "requires_action"
    ERROR = "error"
    DISCONNECTED = "disconnected"


class AccountConnection(Base):
    """Represents a linked external account"""
    __tablename__ = "account_connections"

    id = Column(Integer, primary_key=True, index=True)
    institution = Column(Enum(Institution), nullable=False)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(100))
    currency = Column(String(10), default="CAD")
    mask = Column(String(10))
    external_id = Column(String(255), nullable=True)
    status = Column(Enum(ConnectionStatus), default=ConnectionStatus.CONNECTED)
    last_synced_at = Column(DateTime(timezone=True))
    connection_metadata = Column(JSON)

    balance_snapshots = relationship(
        "AccountBalanceSnapshot",
        back_populates="account",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<AccountConnection(id={self.id}, institution={self.institution}, account_name={self.account_name})>"


class AccountBalanceSnapshot(Base):
    """Point-in-time balance for an external account"""
    __tablename__ = "account_balance_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("account_connections.id"), nullable=False)
    as_of = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    current_balance = Column(Float, nullable=False)
    available_balance = Column(Float)
    holdings_value = Column(Float)
    currency = Column(String(10), nullable=False)
    raw_response = Column(JSON)

    account = relationship("AccountConnection", back_populates="balance_snapshots")

    def __repr__(self):
        return f"<AccountBalanceSnapshot(account_id={self.account_id}, as_of={self.as_of}, balance={self.current_balance})>"
