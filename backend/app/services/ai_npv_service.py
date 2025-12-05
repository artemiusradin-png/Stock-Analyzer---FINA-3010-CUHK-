"""
AI-Powered NPV Service
Fetches Operating Cash Flow data using OpenAI's ChatGPT API and calculates NPV
"""
import json
import requests
import httpx
from typing import List, Dict, Optional
from datetime import datetime
from openai import OpenAI
from app.config import settings
from app.services.finnhub_service import FinnhubService

class AINPVService:
    """Service for AI-powered NPV calculations"""

    def __init__(self):
        """Initialize OpenAI client and Finnhub service"""
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured in settings")
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o"  # GPT-4o: Latest model with improved accuracy and speed
        self.finnhub = FinnhubService()  # Finnhub for validation

    async def fetch_ocf_data(self, ticker: str, years: int = 5, exchange: Optional[str] = None) -> Dict:
        """
        Fetch Operating Cash Flow data for a ticker using ChatGPT API

        Args:
            ticker: Stock ticker symbol (e.g., AAPL, MSFT)
            years: Number of years of historical OCF to fetch
            exchange: Specific stock exchange (e.g., NYSE, NASDAQ, TSX)

        Returns:
            Dictionary with OCF data: {"ocf": [{"year": 2020, "value": 110543}, ...], "source": "chatgpt"}
        """
        try:
            # Construct prompt for ChatGPT with exchange specification
            exchange_text = f" on {exchange}" if exchange else ""
            prompt = f"""You are a financial data expert. Please provide the Operating Cash Flow (OCF) data for {ticker} stock{exchange_text} for the last {years} years.

Return the data in the following JSON format ONLY, with no additional text:
{{
  "ticker": "{ticker}",
  "ocf_data": [
    {{"year": 2020, "value": 12345000000}},
    {{"year": 2021, "value": 13456000000}}
  ],
  "currency": "USD",
  "unit": "dollars"
}}

Important:
- Return actual historical Operating Cash Flow values for {ticker}{exchange_text}
- Values should be in dollars (not millions or billions notation)
- Include the most recent {years} years
- Return ONLY the JSON, no explanations or additional text"""

            # Call ChatGPT API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a financial data API that returns ONLY valid JSON data with no additional text or explanations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for factual data
                max_tokens=500,
                timeout=15.0
            )

            # Parse response
            content = response.choices[0].message.content.strip()

            # Try to extract JSON if there's extra text
            if not content.startswith('{'):
                # Find JSON block
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx]

            data = json.loads(content)

            # Transform to expected format
            ocf_list = []
            for item in data.get("ocf_data", []):
                ocf_list.append({
                    "year": item["year"],
                    "value": float(item["value"])
                })

            return {
                "ticker": ticker.upper(),
                "ocf": ocf_list,
                "source": "chatgpt",
                "currency": data.get("currency", "USD"),
                "fetched_at": datetime.utcnow().isoformat()
            }

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse ChatGPT response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error fetching OCF data from ChatGPT: {str(e)}")

    async def fetch_cf_scenarios(self, ticker: str, years: int = 5, exchange: Optional[str] = None) -> Dict:
        """
        Fetch scenario-based cash flow forecasts (Low/Base/High) using ChatGPT
        Returns PER-SHARE dividends and terminal prices for investment scaling

        Args:
            ticker: Stock ticker symbol
            years: Number of forecast years (5-10)
            exchange: Specific stock exchange

        Returns:
            Dictionary with scenarios: {
                "current_price_per_share": 150.00,
                "years": [2025, 2026, ...],
                "dividends_per_share": {
                    "low": [...],
                    "base": [...],
                    "high": [...]
                },
                "terminal_price_per_share": {
                    "low": 130.0,
                    "base": 210.0,
                    "high": 280.0
                },
                "scenario_explanation": {...}
            }
        """
        try:
            exchange_text = f" on {exchange}" if exchange else ""
            current_year = datetime.utcnow().year

            prompt = f"""You are a conservative financial analyst with access to real-time market data for {ticker}{exchange_text}. Provide realistic dividend forecasts PER SHARE and terminal price targets based on {ticker}'s ACTUAL historical performance.

STEP 1 - VERIFY ACTUAL DATA (use your knowledge cutoff date):
1. {ticker}'s current stock price per share (last known trading price)
2. {ticker}'s most recent annual dividend per share (if any - set to 0 if non-dividend stock)
3. {ticker}'s 5-year average dividend growth rate (historical actual, not projected)
4. {ticker}'s historical P/E ratio and sector average P/E
5. {ticker}'s actual revenue growth rate over past 3 years

STEP 2 - APPLY CONSERVATIVE CONSTRAINTS:
✓ Dividend growth MUST NOT exceed historical average by more than 3%
✓ Price appreciation MUST align with historical P/E expansion/contraction
✓ If {ticker} doesn't pay dividends, use $0.00 for all years
✓ Terminal price must be ABSOLUTE PRICE (not gain): current_price × (0.50 to 1.50) for base case
✓ DO NOT hallucinate future contracts, deals, or events you're not certain about
✓ CRITICAL: terminal_price is the SELLING PRICE per share, not the capital gain!

STEP 3 - Return ONLY valid JSON (NO markdown, NO code blocks, NO explanatory text):

{{
  "current_price_per_share": <actual current price for {ticker}>,
  "years": [{current_year + 1}, {current_year + 2}, {current_year + 3}, {current_year + 4}, {current_year + 5}],
  "dividends_per_share": {{
    "low": [<year 1 dividend>, <year 2 dividend>, <year 3 dividend>, <year 4 dividend>, <year 5 dividend>],
    "base": [<year 1 dividend>, <year 2 dividend>, <year 3 dividend>, <year 4 dividend>, <year 5 dividend>],
    "high": [<year 1 dividend>, <year 2 dividend>, <year 3 dividend>, <year 4 dividend>, <year 5 dividend>]
  }},
  "terminal_price_per_share": {{
    "low": <ABSOLUTE SELLING PRICE per share in year {years} - MUST be >= current_price × 0.80>,
    "base": <ABSOLUTE SELLING PRICE per share in year {years} - MUST be >= current_price × 1.10>,
    "high": <ABSOLUTE SELLING PRICE per share in year {years} - MUST be >= current_price × 1.20>
  }},
  "scenario_explanation": {{
    "low": "<concise 40-50 word explanation citing SPECIFIC risks with QUANTIFIED impacts. Example format: 'EU defense cuts reduce LDO contract value by 15%, supply chain disruptions delay deliveries costing 8% revenue decline, rising interest rates compress P/E from 18x to 14x'>",
    "base": "<concise 40-50 word explanation with ACTUAL upcoming events and QUANTIFIED expectations. Example format: 'NATO spending increase boosts orders by 12%, new aircraft program contributes EUR 2B revenue in 2026, margin improvement from 7.2% to 8.5% through operational efficiency'>",
    "high": "<concise 40-50 word explanation citing SPECIFIC catalysts with QUANTIFIED upsides. Example format: 'EU raises LDO stake from 33% to 52% unlocking 21% revenue growth, major Asian defense contracts worth USD 5B, margin expansion to 10.5% from automation investments'>"
  }}
}}

CRITICAL ANTI-HALLUCINATION RULES:
✗ Do NOT return generic placeholder values like [2.0, 2.1, 2.2, 2.3, 2.4]
✗ Do NOT invent future contracts, deals, or partnerships you're uncertain about
✗ Do NOT project dividend growth above {ticker}'s historical 5-year average + 5%
✗ Do NOT cite specific dollar amounts for future contracts unless publicly announced
✓ Use {ticker}'s ACTUAL current dividend from your training data
✓ Base growth rates on {ticker}'s documented historical performance
✓ Current price must reflect {ticker}'s last known trading price
✓ If uncertain about specifics, use industry averages or say "market conditions"

CONSERVATIVE SCENARIO GUIDELINES for {ticker}:
- Low: Pessimistic (0-2% dividend growth OR maintain current, terminal price = current × 0.90 to 1.15)
- Base: Continuation of historical trends (match historical dividend growth ±2%, terminal price = current × 1.20 to 1.40)
- High: Optimistic but realistic (historical growth +3-5%, terminal price = current × 1.50 to 1.90)

CRITICAL: terminal_price_per_share MUST be the ABSOLUTE SELLING PRICE, not the price change or gain!

EXAMPLE CALCULATION:
  If current_price_per_share = $145.00
  And you expect 30% growth over 5 years
  Then terminal_price_per_share.base = $188.50  ✓ (145 × 1.30)
  NOT terminal_price_per_share.base = $43.50   ✗ (just the gain)

VALIDATION RULE:
  terminal_price_per_share.base MUST be >= current_price_per_share × 0.80
  terminal_price_per_share.base MUST be <= current_price_per_share × 2.00
  If terminal_price is LESS than current_price × 0.80, you are returning GAIN not PRICE!

MAXIMUM BOUNDS (prevent extreme hallucinations):
- Dividend growth per year: -5% to +15% (any higher is unrealistic)
- Total price change over {years} years: -30% to +150% from current

SCENARIO EXPLANATION REQUIREMENTS (be specific but honest about uncertainty):
✓ PREFERRED: Cite known industry trends and historical patterns
✓ ACCEPTABLE: Use conditional language "potential contract wins could..." or "if market conditions improve..."
✓ Include percentages based on historical volatility or industry benchmarks
✓ Examples of REALISTIC explanations:
  - "Sector headwinds reduce growth from historical 8% to 5%, maintaining 15x P/E below sector average"
  - "Continuation of historical 7% dividend growth, market multiple expansion from 18x to 20x P/E"
  - "Strong sector tailwinds could drive 12% growth (vs. historical 8%), potential 22x P/E if margins improve"
✗ AVOID hallucinating specific dollar amounts for unannounced contracts
✗ AVOID naming specific partnerships/deals unless publicly known
✗ AVOID extreme claims like "revolutionary breakthrough" or "market domination"

Each scenario must have EXACTLY {years} dividend values. If {ticker} has no dividend history, all dividends should be $0.00."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a conservative financial analyst API that returns ONLY valid JSON. You prioritize accuracy over optimism. When uncertain, you use historical averages or clearly state assumptions. You NEVER hallucinate specific contracts, deals, or events. You base all projections on documented historical performance."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Lower temperature for more factual, less creative responses
                max_tokens=1500,
                timeout=25.0
            )

            content = response.choices[0].message.content.strip()

            # Extract JSON if wrapped in text
            if not content.startswith('{'):
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx]

            data = json.loads(content)

            # Validate structure
            if "years" not in data or "dividends_per_share" not in data:
                raise ValueError("Invalid response structure from ChatGPT")

            divs = data["dividends_per_share"]
            if "low" not in divs or "base" not in divs or "high" not in divs:
                raise ValueError("Missing scenario data")

            if "terminal_price_per_share" not in data:
                raise ValueError("Missing terminal price data")

            current_price = float(data.get("current_price_per_share", 0))
            terminal_low = float(data["terminal_price_per_share"]["low"])
            terminal_base = float(data["terminal_price_per_share"]["base"])
            terminal_high = float(data["terminal_price_per_share"]["high"])

            # VALIDATION: If terminal prices are too small, ChatGPT returned GAINS instead of ABSOLUTE PRICES
            # Fix by adding current price to terminal prices
            min_expected_terminal = current_price * 0.80  # Terminal should be at least 80% of current
            
            if terminal_base < min_expected_terminal:
                # ChatGPT returned GAINS, convert to ABSOLUTE PRICES
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"ChatGPT returned terminal prices that look like gains (base={terminal_base}, current={current_price}). Converting to absolute prices.")
                
                terminal_low = current_price + terminal_low if terminal_low < current_price else terminal_low
                terminal_base = current_price + terminal_base if terminal_base < current_price else terminal_base
                terminal_high = current_price + terminal_high if terminal_high < current_price else terminal_high
                
                # Ensure reasonable bounds
                terminal_low = max(terminal_low, current_price * 0.80)
                terminal_base = max(terminal_base, current_price * 1.10)
                terminal_high = max(terminal_high, current_price * 1.20)

            return {
                "ticker": ticker.upper(),
                "current_price_per_share": current_price,
                "years": data["years"],
                "dividends_per_share": {
                    "low": [float(v) for v in divs["low"]],
                    "base": [float(v) for v in divs["base"]],
                    "high": [float(v) for v in divs["high"]]
                },
                "terminal_price_per_share": {
                    "low": terminal_low,
                    "base": terminal_base,
                    "high": terminal_high
                },
                "scenario_explanation": data.get("scenario_explanation", {
                    "low": "Conservative growth assumptions",
                    "base": "Expected performance based on historical trends",
                    "high": "Optimistic growth scenario"
                }),
                "source": "chatgpt",
                "fetched_at": datetime.utcnow().isoformat()
            }

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse ChatGPT response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error fetching CF scenarios from ChatGPT: {str(e)}")

    def calculate_npv(
        self,
        initial_cost: float,
        required_return: float,
        cash_flows: List[float]
    ) -> Dict:
        """
        Calculate Net Present Value

        Args:
            initial_cost: Initial investment (usually negative)
            required_return: Discount rate (as decimal, e.g., 0.10 for 10%)
            cash_flows: List of annual cash flows

        Returns:
            Dictionary with NPV calculation results
        """
        discount_rate = required_return
        npv = initial_cost
        discount_table = []

        # Year 0 (initial investment)
        discount_table.append({
            "year": 0,
            "cash_flow": initial_cost,
            "discount_factor": 1.0,
            "present_value": initial_cost
        })

        # Calculate present value for each year
        for idx, cash_flow in enumerate(cash_flows):
            year = idx + 1
            discount_factor = 1 / ((1 + discount_rate) ** year)
            present_value = cash_flow * discount_factor
            npv += present_value

            discount_table.append({
                "year": year,
                "cash_flow": cash_flow,
                "discount_factor": round(discount_factor, 6),
                "present_value": round(present_value, 2)
            })

        # Calculate IRR
        irr = self._calculate_irr([initial_cost] + cash_flows)

        return {
            "npv": round(npv, 2),
            "irr": round(irr * 100, 2) if irr else None,  # Convert to percentage
            "decision": "accept" if npv > 0 else "reject",
            "initial_cost": initial_cost,
            "required_return": required_return * 100,  # Convert to percentage
            "discount_table": discount_table,
            "project_duration": len(cash_flows)
        }

    def calculate_npv_sensitivity(
        self,
        initial_cost: float,
        required_return: float,
        cash_flows: List[float],
        variations: List[float] = [-0.05, -0.02, 0.0, 0.02, 0.05]
    ) -> Dict:
        """
        Calculate NPV sensitivity analysis at different discount rates

        Args:
            initial_cost: Initial investment
            required_return: Base discount rate
            cash_flows: List of annual cash flows
            variations: List of variations to apply to discount rate

        Returns:
            Dictionary with sensitivity analysis results
        """
        base_npv = self.calculate_npv(initial_cost, required_return, cash_flows)
        sensitivity_data = []

        for variation in variations:
            adjusted_rate = required_return + variation
            if adjusted_rate <= 0:
                continue  # Skip negative rates

            result = self.calculate_npv(initial_cost, adjusted_rate, cash_flows)
            sensitivity_data.append({
                "discount_rate": round(adjusted_rate * 100, 2),
                "variation": f"{variation * 100:+.1f}%",
                "npv": result["npv"],
                "decision": result["decision"]
            })

        return {
            "base_npv": base_npv,
            "sensitivity": sensitivity_data
        }

    def _calculate_irr(
        self,
        cash_flows: List[float],
        max_iterations: int = 100,
        tolerance: float = 0.0001
    ) -> Optional[float]:
        """
        Calculate Internal Rate of Return using Newton-Raphson method

        Args:
            cash_flows: List of cash flows including initial investment at index 0
            max_iterations: Maximum number of iterations
            tolerance: Convergence tolerance

        Returns:
            IRR as decimal (e.g., 0.15 for 15%) or None if couldn't converge
        """
        try:
            irr = 0.1  # Initial guess: 10%

            for _ in range(max_iterations):
                npv = 0
                dnpv = 0  # Derivative

                for t, cf in enumerate(cash_flows):
                    npv += cf / ((1 + irr) ** t)
                    dnpv -= t * cf / ((1 + irr) ** (t + 1))

                if abs(dnpv) < 1e-10:  # Avoid division by zero
                    return None

                new_irr = irr - npv / dnpv

                if abs(new_irr - irr) < tolerance:
                    return new_irr

                irr = new_irr

            return irr  # Return best estimate if didn't converge

        except Exception:
            return None

    async def fetch_company_info(self, ticker: str) -> Dict:
        """
        Fetch company information using Finnhub API (validation) + ChatGPT (description)

        Workflow:
        1. Validate ticker with Finnhub directory
        2. Get current price from Finnhub quote
        3. Fetch detailed description from ChatGPT

        Args:
            ticker: Stock ticker symbol (e.g., AAPL, MSFT)

        Returns:
            Dictionary with company info: description, exchange, currency, country, stock_price
        """
        try:
            # Step 1: Validate ticker with Finnhub (authoritative source)
            try:
                finnhub_profile = await self.finnhub.get_company_profile(ticker)
            except ValueError as e:
                # Ticker not found in Finnhub - invalid or delisted
                # Do NOT fallback to ChatGPT - raise error immediately
                raise ValueError(str(e))
            except Exception as e:
                # Check if this is a validation error wrapped in Exception
                error_msg = str(e).lower()
                if 'not found' in error_msg or 'invalid' in error_msg or 'delisted' in error_msg:
                    # This is a validation error - don't fallback, raise it
                    raise ValueError(str(e))
                # Otherwise it's a network/API error - fall back to ChatGPT with warning
                print(f"Warning: Finnhub API error for {ticker}: {str(e)}")
                finnhub_profile = None

            # Step 2: Get current quote if Finnhub succeeded
            current_price = 0.0
            if finnhub_profile:
                quote = await self.finnhub.get_company_quote(ticker)
                if quote and quote.get('current', 0) > 0:
                    current_price = quote['current']

            # Step 3: Fetch detailed description from ChatGPT
            company_name = finnhub_profile.get('name', ticker) if finnhub_profile else ticker
            exchange = finnhub_profile.get('exchange', '') if finnhub_profile else ''

            prompt = f"""You are a financial analyst. Provide a detailed 50-word description of {company_name} ({ticker}) {f"on {exchange}" if exchange else ""}.

