"""Lightweight wrapper for the EOD Historical Data REST API."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import requests


class EodHistoricalData:
    BASE_URL = "https://eodhistoricaldata.com/api"

    def __init__(self, api_token: str, session: Optional[requests.Session] = None) -> None:
        if not api_token:
            raise ValueError("api_token is required for EodHistoricalData client")
        self.api_token = api_token
        self.session = session or requests.Session()

    def _request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        params = params.copy() if params else {}
        params.setdefault("api_token", self.api_token)
        params.setdefault("fmt", "json")

        url = f"{self.BASE_URL}/{endpoint.lstrip('/')}"
        response = self.session.get(url, params=params, timeout=15)
        try:
            response.raise_for_status()
        except requests.HTTPError as err:
            logging.error("EOD API request failed", exc_info=err)
            raise
        return response.json()

    def get_fundamental_equity(self, ticker: str, filter_: Optional[str] = None) -> Any:
        params: Dict[str, Any] = {}
        if filter_:
            params["filter"] = filter_
        return self._request(f"fundamentals/{ticker}", params=params)

    def get_prices_eod(self, symbol: str, period: str = "d", order: str = "a") -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {
            "period": period,
            "order": order,
        }
        return self._request(f"eod/{symbol}", params=params)

    def get_fundamentals_bonds(self, code: str, bond_only: int = 1) -> Any:
        params: Dict[str, Any] = {"bond": bond_only}
        return self._request(f"fundamentals/{code}", params=params)

    def get_exchange_symbol_list(self, exchange: str, **params: Any) -> Any:
        request_params: Dict[str, Any] = params.copy()
        return self._request(f"exchange-symbol-list/{exchange}", params=request_params)
