/**
 * AI NPV Module
 * Handles AI-powered NPV calculations with ChatGPT OCF fetching
 */

// API base URL
function getAINPVAPIBase() {
    if (window.API_BASE_URL) {
        return window.API_BASE_URL.replace(/\/api$/, '');
    }
    return 'http://localhost:8000';
}

const AI_NPV_API = getAINPVAPIBase();

// Global state for export
window.AI_NPV_DATA = null;

// Seed manual AI OCF inputs when remote fetch fails
function seedManualAIOCFInputs(count = 5) {
    const container = document.getElementById('ai-ocf-table-container');
    if (container) {
        container.innerHTML = '';
    }
    for (let i = 0; i < count; i++) {
        addAIOCFYear();
    }
}

/**
 * Fallback: fetch legacy OCF (single column) and map to scenarios
 */
async function fetchLegacyOCFScenarios(ticker, exchange) {
    try {
        const response = await fetch(`${AI_NPV_API}/api/ai-npv/fetch-ocf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker: ticker,
                years: 5,
                exchange: exchange || null
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Failed to fetch legacy OCF');
        }

        const ocf = Array.isArray(data.ocf) ? data.ocf : [];
        const years = ocf.map(o => o.year);
        const dividends = ocf.map(o => o.value || 0);

        return {
            years: years,
            dividends_per_share: {
                low: [...dividends],
                base: [...dividends],
                high: [...dividends]
            },
            terminal_price_per_share: { low: 0, base: 0, high: 0 },
            scenario_explanation: {
                low: 'Legacy OCF fallback: no detailed scenario data.',
                base: 'Legacy OCF fallback: no detailed scenario data.',
                high: 'Legacy OCF fallback: no detailed scenario data.'
            },
            current_price_per_share: data.stock_price || 0,
            exchange: data.exchange || exchange || '',
            currency: data.currency || 'USD',
            description: data.description || ''
        };
    } catch (err) {
        throw new Error(err.message || 'Legacy OCF fetch failed');
    }
}

/**
 * Fetch scenario-based cash flow forecasts from ChatGPT
 */
function parseTickerInput(raw) {
    const input = (raw || '').trim().toUpperCase();
    if (!input) return { ticker: '', exchange: null };
    if (input.includes(':')) {
        const [t, ex] = input.split(':', 2);
        return { ticker: t || '', exchange: ex || null };
    }
    if (input.includes('.')) {
        const [t, ex] = input.split('.', 2);
        return { ticker: t || '', exchange: ex || null };
    }
    return { ticker: input, exchange: null };
}

async function fetchOCF() {
    console.log('fetchOCF function called - fetching scenarios');
    const rawTicker = document.getElementById('ai-ticker').value;
    const { ticker, exchange } = parseTickerInput(rawTicker);
    let companyData = {};

    if (!ticker) {
        showAINPVError('Please enter a stock ticker symbol');
        return;
    }

    const button = document.getElementById('fetch-ocf-button');
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Generating scenarios...</span>';
    button.disabled = true;

    hideAINPVError();

    // Clear previous results
    const resultsContainer = document.getElementById('ai-npv-results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
    }
    const exportButtons = document.getElementById('ai-export-buttons');
    if (exportButtons) {
        exportButtons.style.display = 'none';
    }

    // Clear global data
    window.AI_NPV_DATA = null;

    // Show loading in CF block
    showCFLoading('Fetching company information...');

    try {
        console.log('Fetching company info for ticker:', ticker);

        // STEP 1: Fetch company info FIRST to check for disambiguation
        const companyResponse = await fetch(`${AI_NPV_API}/api/ai-npv/fetch-company-info`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ ticker: ticker, years: 1, exchange: exchange || null })
        });

        companyData = await companyResponse.json();
        console.log('Company info received:', companyData);

        // Check if there are multiple exchanges (disambiguation needed)
        const matches = (Array.isArray(companyData.matches) && companyData.matches.length > 1)
            ? companyData.matches
            : (Array.isArray(companyData.options) && companyData.options.length > 1)
              ? companyData.options
              : (Array.isArray(companyData.results) && companyData.results.length > 1)
                ? companyData.results
                : null;

        if (matches) {
            // Multiple exchanges found - show dropdown and wait for user selection
            console.log('Multiple exchanges found. Showing dropdown for user selection...');
            button.innerHTML = originalText;
            button.disabled = false;

            showCompanyChooser(matches, async (choice) => {
                console.log('User selected company:', choice);

                // Clear disambiguation UI
                const disambiguationContainer = document.getElementById('ai-ticker-disambiguation');
                if (disambiguationContainer) {
                    disambiguationContainer.innerHTML = '';
                }

                // Fetch CF data for the selected exchange - this will update company info with actual price
                await refetchOCFForExchange(choice.ticker || ticker, choice);
            });

        } else {
            // Single company found - proceed with CF fetch
            console.log('Single company found. Proceeding with CF fetch...');
            
            // Show loading in CF block
            showCFLoading('Generating cash flow scenarios with ChatGPT...');

            // Display company info immediately
            displayCompanyInfo(companyData);

            // STEP 2: Fetch CF scenarios for this single company
            const response = await fetch(`${AI_NPV_API}/api/ai-npv/fetch-cf-scenarios`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ticker: ticker,
                    years: 5,
                    exchange: companyData.exchange || exchange || ''
                })
            });

        console.log('Response status:', response.status);

        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
                throw new Error(data.detail || 'Failed to fetch CF scenarios');
            }

            console.log('CF scenarios received:', data);

            // Store scenario data globally (now includes per-share data AND company info)
            window.AI_NPV_DATA = {
                ticker: ticker,
                currentPricePerShare: data.current_price_per_share || 0,
                dividendsPerShare: data.dividends_per_share || {},
                terminalPricePerShare: data.terminal_price_per_share || {},
                scenarioExplanations: data.scenario_explanation || {},
                years: data.years || [],
                // Store for recalculation when investment changes
                storedDividendsPerShare: data.dividends_per_share || {},
                storedTerminalPricePerShare: data.terminal_price_per_share || {},
                // Store company info for consistent display and exports
                companyName: companyData.name || '',  // Full company name (if available)
                exchange: companyData.exchange || exchange || '',
                currency: companyData.currency || 'USD',
                country: companyData.country || '',
                description: companyData.description || ''
            };

            // Update Company Info display with price from CF scenarios (single source of truth)
            displayCompanyInfo({
                ticker: ticker,
                description: companyData.description || '',
                exchange: companyData.exchange || exchange || '',
                currency: companyData.currency || 'USD',
                country: companyData.country || '',
                stock_price: data.current_price_per_share || 0  // Use price from CF scenarios
            });

            // Display scenario table
            displayScenariosTable(data.years, data.dividends_per_share, data.terminal_price_per_share, data.current_price_per_share);

        // Show success message
            showAINPVSuccess(`Successfully generated ${data.years.length} years of cash flow scenarios for ${ticker}${(companyData.exchange || exchange) ? ' on ' + (companyData.exchange || exchange) : ''}`);

            button.innerHTML = originalText;
            button.disabled = false;
        }

    } catch (error) {
        console.error('CF scenarios fetch error:', error);
        try {
            const legacy = await fetchLegacyOCFScenarios(ticker, exchange);
            window.AI_NPV_DATA = {
                ticker: ticker,
                currentPricePerShare: legacy.current_price_per_share || 0,
                dividendsPerShare: legacy.dividends_per_share || {},
                terminalPricePerShare: legacy.terminal_price_per_share || {},
                scenarioExplanations: legacy.scenario_explanation || {},
                years: legacy.years || [],
                companyName: companyData.name || '',
                exchange: legacy.exchange || exchange || '',
                currency: legacy.currency || companyData.currency || 'USD',
                country: companyData.country || '',
                description: legacy.description || companyData.description || ''
            };
            displayCompanyInfo({
                ticker: ticker,
                description: window.AI_NPV_DATA.description,
                exchange: window.AI_NPV_DATA.exchange,
                currency: window.AI_NPV_DATA.currency,
                country: window.AI_NPV_DATA.country,
                stock_price: legacy.current_price_per_share || 0
            });
            displayScenariosTable(legacy.years, legacy.dividends_per_share, legacy.terminal_price_per_share, legacy.current_price_per_share);
            showAINPVSuccess('Auto fetch unavailable; using legacy OCF data. You can edit cash flows below.');
        } catch (fallbackErr) {
            console.error('Legacy OCF fallback error:', fallbackErr);
            // Provide manual inputs so user can proceed without API
            seedManualAIOCFInputs(5);
            window.AI_NPV_DATA = {
                ticker: ticker,
                currentPricePerShare: 0,
                dividendsPerShare: {},
                terminalPricePerShare: {},
                scenarioExplanations: {},
                years: [],
                companyName: '',
                exchange: exchange || '',
                currency: 'USD',
                country: '',
                description: ''
            };
            showAINPVError('Auto fetch unavailable. Please enter cash flows manually below.');
        }
        
        // Clear loading state in CF block
        const container = document.getElementById('ai-ocf-table-container');
        if (container) {
            container.innerHTML = `
                <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1.5rem; text-align: center;">
                    <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem;">
                        Fetch scenario forecasts (Low/Base/High) from ChatGPT
                    </div>
                    <div style="font-size: 0.8125rem; color: #9ca3af;">
                        Click "Fetch CF Scenarios" above to generate forecasts
                    </div>
                </div>
            `;
        }
        
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

/**
 * Show loading state in the CF block
 */
function showCFLoading(message = 'Fetching cash flow scenarios...') {
    const container = document.getElementById('ai-ocf-table-container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 3rem 1.5rem; text-align: center;">
            <div class="cf-loading-spinner" style="width: 40px; height: 40px; border: 3px solid #e5e5e5; border-top: 3px solid #0f0f0f; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem;"></div>
            <div style="font-size: 0.875rem; color: #0f0f0f; font-weight: 600; margin-bottom: 0.5rem;">
                ${message}
            </div>
            <div style="font-size: 0.8125rem; color: #6b7280;">
                This may take a few moments...
            </div>
        </div>
    `;
}

/**
 * Display scenario-based cash flow table (Low/Base/High)
 * Shows TOTAL cash flows based on investment amount (multiplied by shares)
 * Includes terminal value in final year
 */
function displayScenariosTable(years, dividendsPerShare, terminalPricePerShare, currentPricePerShare) {
    console.log('=== displayScenariosTable CALLED ===');
    console.log('Years:', years);
    console.log('Dividends per share:', dividendsPerShare);
    console.log('Terminal price per share:', terminalPricePerShare);
    console.log('Current price per share:', currentPricePerShare);
    console.log('====================================');

    const container = document.getElementById('ai-ocf-table-container');

    if (!years || !dividendsPerShare || years.length === 0) {
        container.innerHTML = '<div class="placeholder-text">No scenario data available</div>';
        return;
    }

    const lowDivs = dividendsPerShare.low || [];
    const baseDivs = dividendsPerShare.base || [];
    const highDivs = dividendsPerShare.high || [];

    console.log('Extracted dividend arrays:', { lowDivs, baseDivs, highDivs });

    // Get currency from AI_NPV_DATA for display
    const currency = window.AI_NPV_DATA?.currency || 'USD';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;

    // Get initial investment to calculate shares - ALWAYS check current value from DOM
    // Try multiple selectors in case ID changed
    let initialCostInput = document.getElementById('ai-initial-cost') || 
                           document.querySelector('input[id*="initial"][id*="cost"]') ||
                           document.querySelector('input[placeholder*="10000"]') ||
                           document.querySelector('input[placeholder*="investment"]');
    
    let initialCostValue = '';
    let initialCost = NaN;
    let investmentAmount = 0;
    let shares = 0;
    
    if (initialCostInput) {
        initialCostValue = (initialCostInput.value || '').trim();
        console.log('Found investment input, value:', initialCostValue, 'element:', initialCostInput.id || initialCostInput.className);
        
        if (initialCostValue) {
            initialCost = parseFloat(initialCostValue);
            console.log('Parsed investment:', initialCost);
            
            if (!isNaN(initialCost) && initialCost !== 0) {
                investmentAmount = Math.abs(initialCost);
                shares = currentPricePerShare > 0 && investmentAmount > 0 ? investmentAmount / currentPricePerShare : 0;
                console.log('Calculated shares:', shares, 'from investment:', investmentAmount, 'and price:', currentPricePerShare);
            }
        }
    } else {
        console.warn('Investment input NOT FOUND - checking all inputs...');
        const allInputs = document.querySelectorAll('input[type="number"]');
        console.log('Found', allInputs.length, 'number inputs');
        allInputs.forEach((inp, idx) => {
            if (inp.id && inp.id.includes('initial') || inp.id.includes('cost') || inp.placeholder?.includes('10000')) {
                console.log(`Input ${idx}: id=${inp.id}, value=${inp.value}, placeholder=${inp.placeholder}`);
            }
        });
    }
    
    console.log('Investment calculation result:', {
        inputElement: initialCostInput ? 'found' : 'NOT FOUND',
        inputValue: initialCostValue,
        parsedCost: initialCost,
        investmentAmount: investmentAmount,
        currentPrice: currentPricePerShare,
        shares: shares,
        willShowTotals: investmentAmount > 0 && shares > 0,
        conditionCheck: `investmentAmount (${investmentAmount}) > 0 && shares (${shares}) > 0 = ${investmentAmount > 0 && shares > 0}`
    });

    // Store per-share values for editing (we'll use these to calculate totals)
    // Store them as data attributes so we can recalculate when investment changes
    const storePerShareValues = (divPerShare, terminalPerShare) => {
        // Store in window for recalculation
        if (!window.AI_NPV_DATA) window.AI_NPV_DATA = {};
        window.AI_NPV_DATA.storedDividendsPerShare = divPerShare;
        window.AI_NPV_DATA.storedTerminalPricePerShare = terminalPerShare;
    };
    storePerShareValues(dividendsPerShare, terminalPricePerShare);

    // Create scenario table showing TOTAL cash flows (multiplied by shares)
    let html = `
        <div style="margin-bottom: 0.75rem; padding: 0.75rem; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 0.8125rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: #1e40af;">📊 Cash Flow Scenarios</div>
                <button onclick="updateCashFlowsToTotals()" 
                        style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8125rem; font-weight: 600; white-space: nowrap; transition: all 0.2s;"
                        onmouseover="this.style.background='#059669'; this.style.transform='scale(1.05)'"
                        onmouseout="this.style.background='#10b981'; this.style.transform='scale(1)'">
                    💰 Convert to Total Cash Flows
                </button>
            </div>
            <div style="color: #1e40af;">
                ${investmentAmount > 0 && shares > 0 
                    ? `Showing total cash flows for investment of <strong>${currencySymbol}${investmentAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> (${shares.toFixed(2)} shares at ${currencySymbol}${currentPricePerShare.toFixed(2)}/share)`
                    : `Enter Initial Investment above, then click "Convert to Total Cash Flows" to see totals for your investment amount.`}
            </div>
        </div>
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                        <th style="padding: 0.75rem; text-align: left; font-weight: 700; color: #111827; border-right: 1px solid #e5e7eb;">Year</th>
                        <th style="padding: 0.75rem; text-align: right; font-weight: 700; color: #dc2626;">Low Scenario</th>
                        <th style="padding: 0.75rem; text-align: right; font-weight: 700; color: #111827; background: #f3f4f6;">Base Scenario</th>
                        <th style="padding: 0.75rem; text-align: right; font-weight: 700; color: #059669;">High Scenario</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Year 0 - Initial Investment
    if (investmentAmount > 0) {
        html += `
            <tr style="border-bottom: 2px solid #e5e7eb; background: #fee2e2;">
                <td style="padding: 0.625rem 0.75rem; font-weight: 700; color: #991b1b; border-right: 1px solid #e5e7eb;">Year 0 (Initial Investment)</td>
                <td style="padding: 0.625rem 0.75rem; text-align: right; color: #991b1b; font-weight: 700;">
                    ${currencySymbol}${(-investmentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td style="padding: 0.625rem 0.75rem; text-align: right; color: #991b1b; font-weight: 700; background: #f3f4f6;">
                    ${currencySymbol}${(-investmentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td style="padding: 0.625rem 0.75rem; text-align: right; color: #991b1b; font-weight: 700;">
                    ${currencySymbol}${(-investmentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
            </tr>
        `;
    }

    // Regular years (dividends only) and final year (dividend + terminal)
    years.forEach((year, idx) => {
        const isLastYear = (idx === years.length - 1);
        const lowDivPerShare = lowDivs[idx] || 0;
        const baseDivPerShare = baseDivs[idx] || 0;
        const highDivPerShare = highDivs[idx] || 0;
        
        // Calculate totals if shares are available, otherwise show per-share
        let lowVal, baseVal, highVal;
        let displayLabel = '';
        
        if (investmentAmount > 0 && shares > 0) {
            // Always show dividend only (terminal is separate row)
            lowVal = lowDivPerShare * shares;
            baseVal = baseDivPerShare * shares;
            highVal = highDivPerShare * shares;
            displayLabel = `Year ${year} (Dividend)`;
        } else {
            // Show per-share values if no investment entered
            lowVal = lowDivPerShare;
            baseVal = baseDivPerShare;
            highVal = highDivPerShare;
            displayLabel = `Year ${year} (Dividend)`;
        }

        // Store per-share values as data attributes for recalculation
        const rowStyle = isLastYear ? 'border-top: 2px solid #e5e7eb; background: #fef3c7;' : 'border-bottom: 1px solid #e5e7eb;';
        const inputStyle = isLastYear ? 'font-weight: 700; background: #fff3cd;' : '';

        html += `
            <tr style="${rowStyle}" data-year-idx="${idx}" data-is-last="${isLastYear}">
                <td style="padding: 0.625rem 0.75rem; font-weight: ${isLastYear ? '700' : '600'}; color: ${isLastYear ? '#92400e' : '#111827'}; border-right: 1px solid #e5e7eb;">
                    ${displayLabel}
                </td>
                <td style="padding: 0.625rem 0.75rem; text-align: right;">
                    <input type="number" 
                           class="input ai-div-low" 
                           data-year-idx="${idx}" 
                           data-per-share="${lowDivPerShare.toFixed(4)}"
                           value="${investmentAmount > 0 && shares > 0 ? lowVal.toFixed(2) : lowDivPerShare.toFixed(2)}" 
                           step="0.01"
                           style="padding: 0.375rem 0.5rem; font-size: 0.8125rem; text-align: right; width: 100%; border: 1px solid #fecaca; background: #fef2f2; ${inputStyle}">
                    ${investmentAmount > 0 && shares > 0 ? '' : `<div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${currencySymbol}/share</div>`}
                </td>
                <td style="padding: 0.625rem 0.75rem; text-align: right; background: ${isLastYear ? '#fff3cd' : '#fafafa'};">
                    <input type="number" 
                           class="input ai-div-base" 
                           data-year-idx="${idx}" 
                           data-per-share="${baseDivPerShare.toFixed(4)}"
                           value="${investmentAmount > 0 && shares > 0 ? baseVal.toFixed(2) : baseDivPerShare.toFixed(2)}" 
                           step="0.01"
                           style="padding: 0.375rem 0.5rem; font-size: 0.8125rem; text-align: right; width: 100%; border: 1px solid #d1d5db; font-weight: ${isLastYear ? '700' : '600'}; ${inputStyle}">
                    ${investmentAmount > 0 && shares > 0 ? '' : `<div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${currencySymbol}/share</div>`}
                </td>
                <td style="padding: 0.625rem 0.75rem; text-align: right;">
                    <input type="number" 
                           class="input ai-div-high" 
                           data-year-idx="${idx}" 
                           data-per-share="${highDivPerShare.toFixed(4)}"
                           value="${investmentAmount > 0 && shares > 0 ? highVal.toFixed(2) : highDivPerShare.toFixed(2)}" 
                           step="0.01"
                           style="padding: 0.375rem 0.5rem; font-size: 0.8125rem; text-align: right; width: 100%; border: 1px solid #a7f3d0; background: #ecfdf5; ${inputStyle}">
                    ${investmentAmount > 0 && shares > 0 ? '' : `<div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${currencySymbol}/share</div>`}
                </td>
            </tr>
        `;
        
        // Add terminal value row after last dividend year
        if (isLastYear) {
            const terminalLow = terminalPricePerShare.low || 0;
            const terminalBase = terminalPricePerShare.base || 0;
            const terminalHigh = terminalPricePerShare.high || 0;
            
            const terminalLowTotal = investmentAmount > 0 && shares > 0 ? terminalLow * shares : terminalLow;
            const terminalBaseTotal = investmentAmount > 0 && shares > 0 ? terminalBase * shares : terminalBase;
            const terminalHighTotal = investmentAmount > 0 && shares > 0 ? terminalHigh * shares : terminalHigh;
            
            html += `
                <tr style="border-top: 2px solid #f59e0b; background: #fef3c7;">
                    <td style="padding: 0.625rem 0.75rem; font-weight: 700; color: #92400e; border-right: 1px solid #e5e7eb;">
                        Terminal Sale Proceeds (Year ${year})
                    </td>
                    <td style="padding: 0.625rem 0.75rem; text-align: right;">
                        <input type="number" 
                               class="input ai-terminal-low" 
                               data-per-share="${terminalLow.toFixed(4)}"
                               value="${terminalLowTotal.toFixed(2)}" 
                               step="0.01"
                               style="padding: 0.375rem 0.5rem; font-size: 0.8125rem; text-align: right; width: 100%; border: 1px solid #fecaca; background: #fef2f2; font-weight: 700;">
                        ${investmentAmount > 0 && shares > 0 ? '' : `<div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${currencySymbol}/share</div>`}
                    </td>
                    <td style="padding: 0.625rem 0.75rem; text-align: right; background: #fff3cd;">
                        <input type="number" 
                               class="input ai-terminal-base" 
                               data-per-share="${terminalBase.toFixed(4)}"
                               value="${terminalBaseTotal.toFixed(2)}" 
                               step="0.01"
                               style="padding: 0.375rem 0.5rem; font-size: 0.8125rem; text-align: right; width: 100%; border: 1px solid #d1d5db; font-weight: 700; background: #fff3cd;">
                        ${investmentAmount > 0 && shares > 0 ? '' : `<div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${currencySymbol}/share</div>`}
                    </td>
                    <td style="padding: 0.625rem 0.75rem; text-align: right;">
                        <input type="number" 
                               class="input ai-terminal-high" 
                               data-per-share="${terminalHigh.toFixed(4)}"
                               value="${terminalHighTotal.toFixed(2)}" 
                               step="0.01"
                               style="padding: 0.375rem 0.5rem; font-size: 0.8125rem; text-align: right; width: 100%; border: 1px solid #a7f3d0; background: #ecfdf5; font-weight: 700;">
                        ${investmentAmount > 0 && shares > 0 ? '' : `<div style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem;">${currencySymbol}/share</div>`}
                    </td>
                </tr>
            `;
        }
    });

    html += `
                </tbody>
            </table>
        </div>
        <div style="margin-top: 0.75rem; font-size: 0.8125rem; color: #6b7280;">
            <div style="margin-bottom: 0.5rem; padding: 0.5rem 0.625rem; background: #dbeafe; border-left: 3px solid #3b82f6; border-radius: 3px;">
                <div style="font-weight: 600; color: #1e40af; margin-bottom: 0.25rem;">ℹ️ Cash Flow Calculation:</div>
                <div style="color: #1e40af; font-size: 0.8125rem;">
                    ${investmentAmount > 0 && shares > 0 
                        ? `• Years 1-${years.length - 1}: <strong>Dividend × ${shares.toFixed(2)} shares</strong><br>
                           • Year ${years[years.length - 1]}: <strong>(Dividend + Terminal Sale) × ${shares.toFixed(2)} shares</strong><br>
                           • Investment: ${currencySymbol}${investmentAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} at ${currencySymbol}${currentPricePerShare.toFixed(2)}/share`
                        : `• Enter Initial Investment above to see total cash flows<br>
                           • Currently showing per-share values<br>
                           • Final year includes dividend + terminal sale proceeds`}
                </div>
            </div>
            <div style="margin-top: 1rem; padding: 0.75rem; background: ${investmentAmount > 0 && shares > 0 ? '#d1fae5' : '#fef3c7'}; border-left: 3px solid ${investmentAmount > 0 && shares > 0 ? '#10b981' : '#f59e0b'}; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    <div>
                        ${investmentAmount > 0 && shares > 0 
                            ? `<span style="color: #065f46; font-weight: 600;">✅ Showing total cash flows for your investment</span>`
                            : `<span style="color: #92400e; font-weight: 600;">⚠️ Enter Initial Investment above to see total cash flows</span>`}
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button onclick="if(window._updateAINPVTable){window._updateAINPVTable();}else{const input=document.getElementById('ai-initial-cost');if(input&&input.value){location.reload();}else{alert('Please enter Initial Investment amount first');}}" 
                                style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8125rem; font-weight: 600; white-space: nowrap; transition: background 0.2s;"
                                onmouseover="this.style.background='#2563eb'"
                                onmouseout="this.style.background='#3b82f6'">
                            🔄 Update Table
                        </button>
                        <span style="font-weight: 600; color: #6b7280;">${years.length} years</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    console.log('Table HTML rendered to container');
    console.log(`Investment: ${investmentAmount}, Shares: ${shares}, Showing totals: ${investmentAmount > 0 && shares > 0}`);
    
    // Function to update table when investment changes
    window._updateAINPVTable = function updateTableFromInvestment() {
        console.log('updateTableFromInvestment called');
        const input = document.getElementById('ai-initial-cost');
        const inputValue = input ? input.value.trim() : '';
        console.log('Current input value:', inputValue);
        
        if (window.AI_NPV_DATA && window.AI_NPV_DATA.storedDividendsPerShare) {
            const storedYears = window.AI_NPV_DATA.years || years;
            const storedCurrentPrice = window.AI_NPV_DATA.currentPricePerShare || currentPricePerShare;
            console.log('Re-rendering table with stored data');
            displayScenariosTable(
                storedYears,
                window.AI_NPV_DATA.storedDividendsPerShare,
                window.AI_NPV_DATA.storedTerminalPricePerShare || terminalPricePerShare,
                storedCurrentPrice
            );
        } else {
            console.log('Re-rendering table with current values');
            displayScenariosTable(
                years,
                dividendsPerShare,
                terminalPricePerShare,
                currentPricePerShare
            );
        }
    };
    
    // Function to convert cash flows to totals - called by button
    window.updateCashFlowsToTotals = function updateCashFlowsToTotals() {
        console.log('updateCashFlowsToTotals button clicked');
        const input = document.getElementById('ai-initial-cost');
        const inputValue = input ? input.value.trim() : '';
        
        if (!inputValue || parseFloat(inputValue) === 0) {
            alert('Please enter an Initial Investment amount first (e.g., -1000 for $1,000 investment)');
            if (input) {
                input.focus();
            }
            return;
        }
        
        console.log('Converting cash flows to totals for investment:', inputValue);
        
        // Call the update function
        if (window._updateAINPVTable) {
            window._updateAINPVTable();
        } else {
            // Fallback: re-render table directly
            if (window.AI_NPV_DATA && window.AI_NPV_DATA.storedDividendsPerShare) {
                const storedYears = window.AI_NPV_DATA.years || [];
                const storedCurrentPrice = window.AI_NPV_DATA.currentPricePerShare || 0;
                displayScenariosTable(
                    storedYears,
                    window.AI_NPV_DATA.storedDividendsPerShare,
                    window.AI_NPV_DATA.storedTerminalPricePerShare || {},
                    storedCurrentPrice
                );
            } else {
                alert('Please fetch cash flow scenarios first by clicking "Fetch CF Scenarios from ChatGPT"');
            }
        }
    };
    
    // Store last known investment value to detect changes
    if (!window._lastAINPVInvestment) {
        window._lastAINPVInvestment = '';
    }
    
    // Set up event listeners AND polling to detect investment changes
    const setupInvestmentListener = () => {
        const initialCostInputForTable = document.getElementById('ai-initial-cost');
        if (initialCostInputForTable) {
            // Check if value changed
            const currentValue = initialCostInputForTable.value.trim();
            if (currentValue !== window._lastAINPVInvestment && currentValue && parseFloat(currentValue) !== 0) {
                console.log('Investment value changed from', window._lastAINPVInvestment, 'to', currentValue);
                window._lastAINPVInvestment = currentValue;
                // Update table immediately
                setTimeout(() => {
                    if (window._updateAINPVTable) {
                        console.log('Auto-updating table due to investment change');
                        window._updateAINPVTable();
                    }
                }, 100);
            } else if (!initialCostInputForTable.dataset.listenerAttached) {
                // Mark as attached to avoid duplicates
                initialCostInputForTable.dataset.listenerAttached = 'true';
                
                // Use a single event listener with proper event handling
                const handleInvestmentChange = () => {
                    const val = initialCostInputForTable.value.trim();
                    console.log('Investment input event fired, value:', val);
                    if (val && parseFloat(val) !== 0 && val !== window._lastAINPVInvestment) {
                        window._lastAINPVInvestment = val;
                        setTimeout(() => {
                            if (window._updateAINPVTable) {
                                console.log('Calling updateAINPVTable from event listener');
                                window._updateAINPVTable();
                            }
                        }, 150);
                    }
                };
                
                // Add listeners to the input
                initialCostInputForTable.addEventListener('input', handleInvestmentChange);
                initialCostInputForTable.addEventListener('change', handleInvestmentChange);
                initialCostInputForTable.addEventListener('blur', handleInvestmentChange);
                initialCostInputForTable.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter' || e.key === 'Tab') {
                        handleInvestmentChange();
                    }
                });
                
                console.log('Event listeners attached to investment input');
            }
        }
    };
    
    // Set up listener immediately
    setupInvestmentListener();
    
    // Also poll every 500ms to catch changes (as backup)
    if (!window._aiNpvInvestmentPollInterval) {
        window._aiNpvInvestmentPollInterval = setInterval(() => {
            setupInvestmentListener();
        }, 500);
    }
    
    // Add event listeners to update when dividend/terminal inputs change
    const allInputs = container.querySelectorAll('.ai-div-low, .ai-div-base, .ai-div-high, .ai-terminal-low, .ai-terminal-base, .ai-terminal-high');
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            // Update stored per-share values when user edits
            const perShareValue = input.getAttribute('data-per-share');
            if (perShareValue && investmentAmount > 0 && shares > 0) {
                // User edited total, recalculate per-share
                const newTotal = parseFloat(input.value) || 0;
                const newPerShare = newTotal / shares;
                input.setAttribute('data-per-share', newPerShare.toFixed(4));
                
                // Update stored values
                if (window.AI_NPV_DATA) {
                    const yearIdx = input.getAttribute('data-year-idx');
                    const isTerminal = input.classList.contains('ai-terminal-low') || 
                                     input.classList.contains('ai-terminal-base') || 
                                     input.classList.contains('ai-terminal-high');
                    
                    if (isTerminal) {
                        if (!window.AI_NPV_DATA.storedTerminalPricePerShare) {
                            window.AI_NPV_DATA.storedTerminalPricePerShare = {};
                        }
                        if (input.classList.contains('ai-terminal-low')) {
                            window.AI_NPV_DATA.storedTerminalPricePerShare.low = newPerShare;
                        } else if (input.classList.contains('ai-terminal-base')) {
                            window.AI_NPV_DATA.storedTerminalPricePerShare.base = newPerShare;
                        } else if (input.classList.contains('ai-terminal-high')) {
                            window.AI_NPV_DATA.storedTerminalPricePerShare.high = newPerShare;
                        }
                    } else if (yearIdx !== null) {
                        const idx = parseInt(yearIdx);
                        if (!window.AI_NPV_DATA.storedDividendsPerShare) {
                            window.AI_NPV_DATA.storedDividendsPerShare = { low: [], base: [], high: [] };
                        }
                        if (input.classList.contains('ai-div-low')) {
                            window.AI_NPV_DATA.storedDividendsPerShare.low[idx] = newPerShare;
                        } else if (input.classList.contains('ai-div-base')) {
                            window.AI_NPV_DATA.storedDividendsPerShare.base[idx] = newPerShare;
                        } else if (input.classList.contains('ai-div-high')) {
                            window.AI_NPV_DATA.storedDividendsPerShare.high[idx] = newPerShare;
                        }
                    }
                }
            }
        });
    });
}

/**
 * Update total cash flows display based on initial investment
 * Shows total cash flows (multiplied by shares) when initial investment is entered
 */
window.updateTotalCashFlowsDisplay = function updateTotalCashFlowsDisplay() {
    const initialCostInput = document.getElementById('ai-initial-cost');
    const initialCost = initialCostInput ? parseFloat(initialCostInput.value) : NaN;
    
    if (isNaN(initialCost) || initialCost === 0 || !window.AI_NPV_DATA) {
        const displayDiv = document.getElementById('total-cash-flows-display');
        if (displayDiv) {
            displayDiv.style.display = 'none';
        }
        return;
    }
    
    const currentPricePerShare = window.AI_NPV_DATA.currentPricePerShare || 0;
    if (!currentPricePerShare || currentPricePerShare <= 0) {
        return;
    }
    
    const investmentAmount = Math.abs(initialCost);
    const shares = investmentAmount / currentPricePerShare;
    
    // Get dividend inputs
    const lowInputs = document.querySelectorAll('.ai-div-low');
    const baseInputs = document.querySelectorAll('.ai-div-base');
    const highInputs = document.querySelectorAll('.ai-div-high');
    const terminalLowInput = document.querySelector('.ai-terminal-low');
    const terminalBaseInput = document.querySelector('.ai-terminal-base');
    const terminalHighInput = document.querySelector('.ai-terminal-high');
    
    if (baseInputs.length === 0) return;
    
    const years = window.AI_NPV_DATA.years || [];
    const currency = window.AI_NPV_DATA.currency || 'USD';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;
    
    // Build total cash flows table
    let tbodyHtml = '';
    
    // Year 0 (initial investment)
    tbodyHtml += `
        <tr style="background: #fee2e2;">
            <td style="padding: 0.5rem; font-weight: 600; color: #991b1b;">Year 0 (Initial Investment)</td>
            <td style="padding: 0.5rem; text-align: right; color: #991b1b; font-weight: 600;">${currencySymbol}${(-investmentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td style="padding: 0.5rem; text-align: right; color: #991b1b; font-weight: 600; background: #f3f4f6;">${currencySymbol}${(-investmentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td style="padding: 0.5rem; text-align: right; color: #991b1b; font-weight: 600;">${currencySymbol}${(-investmentAmount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        </tr>
    `;
    
    // Regular years (dividends only)
    for (let i = 0; i < baseInputs.length - 1; i++) {
        const lowDiv = parseFloat(lowInputs[i].value) || 0;
        const baseDiv = parseFloat(baseInputs[i].value) || 0;
        const highDiv = parseFloat(highInputs[i].value) || 0;
        
        const lowTotal = lowDiv * shares;
        const baseTotal = baseDiv * shares;
        const highTotal = highDiv * shares;
        
        tbodyHtml += `
            <tr>
                <td style="padding: 0.5rem; font-weight: 600; color: #111827;">Year ${years[i]} (Dividend)</td>
                <td style="padding: 0.5rem; text-align: right; color: #dc2626;">${currencySymbol}${lowTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="padding: 0.5rem; text-align: right; color: #111827; background: #f3f4f6; font-weight: 600;">${currencySymbol}${baseTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="padding: 0.5rem; text-align: right; color: #059669;">${currencySymbol}${highTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
        `;
    }
    
    // Final year (dividend + terminal sale)
    const lastIdx = baseInputs.length - 1;
    const lowDiv = parseFloat(lowInputs[lastIdx].value) || 0;
    const baseDiv = parseFloat(baseInputs[lastIdx].value) || 0;
    const highDiv = parseFloat(highInputs[lastIdx].value) || 0;
    const terminalLow = parseFloat(terminalLowInput?.value) || 0;
    const terminalBase = parseFloat(terminalBaseInput?.value) || 0;
    const terminalHigh = parseFloat(terminalHighInput?.value) || 0;
    
    const lowTotal = (lowDiv + terminalLow) * shares;
    const baseTotal = (baseDiv + terminalBase) * shares;
    const highTotal = (highDiv + terminalHigh) * shares;
    
    tbodyHtml += `
        <tr style="background: #dbeafe; border-top: 2px solid #3b82f6;">
            <td style="padding: 0.5rem; font-weight: 700; color: #1e40af;">Year ${years[lastIdx]} (Dividend + Sale)</td>
            <td style="padding: 0.5rem; text-align: right; color: #1e40af; font-weight: 600;">${currencySymbol}${lowTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td style="padding: 0.5rem; text-align: right; color: #1e40af; font-weight: 700; background: #fff3cd;">${currencySymbol}${baseTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td style="padding: 0.5rem; text-align: right; color: #1e40af; font-weight: 600;">${currencySymbol}${highTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        </tr>
        <tr style="background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <td style="padding: 0.5rem; font-weight: 600; color: #6b7280; font-size: 0.75rem;" colspan="4">
                <div style="display: flex; justify-content: space-between;">
                    <span>Number of shares: <strong>${shares.toFixed(2)}</strong></span>
                    <span>Investment: <strong>${currencySymbol}${investmentAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
                    <span>Price per share: <strong>${currencySymbol}${currentPricePerShare.toFixed(2)}</strong></span>
                </div>
            </td>
        </tr>
    `;
    
    const tbody = document.getElementById('total-cash-flows-body');
    const displayDiv = document.getElementById('total-cash-flows-display');
    
    if (tbody) {
        tbody.innerHTML = tbodyHtml;
    }
    if (displayDiv) {
        displayDiv.style.display = 'block';
    }
}

// displayOCFTable() removed - deprecated and unused

/**
 * Add new OCF year (maximum 10 years)
 */
function addAIOCFYear() {
    console.log('addAIOCFYear called');
    const container = document.getElementById('ai-ocf-table-container');
    if (!container) {
        console.error('ai-ocf-table-container not found');
        return;
    }

    let grid = container.querySelector('#ai-ocf-grid');
    const existingInputs = grid ? grid.querySelectorAll('.ai-ocf-input') : [];
    const currentCount = existingInputs.length;

    // Maximum 10 years
    if (currentCount >= 10) {
        console.log('Maximum 10 years reached');
        showAINPVError('Maximum 10 years of cash flows allowed');
        setTimeout(() => hideAINPVError(), 3000);
        return;
    }

    // If no grid exists, create the initial structure
    if (!grid) {
        console.log('No grid found, creating initial structure');
        container.innerHTML = `
            <div id="ai-ocf-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;"></div>
            <button onclick="addAIOCFYear()" class="ghost-button" id="add-year-btn" style="margin-top: 1rem; width: auto;">
                + Add Year
            </button>
        `;
        grid = container.querySelector('#ai-ocf-grid');
    }

    const nextIndex = currentCount;
    const labelYear = new Date().getFullYear() + nextIndex;

    const newCard = document.createElement('div');
    newCard.className = 'ai-ocf-card';
    newCard.setAttribute('data-index', String(nextIndex));
    newCard.style.cssText = 'background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1rem; position: relative;';
    newCard.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase;">
                ${labelYear}
            </div>
            ${currentCount >= 0 ? `<button type="button" class="ghost-button" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="removeAIOCFYear(${nextIndex})">Remove</button>` : ''}
        </div>
        <div class="input-control">
            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6b7280; font-size: 0.875rem;">$</span>
            <input
                type="number"
                class="input ai-ocf-input"
                data-year="${nextIndex + 1}"
                value="0"
                style="padding-left: 2rem;"
                placeholder="0">
        </div>
    `;

    grid.appendChild(newCard);
    console.log('Year card added successfully');

    updateAIOCFAddButton();
}

function removeAIOCFYear(index) {
    const grid = document.querySelector('#ai-ocf-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.ai-ocf-card');
    if (cards.length <= 5) return; // keep at least 5
    const card = grid.querySelector(`.ai-ocf-card[data-index="${index}"]`);
    if (card) card.remove();
    renumberAIOCFGrid();
    updateAIOCFAddButton();
}

function renumberAIOCFGrid() {
    const grid = document.querySelector('#ai-ocf-grid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.ai-ocf-card'));
    const baseYear = new Date().getFullYear();
    cards.forEach((card, idx) => {
        card.setAttribute('data-index', String(idx));
        const header = card.querySelector('div > div:first-child');
        if (header) header.textContent = `${baseYear + idx}`;
        const input = card.querySelector('.ai-ocf-input');
        if (input) input.setAttribute('data-year', String(idx + 1));
        const btn = card.querySelector('button');
        if (btn) btn.setAttribute('onclick', `removeAIOCFYear(${idx})`);
    });
}

function updateAIOCFAddButton() {
    const container = document.getElementById('ai-ocf-table-container');
    if (!container) return;
    const grid = container.querySelector('#ai-ocf-grid');
    const count = grid ? grid.querySelectorAll('.ai-ocf-card').length : 0;
    const addButton = container.querySelector('#add-year-btn');
    if (count >= 10) {
        if (addButton) addButton.style.display = 'none';
    } else {
        if (addButton) {
            addButton.style.display = 'inline-flex';
            addButton.textContent = `+ Add Year (${count}/10)`;
        }
    }
}

/**
 * Calculate NPV with AI-fetched data
 */
async function calculateAINPV() {
    console.log('calculateAINPV called');
    hideAINPVError();

    const ticker = document.getElementById('ai-ticker').value.trim().toUpperCase();
    const initialCost = parseFloat(document.getElementById('ai-initial-cost').value);
    const requiredReturn = parseFloat(document.getElementById('ai-required-return').value);

    console.log('Input values:', { ticker, initialCost, requiredReturn });

    // Validate inputs
    if (!ticker) {
        showAINPVError('Please enter a ticker symbol');
        return;
    }

    if (isNaN(initialCost)) {
        showAINPVError('Please enter a valid Initial Cost');
        return;
    }

    if (isNaN(requiredReturn) || requiredReturn <= 0) {
        showAINPVError('Please enter a valid Required Return (must be positive)');
        return;
    }

    // Validate that price data is available (required for AI NPV calculation)
    if (!window.AI_NPV_DATA || !window.AI_NPV_DATA.currentPricePerShare || window.AI_NPV_DATA.currentPricePerShare <= 0) {
        showAINPVError('No stock price data available. Please fetch CF scenarios first by clicking "Fetch CF Scenarios from ChatGPT".');
        return;
    }

    // Get scenario dividends per share from table (if present)
    const lowInputs = document.querySelectorAll('.ai-div-low');
    const baseInputs = document.querySelectorAll('.ai-div-base');
    const highInputs = document.querySelectorAll('.ai-div-high');
    const ocfInputs = document.querySelectorAll('.ai-ocf-input');

    const cashFlowsLow = [];
    const cashFlowsBase = [];
    const cashFlowsHigh = [];
    let useOCFOnly = false;

    if (baseInputs.length === 0 || lowInputs.length === 0 || highInputs.length === 0) {
        // Fall back to single-column OCF inputs
    if (ocfInputs.length === 0) {
            showAINPVError('Please fetch cash flows first');
        return;
    }
        useOCFOnly = true;
        let invalid = false;
        ocfInputs.forEach(input => {
            const val = parseFloat(input.value);
            if (isNaN(val)) {
                invalid = true;
                return;
            }
            cashFlowsLow.push(val);
            cashFlowsBase.push(val);
            cashFlowsHigh.push(val);
        });
        if (invalid || cashFlowsBase.length === 0) {
            showAINPVError('Please enter valid numeric values for all cash flows');
            return;
        }
    } else {
        // Use dividend/terminal-price scenarios
        const currentPricePerShare = window.AI_NPV_DATA?.currentPricePerShare || 0;
        
        if (!currentPricePerShare || currentPricePerShare <= 0) {
            showAINPVError('Current price per share not available. Please fetch scenarios again.');
            return;
        }

        const investmentAmount = Math.abs(initialCost);
        const shares = investmentAmount / currentPricePerShare;

        console.log(`Investment: $${investmentAmount} at $${currentPricePerShare}/share = ${shares.toFixed(4)} shares`);

        // Get terminal prices from input fields (they may have been edited)
        const terminalLowInput = document.querySelector('.ai-terminal-low');
        const terminalBaseInput = document.querySelector('.ai-terminal-base');
        const terminalHighInput = document.querySelector('.ai-terminal-high');
        
        // Check if values in table are already totals (multiplied by shares) or per-share
        // If investment was entered, table shows totals; otherwise per-share
        const hasInvestment = investmentAmount > 0 && shares > 0;
        
        let terminalLow, terminalBase, terminalHigh;
        if (terminalLowInput && terminalBaseInput && terminalHighInput) {
            // Get values from inputs
            const terminalLowValue = parseFloat(terminalLowInput.value) || 0;
            const terminalBaseValue = parseFloat(terminalBaseInput.value) || 0;
            const terminalHighValue = parseFloat(terminalHighInput.value) || 0;
            
            // If table shows totals (has investment), use directly; otherwise multiply by shares
            terminalLow = hasInvestment ? terminalLowValue : terminalLowValue * shares;
            terminalBase = hasInvestment ? terminalBaseValue : terminalBaseValue * shares;
            terminalHigh = hasInvestment ? terminalHighValue : terminalHighValue * shares;
        } else {
            // Fallback to stored values
            const storedTerminal = window.AI_NPV_DATA?.terminalPricePerShare || {};
            terminalLow = (storedTerminal.low || 0) * shares;
            terminalBase = (storedTerminal.base || 0) * shares;
            terminalHigh = (storedTerminal.high || 0) * shares;
        }

        console.log(`Terminal totals: Low=${terminalLow.toFixed(2)}, Base=${terminalBase.toFixed(2)}, High=${terminalHigh.toFixed(2)}`);

        for (let i = 0; i < baseInputs.length; i++) {
            const lowDivValue = parseFloat(lowInputs[i].value) || 0;
            const baseDivValue = parseFloat(baseInputs[i].value) || 0;
            const highDivValue = parseFloat(highInputs[i].value) || 0;

            if (isNaN(lowDivValue) || isNaN(baseDivValue) || isNaN(highDivValue)) {
                showAINPVError('Please enter valid numeric values for all scenarios');
                return;
            }

            const isLastYear = (i === baseInputs.length - 1);

            if (isLastYear) {
                // Final year: dividend + terminal sale
                // If table shows totals, use directly; otherwise multiply by shares
                const lowDivTotal = hasInvestment ? lowDivValue : lowDivValue * shares;
                const baseDivTotal = hasInvestment ? baseDivValue : baseDivValue * shares;
                const highDivTotal = hasInvestment ? highDivValue : highDivValue * shares;
                
                const lowTotal = lowDivTotal + terminalLow;
                const baseTotal = baseDivTotal + terminalBase;
                const highTotal = highDivTotal + terminalHigh;
                
                console.log(`Final year ${i + 1}: Low=${lowTotal.toFixed(2)}, Base=${baseTotal.toFixed(2)}, High=${highTotal.toFixed(2)}`);
                
                cashFlowsLow.push(lowTotal);
                cashFlowsBase.push(baseTotal);
                cashFlowsHigh.push(highTotal);
            } else {
                // Regular years: dividend only
                // If table shows totals, use directly; otherwise multiply by shares
                const lowTotal = hasInvestment ? lowDivValue : lowDivValue * shares;
                const baseTotal = hasInvestment ? baseDivValue : baseDivValue * shares;
                const highTotal = hasInvestment ? highDivValue : highDivValue * shares;
                
                console.log(`Year ${i + 1}: Low=${lowTotal.toFixed(2)}, Base=${baseTotal.toFixed(2)}, High=${highTotal.toFixed(2)}`);
                
                cashFlowsLow.push(lowTotal);
                cashFlowsBase.push(baseTotal);
                cashFlowsHigh.push(highTotal);
            }
        }
    }

    console.log('Position cash flows:', { low: cashFlowsLow, base: cashFlowsBase, high: cashFlowsHigh });

    const button = document.getElementById('ai-calculate-npv');
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Calculating NPV...</span>';
    button.disabled = true;

    try {
        console.log('Calculating NPV for scenarios:', { ticker, initialCost, requiredReturn });

        // Calculate NPV for each scenario
        const scenarios = ['low', 'base', 'high'];
        const scenarioCashFlows = {
            low: cashFlowsLow,
            base: cashFlowsBase,
            high: cashFlowsHigh
        };

        const npvResults = {};

        for (const scenario of scenarios) {
        const response = await fetch(`${AI_NPV_API}/api/ai-npv/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ticker: ticker,
                initial_cost: initialCost,
                required_return: requiredReturn,
                    cash_flows: scenarioCashFlows[scenario],
                    include_sensitivity: false
            })
        });

        const data = await response.json();

        if (!response.ok) {
                throw new Error(data.detail || `Failed to calculate ${scenario} NPV`);
        }

            npvResults[scenario] = data;
        }

        console.log('NPV calculation results:', npvResults);

        // Store for export
        window.AI_NPV_DATA = {
            ...window.AI_NPV_DATA,
            ticker: ticker,
            initialCost: initialCost,
            requiredReturn: requiredReturn,
            npvResults: npvResults
        };

        // Display results
        displayScenarioNPVResults(ticker, npvResults);
        
        // Also refresh the cash flows table to show totals if investment was just entered
        if (window._updateAINPVTable) {
            setTimeout(() => {
                console.log('Refreshing cash flows table after NPV calculation');
                window._updateAINPVTable();
            }, 200);
        }

    } catch (error) {
        console.error('NPV calculation error:', error);
        showAINPVError(`Failed to calculate NPV: ${error.message}`);
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

/**
 * Display scenario-based NPV results (Low/Base/High)
 */
function displayScenarioNPVResults(ticker, npvResults) {
    const container = document.getElementById('ai-npv-results-container');
    const exportButtons = document.getElementById('ai-export-buttons');

    const lowNPV = npvResults.low?.base_npv?.npv || 0;
    const baseNPV = npvResults.base?.base_npv?.npv || 0;
    const highNPV = npvResults.high?.base_npv?.npv || 0;

    const isBasePositive = baseNPV > 0;
    const decisionColor = isBasePositive ? '#10b981' : '#ef4444';
    const decisionText = isBasePositive ? 'ACCEPT PROJECT (Base Case)' : 'REJECT PROJECT (Base Case)';

    // Calculate shares purchased
    const currentPricePerShare = window.AI_NPV_DATA?.currentPricePerShare || 0;
    const investmentAmount = Math.abs(window.AI_NPV_DATA?.initialCost || 0);
    const sharesPurchased = currentPricePerShare > 0 ? investmentAmount / currentPricePerShare : 0;

    let html = `
        <!-- Investment Summary -->
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.8125rem;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; text-align: center;">
                <div>
                    <div style="color: #0369a1; font-weight: 600; margin-bottom: 0.25rem;">Investment Amount</div>
                    <div style="color: #0c4a6e; font-weight: 700; font-size: 1rem;">${formatCurrency(investmentAmount)}</div>
                </div>
                <div>
                    <div style="color: #0369a1; font-weight: 600; margin-bottom: 0.25rem;">Price Per Share</div>
                    <div style="color: #0c4a6e; font-weight: 700; font-size: 1rem;">$${currentPricePerShare.toFixed(2)}</div>
                </div>
                <div>
                    <div style="color: #0369a1; font-weight: 600; margin-bottom: 0.25rem;">Shares Purchased</div>
                    <div style="color: #0c4a6e; font-weight: 700; font-size: 1rem;">${sharesPurchased.toFixed(4)}</div>
                </div>
            </div>
        </div>

        <!-- Base NPV Value Card -->
        <div style="text-align: center; padding: 1.75rem; background: linear-gradient(135deg, ${isBasePositive ? '#ecfdf5' : '#fef2f2'} 0%, #ffffff 100%); border: 2px solid ${decisionColor}; border-radius: 12px; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                Net Present Value (Base Scenario)
            </div>
            <div style="font-size: 2.75rem; font-weight: 700; color: ${decisionColor}; margin-bottom: 0.4rem; line-height: 1;">
                ${formatCurrency(baseNPV)}
            </div>
            <div style="font-size: 1rem; font-weight: 600; color: ${decisionColor};">
                ${decisionText}
            </div>
        </div>

        <!-- Scenario NPV Cards -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
            <div style="padding: 1rem; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; text-align: center;">
                <div style="font-size: 0.7rem; font-weight: 600; color: #991b1b; text-transform: uppercase; margin-bottom: 0.4rem;">Low Scenario</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #dc2626;">${formatCurrency(lowNPV)}</div>
                <div style="font-size: 0.75rem; color: #991b1b; margin-top: 0.25rem;">${lowNPV > 0 ? 'Positive' : 'Negative'}</div>
            </div>
            <div style="padding: 1rem; background: #f9fafb; border: 2px solid #d1d5db; border-radius: 10px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size: 0.7rem; font-weight: 600; color: #374151; text-transform: uppercase; margin-bottom: 0.4rem;">Base Scenario</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${decisionColor};">${formatCurrency(baseNPV)}</div>
                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">Most Likely</div>
            </div>
            <div style="padding: 1rem; background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 10px; text-align: center;">
                <div style="font-size: 0.7rem; font-weight: 600; color: #065f46; text-transform: uppercase; margin-bottom: 0.4rem;">High Scenario</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">${formatCurrency(highNPV)}</div>
                <div style="font-size: 0.75rem; color: #065f46; margin-top: 0.25rem;">${highNPV > 0 ? 'Positive' : 'Negative'}</div>
            </div>
        </div>

        <!-- Scenario Explanations -->
        <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="font-weight: 700; color: #111827; margin-bottom: 0.875rem; font-size: 0.9375rem;">Scenario Analysis</div>
            ${window.AI_NPV_DATA?.scenarioExplanations ? `
                <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.8125rem; line-height: 1.6;">
                    <div>
                        <strong style="color: #dc2626;">Low Case:</strong>
                        <span style="color: #4b5563;">${window.AI_NPV_DATA.scenarioExplanations.low || 'Conservative estimates'}</span>
                    </div>
                    <div>
                        <strong style="color: #374151;">Base Case:</strong>
                        <span style="color: #4b5563;">${window.AI_NPV_DATA.scenarioExplanations.base || 'Expected performance'}</span>
                    </div>
                    <div>
                        <strong style="color: #059669;">High Case:</strong>
                        <span style="color: #4b5563;">${window.AI_NPV_DATA.scenarioExplanations.high || 'Optimistic projections'}</span>
                    </div>
                </div>
            ` : '<div style="color: #6b7280; font-size: 0.8125rem;">Scenario explanations not available</div>'}
        </div>

        <!-- Key Metrics (Base Scenario) -->
        <div style="font-weight: 700; color: #111827; margin-bottom: 0.75rem; font-size: 0.9375rem;">Key Metrics (Base Case)</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
            <div style="padding: 0.875rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                <div style="font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.3rem;">IRR</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">${npvResults.base?.base_npv?.irr ? npvResults.base.base_npv.irr.toFixed(2) + '%' : 'N/A'}</div>
            </div>
            <div style="padding: 0.875rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                <div style="font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.3rem;">Required Return</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">${npvResults.base?.base_npv?.required_return.toFixed(2)}%</div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Show export buttons
    if (exportButtons) {
        exportButtons.style.display = 'block';
    }
}

// displayAINPVResults() removed - deprecated and unused (replaced by displayScenarioNPVResults)

/**
 * Set button loading state
 */
function setButtonLoading(button, loadingText = 'Loading...') {
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
 * Restore button state
 */
function restoreButton(button, originalHTML) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = originalHTML;
}

/**
 * Export as PDF
 */
async function exportAIPDF(ticker, buttonElement = null) {
    if (!window.AI_NPV_DATA || !window.AI_NPV_DATA.npvResults) {
        showAINPVError('No calculation data available. Please calculate NPV first.');
        return;
    }

    // Find button if not provided
    if (!buttonElement) {
        const buttons = document.querySelectorAll('button[onclick*="exportAIPDF"]');
        buttonElement = Array.from(buttons).find(btn => btn.textContent.includes('Export PDF'));
    }

    const originalHTML = setButtonLoading(buttonElement, 'Generating PDF...');

    try {
        console.log('Exporting PDF for:', ticker);
        showAINPVSuccess('Generating detailed scenario analysis...');

        // Step 1: Generate detailed 150-word scenario analysis
        const detailedAnalysisResponse = await fetch(`${AI_NPV_API}/api/ai-npv/generate-detailed-analysis`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ticker: ticker,
                exchange: window.AI_NPV_DATA.exchange || null
            })
        });

        let detailedExplanations = window.AI_NPV_DATA.scenarioExplanations || {};

        if (detailedAnalysisResponse.ok) {
            const detailedData = await detailedAnalysisResponse.json();
            detailedExplanations = detailedData; // Use 150-word versions
            console.log('Detailed 150-word analysis generated:', detailedData);
        } else {
            console.warn('Failed to generate detailed analysis, using short versions');
        }

        showAINPVSuccess('Preparing PDF export...');

        // Step 2: Prepare export data with all three scenarios + company info
        const exportData = {
            ticker: ticker,
            npv_result: window.AI_NPV_DATA.npvResults.base.base_npv, // Base case for main display
            sensitivity_result: null,
            // New fields for scenario analysis
            scenario_results: {
                low: window.AI_NPV_DATA.npvResults.low.base_npv,
                base: window.AI_NPV_DATA.npvResults.base.base_npv,
                high: window.AI_NPV_DATA.npvResults.high.base_npv
            },
            scenario_explanations: detailedExplanations,
            // Company information for redesigned PDF
            company_name: window.AI_NPV_DATA.companyName || ticker,
            exchange: window.AI_NPV_DATA.exchange || '',
            currency: window.AI_NPV_DATA.currency || 'USD',
            stock_price: window.AI_NPV_DATA.currentPricePerShare || 0,
            description: window.AI_NPV_DATA.description || ''
        };

        console.log('Export data with scenarios:', exportData);

        const response = await fetch(`${AI_NPV_API}/api/ai-npv/export/pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(exportData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to export PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ticker}_NPV_Valuation_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showAINPVSuccess(`PDF exported successfully: ${a.download}`);
        restoreButton(buttonElement, originalHTML);

    } catch (error) {
        console.error('PDF export error:', error);
        showAINPVError(`Failed to export PDF: ${error.message}`);
        restoreButton(buttonElement, originalHTML);
    }
}

