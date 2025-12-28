/**
 * DCF Valuation Module
 * Handles company-level Discounted Cash Flow analysis with AI-powered data extraction
 */

// API base URL
function getDCFAPIBase() {
    // Priority: window.API_BASE_URL (set by detectBackend()) > meta tag > default
    if (window.API_BASE_URL) {
        const base = window.API_BASE_URL.replace(/\/api$/, '');
        console.log('DCF API Base (from window.API_BASE_URL):', base);
        return base;
    }
    
    // Try production meta tag first
    const productionMeta = document.querySelector('meta[name="api-base-production"]')?.getAttribute('content');
    if (productionMeta) {
        const base = productionMeta.trim().replace(/\/$/, '').replace(/\/api$/, '');
        console.log('DCF API Base (from production meta):', base);
        return base;
    }
    
    // Fallback to dcf-api-base meta tag
    const metaBase = document.querySelector('meta[name="dcf-api-base"]')?.getAttribute('content');
    if (metaBase) {
        const base = metaBase.replace(/\/api$/, '');
        console.log('DCF API Base (from dcf-api-base meta):', base);
        return base;
    }
    
    console.warn('DCF API Base: Using default localhost:8000');
    return 'http://localhost:8000';
}

const DCF_API_BASE = getDCFAPIBase();
console.log('DCF_API_BASE initialized to:', DCF_API_BASE);

// Track last DCF result for inline sensitivity
let lastDCFResult = null;

// Store DCF data globally for portfolio integration
window.DCF_DATA = null;

/**
 * Fetch company financial data using AI (ChatGPT)
 * This extracts data from official financial statements
 */
async function fetchDCFCompanyData() {
    const ticker = document.getElementById('dcf-ticker')?.value?.trim().toUpperCase();

    if (!ticker) {
        showDCFError('Please enter a stock ticker symbol');
        return;
    }

    const button = document.getElementById('fetch-dcf-data-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Fetching financial data...</span>';
    button.disabled = true;

    hideDCFError();

    try {
        console.log('Fetching DCF company data for:', ticker);
        console.log('Using API base:', DCF_API_BASE);
        const apiUrl = `${DCF_API_BASE}/api/ai-npv/fetch-dcf-financials`;
        console.log('Full API URL:', apiUrl);

        // Call AI NPV endpoint to fetch comprehensive financial data
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ ticker: ticker })
        });

        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
            }
            throw new Error(errorData.detail || 'Failed to fetch financial data');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to fetch financial data');
        }

        console.log('Financial data received:', data);

        // Handle ticker disambiguation if multiple matches
        if (data.multiple && data.matches && data.matches.length > 1) {
            showDCFCompanyChooser(data.matches, (choice) => {
                // Re-fetch with specific exchange
                refetchDCFFinancials(choice.ticker, choice.exchange);
            });
        } else {
            // Populate form fields with fetched data
            populateDCFInputs(data);
            displayDCFCompanyInfo(data);
            displayDCFDataSources(data.sources || {});
        }

    } catch (error) {
        console.error('DCF data fetch error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            apiBase: DCF_API_BASE,
            apiUrl: `${DCF_API_BASE}/api/ai-npv/fetch-dcf-financials`
        });
        
        // Provide more helpful error message
        let errorMessage = error.message;
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            errorMessage = `Cannot connect to backend at ${DCF_API_BASE}. `;
            if (window.BACKEND_STATUS === 'unverified' || window.BACKEND_STATUS === 'disconnected') {
                errorMessage += 'Backend may not be deployed or is sleeping. ';
                if (DCF_API_BASE.includes('onrender.com')) {
                    errorMessage += 'If using Render free tier, the backend may take 30-60 seconds to wake up.';
                }
            } else {
                errorMessage += 'Please check if the backend is running.';
            }
        }
        
        showDCFError(`Failed to fetch financial data: ${errorMessage}. You can enter values manually.`);
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

/**
 * Re-fetch financials for specific exchange after disambiguation
 */
async function refetchDCFFinancials(ticker, exchange) {
    try {
        console.log('Re-fetching DCF financials for:', ticker, 'on', exchange);

        const response = await fetch(`${DCF_API_BASE}/api/ai-npv/fetch-dcf-financials`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ticker: ticker,
                exchange: exchange
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to fetch financial data');
        }

        // Clear disambiguation UI
        const disambiguationContainer = document.getElementById('dcf-ticker-disambiguation');
        if (disambiguationContainer) {
            disambiguationContainer.innerHTML = '';
        }

        // Populate form and display info
        populateDCFInputs(data);
        displayDCFCompanyInfo(data);
        displayDCFDataSources(data.sources || {});

    } catch (error) {
        console.error('DCF refetch error:', error);
        showDCFError(`Failed to fetch financial data for ${exchange}: ${error.message}`);
    }
}

