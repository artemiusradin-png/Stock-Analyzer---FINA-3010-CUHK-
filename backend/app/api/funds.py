"""Endpoints for unified funds and account balances"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel
import random

from app.database import get_db
from app.schemas.funds import AccountBalance, AccountWithBalance, FundsSummary, FundsSummaryRequest
from app.services.funds_sync_service import FundsSyncService

router = APIRouter()


# ============================================
# ADDITIONAL SCHEMAS FOR MY FUNDS PAGE
# ============================================

class InstitutionBalance(BaseModel):
    """Institution-specific balance response"""
    balance: float
    accounts: Dict[str, float]
    lastUpdated: str
    change: float
    changePercent: float


class Transaction(BaseModel):
    """Transaction model"""
    id: str
    description: str
    account: str
    date: str
    amount: float
    type: str


def _serialize_summary(summary: dict) -> FundsSummary:
    """Convert service summary objects into API-friendly schema"""
    accounts_payload = []
    for item in summary["accounts"]:
        account = item["account"]
        snapshot = item["latest_snapshot"]

        latest_balance = None
        if snapshot:
            latest_balance = AccountBalance(
                account_id=account.id,
                as_of=snapshot.as_of,
                current_balance=snapshot.current_balance,
                available_balance=snapshot.available_balance,
                holdings_value=snapshot.holdings_value,
                currency=snapshot.currency,
            )

        accounts_payload.append(
            AccountWithBalance(
                id=account.id,
                institution=account.institution,
                account_name=account.account_name,
                account_type=account.account_type,
                currency=account.currency,
                mask=account.mask,
                status=account.status,
                last_synced_at=account.last_synced_at,
                latest_balance=latest_balance,
            )
        )

    return FundsSummary(
        totals_by_currency=summary["totals_by_currency"],
        last_synced_at=summary["last_synced_at"],
        accounts=accounts_payload,
        fx_base_currency=summary.get("fx_base_currency"),
        fx_converted_total=summary.get("fx_converted_total"),
    )


@router.get("/summary", response_model=FundsSummary)
def get_funds_summary(db: Session = Depends(get_db)):
    """Return latest balances and totals by currency"""
    service = FundsSyncService(db)
    summary = service.summarize()
    return _serialize_summary(summary)


@router.post("/summary-fx", response_model=FundsSummary)
def get_funds_summary_with_fx(request: FundsSummaryRequest, db: Session = Depends(get_db)):
    """
    Return balances with optional FX conversion.
    Pass fx_rates as a dict of currency->rate to convert into fx_base_currency.
    """
    service = FundsSyncService(db)
    summary = service.summarize(
        fx_base_currency=request.fx_base_currency,
        fx_rates=request.fx_rates
    )
    return _serialize_summary(summary)


@router.post("/refresh", response_model=FundsSummary)
def refresh_funds(db: Session = Depends(get_db)):
    """Trigger balance refresh across connectors then return updated summary"""
    service = FundsSyncService(db)
    try:
        service.refresh_all()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to refresh balances: {exc}") from exc
    summary = service.summarize()
    return _serialize_summary(summary)


@router.get("/accounts", response_model=FundsSummary)
def list_accounts(db: Session = Depends(get_db)):
    """Alias for summary; useful for My Funds page wiring"""
    service = FundsSyncService(db)
    summary = service.summarize()
    return _serialize_summary(summary)


# ============================================
# INSTITUTION-SPECIFIC ENDPOINTS (MOCK DATA)
# ============================================

def generate_institution_data(institution: str) -> InstitutionBalance:
    """
    Generate mock account data for demonstration
    In production, this would integrate with real financial APIs
    """
    mock_data = {
        "td": {
            "balance": 45280.50 + random.uniform(-1000, 1000),
            "accounts": {
                "chequing": 8450.25 + random.uniform(-500, 500),
                "savings": 15230.75 + random.uniform(-800, 800),
                "investments": 21599.50 + random.uniform(-1500, 1500)
            }
        },
        "wealthsimple": {
            "balance": 68920.75 + random.uniform(-2000, 2000),
            "accounts": {
                "tfsa": 32450.00 + random.uniform(-1000, 1000),
                "rrsp": 28470.50 + random.uniform(-800, 800),
                "personal": 8000.25 + random.uniform(-500, 500)
            }
        },
        "ib": {
            "balance": 125450.00 + random.uniform(-3000, 3000),
            "accounts": {
                "cash": 12340.00 + random.uniform(-1000, 1000),
                "stocks": 98760.00 + random.uniform(-2000, 2000),
                "options": 14350.00 + random.uniform(-500, 500)
            }
        },
        "revolut": {
            "balance": 15670.25 + random.uniform(-500, 500),
            "accounts": {
                "main": 8450.00 + random.uniform(-300, 300),
                "savings": 5220.25 + random.uniform(-200, 200),
                "crypto": 2000.00 + random.uniform(-100, 100)
            }
        }
    }

    if institution not in mock_data:
        raise HTTPException(status_code=404, detail=f"Institution '{institution}' not found")

    data = mock_data[institution]
    change_percent = random.uniform(-2.0, 2.0)
    change = data["balance"] * (change_percent / 100)

    return InstitutionBalance(
        balance=round(data["balance"], 2),
        accounts={k: round(v, 2) for k, v in data["accounts"].items()},
        lastUpdated=datetime.now().isoformat(),
        change=round(change, 2),
        changePercent=round(change_percent, 2)
    )


@router.get("/{institution}", response_model=InstitutionBalance)
async def get_institution_balance(institution: str):
    """
    Get account balance for a specific institution

    Supported institutions:
    - td: TD Bank
    - wealthsimple: Wealthsimple
    - ib: Interactive Brokers
    - revolut: Revolut
    """
    return generate_institution_data(institution)


@router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    limit: int = Query(10, ge=1, le=100, description="Number of transactions to return"),
    institution: Optional[str] = Query(None, description="Filter by institution")
):
    """
    Get recent transactions across all accounts

    Query parameters:
    - limit: Number of transactions to return (default: 10, max: 100)
    - institution: Filter by specific institution (optional)
    """
    transaction_templates = [
        {"desc": "AAPL Stock Purchase", "account": "Interactive Brokers", "type": "investment", "range": (-5000, -1000)},
        {"desc": "MSFT Stock Purchase", "account": "Interactive Brokers", "type": "investment", "range": (-4000, -1000)},
        {"desc": "VFV ETF Purchase", "account": "Wealthsimple", "type": "investment", "range": (-2000, -500)},
        {"desc": "TFSA Contribution", "account": "Wealthsimple", "type": "deposit", "range": (500, 2000)},
        {"desc": "RRSP Contribution", "account": "Wealthsimple", "type": "deposit", "range": (500, 3000)},
        {"desc": "Dividend Payment - TD", "account": "TD Investments", "type": "dividend", "range": (50, 300)},
        {"desc": "Dividend Payment - WS", "account": "Wealthsimple", "type": "dividend", "range": (50, 200)},
        {"desc": "Salary Deposit", "account": "TD Bank", "type": "deposit", "range": (2000, 5000)},
        {"desc": "Rent Payment", "account": "TD Bank", "type": "expense", "range": (-2000, -1000)},
        {"desc": "Grocery Store", "account": "Revolut", "type": "expense", "range": (-150, -20)},
        {"desc": "Restaurant", "account": "Revolut", "type": "expense", "range": (-100, -15)},
        {"desc": "Online Shopping", "account": "TD Bank", "type": "expense", "range": (-200, -30)},
        {"desc": "Crypto Purchase - BTC", "account": "Revolut", "type": "investment", "range": (-1000, -100)},
        {"desc": "Transfer to Savings", "account": "TD Bank", "type": "transfer", "range": (-1000, -100)},
        {"desc": "ATM Withdrawal", "account": "Revolut", "type": "expense", "range": (-200, -20)},
    ]

    transactions = []
    for i in range(min(limit, len(transaction_templates))):
        template = random.choice(transaction_templates)
        hours_ago = random.uniform(0, 168)  # 7 days
        tx_date = datetime.now() - timedelta(hours=hours_ago)
        amount = random.uniform(template["range"][0], template["range"][1])

        transactions.append(Transaction(
            id=f"tx_{i+1}_{int(tx_date.timestamp())}",
            description=template["desc"],
            account=template["account"],
            date=tx_date.isoformat(),
            amount=round(amount, 2),
            type=template["type"]
        ))

    transactions.sort(key=lambda x: x.date, reverse=True)

    # Filter by institution if specified
    if institution:
        institution_map = {
            "td": "TD",
            "wealthsimple": "Wealthsimple",
            "ib": "Interactive Brokers",
            "revolut": "Revolut"
        }
        filter_name = institution_map.get(institution.lower())
        if filter_name:
            transactions = [tx for tx in transactions if filter_name in tx.account]

    return transactions[:limit]