/**
 * Export as Excel
 */
async function exportAIExcel(ticker, buttonElement = null) {
    if (!window.AI_NPV_DATA || !window.AI_NPV_DATA.npvResults) {
        showAINPVError('No calculation data available. Please calculate NPV first.');
        return;
    }

    // Find button if not provided
    if (!buttonElement) {
        const buttons = document.querySelectorAll('button[onclick*="exportAIExcel"]');
        buttonElement = Array.from(buttons).find(btn => btn.textContent.includes('Export Excel'));
    }

    const originalHTML = setButtonLoading(buttonElement, 'Generating Excel...');

    try {
        console.log('Exporting Excel for:', ticker);

        // Prepare export data with all three scenarios + company info (same as PDF export)
        const exportData = {
            ticker: ticker,
            npv_result: window.AI_NPV_DATA.npvResults.base.base_npv,
            sensitivity_result: null,
            scenario_results: {
                low: window.AI_NPV_DATA.npvResults.low.base_npv,
                base: window.AI_NPV_DATA.npvResults.base.base_npv,
                high: window.AI_NPV_DATA.npvResults.high.base_npv
            },
            scenario_explanations: window.AI_NPV_DATA.scenarioExplanations || {},
            // Company information
            company_name: window.AI_NPV_DATA.companyName || ticker,
            exchange: window.AI_NPV_DATA.exchange || '',
            currency: window.AI_NPV_DATA.currency || 'USD',
            stock_price: window.AI_NPV_DATA.currentPricePerShare || 0,
            description: window.AI_NPV_DATA.description || ''
        };

        console.log('Export data:', exportData);

        const response = await fetch(`${AI_NPV_API}/api/ai-npv/export/excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(exportData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to export Excel');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${ticker}_NPV_Valuation_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showAINPVSuccess(`Excel file exported successfully: ${a.download}`);
        restoreButton(buttonElement, originalHTML);

    } catch (error) {
        console.error('Excel export error:', error);
        showAINPVError(`Failed to export Excel: ${error.message}`);
        restoreButton(buttonElement, originalHTML);
    }
}

/**
 * Show error message
 */
function showAINPVError(message) {
    const errorDiv = document.getElementById('ai-npv-error-message');
    if (!errorDiv) return;

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 8000);
}

/**
 * Hide error message
 */
function hideAINPVError() {
    const errorDiv = document.getElementById('ai-npv-error-message');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

/**
 * Show success message
 */
function showAINPVSuccess(message) {
    const errorDiv = document.getElementById('ai-npv-error-message');
    if (!errorDiv) return;

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.background = '#f0fdf4';
    errorDiv.style.borderLeft = '3px solid #10b981';
    errorDiv.style.color = '#065f46';

    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.background = '#fef2f2';
        errorDiv.style.borderLeft = '3px solid #ef4444';
        errorDiv.style.color = '#b91c1c';
    }, 5000);
}

/**
 * Format currency
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

/**
 * Re-fetch scenario-based cash flows for a specific exchange after disambiguation
 */
async function refetchOCFForExchange(ticker, companyInfo) {
    try {
        const exchange = typeof companyInfo === 'string' ? companyInfo : companyInfo.exchange;
        console.log('=== refetchOCFForExchange CALLED ===');
        console.log('Ticker:', ticker);
        console.log('Exchange:', exchange);
        console.log('Company Info:', companyInfo);

        // Show loading in CF block
        showCFLoading(`Generating cash flow scenarios for ${ticker} on ${exchange}...`);

        const response = await fetch(`${AI_NPV_API}/api/ai-npv/fetch-cf-scenarios`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ticker: ticker,
                years: 5,
                exchange: exchange  // Pass exchange to backend
            })
        });

        const data = await response.json();
        console.log('API Response:', data);

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to fetch CF scenarios');
        }

        console.log('CF scenarios received for exchange:', data);

        // Store scenario data globally (now includes per-share data AND company info)
        window.AI_NPV_DATA = {
            ticker: ticker,
            currentPricePerShare: data.current_price_per_share || 0,
            dividendsPerShare: data.dividends_per_share || {},
            terminalPricePerShare: data.terminal_price_per_share || {},
            scenarioExplanations: data.scenario_explanation || {},
            years: data.years || [],
            // Store company info from disambiguation
            companyName: typeof companyInfo === 'object' ? (companyInfo.name || '') : '',
            exchange: typeof companyInfo === 'object' ? (companyInfo.exchange || '') : exchange,
            currency: typeof companyInfo === 'object' ? (companyInfo.currency || 'USD') : 'USD',
            country: typeof companyInfo === 'object' ? (companyInfo.country || '') : '',
            description: typeof companyInfo === 'object' ? (companyInfo.description || '') : ''
        };

        // Update Company Info display with price from CF scenarios (single source of truth)
        displayCompanyInfo({
            ticker: ticker,
            description: window.AI_NPV_DATA.description,
            exchange: window.AI_NPV_DATA.exchange,
            currency: window.AI_NPV_DATA.currency,
            country: window.AI_NPV_DATA.country,
            stock_price: data.current_price_per_share || 0  // Use price from CF scenarios
        });

        // Display scenario table with new data
        displayScenariosTable(data.years, data.dividends_per_share, data.terminal_price_per_share, data.current_price_per_share);

        showAINPVSuccess(`Successfully generated ${data.years.length} years of cash flow scenarios for ${ticker} (${exchange})`);

    } catch (error) {
        console.error('CF scenarios refetch error:', error);
        showAINPVError(`Failed to fetch CF scenarios: ${error.message}`);
        
        // Clear loading state in CF block
        const container = document.getElementById('ai-ocf-table-container');
        if (container) {
            container.innerHTML = '';
        }
    } finally {
        // Always restore button state
        if (button) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
}

/**
 * Display company information
 */
function displayCompanyInfo(data) {
    const panel = document.getElementById('ai-company-info-panel');
    const container = document.getElementById('ai-company-info-container');

    if (!panel || !container) return;

    const html = `
        <div style="margin-bottom: 1rem;">
            <p style="font-size: 0.875rem; line-height: 1.6; color: #374151; margin: 0;">
                ${data.description}
            </p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
            <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Exchange
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.exchange}
                </div>
            </div>
            <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Currency
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.currency}
                </div>
            </div>
            <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Country
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.country}
                </div>
            </div>
            <div style="background: #fafafa; padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem;">
                    Stock Price
                </div>
                <div style="font-size: 0.875rem; font-weight: 600; color: #1f2937;">
                    ${data.currency} ${data.stock_price.toFixed(2)}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    panel.style.display = 'block';
}

