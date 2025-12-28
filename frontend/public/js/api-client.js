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
        // 1. window.API_BASE_URL (set by detectBackend())
        // 2. localStorage (persisted from previous session)
        // 3. meta tag
        // 4. URL parameter
        // 5. default

        this.baseUrl = window.API_BASE_URL ||
            localStorage.getItem('apiBaseUrl') ||
            document.querySelector('meta[name="api-base-production"]')?.getAttribute('content') ||
            document.querySelector('meta[name="dcf-api-base"]')?.getAttribute('content') ||
            new URLSearchParams(window.location.search).get('api') ||
            localStorage.getItem('dcfApiBase') ||
            'http://localhost:8000';

        // Remove trailing slash and /api suffix if present
        this.baseUrl = this.baseUrl.replace(/\/api$/, '').replace(/\/$/, '');

        return this.baseUrl;
    },

    /**
     * Make an API call with retry logic and better error handling
     */
    async call(endpoint, options = {}) {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}${endpoint}`;
        const maxRetries = options.retries || (window.BACKEND_CONNECTED === false ? 2 : 0);
        const retryDelay = 1000; // 1 second

        const defaultOptions = {
            method: options.method || 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            }
        };

        if (options.body) {
            defaultOptions.body = JSON.stringify(options.body);
        }

        // Check if backend is configured
        if (!baseUrl || baseUrl === 'http://localhost:8000' && window.location.hostname !== 'localhost') {
            console.warn('Backend URL not properly configured:', baseUrl);
        }

        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

                const response = await fetch(url, {
                    ...defaultOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Handle non-OK responses
                if (!response.ok) {
                    let errorData;
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        errorData = { detail: `HTTP ${response.status}: ${response.statusText}` };
                    }
                    
                    // Don't retry on 4xx errors (client errors)
                    if (response.status >= 400 && response.status < 500) {
                        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    // Retry on 5xx errors (server errors)
                    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                // Mark backend as connected on successful request
                if (window.BACKEND_CONNECTED === false) {
                    window.BACKEND_CONNECTED = true;
                    window.BACKEND_STATUS = 'connected';
                    console.log('✓ Backend connection verified');
                }
                
                return data;
            } catch (error) {
                lastError = error;
                
                // Handle network errors
                if (error.name === 'AbortError') {
                    console.warn(`API call timeout (attempt ${attempt + 1}/${maxRetries + 1}):`, url);
                } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.warn(`API call failed - network/CORS error (attempt ${attempt + 1}/${maxRetries + 1}):`, url);
                    console.warn('This may indicate:', {
                        backendUnreachable: 'Backend is not deployed or unreachable',
                        corsIssue: 'CORS configuration issue',
                        backendSleeping: 'Backend may be sleeping (Render free tier)'
                    });
                } else {
                    console.error(`API call error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
                }

                // Retry logic
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
                    continue;
                }
            }
        }

        // All retries failed
        console.error('API call failed after all retries:', url, lastError);
        
        // Provide helpful error message
        if (lastError.name === 'TypeError' && lastError.message.includes('Failed to fetch')) {
            throw new Error(`Cannot connect to backend at ${baseUrl}. Please check if the backend is deployed and accessible.`);
        }
        
        throw lastError || new Error('API call failed');
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