/**
 * Populate DCF input fields with fetched data
 */
function populateDCFInputs(data) {
    // Fill in financial metrics from income statement and balance sheet
    if (data.revenue) document.getElementById('dcf-revenue').value = (data.revenue / 1e9).toFixed(2);
    if (data.revenue_growth) document.getElementById('dcf-revenue-growth').value = (data.revenue_growth * 100).toFixed(1);
    if (data.fcf_margin) document.getElementById('dcf-fcf-margin').value = (data.fcf_margin * 100).toFixed(1);
    if (data.terminal_growth) document.getElementById('dcf-terminal-growth').value = (data.terminal_growth * 100).toFixed(1);

    // WACC parameters
    if (data.risk_free) document.getElementById('dcf-risk-free').value = (data.risk_free * 100).toFixed(1);
    if (data.market_premium) document.getElementById('dcf-market-premium').value = (data.market_premium * 100).toFixed(1);
    if (data.beta) document.getElementById('dcf-beta').value = data.beta.toFixed(2);
    if (data.cost_debt) document.getElementById('dcf-cost-debt').value = (data.cost_debt * 100).toFixed(1);
    if (data.tax_rate) document.getElementById('dcf-tax-rate').value = (data.tax_rate * 100).toFixed(1);
    if (data.debt_equity) document.getElementById('dcf-debt-equity').value = data.debt_equity.toFixed(2);

    console.log('DCF inputs populated successfully');
}

/**
 * Display company information
 */
function displayDCFCompanyInfo(data) {
    const panel = document.getElementById('dcf-company-info-panel');
    const container = document.getElementById('dcf-company-info-container');

    if (!panel || !container) return;

    const html = `
        <div style="margin-bottom: 1rem;">
            <p style="font-size: 0.875rem; line-height: 1.6; color: #374151; margin: 0;">
                ${data.description || ''}
            </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
            <div style="background: #fff; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Exchange
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.exchange || 'N/A'}
                </div>
            </div>
            <div style="background: #fff; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Currency
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.currency || 'USD'}
                </div>
            </div>
            <div style="background: #fff; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Market Cap
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.market_cap ? formatLargeNumber(data.market_cap) : 'N/A'}
                </div>
            </div>
            <div style="background: #fff; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Stock Price
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.stock_price ? data.stock_price.toFixed(2) : 'N/A'}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    panel.style.display = 'block';
}

/**
 * Display data sources showing where each metric comes from
 */
function displayDCFDataSources(sources) {
    const panel = document.getElementById('dcf-data-source-panel');
    const container = document.getElementById('dcf-data-source-container');

    if (!panel || !container) return;

    // Categorize metrics by source based on their descriptions
    const finnhubMetrics = [];
    const yfinanceMetrics = [];
    const chatgptMetrics = [];

    // Map each metric to its source category based on the source description
    const metricMapping = {
        'revenue': { label: 'Revenue', category: null },
        'revenue_growth': { label: 'Revenue Growth', category: null },
        'fcf_margin': { label: 'FCF Margin', category: null },
        'terminal_growth': { label: 'Terminal Growth Rate', category: null },
        'risk_free': { label: 'Risk-Free Rate', category: null },
        'market_premium': { label: 'Market Risk Premium', category: null },
        'beta': { label: 'Beta', category: null },
        'cost_debt': { label: 'Cost of Debt', category: null },
        'tax_rate': { label: 'Tax Rate', category: null },
        'debt_equity': { label: 'Debt/Equity Ratio', category: null }
    };

    // Categorize each metric based on source text
    for (const [key, metric] of Object.entries(metricMapping)) {
        const sourceText = sources[key] || '';
        const lowerSource = sourceText.toLowerCase();

        if (lowerSource.includes('yahoo finance') || lowerSource.includes('bloomberg') ||
            lowerSource.includes('finnhub') || lowerSource.includes('data provider')) {
            finnhubMetrics.push(metric.label);
        } else if (lowerSource.includes('income statement') || lowerSource.includes('balance sheet') ||
                   lowerSource.includes('cash flow statement') || lowerSource.includes('annual report') ||
                   lowerSource.includes('fy20') || lowerSource.includes('calculated from')) {
            yfinanceMetrics.push(metric.label);
        } else if (lowerSource.includes('treasury') || lowerSource.includes('gdp') ||
                   lowerSource.includes('equity risk premium') || lowerSource.includes('historical')) {
            chatgptMetrics.push(metric.label);
        } else {
            // Default categorization if source is unclear
            if (key === 'beta') finnhubMetrics.push(metric.label);
            else if (['revenue', 'revenue_growth', 'fcf_margin', 'tax_rate', 'debt_equity'].includes(key)) yfinanceMetrics.push(metric.label);
            else chatgptMetrics.push(metric.label);
        }
    }

    // Store data sources for info modal
    window.lastDCFDataSources = {
        finnhub: finnhubMetrics,
        yfinance: yfinanceMetrics,
        chatgpt: chatgptMetrics
    };

    const html = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div>
                <strong style="color: #111827;">Revenue:</strong> ${sources.revenue || 'Latest annual income statement'}
            </div>
            <div>
                <strong style="color: #111827;">Revenue Growth:</strong> ${sources.revenue_growth || 'Calculated from historical revenue (3-year average)'}
            </div>
            <div>
                <strong style="color: #111827;">FCF Margin:</strong> ${sources.fcf_margin || 'Free Cash Flow / Revenue from cash flow statement'}
            </div>
            <div>
                <strong style="color: #111827;">Terminal Growth:</strong> ${sources.terminal_growth || 'Estimated based on GDP growth + inflation (2-3%)'}
            </div>
            <div>
                <strong style="color: #111827;">Risk-Free Rate:</strong> ${sources.risk_free || 'Current 10-year Treasury yield'}
            </div>
            <div>
                <strong style="color: #111827;">Market Risk Premium:</strong> ${sources.market_premium || 'Historical equity risk premium (5-6%)'}
            </div>
            <div>
                <strong style="color: #111827;">Beta:</strong> ${sources.beta || 'Company beta from financial data providers'}
            </div>
            <div>
                <strong style="color: #111827;">Cost of Debt:</strong> ${sources.cost_debt || 'Interest Expense / Total Debt from financials'}
            </div>
            <div>
                <strong style="color: #111827;">Tax Rate:</strong> ${sources.tax_rate || 'Effective tax rate from income statement'}
            </div>
            <div>
                <strong style="color: #111827;">Debt/Equity Ratio:</strong> ${sources.debt_equity || 'Total Debt / Market Cap from balance sheet'}
            </div>
        </div>
    `;

    container.innerHTML = html;
    panel.style.display = 'block';
}