/**
 * Show a small chooser when multiple companies share a ticker
 */
function showCompanyChooser(matches, onSelect) {
    const container = document.getElementById('ai-ticker-disambiguation');
    if (!container) {
        // fallback to overlay if container missing
        return showCompanyChooserOverlay(matches, onSelect);
    }
    container.innerHTML = '';

    const label = document.createElement('label');
    label.className = 'input-label disambiguation-label';
    label.textContent = 'Select a company';
    container.appendChild(label);

    // Create wrapper for select + button combo
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'disambiguation-input-wrapper';

    const select = document.createElement('select');
    select.className = 'input disambiguation-select';
    select.setAttribute('aria-label', 'Select a company from the list');
    select.size = Math.min(matches.length, 6);

    matches.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        // Show company name if available, otherwise ticker + exchange
        const displayName = m.name || `${(m.ticker || '').toUpperCase()}${m.exchange ? ' (' + m.exchange + ')' : ''}`;
        opt.textContent = displayName;
        opt.dataset.exchange = m.exchange || '';
        opt.dataset.name = m.name || '';
        opt.dataset.description = m.description || '';
        opt.dataset.ticker = m.ticker || '';
        opt.dataset.currency = m.currency || '';
        opt.dataset.country = m.country || '';
        opt.dataset.stock_price = m.stock_price || '';
        select.appendChild(opt);
    });

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'disambiguation-button';
    btn.textContent = 'Use Selection';
    btn.setAttribute('aria-label', 'Confirm company selection');
    btn.addEventListener('click', () => {
        const idx = select.value;
        const m = matches[idx];
        if (onSelect) onSelect(m);
    });

    inputWrapper.appendChild(select);
    inputWrapper.appendChild(btn);
    container.appendChild(inputWrapper);

    const helper = document.createElement('p');
    helper.className = 'hint disambiguation-helper';
    helper.textContent = 'Multiple companies found with this ticker. Please select the correct one.';
    container.appendChild(helper);
}

