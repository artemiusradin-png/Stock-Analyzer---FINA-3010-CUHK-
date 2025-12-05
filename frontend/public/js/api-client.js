/**
 * API Client - Shared utilities for backend communication
 * Portfolio Management Platform v2.0
 */

const API = {
    baseUrl: null,

    /**
     * Get the API base URL from various sources
     */
    getBaseUrl() {
        if (this.baseUrl) return this.baseUrl;

        // Priority order:
        // 1. window.API_BASE_URL
        // 2. meta tag
        // 3. URL parameter
        // 4. localStorage
        // 5. default

        this.baseUrl = window.API_BASE_URL ||
            document.querySelector('meta[name="dcf-api-base"]')?.getAttribute('content') ||
            new URLSearchParams(window.location.search).get('api') ||
            localStorage.getItem('dcfApiBase') ||
            'http://localhost:8000';

        return this.baseUrl;
    },

    /**
     * Make an API call
     */
    async call(endpoint, options = {}) {
        const url = `${this.getBaseUrl()}${endpoint}`;

        const defaultOptions = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        if (options.body) {
            defaultOptions.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, {
                ...defaultOptions,
                timeout: options.timeout || 30000
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await this.call('/health');
            return response.status === 'healthy';
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    },

    // Valuation endpoints
    valuations: {
        async calculate(params) {
            return await API.call('/api/valuations/calculate', {
                method: 'POST',
                body: params
            });
        },

        async scenarios(params) {
            return await API.call('/api/valuations/scenarios', {
                method: 'POST',
                body: params
            });
        },

        async sensitivity(params, waccLow, waccHigh, tgrLow, tgrHigh, gridSize) {
            const queryParams = new URLSearchParams({
                wacc_low: waccLow,
                wacc_high: waccHigh,
                tgr_low: tgrLow,
                tgr_high: tgrHigh,
                grid_size: gridSize
            });

            return await API.call(`/api/valuations/sensitivity?${queryParams}`, {
                method: 'POST',
                body: params
            });
        }
    },

    // Portfolio endpoints
    portfolios: {
        async optimize(request) {
            return await API.call('/api/portfolios/optimize', {
                method: 'POST',
                body: request
            });
        },

        async efficientFrontier(request) {
            return await API.call('/api/portfolios/efficient-frontier', {
                method: 'POST',
                body: request
            });
        }
    },

    // Sentiment endpoints
    sentiment: {
        async analyze(ticker, days = 30) {
            return await API.call('/api/sentiment/analyze', {
                method: 'POST',
                body: { ticker, days }
            });
        },

        async news(ticker, days = 7) {
            return await API.call(`/api/sentiment/news/${ticker}?days=${days}`);
        }
    },

    // Risk endpoints
    risk: {
        async analyze(request) {
            return await API.call('/api/risk/analyze', {
                method: 'POST',
                body: request
            });
        },

        async decomposition(tickers, weights, lookbackDays = 252) {
            const queryParams = new URLSearchParams({
                tickers: tickers.join(','),
                weights: weights.join(','),
                lookback_days: lookbackDays
            });

            return await API.call(`/api/risk/portfolio-decomposition?${queryParams}`, {
                method: 'POST'
            });
        }
    },

    // Asset endpoints
    assets: {
        async getInfo(ticker) {
            return await API.call(`/api/assets/${ticker}`);
        }
    }
};

// Utility functions
const APIUtils = {
    /**
     * Format currency
     */
    formatCurrency(value, decimals = 2) {
        if (value === null || value === undefined) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    },

    /**
     * Format percentage
     */
    formatPercent(value, decimals = 2) {
        if (value === null || value === undefined) return 'N/A';
        return `${(value * 100).toFixed(decimals)}%`;
    },

    /**
     * Format large numbers
     */
    formatNumber(value, decimals = 2) {
        if (value === null || value === undefined) return 'N/A';

        const absValue = Math.abs(value);
        if (absValue >= 1e9) {
            return `$${(value / 1e9).toFixed(decimals)}B`;
        } else if (absValue >= 1e6) {
            return `$${(value / 1e6).toFixed(decimals)}M`;
        } else if (absValue >= 1e3) {
            return `$${(value / 1e3).toFixed(decimals)}K`;
        }
        return `$${value.toFixed(decimals)}`;
    },

    /**
     * Convert percentage input to decimal
     */
    percentToDecimal(percent) {
        return percent / 100;
    },

    /**
     * Convert decimal to percentage
     */
    decimalToPercent(decimal) {
        return decimal * 100;
    },

    /**
     * Show loading overlay
     */
    showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: white;
                padding: 2rem;
                border-radius: 8px;
                text-align: center;
            `;
            content.innerHTML = `
                <div class="spinner"></div>
                <p style="margin-top: 1rem; color: #0f0f0f;">${message}</p>
            `;

            overlay.appendChild(content);
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
            overlay.querySelector('p').textContent = message;
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },

    /**
     * Show error message
     */
    showError(message) {
        alert(`Error: ${message}`);
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        // Simple implementation - can be enhanced with toast notifications
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10001;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
};

// Export to window
window.API = API;
window.APIUtils = APIUtils;