/**
 * Show company chooser for disambiguation (reuses AI NPV pattern)
 */
function showDCFCompanyChooser(matches, onSelect) {
    const container = document.getElementById('dcf-ticker-disambiguation');
    if (!container) return;

    container.innerHTML = '';

    const label = document.createElement('div');
    label.style.fontSize = '0.8rem';
    label.style.color = '#6b7280';
    label.style.marginBottom = '0.35rem';
    label.textContent = 'Select a company';
    container.appendChild(label);

    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '0.55rem 0.65rem';
    select.style.border = '1px solid #d1d5db';
    select.style.borderRadius = '6px';
    select.style.fontSize = '0.9rem';
    select.style.color = '#111827';
    select.style.background = '#fff';

    matches.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${(m.ticker || '').toUpperCase()} ${m.exchange || ''}`.trim();
        opt.dataset.exchange = m.exchange || '';
        opt.dataset.ticker = m.ticker || '';
        select.appendChild(opt);
    });

    const helper = document.createElement('div');
    helper.style.fontSize = '0.8rem';
    helper.style.color = '#9ca3af';
    helper.style.marginTop = '0.3rem';
    helper.textContent = 'Exchange and name shown for identical tickers';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Use selection';
    btn.style.marginTop = '0.6rem';
    btn.style.padding = '0.5rem 0.9rem';
    btn.style.borderRadius = '6px';
    btn.style.border = '1px solid #7c3aed';
    btn.style.background = '#7c3aed';
    btn.style.color = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';
    btn.addEventListener('click', () => {
        const idx = select.value;
        const m = matches[idx];
        if (onSelect) onSelect(m);
    });

    container.appendChild(select);
    container.appendChild(helper);
    container.appendChild(btn);
}

/**
 * Calculate DCF Valuation
 * Called when user clicks "Calculate DCF Valuation" button
 */
async function calculateDCF() {
    // Get both possible button IDs
    const calculateBtn = document.getElementById('calculate-dcf-button');
    const headerBtn = document.getElementById('company-dcf-header-btn');
    const errorMsg = document.getElementById('dcf-error-message');

    // Helper function to set button state
    const setButtonState = (btn, disabled, text) => {
        if (btn) {
            btn.disabled = disabled;
            btn.innerHTML = text;
        }
    };

    try {
        // Show loading state on both buttons
        setButtonState(calculateBtn, true, '<span>Calculating...</span>');
        setButtonState(headerBtn, true, '<span>Calculating...</span>');

        if (errorMsg) {
            errorMsg.style.display = 'none';
        }

        // Gather inputs
        const ticker = document.getElementById('dcf-ticker')?.value?.trim();
        const forecastPeriod = parseInt(document.getElementById('dcf-forecast-period')?.value || 5);
        const revenue = parseFloat(document.getElementById('dcf-revenue')?.value || 0);
        const revenueGrowth = parseFloat(document.getElementById('dcf-revenue-growth')?.value || 0);
        const fcfMargin = parseFloat(document.getElementById('dcf-fcf-margin')?.value || 0);
        const terminalGrowth = parseFloat(document.getElementById('dcf-terminal-growth')?.value || 0);
        const riskFree = parseFloat(document.getElementById('dcf-risk-free')?.value || 0);
        const marketPremium = parseFloat(document.getElementById('dcf-market-premium')?.value || 0);
        const beta = parseFloat(document.getElementById('dcf-beta')?.value || 0);
        const costDebt = parseFloat(document.getElementById('dcf-cost-debt')?.value || 0);
        const taxRate = parseFloat(document.getElementById('dcf-tax-rate')?.value || 0);
        const debtEquity = parseFloat(document.getElementById('dcf-debt-equity')?.value || 0);

        // Validate inputs
        if (!ticker) {
            showDCFError('Please enter a ticker symbol');
            // Reset buttons before returning
            setButtonState(calculateBtn, false, '<span>Calculate DCF Valuation</span>');
            setButtonState(headerBtn, false, '<span>Calculate DCF Valuation</span>');
            return;
        }

        if (revenue <= 0) {
            showDCFError('Please enter a valid revenue value');
            // Reset buttons before returning
            setButtonState(calculateBtn, false, '<span>Calculate DCF Valuation</span>');
            setButtonState(headerBtn, false, '<span>Calculate DCF Valuation</span>');
            return;
        }

        // Prepare request payload
        const payload = {
            ticker: ticker,
            forecast_period: forecastPeriod,
            revenue: revenue * 1e9, // Convert billions to dollars
            revenue_growth: revenueGrowth / 100, // Convert percentage to decimal
            fcf_margin: fcfMargin / 100,
            terminal_growth: terminalGrowth / 100,
            risk_free: riskFree / 100,
            market_premium: marketPremium / 100,
            beta: beta,
            cost_debt: costDebt / 100,
            tax_rate: taxRate / 100,
            debt_equity: debtEquity
        };

        // Build request body - include revenue_override if revenue > 0
        const requestBody = {
            ticker: ticker,
            forecast_period: forecastPeriod,
            revenue_growth_start: revenueGrowth / 100,
            ebit_margin_start: fcfMargin / 100,
            terminal_growth: terminalGrowth / 100,
            risk_free_rate: riskFree / 100,
            erp: marketPremium / 100,
            cost_of_debt: costDebt / 100,
            tax_rate_start: taxRate / 100,
            discount_rate: null  // Let it calculate WACC automatically
        };

        // Only include revenue_override if user provided a valid revenue value
        if (revenue > 0) {
            requestBody.revenue_override = revenue * 1e9;
        }

        // Call DCF API
        const response = await fetch(`${DCF_API_BASE}/api/valuations/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to calculate DCF');
        }

        const result = await response.json();

        // Display results
        displayDCFResults(result);

    } catch (error) {
        console.error('DCF calculation error:', error);
        showDCFError(error.message || 'An error occurred during DCF calculation');
    } finally {
        // Reset both buttons
        setButtonState(calculateBtn, false, '<span>Calculate DCF Valuation</span>');
        setButtonState(headerBtn, false, '<span>Calculate DCF Valuation</span>');
    }
}

