"""Schemas for unified funds/accounts view"""
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.funds import Institution, ConnectionStatus


class AccountBalance(BaseModel):
    """Latest balance snapshot for an account"""
    model_config = ConfigDict(from_attributes=True)

    account_id: int
    as_of: datetime
    current_balance: float
    available_balance: Optional[float] = None
    holdings_value: Optional[float] = None
    currency: str


class AccountWithBalance(BaseModel):
    """Account connection enriched with latest balance"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    institution: Institution
    account_name: str
    account_type: Optional[str] = None
    currency: str
    mask: Optional[str] = None
    status: ConnectionStatus
    last_synced_at: Optional[datetime] = None
    latest_balance: Optional[AccountBalance] = Field(
        default=None,
        description="Most recent balance snapshot for the account",
    )


class FundsSummary(BaseModel):
    """Aggregated balance view across all institutions"""
    totals_by_currency: Dict[str, float]
    last_synced_at: Optional[datetime]
    accounts: List[AccountWithBalance]
    fx_base_currency: Optional[str] = None
    fx_converted_total: Optional[float] = None


class FundsSummaryRequest(BaseModel):
    """Request body for FX-aware summary"""
    fx_base_currency: str = Field("USD", description="Target currency for conversion")
    fx_rates: Optional[Dict[str, float]] = Field(
        default=None,
        description="Map of currency code to rate in terms of target currency (e.g., CAD->USD rate)",
    )
