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
// Each asset can have: { ticker, weight, companyName, npvData, currency, exchange }
let portfolioAssets = [];

// Make portfolioAssets accessible globally for adding from other modules
window.portfolioAssets = portfolioAssets;

/**
 * Tab Management
 */
function initNPVTabs() {
    const tabButtons = document.querySelectorAll('.npv-tab-btn');
    const tabContents = document.querySelectorAll('.npv-tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Remove active class from all buttons and hide all contents
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });

            // Add active class to clicked button and show corresponding content
            btn.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block';
            }
        });
    });
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
    let ticker, companyName, npvData, currency, exchange;

    if (assetData && typeof assetData === 'object') {
        // Called programmatically with rich data from AI NPV
        ticker = assetData.ticker?.trim().toUpperCase();
        companyName = assetData.companyName || '';
        npvData = assetData.npvData || null;
        currency = assetData.currency || 'USD';
        exchange = assetData.exchange || '';
    } else {
        // Called from UI input
        const tickerInput = document.getElementById('portfolio-ticker-input');
        ticker = tickerInput.value.trim().toUpperCase();
        companyName = '';
        npvData = null;
        currency = 'USD';
        exchange = '';
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
        currency: currency,
        exchange: exchange
    });

    // Update global reference
    window.portfolioAssets = portfolioAssets;

    // Clear input if called from UI
    const tickerInput = document.getElementById('portfolio-ticker-input');
    if (tickerInput && !assetData) {
        tickerInput.value = '';
    }

    renderPortfolioAssets();
}

function removePortfolioAsset(ticker) {
    portfolioAssets = portfolioAssets.filter(a => a.ticker !== ticker);
    // Update global reference
    window.portfolioAssets = portfolioAssets;
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
            ? `<span style="padding: 0.25rem 0.5rem; background: ${asset.npvData.npv >= 0 ? '#d1fae5' : '#fee2e2'}; color: ${asset.npvData.npv >= 0 ? '#065f46' : '#991b1b'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-right: 0.5rem;">
                NPV: ${asset.npvData.npv >= 0 ? '+' : ''}${asset.npvData.npv.toFixed(2)}
               </span>`
            : '';

        return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: ${asset.npvData ? '#f0fdf4' : '#f9fafb'}; border: 1px solid ${asset.npvData ? '#86efac' : '#e5e5e5'}; border-radius: 6px; margin-bottom: 0.5rem;">
            ${displayName}
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${npvBadge}
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

function displayPortfolioResults(data) {
    const container = document.getElementById('portfolio-results-container');

    const expectedReturn = ((data.expected_return || 0) * 100).toFixed(2);
    const volatility = ((data.volatility || 0) * 100).toFixed(2);
    const sharpeRatio = (data.sharpe_ratio || 0).toFixed(3);

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div class="summary-card primary">
                <div class="card-label">Expected Return</div>
                <div class="card-value">${expectedReturn}%</div>
            </div>
            <div class="summary-card warning">
                <div class="card-label">Volatility</div>
                <div class="card-value">${volatility}%</div>
            </div>
            <div class="summary-card success">
                <div class="card-label">Sharpe Ratio</div>
                <div class="card-value">${sharpeRatio}</div>
            </div>
        </div>

        ${data.weights ? `
            <div class="table-container">
                <h3 style="margin-bottom: 1rem; font-size: 1rem; font-weight: 600;">Optimal Asset Weights</h3>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th class="number">Weight (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.weights).map(([ticker, weight]) => `
                            <tr>
                                <td>${ticker}</td>
                                <td class="number">${((weight || 0) * 100).toFixed(2)}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : ''}
    `;
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
    initNPVTabs();
});

// Make functions globally available
window.calculateDCF = calculateDCF;
window.addPortfolioAsset = addPortfolioAsset;
window.removePortfolioAsset = removePortfolioAsset;
window.optimizePortfolio = optimizePortfolio;
window.analyzeSentiment = analyzeSentiment;