/**
 * Display DCF calculation results
 */
function displayDCFResults(data) {
    const container = document.getElementById('dcf-results-container');
    if (!container) return;

    // Cache result for inline sensitivity
    lastDCFResult = data;
    
    // Store DCF data globally for portfolio integration
    window.DCF_DATA = {
        ticker: data.ticker,
        companyName: data.company_name || '',
        currency: 'USD', // Default, could be enhanced
        exchange: '',
        dcfData: {
            currentPrice: data.current_price,
            impliedPrice: data.implied_price,
            upsideDownside: data.upside_downside,
            enterpriseValue: data.enterprise_value,
            equityValue: data.equity_value,
            wacc: data.wacc,
            terminalValue: data.terminal_value
        }
    };

    const upsideColor = data.upside_downside >= 0 ? '#10b981' : '#ef4444';
    const upsideSign = data.upside_downside >= 0 ? '+' : '';

    const html = `
        <div style="padding: 1.5rem;">
            <!-- Valuation Summary -->
            <div style="background: ${data.upside_downside >= 0 ? '#ecfdf5' : '#fef2f2'}; border: 2px solid ${data.upside_downside >= 0 ? '#10b981' : '#ef4444'}; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 0.75rem 0; font-size: 1.125rem; color: #111827;">Valuation Summary</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">Current Price</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #111827;">$${data.current_price.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">Implied Price</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: ${upsideColor};">$${data.implied_price.toFixed(2)}</div>
                    </div>
                    <div style="grid-column: span 2;">
                        <div style="font-size: 0.75rem; color: #6b7280; font-weight: 600; text-transform: uppercase; margin-bottom: 0.25rem;">Upside/(Downside)</div>
                        <div style="font-size: 1.75rem; font-weight: 700; color: ${upsideColor};">${upsideSign}${data.upside_downside.toFixed(1)}%</div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button class="npv-trigger-btn" onclick="openNPVModal()" style="flex: 1; min-width: 200px;">
                    <span>📊 Run NPV Analysis</span>
                </button>
                <button onclick="if(window.DCF_DATA?.ticker) addToPortfolioFromDCF(window.DCF_DATA.ticker, this)" class="ghost-button" style="flex: 1; min-width: 200px; padding: 0.6rem 1.2rem; font-size: 0.9rem;">
                    Add to My Portfolio
                </button>
            </div>

            <!-- Key Metrics -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
                <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Enterprise Value</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #1f2937;">$${data.enterprise_value.toFixed(2)}B</div>
                </div>
                <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Equity Value</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #1f2937;">$${data.equity_value.toFixed(2)}B</div>
                </div>
                <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">WACC</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #1f2937;">${data.wacc.toFixed(2)}%</div>
                </div>
                <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px; border: 1px solid #e5e5e5;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">Terminal Value</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #1f2937;">$${data.terminal_value.toFixed(2)}B</div>
                </div>
            </div>

            <!-- Free Cash Flow Projections -->
            <h3 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: #111827; font-weight: 700;">Free Cash Flow Projections</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8125rem;">
                    <thead>
                        <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                            <th style="padding: 0.5rem; text-align: left; font-weight: 600; color: #6b7280;">Year</th>
                            <th style="padding: 0.5rem; text-align: right; font-weight: 600; color: #6b7280;">Revenue ($B)</th>
                            <th style="padding: 0.5rem; text-align: right; font-weight: 600; color: #6b7280;">Growth %</th>
                            <th style="padding: 0.5rem; text-align: right; font-weight: 600; color: #6b7280;">EBIT ($B)</th>
                            <th style="padding: 0.5rem; text-align: right; font-weight: 600; color: #6b7280;">FCF ($B)</th>
                            <th style="padding: 0.5rem; text-align: right; font-weight: 600; color: #6b7280;">PV FCF ($B)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.projections.map(proj => `
                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 0.5rem; color: #111827; font-weight: 500;">${proj.year}</td>
                                <td style="padding: 0.5rem; text-align: right; color: #111827;">${proj.revenue.toFixed(2)}</td>
                                <td style="padding: 0.5rem; text-align: right; color: #6b7280;">${proj.revenue_growth_pct.toFixed(1)}%</td>
                                <td style="padding: 0.5rem; text-align: right; color: #111827;">${proj.ebit.toFixed(2)}</td>
                                <td style="padding: 0.5rem; text-align: right; color: #111827; font-weight: 600;">${proj.fcf.toFixed(2)}</td>
                                <td style="padding: 0.5rem; text-align: right; color: #059669; font-weight: 600;">${proj.pv_fcf.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Show DCF error message
 */
function showDCFError(message) {
    const errorMsg = document.getElementById('dcf-error-message');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 5000);
    }
}

