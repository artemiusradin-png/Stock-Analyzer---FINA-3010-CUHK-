/**
 * DCF Valuation Module
 * Handles company-level Discounted Cash Flow analysis with AI-powered data extraction
 */

// API base URL
function getDCFAPIBase() {
    if (window.API_BASE_URL) return window.API_BASE_URL.replace(/\/api$/, '');
    const metaBase = document.querySelector('meta[name="dcf-api-base"]')?.getAttribute('content');
    if (metaBase) return metaBase.replace(/\/api$/, '');
    return 'http://localhost:8000';
}

const DCF_API_BASE = getDCFAPIBase();

// Track last DCF result for inline sensitivity
let lastDCFResult = null;

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

        // Call AI NPV endpoint to fetch comprehensive financial data
        const response = await fetch(`${DCF_API_BASE}/api/ai-npv/fetch-dcf-financials`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ticker: ticker })
        });

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
        showDCFError(`Failed to fetch financial data: ${error.message}. You can enter values manually.`);
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
    try {
        // Show loading state
        const calculateBtn = document.getElementById('calculate-dcf-button');
        const errorMsg = document.getElementById('dcf-error-message');

        if (calculateBtn) {
            calculateBtn.disabled = true;
            calculateBtn.innerHTML = '<span>Calculating...</span>';
        }

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
            return;
        }

        if (revenue <= 0) {
            showDCFError('Please enter a valid revenue value');
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

        // Call DCF API
        const response = await fetch(`${DCF_API_BASE}/api/valuations/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
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
            })
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
        // Reset button
        const calculateBtn = document.getElementById('calculate-dcf-button');
        if (calculateBtn) {
            calculateBtn.disabled = false;
            calculateBtn.innerHTML = '<span>Calculate DCF Valuation</span>';
        }
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

// Make functions globally available
window.fetchDCFCompanyData = fetchDCFCompanyData;
window.calculateDCF = calculateDCF;
window.runInlineDCFSensitivity = runInlineDCFSensitivity;
