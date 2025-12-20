/**
 * Portfolio Management Module
 * Handles DCF Valuation, Portfolio Optimization, and Sentiment Analysis
 */

// Get API base URL
function getPortfolioAPIBase() {
    // Try multiple sources for API base URL
    if (window.API_BASE_URL) {
        return window.API_BASE_URL.replace(/\/api$/, '');
    }

    const metaBase = document.querySelector('meta[name="dcf-api-base"]')?.getAttribute('content');
    if (metaBase) {
        return metaBase.replace(/\/api$/, '');
    }

    // Use API client if available
    if (window.API && window.API.getBaseUrl) {
        return window.API.getBaseUrl();
    }

    // Default to localhost:8000 (not 5050)
    return 'http://localhost:8000';
}

const PORTFOLIO_API_BASE = getPortfolioAPIBase();

// Portfolio assets storage with enhanced metadata
// Each asset can have: { ticker, weight, companyName, npvData, dcfData, currency, exchange, source }
let portfolioAssets = [];

// Make portfolioAssets accessible globally for adding from other modules
window.portfolioAssets = portfolioAssets;

const OPTIMIZATION_PARAMS_KEY = 'portfolioOptimizationParams';
const ACTIVE_TAB_KEY = 'npvActiveTab';
const SCROLL_POS_KEY = 'npvScrollY';

// QuickChart API configuration
const QUICKCHART_API_KEY = 'sk-zMh-5GPf4rfkoNjDIKPLOUgGS7qMhTIDtHI8bZcA8pNurwK2I3Bmdq8mTk6mEbMZguTvHKGT_pXZPZ7jwOQW0GLgxFRi';
const QUICKCHART_BASE_URL = 'https://quickchart.io/chart';

/**
 * Generate chart using QuickChart API with Chart.js fallback
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Object} chartConfig - Chart.js configuration object
 * @param {Function} fallbackFn - Optional fallback function that creates Chart.js chart
 * @returns {Promise<boolean>} - True if QuickChart succeeded, false if using fallback
 */
async function renderChartWithQuickChart(canvas, chartConfig, fallbackFn = null) {
    try {
        // Build QuickChart URL
        const chartConfigStr = encodeURIComponent(JSON.stringify(chartConfig));
        const quickChartUrl = `${QUICKCHART_BASE_URL}?c=${chartConfigStr}&key=${QUICKCHART_API_KEY}&width=800&height=400&devicePixelRatio=2.0`;

        // Create image and load from QuickChart
        const img = new Image();
        img.crossOrigin = 'anonymous';

        return new Promise((resolve) => {
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                canvas.width = 800;
                canvas.height = 400;
                ctx.drawImage(img, 0, 0, 800, 400);
                console.log('✓ Chart rendered using QuickChart API');
                resolve(true);
            };

            img.onerror = () => {
                console.warn('QuickChart API failed, falling back to Chart.js');
                if (fallbackFn) {
                    fallbackFn();
                }
                resolve(false);
            };

            img.src = quickChartUrl;

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!img.complete) {
                    console.warn('QuickChart API timeout, falling back to Chart.js');
                    if (fallbackFn) {
                        fallbackFn();
                    }
                    resolve(false);
                }
            }, 5000);
        });
    } catch (error) {
        console.error('QuickChart error:', error);
        if (fallbackFn) {
            fallbackFn();
        }
        return false;
    }
}

function persistPortfolioAssets() {
    try {
        localStorage.setItem('portfolioAssets', JSON.stringify(portfolioAssets));
    } catch (err) {
        console.warn('Unable to persist portfolio assets:', err);
    }
}

function loadPortfolioAssetsFromStorage() {
    try {
        const saved = localStorage.getItem('portfolioAssets');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
            portfolioAssets = parsed;
            window.portfolioAssets = portfolioAssets;
            renderPortfolioAssets();
        }
    } catch (err) {
        console.warn('Unable to load saved portfolio assets:', err);
    }
}

function getOptimizationParamsFromUI() {
    const strategy = document.getElementById('portfolio-strategy')?.value;
    const targetReturn = document.getElementById('portfolio-target-return')?.value;
    const riskFree = document.getElementById('portfolio-risk-free')?.value;
    const maxWeight = document.getElementById('portfolio-max-weight')?.value;
    const minWeight = document.getElementById('portfolio-min-weight')?.value;

    return { strategy, targetReturn, riskFree, maxWeight, minWeight };
}

function persistOptimizationParams() {
    try {
        localStorage.setItem(OPTIMIZATION_PARAMS_KEY, JSON.stringify(getOptimizationParamsFromUI()));
    } catch (err) {
        console.warn('Unable to persist optimization params:', err);
    }
}

function loadOptimizationParams() {
    try {
        const saved = localStorage.getItem(OPTIMIZATION_PARAMS_KEY);
        if (!saved) return;
        const params = JSON.parse(saved);
        if (!params || typeof params !== 'object') return;

        const applyValue = (id, value) => {
            const el = document.getElementById(id);
            if (el && value !== undefined && value !== null && value !== '') {
                el.value = value;
            }
        };

        applyValue('portfolio-strategy', params.strategy);
        applyValue('portfolio-target-return', params.targetReturn);
        applyValue('portfolio-risk-free', params.riskFree);
        applyValue('portfolio-max-weight', params.maxWeight);
        applyValue('portfolio-min-weight', params.minWeight);
    } catch (err) {
        console.warn('Unable to load optimization params:', err);
    }
}

function attachOptimizationParamListeners() {
    const ids = [
        'portfolio-strategy',
        'portfolio-target-return',
        'portfolio-risk-free',
        'portfolio-max-weight',
        'portfolio-min-weight'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', persistOptimizationParams);
        el.addEventListener('input', persistOptimizationParams);
    });
}

/**
 * Tab Management
 */