// Fallback overlay if needed
function showCompanyChooserOverlay(matches, onSelect) {
    let overlay = document.getElementById('ai-company-chooser');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'ai-company-chooser';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.style.background = '#ffffff';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.12)';
    modal.style.padding = '1.25rem';
    modal.style.width = '360px';
    modal.style.maxWidth = '90%';
    modal.style.color = '#111827';
    modal.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';

    const title = document.createElement('h3');
    title.textContent = 'Select a company';
    title.style.margin = '0 0 0.5rem 0';
    title.style.fontSize = '1.05rem';
    title.style.fontWeight = '700';
    modal.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Multiple matches found for this ticker. Choose one:';
    subtitle.style.margin = '0 0 0.75rem 0';
    subtitle.style.fontSize = '0.9rem';
    subtitle.style.color = '#4b5563';
    modal.appendChild(subtitle);

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '0.5rem';

    matches.forEach((m) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.style.width = '100%';
        card.style.textAlign = 'left';
        card.style.padding = '0.65rem 0.75rem';
        card.style.border = '1px solid #e5e7eb';
        card.style.borderRadius = '8px';
        card.style.background = '#fff';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.2s ease';

        const top = document.createElement('div');
        top.style.display = 'flex';
        top.style.justifyContent = 'space-between';
        top.style.alignItems = 'center';
        top.style.fontWeight = '700';
        top.style.fontSize = '0.95rem';
        top.style.color = '#111827';
        top.textContent = `${(m.ticker || '').toUpperCase()} ${m.exchange || ''}`.trim();

        const bottom = document.createElement('div');
        bottom.style.fontSize = '0.8rem';
        bottom.style.color = '#6b7280';
        bottom.style.marginTop = '0.15rem';
        bottom.textContent = m.name || '';

        card.appendChild(top);
        card.appendChild(bottom);

        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#7c3aed';
            card.style.boxShadow = '0 3px 10px rgba(124, 58, 237, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e5e7eb';
            card.style.boxShadow = 'none';
        });
        card.addEventListener('click', () => {
            overlay.remove();
            if (onSelect) onSelect(m);
        });

        list.appendChild(card);
    });

    modal.appendChild(list);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.marginTop = '1rem';
    cancel.style.padding = '0.55rem 0.9rem';
    cancel.style.borderRadius = '6px';
    cancel.style.border = '1px solid #e5e7eb';
    cancel.style.background = '#f9fafb';
    cancel.style.cursor = 'pointer';
    cancel.style.fontWeight = '600';
    cancel.style.color = '#374151';
    cancel.addEventListener('click', () => overlay.remove());

    modal.appendChild(cancel);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/**
 * Add ticker to Portfolio Optimization from AI NPV results
 */
