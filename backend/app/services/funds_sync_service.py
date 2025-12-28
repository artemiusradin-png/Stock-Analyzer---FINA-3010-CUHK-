"""Service layer for syncing external account balances"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Protocol
from sqlalchemy.orm import Session

from app.models.funds import (
    AccountBalanceSnapshot,
    AccountConnection,
    ConnectionStatus,
    Institution,
)


@dataclass
class ExternalAccountBalance:
    """Normalized balance payload returned by connectors"""
    institution: Institution
    account_name: str
    account_type: Optional[str]
    currency: str
    current_balance: float
    available_balance: Optional[float]
    holdings_value: Optional[float]
    external_id: Optional[str]
    mask: Optional[str]
    as_of: datetime
    raw: Optional[Dict] = None


class InstitutionConnector(Protocol):
    """Connector interface for financial institutions"""
    institution: Institution

    def fetch_account_balances(self) -> List[ExternalAccountBalance]:
        """Return normalized balances for all accounts under this institution"""
        raise NotImplementedError


class WealthsimpleConnector:
    """Placeholder connector for Wealthsimple (Cash + TFSA)"""
    institution = Institution.WEALTHSIMPLE

    def fetch_account_balances(self) -> List[ExternalAccountBalance]:
        now = datetime.now(timezone.utc)
        return [
            ExternalAccountBalance(
                institution=self.institution,
                account_name="Wealthsimple Cash",
                account_type="cash",
                currency="CAD",
                current_balance=5200.15,
                available_balance=5200.15,
                holdings_value=None,
                external_id="ws_cash_1",
                mask="WS-001",
                as_of=now,
                raw={"source": "placeholder"},
            ),
            ExternalAccountBalance(
                institution=self.institution,
                account_name="Wealthsimple TFSA",
                account_type="tfsa",
                currency="CAD",
                current_balance=18450.42,
                available_balance=18450.42,
                holdings_value=18450.42,
                external_id="ws_tfsa_1",
                mask="WS-002",
                as_of=now,
                raw={"source": "placeholder"},
            ),
        ]


class RevolutConnector:
    """Placeholder connector for Revolut cash and brokerage accounts"""
    institution = Institution.REVOLUT

    def fetch_account_balances(self) -> List[ExternalAccountBalance]:
        now = datetime.now(timezone.utc)
        return [
            ExternalAccountBalance(
                institution=self.institution,
                account_name="Revolut Cash",
                account_type="cash",
                currency="CAD",
                current_balance=1230.75,
                available_balance=1230.75,
                holdings_value=None,
                external_id="rev_cash_1",
                mask="RV-001",
                as_of=now,
                raw={"source": "placeholder"},
            ),
            ExternalAccountBalance(
                institution=self.institution,
                account_name="Revolut Brokerage",
                account_type="brokerage",
                currency="USD",
                current_balance=7600.25,
                available_balance=7600.25,
                holdings_value=7600.25,
                external_id="rev_broker_1",
                mask="RV-002",
                as_of=now,
                raw={"source": "placeholder"},
            ),
        ]


class IBKRConnector:
    """Placeholder connector for IBKR brokerage"""
    institution = Institution.IBKR

    def fetch_account_balances(self) -> List[ExternalAccountBalance]:
        now = datetime.now(timezone.utc)
        return [
            ExternalAccountBalance(
                institution=self.institution,
                account_name="IBKR Main",
                account_type="brokerage",
                currency="USD",
                current_balance=25400.10,
                available_balance=25000.00,
                holdings_value=25400.10,
                external_id="ibkr_1",
                mask="IB-001",
                as_of=now,
                raw={"source": "placeholder"},
            )
        ]


class TDConnector:
    """Placeholder connector for TD chequing"""
    institution = Institution.TD

    def fetch_account_balances(self) -> List[ExternalAccountBalance]:
        now = datetime.now(timezone.utc)
        return [
            ExternalAccountBalance(
                institution=self.institution,
                account_name="TD Chequing",
                account_type="chequing",
                currency="CAD",
                current_balance=3200.55,
                available_balance=3200.55,
                holdings_value=None,
                external_id="td_1",
                mask="TD-001",
                as_of=now,
                raw={"source": "placeholder"},
            )
        ]


class FundsSyncService:
    """Syncs external balances and persists snapshots"""

    def __init__(self, db: Session, connectors: Optional[List[InstitutionConnector]] = None):
        self.db = db
        self.connectors = connectors or [
            WealthsimpleConnector(),
            RevolutConnector(),
            IBKRConnector(),
            TDConnector(),
        ]

    def refresh_all(self) -> List[AccountBalanceSnapshot]:
        """Pull balances from all connectors and store snapshots"""
        snapshots: List[AccountBalanceSnapshot] = []

        for connector in self.connectors:
            balances = connector.fetch_account_balances()
            for balance in balances:
                account = self._get_or_create_account(balance)
                snapshot = AccountBalanceSnapshot(
                    account_id=account.id,
                    as_of=balance.as_of,
                    current_balance=balance.current_balance,
                    available_balance=balance.available_balance,
                    holdings_value=balance.holdings_value,
                    currency=balance.currency,
                    raw_response=balance.raw,
                )
                account.last_synced_at = balance.as_of
                account.status = ConnectionStatus.CONNECTED

                self.db.add(snapshot)
                snapshots.append(snapshot)

        self.db.commit()

        for snapshot in snapshots:
            self.db.refresh(snapshot)
        return snapshots

    def get_accounts_with_latest(self) -> List[Dict]:
        """Return accounts with most recent snapshot attached"""
        accounts = self.db.query(AccountConnection).all()
        results: List[Dict] = []
        for account in accounts:
            latest_snapshot = (
                self.db.query(AccountBalanceSnapshot)
                .filter(AccountBalanceSnapshot.account_id == account.id)
                .order_by(AccountBalanceSnapshot.as_of.desc())
                .first()
            )
            results.append({"account": account, "latest_snapshot": latest_snapshot})
        return results

    def summarize(self, fx_base_currency: Optional[str] = None, fx_rates: Optional[Dict[str, float]] = None) -> Dict:
        """Build summary payload with totals by currency and optional FX-converted total"""
        accounts = self.get_accounts_with_latest()
        totals_by_currency: Dict[str, float] = {}
        last_synced_at: Optional[datetime] = None
        fx_converted_total: Optional[float] = None

        for item in accounts:
            snapshot = item["latest_snapshot"]
            if snapshot:
                totals_by_currency[snapshot.currency] = totals_by_currency.get(snapshot.currency, 0.0) + snapshot.current_balance
                if last_synced_at is None or snapshot.as_of > last_synced_at:
                    last_synced_at = snapshot.as_of

        if fx_base_currency and fx_rates:
            fx_converted_total = 0.0
            for currency, total in totals_by_currency.items():
                if currency == fx_base_currency:
                    fx_converted_total += total
                elif currency in fx_rates:
                    fx_converted_total += total * fx_rates[currency]

        return {
            "totals_by_currency": totals_by_currency,
            "last_synced_at": last_synced_at,
            "accounts": accounts,
            "fx_base_currency": fx_base_currency,
            "fx_converted_total": fx_converted_total,
        }

    def _get_or_create_account(self, balance: ExternalAccountBalance) -> AccountConnection:
        """Fetch or create an AccountConnection record for a balance item"""
        query = self.db.query(AccountConnection).filter(
            AccountConnection.institution == balance.institution,
            AccountConnection.account_name == balance.account_name,
        )
        if balance.external_id:
            query = query.filter(AccountConnection.external_id == balance.external_id)
        account = query.first()

        if not account:
            account = AccountConnection(
                institution=balance.institution,
                account_name=balance.account_name,
                account_type=balance.account_type,
                currency=balance.currency,
                mask=balance.mask,
                external_id=balance.external_id,
                status=ConnectionStatus.CONNECTED,
                last_synced_at=balance.as_of,
                connection_metadata={"source": "placeholder"},
            )
            self.db.add(account)
            self.db.flush()
        return account