function initNPVTabs() {
    const tabButtons = document.querySelectorAll('.npv-tab-btn');
    const tabContents = document.querySelectorAll('.npv-tab-content');

    const activateTab = (tabName) => {
            // Remove active class from all buttons and hide all contents
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });

            // Add active class to clicked button and show corresponding content
        const targetButton = Array.from(tabButtons).find(b => b.dataset.tab === tabName);
        const targetContent = document.getElementById(`${tabName}-tab`);
        if (targetButton) targetButton.classList.add('active');
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block';
            }
        // Toggle sub-tabs visibility based on top-level tab
        const subTabsContainer = document.querySelector('.npv-sub-tabs-container');
        if (subTabsContainer) {
            subTabsContainer.style.display = (tabName === 'npv-calculator') ? 'flex' : 'none';
        }
        try {
            localStorage.setItem(ACTIVE_TAB_KEY, tabName);
        } catch (err) {
            console.warn('Unable to persist active tab:', err);
        }
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    // Restore last tab or default to first
    const savedTab = (() => {
        try {
            return localStorage.getItem(ACTIVE_TAB_KEY);
        } catch {
            return null;
        }
    })();
    const initialTab = (savedTab && document.getElementById(`${savedTab}-tab`)) ? savedTab : tabButtons[0]?.dataset.tab;
    if (initialTab) {
        activateTab(initialTab);
    }
}

/**
 * DCF Valuation Functions
 */