function addToPortfolioFromAI(ticker, buttonElement = null) {
    if (!ticker) {
        showAINPVError('No ticker available to add');
        return;
    }

    // Find button if not provided
    if (!buttonElement) {
        const buttons = document.querySelectorAll('button[onclick*="addToPortfolioFromAI"]');
        buttonElement = Array.from(buttons).find(btn => btn.textContent.includes('Add to My Portfolio'));
    }

    const originalHTML = setButtonLoading(buttonElement, 'Adding...');

    const tickerUpper = ticker.toUpperCase();

    // Check if portfolio module functions are available
    if (typeof addPortfolioAsset === 'undefined') {
        showAINPVError('Portfolio module not loaded. Please refresh the page.');
        restoreButton(buttonElement, originalHTML);
        return;
    }

    // Check if ticker already exists in portfolio
    if (window.portfolioAssets && window.portfolioAssets.find(a => a.ticker === tickerUpper)) {
        showAINPVError(`${tickerUpper} is already in your portfolio`);
        restoreButton(buttonElement, originalHTML);
        return;
    }

    try {
        // Prepare rich asset data from AI_NPV_DATA
        const assetData = {
            ticker: tickerUpper,
            companyName: window.AI_NPV_DATA?.companyName || '',
            currency: window.AI_NPV_DATA?.currency || 'USD',
            exchange: window.AI_NPV_DATA?.exchange || '',
            npvData: null,
            dcfData: null,
            source: 'ai_npv'
        };

        // Add NPV data if available
        if (window.AI_NPV_DATA?.npvResults?.base?.base_npv) {
            const baseNPV = window.AI_NPV_DATA.npvResults.base.base_npv;
            assetData.npvData = {
                npv: baseNPV.npv || 0,
                irr: baseNPV.irr || 0,
                decision: baseNPV.decision || 'N/A',
                initialCost: baseNPV.initial_cost || 0,
                requiredReturn: baseNPV.required_return || 0
            };
        }

        // Call addPortfolioAsset with rich data
        addPortfolioAsset(assetData);

        const companyDisplay = assetData.companyName ? `${assetData.companyName} (${tickerUpper})` : tickerUpper;
        showAINPVSuccess(`Added ${companyDisplay} to Portfolio Optimization`);

        restoreButton(buttonElement, originalHTML);
    } catch (error) {
        console.error('Add to portfolio error:', error);
        showAINPVError(`Failed to add ${tickerUpper} to portfolio: ${error.message}`);
        restoreButton(buttonElement, originalHTML);
    }
}

// Make functions globally available
window.fetchOCF = fetchOCF;
window.addAIOCFYear = addAIOCFYear;
window.calculateAINPV = calculateAINPV;
window.exportAIPDF = exportAIPDF;
window.exportAIExcel = exportAIExcel;
window.addToPortfolioFromAI = addToPortfolioFromAI;
