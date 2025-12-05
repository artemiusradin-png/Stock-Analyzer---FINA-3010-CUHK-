// ---------- Enhanced Ticker Handler ----------
(function () {
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.from(document.querySelectorAll(s)); }

  // Ticker data storage
  window.appState = window.appState || {};
  
  // Sample ticker data (fallback demo values)
  const TICKER_DATA = {
    // Static fallback data used only when no API response is available.
    'AAPL': {
      name: 'Apple Inc',
      sector: 'Technology',
      marketCap: 3500.0,
      revenue: 383.3,
      ebitda: 123.4,
      pe: 28.5,
      beta: 1.2,
      prevClose: 195.18,
      open: 194.50,
      bid: '194.85 x 1250000',
      ask: '194.90 x 980000',
      dayRange: '194.20 - 196.50',
      weekRange: '180.00 - 200.00',
      volume: '45,234,567',
      avgVolume: '52,100,000',
      eps: 6.85,
      earningsDate: 'Jan 30, 2025',
      dividend: '0.96 (0.49%)',
      exDividend: 'Nov 8, 2024',
      targetEst: 210.00
    },
    'MSFT': {
      name: 'Microsoft Corporation',
      sector: 'Technology',
      marketCap: 2800.0,
      revenue: 211.9,
      ebitda: 88.5,
      pe: 32.1,
      beta: 0.9,
      prevClose: 375.25,
      open: 374.80,
      bid: '375.10 x 890000',
      ask: '375.15 x 750000',
      dayRange: '373.50 - 377.20',
      weekRange: '350.00 - 380.00',
      volume: '28,456,789',
      avgVolume: '35,200,000',
      eps: 11.68,
      earningsDate: 'Jan 28, 2025',
      dividend: '3.00 (0.80%)',
      exDividend: 'Nov 6, 2024',
      targetEst: 400.00
    },
    'GOOGL': {
      name: 'Alphabet Inc Class A',
      sector: 'Technology',
      marketCap: 1800.0,
      revenue: 307.4,
      ebitda: 89.2,
      pe: 25.8,
      beta: 1.1,
      prevClose: 142.50,
      open: 142.20,
      bid: '142.45 x 2100000',
      ask: '142.50 x 1800000',
      dayRange: '141.80 - 143.90',
      weekRange: '130.00 - 150.00',
      volume: '32,123,456',
      avgVolume: '28,500,000',
      eps: 5.52,
      earningsDate: 'Jan 30, 2025',
      dividend: '0.00 (0.00%)',
      exDividend: 'N/A',
      targetEst: 160.00
    },
    'CMG': {
      name: 'Chipotle Mexican Grill Inc',
      sector: 'Consumer Cyclical',
      marketCap: 55.8,
      revenue: 12.7,
      ebitda: 3.3,
      pe: 48.2,
      beta: 1.05,
      prevClose: 41.61,
      open: 41.80,
      bid: '41.55 x 1500',
      ask: '41.70 x 1500',
      dayRange: '40.90 - 41.95',
      weekRange: '31.00 - 44.00',
      volume: '1,245,320',
      avgVolume: '1,100,000',
      eps: 2.10,
      earningsDate: 'Oct 23, 2025',
      dividend: '0.00 (0.00%)',
      exDividend: 'N/A',
      targetEst: 31.43
    }
  };

  function setTicker(ticker) {
    const normalized = (ticker || '').toUpperCase();
    const canonical = normalized.replace(/\./g, '-');
    window.appState.tickerDisplay = normalized;
    window.appState.ticker = canonical;
    const staticData = TICKER_DATA[canonical] || TICKER_DATA[normalized];
    window.appState.tickerData = staticData ? { ...staticData, __source: 'static' } : null;
  }

  function getTicker() {
    return window.appState.ticker || '';
  }

  function getTickerDisplay() {
    return window.appState.tickerDisplay || getTicker();
  }

  function getTickerData() {
    return window.appState.tickerData || null;
  }

  function updateKeyDataTable() {
    const data = getTickerData();
    if (!data) {
      const table = ['prev-close','open-price','bid-data','ask-data','day-range','week-range','volume','avg-volume','market-cap','beta','pe-ratio','eps','earnings-date','dividend','ex-dividend','target-est'];
      table.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = '--';
        }
      });
      const timestamp = document.getElementById('data-timestamp');
      if (timestamp) timestamp.textContent = 'Awaiting data…';
      return;
    }
    const ticker = getTicker();
    
    // Update key metrics in the right panel
    const updates = {
      'prev-close': data.prevClose.toString(),
      'open-price': data.open.toString(),
      'bid-data': data.bid,
      'ask-data': data.ask,
      'day-range': data.dayRange,
      'week-range': data.weekRange,
      'volume': data.volume,
      'avg-volume': data.avgVolume,
      'market-cap': Number.isFinite(data.marketCap) ? `${data.marketCap}B` : data.marketCap,
      'beta': data.beta.toString(),
      'pe-ratio': data.pe.toString(),
      'eps': data.eps.toString(),
      'earnings-date': data.earningsDate,
      'dividend': data.dividend,
      'ex-dividend': data.exDividend,
      'target-est': data.targetEst.toString()
    };

    Object.entries(updates).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        // Add animation class
        el.classList.add('updating');
        
        // Update value
        el.textContent = value;
        
        // Remove animation class after animation completes
        setTimeout(() => {
          el.classList.remove('updating');
        }, 600);
      }
    });

    // Update timestamp
    const timestamp = document.getElementById('data-timestamp');
    if (timestamp) {
      const now = new Date();
      const timeStr = now.toLocaleString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      timestamp.textContent = timeStr;
    }
  }

  function updateDCFInputs() {
    const data = getTickerData();
    if (!data) return;
    
    // Update DCF model inputs with ticker data
    const revenueInput = document.getElementById('revenue_base');
    if (revenueInput) revenueInput.value = data.revenue;

    const equityInput = document.getElementById('equity_value');
    if (equityInput) equityInput.value = data.marketCap;

  }

  function activateTicker() {
    const input = $('#symbol');
    const button = $('#confirm-tick');
    const inputControl = input?.parentElement;
    const status = $('#status-text');
    
    if (input && button) {
      // Add active styling
      input.classList.add('active');
      button.classList.add('active');
      if (inputControl) inputControl.classList.add('ticker-active');
      
      // Update status
      if (status) {
        status.textContent = `Analyzing ${getTickerDisplay()}…`;
        status.style.color = '#ffffff';
      }

      // Update all data
      updateKeyDataTable();
      updateDCFInputs();
      
      // Auto-populate inputs with new ticker data
      if (typeof autoPopulateInputs === 'function') {
        autoPopulateInputs();
      }
      
      // Re-run all calculations
      setTimeout(() => {
        try { 
          if (typeof calculateValuation === 'function') calculateValuation(); 
        } catch(e) { console.error('calculateValuation error:', e); }
        
        try { 
          if (typeof runSensitivityAnalysis === 'function') runSensitivityAnalysis(); 
        } catch(e) { console.error('runSensitivityAnalysis error:', e); }
        
        try { 
          if (typeof calculateComparables === 'function') calculateComparables(); 
        } catch(e) { console.error('calculateComparables error:', e); }
      }, 100);
    }
  }

  function deactivateTicker() {
    const input = $('#symbol');
    const button = $('#confirm-tick');
    const inputControl = input?.parentElement;
    const status = $('#status-text');
    
    if (input && button) {
      input.classList.remove('active');
      button.classList.remove('active');
      if (inputControl) inputControl.classList.remove('ticker-active');
      
      if (status) {
        status.textContent = 'Enter ticker symbol';
        status.style.color = '#a1a1aa'; // Default color
      }
    }
  }

  function trigger() {
    const input = $('#symbol');
    const ticker = (input?.value || '').toUpperCase().trim();
    
    if (!ticker) {
      deactivateTicker();
      return;
    }

    setTicker(ticker);
    activateTicker();
    const status = $('#status-text');
    if (status) {
      status.textContent = `Requesting ${ticker}…`;
      status.style.color = '#f59e0b';
    }
  }

  // Initialize on DOM ready
  window.addEventListener('DOMContentLoaded', () => {
    const input = $('#symbol');
    const button = $('#confirm-tick');

    // Initialize with default ticker
    if (input) {
      setTicker(input.value || '');
      input.addEventListener('input', () => {
        // Deactivate when user starts typing
        deactivateTicker();
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          trigger();
        }
      });
    }

    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        trigger();
      });
    }

    // Initial activation
    setTimeout(() => {
      activateTicker();
    }, 500);
  });

  // Expose functions globally
  window.setTicker = setTicker;
  window.getTicker = getTicker;
  window.getTickerDisplay = getTickerDisplay;
  window.getTickerData = getTickerData;
  window.activateTicker = activateTicker;
  window.deactivateTicker = deactivateTicker;
  window.applyTickerSnapshot = function(apiData) {
    if (!apiData) return;
    const rawTicker = (apiData.ticker || '').toUpperCase();
    const simpleTicker = rawTicker.includes('.') ? rawTicker.split('.')[0] : rawTicker;
    const activeTicker = getTicker();
    if (simpleTicker && activeTicker !== simpleTicker && activeTicker !== rawTicker) {
      // Avoid overwriting state if user has already switched tickers
      return;
    }

    const projections = apiData.projections || [];
    const firstProj = projections[0] || {};
    const snapshot = {
      name: apiData.company_name || rawTicker,
      marketCap: typeof apiData.market_cap === 'number' ? Number(apiData.market_cap.toFixed(1)) : getTickerData()?.marketCap || 0,
      revenue: typeof firstProj.revenue === 'number' ? Number(firstProj.revenue.toFixed(3)) : getTickerData()?.revenue || 0,
      ebitda: '--',
      pe: '--',
      beta: typeof apiData.beta === 'number' ? Number(apiData.beta.toFixed(2)) : '--',
      prevClose: typeof apiData.current_price === 'number' ? apiData.current_price.toFixed(2) : '--',
      open: '--',
      bid: '--',
      ask: '--',
      dayRange: '--',
      weekRange: '--',
      volume: '--',
      avgVolume: '--',
      eps: '--',
      earningsDate: '--',
      dividend: '--',
      exDividend: '--',
      targetEst: '--',
      sector: apiData.sector,
      industry: apiData.industry,
      __source: 'api'
    };

    window.appState.tickerData = snapshot;

    if (typeof window.autoPopulateInputs === 'function') {
      window.autoPopulateInputs();
    } else {
      updateDCFInputs();
    }

    updateKeyDataTable();
  };
})();