async function calculateDCF() {
    const errorDiv = document.getElementById('dcf-error-message');
    errorDiv.style.display = 'none';

    // Get input values
    const ticker = document.getElementById('dcf-ticker').value.trim();
    const forecastPeriod = parseFloat(document.getElementById('dcf-forecast-period').value);
    const revenue = parseFloat(document.getElementById('dcf-revenue').value);
    const revenueGrowth = parseFloat(document.getElementById('dcf-revenue-growth').value);
    const fcfMargin = parseFloat(document.getElementById('dcf-fcf-margin').value);
    const terminalGrowth = parseFloat(document.getElementById('dcf-terminal-growth').value);
    const riskFree = parseFloat(document.getElementById('dcf-risk-free').value);
    const marketPremium = parseFloat(document.getElementById('dcf-market-premium').value);
    const beta = parseFloat(document.getElementById('dcf-beta').value);
    const costDebt = parseFloat(document.getElementById('dcf-cost-debt').value);
    const taxRate = parseFloat(document.getElementById('dcf-tax-rate').value);
    const debtEquity = parseFloat(document.getElementById('dcf-debt-equity').value);

    // Validate inputs
    if (!ticker) {
        showDCFError('Please enter a ticker symbol');
        return;
    }

    const requestBody = {
        ticker: ticker.toUpperCase(),
        forecast_period: forecastPeriod,
        revenue: revenue,
        revenue_growth: revenueGrowth / 100,
        fcf_margin: fcfMargin / 100,
        terminal_growth: terminalGrowth / 100,
        risk_free_rate: riskFree / 100,
        market_premium: marketPremium / 100,
        beta: beta,
        cost_of_debt: costDebt / 100,
        tax_rate: taxRate / 100,
        debt_equity_ratio: debtEquity
    };

    const button = document.getElementById('calculate-dcf-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Calculating...</span>';
    button.disabled = true;

    try {
        const response = await fetch(`${PORTFOLIO_API_BASE}/api/valuations/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        displayDCFResults(data);

    } catch (error) {
        console.error('DCF calculation error:', error);
        showDCFError(error.message || 'Failed to calculate DCF. Please try again.');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function showDCFError(message) {
    const errorDiv = document.getElementById('dcf-error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function displayDCFResults(data) {
    const container = document.getElementById('dcf-results-container');

    const enterpriseValue = formatCurrency(data.enterprise_value || 0);
    const equityValue = formatCurrency(data.equity_value || 0);
    const wacc = ((data.wacc || 0) * 100).toFixed(2);
    const intrinsicValue = formatCurrency(data.intrinsic_value_per_share || 0);

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div class="summary-card primary">
                <div class="card-label">Enterprise Value</div>
                <div class="card-value">${enterpriseValue}</div>
            </div>
            <div class="summary-card success">
                <div class="card-label">Equity Value</div>
                <div class="card-value">${equityValue}</div>
            </div>
            <div class="summary-card">
                <div class="card-label">WACC</div>
                <div class="card-value">${wacc}%</div>
            </div>
            <div class="summary-card warning">
                <div class="card-label">Intrinsic Value/Share</div>
                <div class="card-value">${intrinsicValue}</div>
            </div>
        </div>

        ${data.fcf_projections ? `
            <div class="table-container">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 600;">FCF Projections</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Year</th>
                            <th class="number">Revenue ($B)</th>
                            <th class="number">FCF ($B)</th>
                            <th class="number">PV of FCF ($B)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.fcf_projections.map((proj, idx) => `
                            <tr>
                                <td>Year ${idx + 1}</td>
                                <td class="number">${(proj.revenue || 0).toFixed(2)}</td>
                                <td class="number">${(proj.fcf || 0).toFixed(2)}</td>
                                <td class="number">${(proj.pv_fcf || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;
}

/**
 * Portfolio Optimization Functions
 */
function addPortfolioAsset(assetData = null) {
    let ticker, companyName, npvData, dcfData, currency, exchange, source;

    if (assetData && typeof assetData === 'object') {
        // Called programmatically with rich data from AI NPV
        ticker = assetData.ticker?.trim().toUpperCase();
        companyName = assetData.companyName || '';
        npvData = assetData.npvData || null;
        dcfData = assetData.dcfData || null;
        currency = assetData.currency || 'USD';
        exchange = assetData.exchange || '';
        source = assetData.source || '';
    } else {
        // Called from UI input
        const tickerInput = document.getElementById('portfolio-ticker-input');
        ticker = tickerInput.value.trim().toUpperCase();
        companyName = '';
        npvData = null;
        dcfData = null;
        currency = 'USD';
        exchange = '';
        source = 'manual';
    }

    if (!ticker) {
        showPortfolioError('Please enter a ticker symbol');
        return;
    }

    if (portfolioAssets.find(a => a.ticker === ticker)) {
        showPortfolioError('Asset already added to portfolio');
        return;
    }

    portfolioAssets.push({
        ticker: ticker,
        weight: 0,
        companyName: companyName,
        npvData: npvData,
        dcfData: dcfData,
        currency: currency,
        exchange: exchange,
        source: source
    });

    // Update global reference
    window.portfolioAssets = portfolioAssets;
    persistPortfolioAssets();

    // Clear input if called from UI
    const tickerInput = document.getElementById('portfolio-ticker-input');
    if (tickerInput && !assetData) {
        tickerInput.value = '';
    }

    renderPortfolioAssets();
    showPortfolioSuccess(`${ticker} added to portfolio`);
}

function removePortfolioAsset(ticker) {
    portfolioAssets = portfolioAssets.filter(a => a.ticker !== ticker);
    // Update global reference
    window.portfolioAssets = portfolioAssets;
    persistPortfolioAssets();
    renderPortfolioAssets();
}

function renderPortfolioAssets() {
    const container = document.getElementById('portfolio-assets-list');
    if (!container) return;

    if (portfolioAssets.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; font-size: 0.9rem;">No assets added yet. Analyze stocks with AI NPV first, then add them here.</p>';
        return;
    }

    container.innerHTML = portfolioAssets.map(asset => {
        const displayName = asset.companyName
            ? `<div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <span style="font-weight: 600; color: #0f0f0f; font-size: 0.95rem;">${asset.ticker}</span>
                <span style="font-size: 0.75rem; color: #6b7280;">${asset.companyName}</span>
               </div>`
            : `<span style="font-weight: 600; color: #0f0f0f;">${asset.ticker}</span>`;

        const npvBadge = asset.npvData
            ? `<span style="padding: 0.25rem 0.5rem; background: ${asset.npvData.npv >= 0 ? '#d1fae5' : '#fee2e2'}; color: ${asset.npvData.npv >= 0 ? '#065f46' : '#991b1b'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-right: 0.35rem;">
                NPV: ${asset.npvData.npv >= 0 ? '+' : ''}${asset.npvData.npv.toFixed(2)}
               </span>`
            : '';

        const dcfBadge = asset.dcfData
            ? `<span style="padding: 0.25rem 0.5rem; background: #e0f2fe; color: #0ea5e9; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-right: 0.35rem;">
                DCF
               </span>`
            : '';

        return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: ${asset.npvData ? '#f0fdf4' : '#f9fafb'}; border: 1px solid ${asset.npvData ? '#86efac' : '#e5e5e5'}; border-radius: 6px; margin-bottom: 0.5rem;">
            ${displayName}
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${npvBadge}${dcfBadge}
                <button onclick="removePortfolioAsset('${asset.ticker}')" style="padding: 0.35rem 0.75rem; background: #ffffff; border: 1px solid #ef4444; border-radius: 4px; color: #ef4444; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;">Remove</button>
            </div>
        </div>
        `;
    }).join('');
}

async function optimizePortfolio() {
    if (portfolioAssets.length < 2) {
        showPortfolioError('Please add at least 2 assets to optimize portfolio');
        return;
    }

    console.log('DEBUG Frontend: portfolioAssets array:', portfolioAssets);

    const strategy = document.getElementById('portfolio-strategy')?.value || 'max_sharpe';
    const targetReturn = parseFloat(document.getElementById('portfolio-target-return')?.value || 0);
    const riskFree = parseFloat(document.getElementById('portfolio-risk-free')?.value || 4.5);
    const maxWeight = parseFloat(document.getElementById('portfolio-max-weight')?.value || 40) / 100;
    const minWeight = parseFloat(document.getElementById('portfolio-min-weight')?.value || 0) / 100;

    const requestBody = {
        assets: portfolioAssets.map(a => ({ ticker: a.ticker })),
        strategy: strategy,
        constraints: {
            min_weight: minWeight,
            max_weight: maxWeight,
            target_return: targetReturn > 0 ? targetReturn / 100 : null
        },
        lookback_days: 252,
        risk_free_rate: riskFree / 100
    };

    console.log('DEBUG Frontend: Request body:', JSON.stringify(requestBody, null, 2));

    persistOptimizationParams();

    const button = document.getElementById('optimize-portfolio-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Optimizing...</span>';
    button.disabled = true;

    try {
        const response = await fetch(`${PORTFOLIO_API_BASE}/api/portfolios/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        displayPortfolioResults(data);

    } catch (error) {
        console.error('Portfolio optimization error:', error);
        showPortfolioError(error.message || 'Failed to optimize portfolio. Please try again.');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function showPortfolioError(message) {
    const errorDiv = document.getElementById('portfolio-error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showPortfolioSuccess(message) {
    const errorDiv = document.getElementById('portfolio-error-message');
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.color = '#065f46';
    errorDiv.style.background = '#d1fae5';
    errorDiv.style.border = '1px solid #10b981';
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.color = '';
        errorDiv.style.background = '';
        errorDiv.style.border = '';
    }, 5000);
}

function displayPortfolioResults(data) {
    const metricsContainer = document.getElementById('portfolio-metrics-container');
    const resultsContainer = document.getElementById('portfolio-results-container');
    const statusEl = document.getElementById('portfolio-optimization-status');
    const titleEl = document.getElementById('portfolio-optimization-title');
    const strategyEl = document.getElementById('portfolio-optimization-strategy');

    const expectedReturn = ((data.expected_return || 0) * 100).toFixed(2);
    const volatility = ((data.volatility || 0) * 100).toFixed(2);
    const sharpeRatio = (data.sharpe_ratio || 0).toFixed(3);
    const strategyLabel = {
        max_sharpe: 'Maximum Sharpe',
        min_variance: 'Minimum Variance',
        risk_parity: 'Risk Parity',
        equal_weight: 'Equal Weight',
        target_return: 'Target Return',
        dcf_weighted: 'DCF-Weighted'
    }[data.strategy] || data.strategy || 'Optimized';

    // Store data globally for efficient frontier and Monte Carlo
    window.currentPortfolioData = data;

    // Update panel header (outside of results box)
    if (statusEl) statusEl.textContent = 'Optimization complete';
    if (titleEl) titleEl.textContent = 'Portfolio Metrics';
    if (strategyEl) strategyEl.textContent = `Strategy: ${strategyLabel}`;
    const metricsPanelHeader = document.querySelector('#portfolio-metrics-container')?.previousElementSibling;
    if (metricsPanelHeader && metricsPanelHeader.classList.contains('panel-header')) {
        metricsPanelHeader.style.display = 'none';
    }

    // Display Portfolio Metrics in separate container
    metricsContainer.innerHTML = `
        <div class="portfolio-results-shell metrics-shell">
            <div class="metrics-heading">
                <div>
                    <h3>Portfolio Metrics</h3>
                    <p class="muted">Weights, expected return, volatility, and Sharpe</p>
            </div>
                <div class="portfolio-actions" style="justify-content: flex-end;">
                    <button class="ghost-button" onclick="exportPortfolioToCSV()">Export CSV</button>
                    <button class="primary-button" onclick="savePortfolioToLocalStorage()">Save Portfolio</button>
            </div>
            </div>

            <div class="portfolio-metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Expected Return</div>
                    <div class="metric-value">${expectedReturn}%</div>
                    <div class="metric-sub">Annualized</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Volatility</div>
                    <div class="metric-value">${volatility}%</div>
                    <div class="metric-sub">Annualized</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Sharpe Ratio</div>
                    <div class="metric-value">${sharpeRatio}</div>
                    <div class="metric-sub">Risk-adjusted</div>
            </div>
        </div>

            ${data.holdings && data.holdings.length > 0 ? `
                <div class="allocation-card">
                    <div class="allocation-header">
                        <div>
                            <p class="eyebrow">Optimal Allocation</p>
                            <h4>Weights & Asset Stats</h4>
                        </div>
                        <span class="pill">${strategyLabel}</span>
                    </div>
                    <div class="portfolio-table-wrap">
                        <table class="portfolio-table">
                    <thead>
                        <tr>
                            <th>Ticker</th>
                                    <th class="number">Weight</th>
                                    <th class="number">Exp. Return</th>
                                    <th class="number">Volatility</th>
                                    <th class="number">Risk Contrib.</th>
                        </tr>
                    </thead>
                    <tbody>
                                ${data.holdings.map(h => `
                                    <tr>
                                        <td><span class="ticker-chip">${h.ticker}</span></td>
                                        <td class="number">${((h.weight || 0) * 100).toFixed(2)}%</td>
                                        <td class="number">${((h.expected_return || 0) * 100).toFixed(2)}%</td>
                                        <td class="number">${((h.volatility || 0) * 100).toFixed(2)}%</td>
                                        <td class="number">${((h.contribution_to_risk || 0) * 100).toFixed(2)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                    </div>
            </div>
        ` : ''}
        </div>
    `;

    // Display charts in separate container
    resultsContainer.innerHTML = `
        <div class="portfolio-results-shell">
            <div class="portfolio-chart-grid">
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h4>Efficient Frontier</h4>
                        <span class="pill soft">Risk/Return</span>
                    </div>
                    <div id="efficient-frontier-loading" class="chart-loading" style="display: none;">
                        <div class="spinner"></div>
                        <p>Generating efficient frontier...</p>
                    </div>
                    <canvas id="efficient-frontier-chart"></canvas>
                </div>
                <div class="chart-card">
                    <div class="chart-card-header">
                        <h4>Monte Carlo Simulation</h4>
                        <span class="pill soft">1,000 paths</span>
                    </div>
                    <div id="monte-carlo-loading" class="chart-loading" style="display: none;">
                        <div class="spinner green"></div>
                        <p>Running simulation...</p>
                    </div>
                    <canvas id="monte-carlo-chart"></canvas>
                </div>
            </div>
        </div>
    `;

    // Auto-generate charts if we have data
    if (data.holdings && data.holdings.length > 0) {
        setTimeout(() => {
            plotEfficientFrontier();
            runMonteCarloSimulation();
            calculateRiskAnalytics();
        }, 500);
    }
}

/**
 * Risk Analytics Functions
 */
async function calculateRiskAnalytics() {
    if (!window.currentPortfolioData || !portfolioAssets || portfolioAssets.length < 1) {
        return;
    }

    const tickers = portfolioAssets.map(a => a.ticker);
    const weights = window.currentPortfolioData.holdings.map(h => h.weight);
    const riskFree = parseFloat(document.getElementById('portfolio-risk-free')?.value || 4.5) / 100;

    try {
        const response = await fetch(`${PORTFOLIO_API_BASE}/api/portfolios/risk-analytics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tickers: tickers,
                weights: weights,
                lookback_days: 252,
                risk_free_rate: riskFree,
                confidence_level: 0.95
            })
        });

        if (!response.ok) {
            throw new Error('Failed to calculate risk analytics');
        }

        const data = await response.json();
        displayRiskAnalytics(data);

    } catch (error) {
        console.error('Risk analytics error:', error);
        // Don't show alert, just log - risk analytics is optional
    }
}

function displayRiskAnalytics(data) {
    // Find or create risk analytics container - make it full-width
    let container = document.getElementById('risk-analytics-container');
    if (!container) {
        // Create container after portfolio results section, outside of panels but within the tab
        const portfolioTab = document.getElementById('portfolio-optimization-tab');
        if (portfolioTab) {
            // Find the panels container (the div containing all panels)
            const panelsContainer = portfolioTab.querySelector('.npv-tabs-row')?.nextElementSibling;
            if (panelsContainer && panelsContainer.classList.contains('npv-tabs-row')) {
                // Insert after the panels row
                container = document.createElement('div');
                container.id = 'risk-analytics-container';
                container.className = 'risk-analytics-full-width';
                panelsContainer.parentElement.insertBefore(container, panelsContainer.nextSibling);
            } else {
                // Fallback: append to tab
                container = document.createElement('div');
                container.id = 'risk-analytics-container';
                container.className = 'risk-analytics-full-width';
                portfolioTab.appendChild(container);
            }
        } else {
            // Fallback: create after portfolio results
            const resultsContainer = document.getElementById('portfolio-results-container');
            if (resultsContainer) {
                container = document.createElement('div');
                container.id = 'risk-analytics-container';
                container.className = 'risk-analytics-full-width';
                resultsContainer.parentElement.parentElement.appendChild(container);
            }
        }
    }

    const metrics = data.portfolio_metrics;
    const decomp = data.risk_decomposition;

    container.innerHTML = `
        <div class="risk-shell">
            <div class="risk-header">
                <div>
                    <p class="eyebrow">Risk Analytics</p>
                    <h3>Comprehensive risk metrics & decomposition</h3>
                    <p class="muted">Confidence: 95% | Lookback: 252d</p>
                </div>
                <div class="pill soft">Risk snapshot</div>
            </div>

            <div class="risk-vertical-list">
                <div class="risk-section">
                    <div class="risk-section-title">Volatility Metrics</div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Annualized Volatility</span>
                        <span class="risk-metric-value">${(metrics.annualized_volatility * 100).toFixed(2)}%</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Downside Volatility</span>
                        <span class="risk-metric-value">${(metrics.downside_volatility * 100).toFixed(2)}%</span>
                    </div>
                </div>

                <div class="risk-section">
                    <div class="risk-section-title">Downside Risk</div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">VaR (95%)</span>
                        <span class="risk-metric-value">${(metrics.value_at_risk * 100).toFixed(2)}%</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">CVaR (ES)</span>
                        <span class="risk-metric-value">${(metrics.conditional_value_at_risk * 100).toFixed(2)}%</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Max Drawdown</span>
                        <span class="risk-metric-value">${(metrics.max_drawdown * 100).toFixed(2)}%</span>
                    </div>
                </div>

                <div class="risk-section">
                    <div class="risk-section-title">Risk-Adjusted Returns</div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Sharpe</span>
                        <span class="risk-metric-value">${metrics.sharpe_ratio.toFixed(3)}</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Sortino</span>
                        <span class="risk-metric-value">${metrics.sortino_ratio.toFixed(3)}</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Calmar</span>
                        <span class="risk-metric-value">${metrics.calmar_ratio.toFixed(3)}</span>
                    </div>
                </div>

                <div class="risk-section">
                    <div class="risk-section-title">Distribution</div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Skewness</span>
                        <span class="risk-metric-value">${metrics.skewness.toFixed(3)}</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Kurtosis</span>
                        <span class="risk-metric-value">${metrics.kurtosis.toFixed(3)}</span>
                    </div>
                </div>

                ${metrics.beta !== null ? `
                <div class="risk-section">
                    <div class="risk-section-title">Market Risk (vs SPY)</div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Beta</span>
                        <span class="risk-metric-value">${metrics.beta.toFixed(3)}</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Alpha (Annual)</span>
                        <span class="risk-metric-value">${(metrics.alpha * 100).toFixed(2)}%</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">R-Squared</span>
                        <span class="risk-metric-value">${(metrics.r_squared * 100).toFixed(1)}%</span>
                    </div>
                </div>
                ` : ''}

                <div class="risk-section">
                    <div class="risk-section-title">Risk Components</div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Systematic (Market)</span>
                        <span class="risk-metric-value">${(data.systematic_risk * 100).toFixed(2)}%</span>
                    </div>
                    <div class="risk-metric-row">
                        <span class="risk-metric-label">Idiosyncratic (Specific)</span>
                        <span class="risk-metric-value">${(data.idiosyncratic_risk * 100).toFixed(2)}%</span>
                    </div>
                </div>

                <div class="risk-section">
                    <div class="risk-section-title">Contribution by Asset</div>
                    <div class="portfolio-table-wrap">
                        <table class="portfolio-table risk-table">
                            <thead>
                                <tr>
                                    <th>Asset</th>
                                    <th class="number">Weight</th>
                                    <th class="number">Risk %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${decomp.map(d => `
                                    <tr>
                                        <td><span class="ticker-chip">${d.ticker}</span></td>
                                        <td class="number">${(d.weight * 100).toFixed(2)}%</td>
                                        <td class="number">${d.percent_contribution_to_risk.toFixed(2)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="risk-section">
                    <div class="risk-section-title">Risk Decomposition Chart</div>
                    <div style="position: relative; height: 300px; width: 100%;">
                        <canvas id="risk-decomposition-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Plot risk decomposition pie chart
    setTimeout(() => plotRiskDecomposition(decomp), 100);
}

let riskDecompositionChart = null;

async function plotRiskDecomposition(decomposition) {
    const ctx = document.getElementById('risk-decomposition-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (riskDecompositionChart) {
        riskDecompositionChart.destroy();
    }

    const labels = decomposition.map(d => d.ticker);
    const data = decomposition.map(d => d.percent_contribution_to_risk);

    // Build chart configuration with professional theme
    const chartConfig = {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#0f0f0f',
                    '#1a1a1a',
                    '#52525b',
                    '#71717a',
                    '#a1a1aa',
                    '#d4d4d8',
                    '#e4e4e7',
                    '#f4f4f5'
                ],
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverBorderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1.8,
            layout: {
                padding: {
                    left: 0,
                    right: 0,
                    top: 10,
                    bottom: 10
                }
            },
            plugins: {
                legend: {
                    position: 'right',
                    align: 'start',
                    display: true,
                    fullSize: true,
                    labels: {
                        font: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            size: 18,
                            weight: '700'
                        },
                        color: '#0f0f0f',
                        padding: 18,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 16,
                        boxHeight: 16
                    }
                },
                tooltip: {
                    backgroundColor: '#0f0f0f',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    titleFont: {
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        size: 12,
                        weight: '600'
                    },
                    bodyFont: {
                        family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        size: 11
                    },
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: true,
                    borderColor: '#1a1a1a',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.toFixed(2)}% of risk`;
                        }
                    }
                },
                title: {
                    display: false
                }
            }
        }
    };

    // Use Chart.js directly for risk decomposition to ensure legend positioning works
    // QuickChart API may not properly support right-side legend positioning
    riskDecompositionChart = new Chart(ctx, chartConfig);
    console.log('Using Chart.js for risk decomposition with right-side legend');
}

/**
 * Sentiment Analysis Functions
 */
async function analyzeSentiment() {
    const tickerInput = document.getElementById('sentiment-ticker');
    const ticker = tickerInput.value.trim().toUpperCase();

    if (!ticker) {
        showSentimentError('Please enter a ticker symbol');
        return;
    }

    const button = document.getElementById('analyze-sentiment-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Analyzing...</span>';
    button.disabled = true;

    try {
        const response = await fetch(`${PORTFOLIO_API_BASE}/api/sentiment/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ticker: ticker,
                days: 30
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        const data = await response.json();
        displaySentimentResults(data, ticker);

    } catch (error) {
        console.error('Sentiment analysis error:', error);
        showSentimentError(error.message || 'Failed to analyze sentiment. Please try again.');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function showSentimentError(message) {
    const errorDiv = document.getElementById('sentiment-error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function displaySentimentResults(data, ticker) {
    const container = document.getElementById('sentiment-results-container');

    const sentimentScore = (data.overall_sentiment || 0).toFixed(2);
    const sentimentLabel = sentimentScore > 0.1 ? 'Positive' : sentimentScore < -0.1 ? 'Negative' : 'Neutral';
    const sentimentColor = sentimentScore > 0.1 ? '#10b981' : sentimentScore < -0.1 ? '#ef4444' : '#fbbf24';

    container.innerHTML = `
        <div style="text-align: center; margin-bottom: 2rem; padding: 1.5rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
            <div style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Overall Sentiment for ${ticker}</div>
            <div style="font-size: 2.5rem; font-weight: 700; color: ${sentimentColor}; margin-bottom: 0.5rem;">${sentimentLabel}</div>
            <div style="font-size: 1rem; color: rgba(255, 255, 255, 0.6);">Score: ${sentimentScore}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div class="summary-card">
                <div class="card-label">Sentiment Trend</div>
                <div class="card-value">${data.sentiment_trend || 'N/A'}</div>
            </div>
            <div class="summary-card">
                <div class="card-label">7d News Volume</div>
                <div class="card-value">${data.news_volume_7d || 0}</div>
            </div>
            <div class="summary-card">
                <div class="card-label">30d Avg Sentiment</div>
                <div class="card-value">${(data.avg_sentiment_30d || 0).toFixed(2)}</div>
            </div>
        </div>

        ${data.articles && data.articles.length > 0 ? `
            <div>
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 600;">Recent News</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${data.articles.slice(0, 5).map(article => `
                        <div style="padding: 1rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
                            <div style="font-weight: 600; margin-bottom: 0.5rem;">${article.headline || 'No headline'}</div>
                            <div style="font-size: 0.875rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.5rem;">${article.summary || ''}</div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: rgba(255, 255, 255, 0.4);">
                                <span>${new Date(article.datetime * 1000).toLocaleDateString()}</span>
                                <span style="color: ${article.sentiment > 0 ? '#10b981' : article.sentiment < 0 ? '#ef4444' : '#fbbf24'}">
                                    Sentiment: ${(article.sentiment || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '<p style="color: rgba(255, 255, 255, 0.4);">No news data available.</p>'}
    `;
}

/**
 * Format currency helper
 */
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '$--';
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue >= 1e9) {
        return `${sign}$${(absValue / 1e9).toFixed(2)}B`;
    } else if (absValue >= 1e6) {
        return `${sign}$${(absValue / 1e6).toFixed(2)}M`;
    } else if (absValue >= 1e3) {
        return `${sign}$${(absValue / 1e3).toFixed(2)}K`;
    } else {
        return `${sign}$${absValue.toFixed(2)}`;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Restore scroll position (done after paint for smoother behavior)
    try {
        const savedScroll = localStorage.getItem(SCROLL_POS_KEY);
        if (savedScroll !== null) {
            setTimeout(() => window.scrollTo(0, parseInt(savedScroll, 10) || 0), 0);
        }
    } catch (err) {
        console.warn('Unable to restore scroll position:', err);
    }

    loadPortfolioAssetsFromStorage();
    loadOptimizationParams();
    initNPVTabs();
    attachOptimizationParamListeners();
    // Render immediately if storage was empty to ensure empty state shows
    renderPortfolioAssets();
});

// Capture scroll position before leaving/reloading the page
window.addEventListener('beforeunload', () => {
    try {
        localStorage.setItem(SCROLL_POS_KEY, window.scrollY.toString());
    } catch (err) {
        console.warn('Unable to persist scroll position:', err);
    }
});

/**
 * Efficient Frontier Visualization
 */
let efficientFrontierChart = null;

async function plotEfficientFrontier() {
    if (!portfolioAssets || portfolioAssets.length < 2) {
        alert('Please add at least 2 assets to generate efficient frontier');
        return;
    }

    const tickers = portfolioAssets.map(a => a.ticker);
    const riskFree = parseFloat(document.getElementById('portfolio-risk-free')?.value || 4.5) / 100;

    // Show loading state
    const loadingDiv = document.getElementById('efficient-frontier-loading');
    const canvas = document.getElementById('efficient-frontier-chart');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        canvas.style.display = 'none';
    }

    try {
        const response = await fetch(`${PORTFOLIO_API_BASE}/api/portfolios/efficient-frontier`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tickers: tickers,
                lookback_days: 252,
                n_points: 50,
                risk_free_rate: riskFree
            })
        });

        if (!response.ok) {
            throw new Error('Failed to calculate efficient frontier');
        }

        const data = await response.json();
        const ctx = document.getElementById('efficient-frontier-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (efficientFrontierChart) {
            efficientFrontierChart.destroy();
        }

        // Prepare data
        const frontierData = data.frontier.map(p => ({
            x: p.volatility * 100,
            y: p.return_achieved * 100
        }));

        const maxSharpePoint = {
            x: data.max_sharpe_point.volatility * 100,
            y: data.max_sharpe_point.return_achieved * 100
        };

        // Add current portfolio if available
        const currentPortfolio = window.currentPortfolioData ? {
            x: window.currentPortfolioData.volatility * 100,
            y: window.currentPortfolioData.expected_return * 100
        } : null;

        // Build chart configuration with professional theme
        const chartConfig = {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Efficient Frontier',
                        data: frontierData,
                        borderColor: '#0f0f0f',
                        backgroundColor: 'rgba(15, 15, 15, 0.05)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        borderWidth: 2
                    },
                    {
                        label: 'Max Sharpe Portfolio',
                        data: [maxSharpePoint],
                        borderColor: '#0f0f0f',
                        backgroundColor: '#0f0f0f',
                        pointRadius: 8,
                        pointStyle: 'circle',
                        pointBorderWidth: 2,
                        pointBorderColor: '#ffffff'
                    },
                    ...(currentPortfolio ? [{
                        label: 'Current Portfolio',
                        data: [currentPortfolio],
                        borderColor: '#71717a',
                        backgroundColor: '#71717a',
                        pointRadius: 6,
                        pointBorderWidth: 2,
                        pointBorderColor: '#ffffff'
                    }] : [])
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 11,
                                weight: '600'
                            },
                            color: '#0f0f0f',
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 10,
                            boxHeight: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f0f0f',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        titleFont: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            size: 12,
                            weight: '600'
                        },
                        bodyFont: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            size: 11
                        },
                        padding: 10,
                        cornerRadius: 4,
                        displayColors: true,
                        borderColor: '#1a1a1a',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: Return ${context.parsed.y.toFixed(2)}%, Volatility ${context.parsed.x.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Volatility (%)',
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 11,
                                weight: '600'
                            },
                            color: '#0f0f0f'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 10
                            },
                            color: '#71717a'
                        },
                        grid: {
                            color: '#e5e5e5',
                            drawBorder: false,
                            lineWidth: 1
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Expected Return (%)',
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 11,
                                weight: '600'
                            },
                            color: '#0f0f0f'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 10
                            },
                            color: '#71717a'
                        },
                        grid: {
                            color: '#e5e5e5',
                            drawBorder: false,
                            lineWidth: 1
                        }
                    }
                }
            }
        };

        // Try QuickChart first, fallback to Chart.js
        const quickChartSuccess = await renderChartWithQuickChart(
            ctx,
            chartConfig,
            () => {
                // Fallback: use Chart.js
                efficientFrontierChart = new Chart(ctx, chartConfig);
            }
        );

        // If QuickChart succeeded, we don't need the Chart.js instance
        if (!quickChartSuccess) {
            console.log('Using Chart.js for efficient frontier');
        }

    } catch (error) {
        console.error('Efficient frontier error:', error);
        alert('Failed to generate efficient frontier: ' + error.message);
    } finally {
        // Hide loading state
        const loadingDiv = document.getElementById('efficient-frontier-loading');
        const canvas = document.getElementById('efficient-frontier-chart');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
            canvas.style.display = 'block';
        }
    }
}

/**
 * Monte Carlo Simulation
 */
let monteCarloChart = null;

async function runMonteCarloSimulation() {
    if (!portfolioAssets || portfolioAssets.length < 2) {
        alert('Please add at least 2 assets to run Monte Carlo simulation');
        return;
    }

    const tickers = portfolioAssets.map(a => a.ticker);
    const riskFree = parseFloat(document.getElementById('portfolio-risk-free')?.value || 4.5) / 100;

    // Show loading state
    const loadingDiv = document.getElementById('monte-carlo-loading');
    const canvas = document.getElementById('monte-carlo-chart');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
        canvas.style.display = 'none';
    }

    try {
        const response = await fetch(`${PORTFOLIO_API_BASE}/api/portfolios/monte-carlo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tickers: tickers,
                lookback_days: 252,
                n_simulations: 1000,
                time_horizon_days: 252,
                risk_free_rate: riskFree
            })
        });

        if (!response.ok) {
            throw new Error('Failed to run Monte Carlo simulation');
        }

        const data = await response.json();
        const ctx = document.getElementById('monte-carlo-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (monteCarloChart) {
            monteCarloChart.destroy();
        }

        // Prepare scatter plot data
        const scatterData = data.simulations.map(s => ({
            x: s.volatility_simulated * 100,
            y: s.return_simulated * 100
        }));

        // Add current portfolio if available
        const currentPortfolio = window.currentPortfolioData ? {
            x: window.currentPortfolioData.volatility * 100,
            y: window.currentPortfolioData.expected_return * 100
        } : null;

        // Build chart configuration with professional theme
        const chartConfig = {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Random Portfolios',
                        data: scatterData,
                        backgroundColor: 'rgba(15, 15, 15, 0.15)',
                        borderColor: 'rgba(15, 15, 15, 0.3)',
                        pointRadius: 2.5,
                        pointBorderWidth: 0
                    },
                    ...(currentPortfolio ? [{
                        label: 'Optimized Portfolio',
                        data: [currentPortfolio],
                        backgroundColor: '#0f0f0f',
                        borderColor: '#ffffff',
                        pointRadius: 8,
                        pointStyle: 'circle',
                        pointBorderWidth: 2
                    }] : [])
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 11,
                                weight: '600'
                            },
                            color: '#0f0f0f',
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 10,
                            boxHeight: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f0f0f',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        titleFont: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            size: 12,
                            weight: '600'
                        },
                        bodyFont: {
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            size: 11
                        },
                        padding: 10,
                        cornerRadius: 4,
                        displayColors: true,
                        borderColor: '#1a1a1a',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === 'Optimized Portfolio') {
                                    return `Optimized: Return ${context.parsed.y.toFixed(2)}%, Volatility ${context.parsed.x.toFixed(2)}%`;
                                }
                                return `Return ${context.parsed.y.toFixed(2)}%, Volatility ${context.parsed.x.toFixed(2)}%`;
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Volatility (%)',
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 11,
                                weight: '600'
                            },
                            color: '#0f0f0f'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 10
                            },
                            color: '#71717a'
                        },
                        grid: {
                            color: '#e5e5e5',
                            drawBorder: false,
                            lineWidth: 1
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Expected Return (%)',
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 11,
                                weight: '600'
                            },
                            color: '#0f0f0f'
                        },
                        ticks: {
                            font: {
                                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                size: 10
                            },
                            color: '#71717a'
                        },
                        grid: {
                            color: '#e5e5e5',
                            drawBorder: false,
                            lineWidth: 1
                        }
                    }
                }
            }
        };

        // Try QuickChart first, fallback to Chart.js
        const quickChartSuccess = await renderChartWithQuickChart(
            ctx,
            chartConfig,
            () => {
                // Fallback: use Chart.js
                monteCarloChart = new Chart(ctx, chartConfig);
            }
        );

        // If QuickChart succeeded, we don't need the Chart.js instance
        if (!quickChartSuccess) {
            console.log('Using Chart.js for Monte Carlo');
        }

    } catch (error) {
        console.error('Monte Carlo error:', error);
        alert('Failed to run Monte Carlo simulation: ' + error.message);
    } finally {
        // Hide loading state
        const loadingDiv = document.getElementById('monte-carlo-loading');
        const canvas = document.getElementById('monte-carlo-chart');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
            canvas.style.display = 'block';
        }
    }
}

