"""DCF Data Service

Provides multi-step fallback data retrieval for DCF:
- Primary: yfinance / Finnhub via existing pipeline
- Fallback: OpenAI (ChatGPT) to extract key financial metrics from official statements
"""

from typing import Dict, Optional
from datetime import datetime
import json

from openai import OpenAI

from app.config import settings


class DCFDataService:
    """Service for fetching and validating DCF input metrics via OpenAI."""

    def __init__(self):
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured in settings for DCFDataService")
        self.client = OpenAI(api_key=api_key)
        # Use same model as AI NPV service
        self.model = "gpt-4o"

    async def fetch_dcf_metrics(self, ticker: str) -> Dict:
        """
        Fetch core DCF metrics using ChatGPT as a last-resort fallback.

        The prompt explicitly asks the model to base numbers ONLY on
        officially published financial statements (income statement,
        balance sheet, cash flow statement) up to its knowledge cutoff.

        Returns a dictionary with at least:
        - revenue              (latest annual, dollars)
        - beta                 (levered beta)
        - debt                 (total interest-bearing debt)
        - cash                 (cash and cash equivalents)
        - market_cap           (equity market cap)
        - shares_outstanding   (basic shares)
        - current_price        (last known trading price)
        - cost_of_debt         (approximate pre-tax cost of debt)
        """
        ticker_upper = ticker.upper()

        prompt = f"""
You are a conservative financial data engine.
Using ONLY officially published financial statements and reliable market data
available up to your knowledge cutoff, extract the key inputs needed for a
Discounted Cash Flow (DCF) valuation of {ticker_upper}.

Return ONLY a single JSON object with this exact schema and field names:
{{
  "ticker": "{ticker_upper}",
  "currency": "USD",
  "revenue": 0.0,
  "beta": 0.0,
  "debt": 0.0,
  "cash": 0.0,
  "market_cap": 0.0,
  "shares_outstanding": 0.0,
  "current_price": 0.0,
  "cost_of_debt": 0.04
}}

Field definitions:
- revenue: latest full-year Total Revenue / Sales, in dollars (NOT millions/billions).
- beta: latest reported LEVERED beta vs. broad market index.
- debt: total interest-bearing debt (short + long term), in dollars.
- cash: Cash and Cash Equivalents, in dollars.
- market_cap: equity market capitalization, in dollars.
- shares_outstanding: basic shares outstanding (NOT fully diluted).
- current_price: last known trading price per share in {ticker_upper}'s primary listing currency.
- cost_of_debt: approximate PRE-TAX cost of debt as a decimal (e.g. 0.04 for 4%).

Constraints:
- All numeric values MUST be floats (no strings, no commas, no units).
- If you are uncertain, use your best conservative estimate based on historical data
  and clearly state that in the value (do NOT omit the field).
- Do NOT include any fields other than those specified above.
- Do NOT include explanations, comments, or markdown. Return JSON ONLY.
"""

        # Call OpenAI synchronously from async context (acceptable for our use case)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a financial data API that returns ONLY strict JSON with no additional text. "
                        "All numeric values must be floats. Use officially published financials only."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=600,
            timeout=25.0,
        )

        content = response.choices[0].message.content.strip()

        # Extract JSON if wrapped
        if not content.startswith("{"):
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                content = content[start_idx:end_idx]

        data = json.loads(content)

        # Basic sanity defaults
        return {
            "ticker": data.get("ticker", ticker_upper),
            "currency": data.get("currency", "USD"),
            "revenue": float(data.get("revenue", 0.0) or 0.0),
            "beta": float(data.get("beta", 1.0) or 1.0),
            "debt": float(data.get("debt", 0.0) or 0.0),
            "cash": float(data.get("cash", 0.0) or 0.0),
            "market_cap": float(data.get("market_cap", 0.0) or 0.0),
            "shares_outstanding": float(data.get("shares_outstanding", 0.0) or 0.0),
            "current_price": float(data.get("current_price", 0.0) or 0.0),
            "cost_of_debt": float(data.get("cost_of_debt", 0.04) or 0.04),
            "fetched_at": datetime.utcnow().isoformat(),
        }

    async def validate_dcf_metrics(self, ticker: str, metrics: Dict) -> Dict:
        """
        Second-layer validation via ChatGPT.

        We send the initially extracted metrics back to the model and ask it to
        check for obvious inconsistencies (e.g. negative revenues, impossible
        margins, market cap far from price * shares, etc.) and return a corrected
        version of the SAME JSON schema if needed.
        """
        ticker_upper = ticker.upper()
        metrics_json = json.dumps(metrics)

        prompt = f"""
You are a validation layer for DCF input metrics for {ticker_upper}.

You are given the following JSON with DCF metrics:
{metrics_json}

Tasks:
1. Check for internal consistency:
   - revenue should be > 0 for an actively traded company.
   - market_cap should roughly equal current_price * shares_outstanding (within ±30%).
   - debt and cash should be >= 0.
   - beta should usually be between 0 and 3 (inclusive), unless you have strong reason otherwise.
   - cost_of_debt should typically be between 0.0 and 0.15.
2. If any value is clearly inconsistent with the others or obviously unrealistic,
   correct it to the closest conservative value consistent with your knowledge.
3. Return ONLY a JSON object with the SAME schema as the original:
{{
  \"ticker\": \"{ticker_upper}\",
  \"currency\": \"USD\",
  \"revenue\": 0.0,
  \"beta\": 0.0,
  \"debt\": 0.0,
  \"cash\": 0.0,
  \"market_cap\": 0.0,
  \"shares_outstanding\": 0.0,
  \"current_price\": 0.0,
  \"cost_of_debt\": 0.04
}}

Important:
- Do NOT add or remove fields.
- Do NOT include explanations or comments. JSON ONLY.
"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a strict JSON validation API. You receive JSON and must return "
                        "corrected JSON with the exact same schema and keys."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=600,
            timeout=25.0,
        )

        content = response.choices[0].message.content.strip()

        if not content.startswith("{"):
            start_idx = content.find("{")
            end_idx = content.rfind("}") + 1
            if start_idx != -1 and end_idx > start_idx:
                content = content[start_idx:end_idx]

        data = json.loads(content)

        # Same normalization as fetch
        return {
            "ticker": data.get("ticker", ticker_upper),
            "currency": data.get("currency", metrics.get("currency", "USD")),
            "revenue": float(data.get("revenue", metrics.get("revenue", 0.0)) or 0.0),
            "beta": float(data.get("beta", metrics.get("beta", 1.0)) or 1.0),
            "debt": float(data.get("debt", metrics.get("debt", 0.0)) or 0.0),
            "cash": float(data.get("cash", metrics.get("cash", 0.0)) or 0.0),
            "market_cap": float(data.get("market_cap", metrics.get("market_cap", 0.0)) or 0.0),
            "shares_outstanding": float(
                data.get("shares_outstanding", metrics.get("shares_outstanding", 0.0)) or 0.0
            ),
            "current_price": float(data.get("current_price", metrics.get("current_price", 0.0)) or 0.0),
            "cost_of_debt": float(data.get("cost_of_debt", metrics.get("cost_of_debt", 0.04)) or 0.04),
            "validated_at": datetime.utcnow().isoformat(),
        }