/**
 * Hide DCF error message
 */
function hideDCFError() {
    const errorMsg = document.getElementById('dcf-error-message');
    if (errorMsg) {
        errorMsg.style.display = 'none';
    }
}

/**
 * Format large numbers (for market cap display)
 */
function formatLargeNumber(value) {
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1e12) {
        return `${sign}$${(absValue / 1e12).toFixed(2)}T`;
    } else if (absValue >= 1e9) {
        return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
        return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
    } else {
        return `${sign}$${absValue.toFixed(2)}`;
    }
}

/**
 * Inline sensitivity for Company DCF (quick scenario around implied value)
 * This uses lastDCFResult and scales implied price around the base WACC.
 */
function runInlineDCFSensitivity() {
    if (!lastDCFResult) {
        showDCFError('Run a DCF valuation first to see sensitivity');
        return;
    }

    const range = parseFloat(document.getElementById('dcf-sens-range')?.value || '0');
    const steps = parseInt(document.getElementById('dcf-sens-steps')?.value || '0');
    if (isNaN(range) || range <= 0) {
        showDCFError('Enter a valid sensitivity range');
        return;
    }
    if (isNaN(steps) || steps < 3) {
        showDCFError('Steps should be at least 3');
        return;
    }

    const basePrice = lastDCFResult.implied_price || 0;
    const baseWacc = lastDCFResult.wacc ? lastDCFResult.wacc / 100 : 0.0;

    const minAdj = -range / 100;
    const maxAdj = range / 100;
    const scenarios = [];

    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const adj = minAdj + (maxAdj - minAdj) * t;
        const wacc = Math.max(0.0001, baseWacc * (1 + adj));
        // Simple approximation: price inversely related to discount rate
        const factor = baseWacc > 0 ? (baseWacc / wacc) : 1;
        const price = basePrice * factor;
        const upside = lastDCFResult.current_price && lastDCFResult.current_price > 0
            ? ((price - lastDCFResult.current_price) / lastDCFResult.current_price) * 100
            : 0;

        scenarios.push({
            label: `${(wacc * 100).toFixed(2)}% WACC`,
            wacc: wacc * 100,
            price,
            upside
        });
    }

    displayDCFSensitivityResults(scenarios);
}