/**
 * Portfolio Save/Export Functions
 */
function savePortfolioToLocalStorage() {
    if (!window.currentPortfolioData) {
        alert('No portfolio to save. Please optimize a portfolio first.');
        return;
    }

    const portfolioName = prompt('Enter a name for this portfolio:', 'My Portfolio ' + new Date().toLocaleDateString());
    if (!portfolioName) return;

    const portfolioData = {
        name: portfolioName,
        timestamp: new Date().toISOString(),
        assets: portfolioAssets,
        optimization: window.currentPortfolioData,
        strategy: document.getElementById('portfolio-strategy')?.value || 'max_sharpe',
        riskFreeRate: parseFloat(document.getElementById('portfolio-risk-free')?.value || 4.5)
    };

    // Get existing portfolios or initialize empty array
    let savedPortfolios = JSON.parse(localStorage.getItem('savedPortfolios') || '[]');
    savedPortfolios.push(portfolioData);

    // Save to localStorage
    localStorage.setItem('savedPortfolios', JSON.stringify(savedPortfolios));

    alert(`Portfolio "${portfolioName}" saved successfully! (${savedPortfolios.length} total portfolios saved)`);
}

function exportPortfolioToCSV() {
    if (!window.currentPortfolioData) {
        alert('No portfolio to export. Please optimize a portfolio first.');
        return;
    }

    const data = window.currentPortfolioData;
    const holdings = data.holdings || [];

    // Create CSV content
    let csvContent = 'Ticker,Weight (%),Expected Return (%),Volatility (%),Risk Contribution (%)\n';

    holdings.forEach(h => {
        csvContent += `${h.ticker},`;
        csvContent += `${(h.weight * 100).toFixed(2)},`;
        csvContent += `${(h.expected_return * 100).toFixed(2)},`;
        csvContent += `${(h.volatility * 100).toFixed(2)},`;
        csvContent += `${(h.contribution_to_risk * 100).toFixed(2)}\n`;
    });

    // Add summary metrics
    csvContent += '\nPortfolio Summary\n';
    csvContent += `Expected Return (%),${ (data.expected_return * 100).toFixed(2)}\n`;
    csvContent += `Volatility (%),${ (data.volatility * 100).toFixed(2)}\n`;
    csvContent += `Sharpe Ratio,${data.sharpe_ratio.toFixed(3)}\n`;
    csvContent += `Strategy,${data.strategy}\n`;
    csvContent += `Generated,${new Date().toISOString()}\n`;

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `portfolio_${Date.now()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function loadSavedPortfolios() {
    const savedPortfolios = JSON.parse(localStorage.getItem('savedPortfolios') || '[]');

    if (savedPortfolios.length === 0) {
        alert('No saved portfolios found.');
        return;
    }

    // Create a simple list for the user to select from
    let listText = 'Saved Portfolios:\n\n';
    savedPortfolios.forEach((p, idx) => {
        listText += `${idx + 1}. ${p.name} (${new Date(p.timestamp).toLocaleDateString()})\n`;
    });

    alert(listText + '\n(Full portfolio management UI coming soon)');
}

// Make functions globally available
window.calculateDCF = calculateDCF;
window.addPortfolioAsset = addPortfolioAsset;
window.removePortfolioAsset = removePortfolioAsset;
window.optimizePortfolio = optimizePortfolio;
window.analyzeSentiment = analyzeSentiment;
window.plotEfficientFrontier = plotEfficientFrontier;
window.runMonteCarloSimulation = runMonteCarloSimulation;
window.calculateRiskAnalytics = calculateRiskAnalytics;
window.displayRiskAnalytics = displayRiskAnalytics;
window.plotRiskDecomposition = plotRiskDecomposition;
window.savePortfolioToLocalStorage = savePortfolioToLocalStorage;
window.exportPortfolioToCSV = exportPortfolioToCSV;
window.loadSavedPortfolios = loadSavedPortfolios;