The description must cover:
1. What the company does (core business)
2. Main products/services
3. Industry/sector
4. Market position
5. Key business segments

Return ONLY valid JSON (NO markdown, NO code blocks):
{{
  "description": "<50-word description covering all 5 points>"
}}

IMPORTANT: Return ONLY the JSON, no additional text."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a financial data API that returns ONLY valid JSON data with no additional text or explanations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=300,
                timeout=10.0
            )

            content = response.choices[0].message.content.strip()

            # Clean response if needed
            if not content.startswith('{'):
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx]

            description_data = json.loads(content)
            description = description_data.get("description", "")

            # Return combined Finnhub + ChatGPT data
            return {
                "ticker": ticker.upper(),
                "name": finnhub_profile.get('name', '') if finnhub_profile else '',
                "description": description,
                "exchange": exchange,
                "currency": finnhub_profile.get('currency', 'USD') if finnhub_profile else 'USD',
                "country": finnhub_profile.get('country', '') if finnhub_profile else '',
                "stock_price": current_price,
                "industry": finnhub_profile.get('industry', '') if finnhub_profile else '',
                "marketCap": finnhub_profile.get('marketCap', 0) if finnhub_profile else 0,
                "ipo": finnhub_profile.get('ipo', '') if finnhub_profile else '',
                "fetched_at": datetime.utcnow().isoformat(),
                "source": "finnhub+chatgpt"
            }

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse ChatGPT response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error fetching company info: {str(e)}")

    async def fetch_dcf_financials(self, ticker: str, exchange: Optional[str] = None) -> Dict:
        """
        Fetch comprehensive financial data for DCF valuation using ChatGPT API
        Extracts metrics from official financial statements and calculates derived values

        Args:
            ticker: Stock ticker symbol
            exchange: Specific stock exchange (optional, for disambiguation)

        Returns:
            Dictionary with complete financial metrics and data sources
        """
        try:
            exchange_text = f" on {exchange}" if exchange else ""
            prompt = f"""You are a financial analyst. Extract comprehensive financial data for {ticker}{exchange_text} from the company's most recent official financial statements.

Extract the following metrics from the actual financial statements:

FROM INCOME STATEMENT:
- Annual Revenue (most recent fiscal year, in dollars)
- Revenue for past 3 years (for growth calculation)
- Effective Tax Rate (Tax Expense / Pre-Tax Income)

FROM CASH FLOW STATEMENT:
- Operating Cash Flow (most recent fiscal year)
- Free Cash Flow (OCF - CapEx)
- Calculate FCF Margin (Free Cash Flow / Revenue)

FROM BALANCE SHEET:
- Total Debt (Long-term + Short-term debt)
- Total Equity (Market Cap or Book Equity)
- Cash and Cash Equivalents

CALCULATED METRICS (use formulas):
- Revenue Growth Rate: Calculate 3-year CAGR from historical revenue
- Cost of Debt: Interest Expense / Total Debt (from income statement)
- Debt/Equity Ratio: Total Debt / Market Equity

MARKET DATA:
- Current Stock Price
- Shares Outstanding
- Market Cap (Price * Shares)
- Beta (from financial data providers)

ASSUMPTIONS (use standard estimates if not in statements):
- Terminal Growth Rate: 2.5% (GDP + inflation)
- Risk-Free Rate: Current 10-year Treasury yield (~4.5%)
- Market Risk Premium: Historical average (~5.5%)

Return ONLY valid JSON in this exact format:
{{
  "ticker": "{ticker}",
  "exchange": "NYSE|NASDAQ|TSX|etc",
  "description": "Brief company description",
  "currency": "USD|CAD|EUR|etc",
  "stock_price": 123.45,
  "market_cap": 1500000000,
  "revenue": 1200000000,
  "revenue_growth": 0.08,
  "fcf_margin": 0.15,
  "terminal_growth": 0.025,
  "risk_free": 0.045,
  "market_premium": 0.055,
  "beta": 1.2,
  "cost_debt": 0.04,
  "tax_rate": 0.21,
  "debt_equity": 0.30,
  "sources": {{
    "revenue": "FY2023 Annual Report - Income Statement",
    "revenue_growth": "Calculated from FY2021-2023 revenue (CAGR)",
    "fcf_margin": "Cash Flow Statement: FCF / Revenue",
    "cost_debt": "Interest Expense / Total Debt from financials",
    "tax_rate": "Effective tax rate from income statement",
    "debt_equity": "Balance Sheet: Total Debt / Market Cap",
    "beta": "Yahoo Finance / Bloomberg",
    "risk_free": "Current 10-year US Treasury yield",
    "market_premium": "Historical equity risk premium",
    "terminal_growth": "Long-term GDP growth + inflation"
  }}
}}

IMPORTANT:
- Extract actual values from financial statements, not estimates
- Calculate derived metrics using formulas (don't guess)
- Be specific about data sources in the "sources" field
- Use most recent fiscal year data
- Return ONLY JSON, no additional text"""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a financial data API that extracts data from official financial statements and returns ONLY valid JSON with no additional text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1500,
                timeout=25.0
            )

            content = response.choices[0].message.content.strip()

            # Clean response if needed
            if not content.startswith('{'):
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx]

            data = json.loads(content)

            return {
                **data,
                "fetched_at": datetime.utcnow().isoformat()
            }

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse ChatGPT response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error fetching DCF financials from ChatGPT: {str(e)}")

    async def generate_detailed_scenario_analysis(
        self,
        ticker: str,
        exchange: Optional[str] = None,
        scenario_results: Optional[Dict] = None
    ) -> Dict:
        """
        Generate detailed 230-word professional scenario analysis for Low/Base/High cases

        Args:
            ticker: Stock ticker symbol
            exchange: Specific stock exchange
            scenario_results: NPV results for all three scenarios (optional, for context)

        Returns:
            Dictionary with detailed explanations: {
                "low": "150-word detailed downside analysis",
                "base": "150-word detailed base case analysis",
                "high": "150-word detailed upside analysis"
            }
        """
        try:
            exchange_text = f" on {exchange}" if exchange else ""

            # Build context from scenario results if provided
            results_context = ""
            if scenario_results:
                results_context = f"""
CONTEXT - NPV Results for {ticker}:
- Low Scenario NPV: ${scenario_results.get('low', {}).get('npv', 0):,.2f}
- Base Scenario NPV: ${scenario_results.get('base', {}).get('npv', 0):,.2f}
- High Scenario NPV: ${scenario_results.get('high', {}).get('npv', 0):,.2f}
"""

            prompt = f"""You are a professional investment analyst writing detailed scenario analysis for {ticker}{exchange_text} valuation report.

{results_context}

Generate THREE detailed scenario analyses (EXACTLY 230 words each) in professional report format (bullet-friendly; pack detail, use specific numbers):

1. DOWNSIDE CASE (Low Scenario):
   - Cite 3-4 SPECIFIC risks with QUANTIFIED impacts
   - Include: regulatory changes, market conditions, competitive threats, operational challenges
   - Reference actual upcoming events, contract expirations, market trends
   - Use concrete numbers: revenue declines (%), margin compression (bps), market share loss (%)
   - Professional tone suitable for investment committee presentation

2. BASE CASE (Most Likely Scenario):
   - Cite 3-4 ACTUAL expected developments with QUANTIFIED outcomes
   - Include: confirmed contracts, market trends, operational improvements, strategic initiatives
   - Reference analyst consensus, management guidance, industry forecasts
   - Use concrete numbers: revenue growth (%), margin expansion (bps), market share gains (%)
   - Professional tone with balanced perspective

3. UPSIDE CASE (High Scenario):
   - Cite 3-4 SPECIFIC catalysts with QUANTIFIED upside potential
   - Include: new contracts, market expansion, efficiency gains, strategic opportunities
   - Reference potential deals, regulatory tailwinds, technology advantages
   - Use concrete numbers: revenue acceleration (%), margin improvements (bps), valuation multiples
   - Professional tone highlighting growth opportunities

Return ONLY valid JSON:
{{
  "low": "EXACTLY 230-word detailed professional analysis of downside risks for {ticker} with specific events and quantified impacts...",
  "base": "EXACTLY 230-word detailed professional analysis of base case for {ticker} with actual developments and quantified expectations...",
  "high": "EXACTLY 230-word detailed professional analysis of upside potential for {ticker} with specific catalysts and quantified opportunities..."
}}

CRITICAL REQUIREMENTS:
✓ Each analysis must be EXACTLY 230 words (±5 words acceptable)
✓ Must cite SPECIFIC events, contracts, or developments (not generic statements)
✓ Must include QUANTIFIED impacts (percentages, dollar amounts, basis points)
✓ Professional investment report tone
✓ Focus on ACTUAL upcoming events and market conditions for {ticker}
✗ NO vague statements like "market volatility" or "steady growth"
✗ NO generic financial jargon without specifics
✗ NO placeholder values or hypothetical examples"""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional investment analyst writing detailed scenario analysis for institutional investors. Return ONLY valid JSON with no additional text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Slightly higher for more detailed narrative
                max_tokens=2600,  # Increased for 3x 230-word analyses
                timeout=30.0
            )

            content = response.choices[0].message.content.strip()

            # Extract JSON if wrapped in text
            if not content.startswith('{'):
                start_idx = content.find('{')
                end_idx = content.rfind('}') + 1
                if start_idx != -1 and end_idx > start_idx:
                    content = content[start_idx:end_idx]

            data = json.loads(content)

            # Validate structure
            if "low" not in data or "base" not in data or "high" not in data:
                raise ValueError("Missing scenario analysis data")

            return {
                "low": data["low"],
                "base": data["base"],
                "high": data["high"],
                "generated_at": datetime.utcnow().isoformat()
            }

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse ChatGPT response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error generating scenario analysis from ChatGPT: {str(e)}")

    # === New Hybrid CF Scenario Fetch (EOD/Finnhub first, GPT fallback) ===
    async def fetch_cf_scenarios(self, ticker: str, years: int = 5, exchange: Optional[str] = None) -> Dict:
        """
        Hybrid CF scenario fetch:
        1) Try EOD dividends + Finnhub price to derive low/base/high.
        2) Fallback to ChatGPT generation if data not available.
        """
        years = max(3, min(years, 10))
        try:
            eod_data = self._fetch_eod_dividends(ticker, exchange, years)
            quote_data = await self._fetch_finnhub_quote(ticker)
            price = quote_data.get("current", 0) if quote_data else 0
            currency = quote_data.get("currency", "USD") if quote_data else "USD"

            if eod_data.get("stock_price"):
                price = eod_data["stock_price"]
            if eod_data.get("currency"):
                currency = eod_data["currency"]

            dividends_hist = eod_data["dividends"]
            trailing_div = dividends_hist[-1]["value"] if dividends_hist else 0

            growth_rates = []
            for i in range(1, len(dividends_hist)):
                prev = dividends_hist[i - 1]["value"]
                curr = dividends_hist[i]["value"]
                if prev > 0:
                    growth_rates.append((curr - prev) / prev)
            avg_growth = sum(growth_rates) / len(growth_rates) if growth_rates else 0.03
            avg_growth = max(-0.15, min(avg_growth, 0.15))

            def project(start: float, g: float, n: int) -> List[float]:
                vals = []
                current = start
                for _ in range(n):
                    current = current * (1 + g)
                    vals.append(round(current, 4))
                return vals

            base_divs = project(trailing_div, avg_growth, years)
            low_divs = project(trailing_div, max(avg_growth - 0.05, -0.2), years)
            high_divs = project(trailing_div, min(avg_growth + 0.05, 0.25), years)

            terminal_yield = trailing_div / price if price > 0 else 0.03

            def terminal_price(div, y):
                y_safe = y if y and y > 0.0001 else 0.03
                return round(div / y_safe, 4)

            term_prices = {
                "low": terminal_price(low_divs[-1] * (1 + max(avg_growth - 0.05, -0.2)), terminal_yield),
                "base": terminal_price(base_divs[-1] * (1 + avg_growth), terminal_yield),
                "high": terminal_price(high_divs[-1] * (1 + min(avg_growth + 0.05, 0.25)), terminal_yield),
            }

            price_source = "eod_realtime" if eod_data.get("stock_price") else ("finnhub_quote" if price else "unknown")

            return {
                "current_price_per_share": price,
                "currency": currency,
                "years": [datetime.utcnow().year + i + 1 for i in range(years)],
                "dividends_per_share": {
                    "low": low_divs,
                    "base": base_divs,
                    "high": high_divs
                },
                "terminal_price_per_share": term_prices,
                "data_source": "eod_finnhub",
                "price_source": price_source,
                "scenario_explanation": {
                    "low": "EOD/Finnhub-derived downside: softer dividend growth and conservative terminal value.",
                    "base": "EOD/Finnhub-derived base: extrapolated dividend growth with yield-based terminal value.",
                    "high": "EOD/Finnhub-derived upside: stronger dividend growth and higher terminal value."
                }
            }

        except Exception:
            return await self._fallback_cf_scenarios_via_gpt(ticker, years, exchange)

    def _fetch_eod_dividends(self, ticker: str, exchange: Optional[str], years: int) -> Dict:
        """
        Fetch dividend history from EOD and return recent N dividends with price/currency.
        """
        api_token = settings.EOD_API_KEY
        if not api_token:
            raise ValueError("EOD_API_KEY not configured")

        symbol = ticker
        if exchange:
            symbol = f"{ticker}.{exchange}" if '.' not in ticker else ticker

        # Dividend history
        div_url = f"https://eodhistoricaldata.com/api/div/{symbol}"
        div_params = {"api_token": api_token, "fmt": "json"}
        div_resp = requests.get(div_url, params=div_params, timeout=15)
        div_resp.raise_for_status()
        div_data = div_resp.json() or []

        # Price/overview
        fund_url = f"https://eodhistoricaldata.com/api/fundamentals/{symbol}"
        fund_params = {"api_token": api_token, "fmt": "json"}
        fund_resp = requests.get(fund_url, params=fund_params, timeout=15)
        fund_resp.raise_for_status()
        fund_data = fund_resp.json() or {}

        currency = fund_data.get("General", {}).get("CurrencyCode", "USD")

        # Prefer real-time/close price (avoid market cap misuse)
        stock_price = 0
        price_url = f"https://eodhistoricaldata.com/api/real-time/{symbol}"
        price_params = {"api_token": api_token, "fmt": "json"}
        try:
            price_resp = requests.get(price_url, params=price_params, timeout=15)
            if price_resp.ok:
                price_json = price_resp.json()
                stock_price = (
                    price_json.get("close")
                    or price_json.get("close_adj")
                    or price_json.get("previousClose")
                    or 0
                )
        except Exception:
            pass

        # Prepare dividends list
        dividends = []
        for entry in div_data[-years:]:
            try:
                pay_date = entry.get("paydate") or entry.get("date") or ""
                year = int(pay_date[:4]) if len(pay_date) >= 4 else datetime.utcnow().year
                dividends.append({"year": year, "value": float(entry.get("value", 0))})
            except Exception:
                continue

        dividends = dividends[-years:]

        return {
            "dividends": dividends,
            "stock_price": stock_price or 0,
            "currency": currency
        }

    async def _fetch_finnhub_quote(self, ticker: str) -> Dict:
        """
        Fetch current price and currency from Finnhub.
        """
        api_key = settings.FINNHUB_API_KEY
        if not api_key:
            return {}

        url = f"https://finnhub.io/api/v1/quote"
        params = {"symbol": ticker.upper(), "token": api_key}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            if not data or data.get("c", 0) == 0:
                return {}
            # Finnhub quote doesn’t include currency; try profile for currency
            prof_url = f"https://finnhub.io/api/v1/stock/profile2"
            prof_params = {"symbol": ticker.upper(), "token": api_key}
            currency = "USD"
            try:
                prof_resp = await client.get(prof_url, params=prof_params)
                if prof_resp.ok:
                    prof_data = prof_resp.json()
                    currency = prof_data.get("currency", "USD")
            except Exception:
                pass
            return {"current": data.get("c", 0), "currency": currency}

    async def _fallback_cf_scenarios_via_gpt(self, ticker: str, years: int, exchange: Optional[str]) -> Dict:
        """
        Legacy fallback: generate scenarios via ChatGPT if EOD/Finnhub unavailable.
        """
        exchange_text = f" on {exchange}" if exchange else ""
        current_year = datetime.utcnow().year

        prompt = f"""You are an investment analyst researching {ticker}{exchange_text}. Provide realistic dividend forecasts PER SHARE and terminal price targets for a {years}-year investment horizon.

Return ONLY valid JSON (no markdown):
{{
  "current_price_per_share": <price>,
  "years": [{', '.join(str(current_year + i + 1) for i in range(years))}],
  "dividends_per_share": {{
    "low": [year1, year2, ..., year{years}],
    "base": [year1, year2, ..., year{years}],
    "high": [year1, year2, ..., year{years}]
  }},
  "terminal_price_per_share": {{
    "low": <price>,
    "base": <price>,
    "high": <price>
  }},
  "scenario_explanation": {{
    "low": "40-50 word downside explanation with specific quantified risks",
    "base": "40-50 word base explanation with quantified expectations",
    "high": "40-50 word upside explanation with quantified catalysts"
  }}
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a financial data API that returns ONLY valid JSON data with no additional text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1500,
            timeout=25.0
        )

        content = response.choices[0].message.content.strip()
        if not content.startswith('{'):
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            if start_idx != -1 and end_idx > start_idx:
                content = content[start_idx:end_idx]

        data = json.loads(content)

        return {
            "current_price_per_share": float(data.get("current_price_per_share", 0)),
            "currency": data.get("currency", "USD"),
            "years": data.get("years", [current_year + i + 1 for i in range(years)]),
            "dividends_per_share": data.get("dividends_per_share", {}),
            "terminal_price_per_share": data.get("terminal_price_per_share", {}),
            "scenario_explanation": data.get("scenario_explanation", {}),
            "data_source": "chatgpt_fallback",
            "price_source": "chatgpt"
        }