function displayDCFSensitivityResults(scenarios) {
    const container = document.getElementById('dcf-sensitivity-results');
    if (!container) return;

    if (!scenarios || !scenarios.length) {
        container.innerHTML = '<div class="placeholder-text">No sensitivity results</div>';
        return;
    }

    const cards = scenarios.map(s => {
        const isPositive = s.upside >= 0;
        const bg = isPositive ? '#ecfdf5' : '#fef2f2';
        const border = isPositive ? '#10b981' : '#ef4444';
        const color = isPositive ? '#047857' : '#b91c1c';
        const sign = isPositive ? '+' : '';
        return `
            <div style="border: 1.5px solid ${border}; border-radius: 10px; padding: 0.9rem; background: ${bg};">
                <div style="font-size: 0.8rem; font-weight: 700; color: #111827; margin-bottom: 0.35rem;">${s.label}</div>
                <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem;">
                    <div style="font-size: 1rem; font-weight: 700; color: ${color};">$${s.price.toFixed(2)}</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: ${color};">${sign}${s.upside.toFixed(1)}%</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
            ${cards}
        </div>
    `;
}

/* ============================================
   NPV Modal Integration Functions
   ============================================ */

/**
 * Open NPV Modal and pre-populate with DCF data
 */
function openNPVModal() {
    if (!lastDCFResult) {
        showDCFError('Please calculate DCF first before running NPV analysis');
        return;
    }

    // Show modal
    const modal = document.getElementById('npv-modal-overlay');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Pre-populate NPV inputs from DCF results
        populateNPVFromDCF();
    }
}

/**
 * Close NPV Modal
 */
function closeNPVModal() {
    const modal = document.getElementById('npv-modal-overlay');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

/**
 * Pre-populate NPV inputs from DCF calculation
 */
function populateNPVFromDCF() {
    if (!lastDCFResult || !lastDCFResult.projections) {
        console.warn('No DCF results available for NPV pre-population');
        return;
    }

    // Initial Cost: Use negative Enterprise Value as proxy (convert from billions to actual value)
    const initialCostBillions = -(lastDCFResult.enterprise_value || 0);
    const initialCostEl = document.getElementById('dcf-npv-initial-cost');
    if (initialCostEl) {
        initialCostEl.value = initialCostBillions.toFixed(2);
    }

    // Required Return: Use WACC from DCF
    const requiredReturn = lastDCFResult.wacc || 0;
    const requiredReturnEl = document.getElementById('dcf-npv-required-return');
    if (requiredReturnEl) {
        requiredReturnEl.value = requiredReturn.toFixed(2);
    }

    // Cash Flows: Use projected FCF values (in billions)
    const projections = lastDCFResult.projections || [];
    const cashFlowGrid = document.getElementById('dcf-npv-cash-flow-grid');

    if (cashFlowGrid) {
        // Clear existing
        cashFlowGrid.innerHTML = '';

        // Add cash flow cards for each projection year
        projections.forEach((proj, index) => {
            const year = index + 1;
            const fcf = proj.fcf || 0; // FCF in billions

            const card = createNPVCashFlowCard(year, fcf);
            cashFlowGrid.appendChild(card);
        });
    }

    // Update hint text
    const hintEl = document.getElementById('dcf-npv-data-source-hint');
    if (hintEl) {
        hintEl.textContent = `Pre-populated from DCF (WACC: ${requiredReturn.toFixed(2)}%, ${projections.length} year forecast)`;
    }
}

/**
 * Create cash flow card for NPV modal
 */
function createNPVCashFlowCard(year, value) {
    const card = document.createElement('div');
    card.className = 'cash-flow-card';
    card.setAttribute('data-year', year);

    const showRemoveBtn = year > 5;

    card.innerHTML = `
        <div class="cash-flow-card-header">
            <div class="cash-flow-card-year">Year ${year}</div>
            <button type="button" class="ghost-button cash-flow-remove-btn"
                    style="padding: 0.25rem 0.55rem; font-size: 0.75rem; ${showRemoveBtn ? '' : 'display: none;'}"
                    onclick="removeNPVCashFlowYear(${year})">Remove</button>
        </div>
        <div class="input-control cash-flow-input-wrapper">
            <span class="cash-flow-currency">$</span>
            <input type="number" class="input cash-flow-input-field"
                   data-year="${year}" value="${value.toFixed(2)}"
                   step="0.01" style="padding-left: 2rem;">
        </div>
    `;

    return card;
}

/**
 * Calculate NPV from modal (scoped version)
 */
async function calculateNPVFromModal() {
    // Use the scoped NPV calculation function from npv-module.js
    await calculateNPVScoped('dcf-npv');
}

/**
 * Add cash flow year to NPV modal
 */
function addNPVCashFlowYear() {
    const grid = document.getElementById('dcf-npv-cash-flow-grid');
    if (!grid) return;

    const existingCards = grid.querySelectorAll('.cash-flow-card');
    const nextYear = existingCards.length + 1;

    if (nextYear > 10) {
        alert('Maximum 10 years allowed');
        return;
    }

    const card = createNPVCashFlowCard(nextYear, 0);
    grid.appendChild(card);
}

/**
 * Remove cash flow year from NPV modal
 */
function removeNPVCashFlowYear(year) {
    const grid = document.getElementById('dcf-npv-cash-flow-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.cash-flow-card'));

    if (cards.length <= 5) {
        alert('Minimum 5 years required');
        return;
    }

    // Find and remove the card for this year
    const cardToRemove = cards.find(card => parseInt(card.getAttribute('data-year')) === year);
    if (cardToRemove) {
        cardToRemove.remove();

        // Renumber remaining cards
        const remainingCards = Array.from(grid.querySelectorAll('.cash-flow-card'));
        remainingCards.forEach((card, index) => {
            const newYear = index + 1;
            card.setAttribute('data-year', newYear);

            const yearLabel = card.querySelector('.cash-flow-card-year');
            if (yearLabel) yearLabel.textContent = `Year ${newYear}`;

            const input = card.querySelector('.cash-flow-input-field');
            if (input) input.setAttribute('data-year', newYear);

            const removeBtn = card.querySelector('.cash-flow-remove-btn');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `removeNPVCashFlowYear(${newYear})`);
                removeBtn.style.display = newYear > 5 ? '' : 'none';
            }
        });
    }
}

// Make functions globally available
// Data Source Info Modal Functions
function showDataSourceInfo() {
    const modal = document.getElementById('data-source-info-modal');
    if (modal) {
        // Update modal content with actual fetched data
        updateDataSourceMetrics();
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeDataSourceInfo() {
    const modal = document.getElementById('data-source-info-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function updateDataSourceMetrics() {
    // Get the last fetched DCF data sources if available
    const dcfData = window.lastDCFDataSources || {};

    // Update Finnhub metrics
    const finnhubContainer = document.getElementById('finnhub-metrics');
    if (finnhubContainer) {
        const finnhubMetrics = dcfData.finnhub || [];
        if (finnhubMetrics.length > 0) {
            finnhubContainer.innerHTML = finnhubMetrics.map(metric =>
                `<span class="metric-chip">${metric}</span>`
            ).join('');
        } else {
            finnhubContainer.innerHTML = '<span class="metric-chip">No data fetched</span>';
        }
    }

    // Update YFinance metrics
    const yfinanceContainer = document.getElementById('yfinance-metrics');
    if (yfinanceContainer) {
        const yfinanceMetrics = dcfData.yfinance || [];
        if (yfinanceMetrics.length > 0) {
            yfinanceContainer.innerHTML = yfinanceMetrics.map(metric =>
                `<span class="metric-chip">${metric}</span>`
            ).join('');
        } else {
            yfinanceContainer.innerHTML = '<span class="metric-chip">No data fetched</span>';
        }
    }

    // Update ChatGPT metrics
    const chatgptContainer = document.getElementById('chatgpt-metrics');
    if (chatgptContainer) {
        const chatgptMetrics = dcfData.chatgpt || [];
        if (chatgptMetrics.length > 0) {
            chatgptContainer.innerHTML = chatgptMetrics.map(metric =>
                `<span class="metric-chip">${metric}</span>`
            ).join('');
        } else {
            chatgptContainer.innerHTML = '<span class="metric-chip">No data fetched</span>';
        }
    }
}

/**
 * Helper function to set button loading state
 */
function setDCFButtonLoading(button, loadingText = 'Loading...') {
    if (!button) return null;
    
    const originalHTML = button.innerHTML;
    button.disabled = true;
    
    // Check if it's a ghost button (white background) or regular button (black background)
    const isGhostButton = button.classList.contains('ghost-button');
    const spinnerColor = isGhostButton 
        ? 'border: 2px solid rgba(15, 15, 15, 0.3); border-top: 2px solid #0f0f0f;'
        : 'border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #ffffff;';
    
    button.innerHTML = `
        <span style="display: inline-flex; align-items: center; gap: 0.5rem;">
            <span class="button-loading-spinner" style="width: 14px; height: 14px; ${spinnerColor} border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;"></span>
            ${loadingText}
        </span>
    `;
    return originalHTML;
}

/**
 * Helper function to restore button state
 */
function restoreDCFButton(button, originalHTML) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = originalHTML;
}

/**
 * Add DCF valuation result to portfolio
 */
function addToPortfolioFromDCF(ticker, buttonElement = null) {
    if (!ticker) {
        showDCFError('No ticker available to add');
        return;
    }

    // Find button if not provided
    if (!buttonElement) {
        const buttons = document.querySelectorAll('button[onclick*="addToPortfolioFromDCF"]');
        buttonElement = Array.from(buttons).find(btn => btn.textContent.includes('Add to My Portfolio'));
    }

    const originalHTML = setDCFButtonLoading(buttonElement, 'Adding...');

    const tickerUpper = ticker.toUpperCase();

    // Check if portfolio module functions are available
    if (typeof addPortfolioAsset === 'undefined') {
        showDCFError('Portfolio module not loaded. Please refresh the page.');
        restoreDCFButton(buttonElement, originalHTML);
        return;
    }

    // Check if ticker already exists in portfolio
    if (window.portfolioAssets && window.portfolioAssets.find(a => a.ticker === tickerUpper)) {
        showDCFError(`${tickerUpper} is already in your portfolio`);
        restoreDCFButton(buttonElement, originalHTML);
        return;
    }

    try {
        // Prepare rich asset data from DCF_DATA
        const assetData = {
            ticker: tickerUpper,
            companyName: window.DCF_DATA?.companyName || '',
            currency: window.DCF_DATA?.currency || 'USD',
            exchange: window.DCF_DATA?.exchange || '',
            npvData: null, // DCF doesn't have NPV data, but we can store DCF data separately if needed
            dcfData: window.DCF_DATA?.dcfData || null,
            source: 'dcf'
        };

        // Call addPortfolioAsset with rich data
        addPortfolioAsset(assetData);

        const companyDisplay = assetData.companyName ? `${assetData.companyName} (${tickerUpper})` : tickerUpper;
        showDCFSuccess(`Added ${companyDisplay} to Portfolio Optimization`);

        restoreDCFButton(buttonElement, originalHTML);
    } catch (error) {
        console.error('Add to portfolio error:', error);
        showDCFError(`Failed to add ${tickerUpper} to portfolio: ${error.message}`);
        restoreDCFButton(buttonElement, originalHTML);
    }
}

/**
 * Show DCF success message
 */
function showDCFSuccess(message) {
    const errorMsg = document.getElementById('dcf-error-message');
    if (errorMsg) {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        errorMsg.style.color = '#059669';
        errorMsg.style.background = '#d1fae5';
        errorMsg.style.borderColor = '#10b981';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 5000);
    }
}

// Make functions globally available
window.fetchDCFCompanyData = fetchDCFCompanyData;
window.calculateDCF = calculateDCF;
window.runInlineDCFSensitivity = runInlineDCFSensitivity;
window.openNPVModal = openNPVModal;
window.closeNPVModal = closeNPVModal;
window.calculateNPVFromModal = calculateNPVFromModal;
window.addNPVCashFlowYear = addNPVCashFlowYear;
window.removeNPVCashFlowYear = removeNPVCashFlowYear;
window.showDataSourceInfo = showDataSourceInfo;
window.closeDataSourceInfo = closeDataSourceInfo;
window.addToPortfolioFromDCF = addToPortfolioFromDCF;
