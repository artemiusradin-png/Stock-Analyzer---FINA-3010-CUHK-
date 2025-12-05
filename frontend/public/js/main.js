// ---------- main.js (Complete DCF Valuation Platform) ----------
(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  
  function num(id, def = 0) {
      const el = document.getElementById(id);
      const v = parseFloat(el && el.value);
      return Number.isFinite(v) ? v : def;
  }

  const formatBillions = (value) => {
    if (!Number.isFinite(value)) return '$--';
    const abs = Math.abs(value);
    const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    const formatted = value.toFixed(decimals);
    return `$${formatted}B`;
  };

  const STATIC_DCF_DATA = {
    CMG: {
      ticker: 'CMG',
      company_name: 'Chipotle Mexican Grill Inc',
      snapshot_source: 'alphaspread-static',
      sector: 'Consumer Cyclical',
      industry: 'Restaurants',
      currency: 'USD',
      current_price: 41.61,
      implied_price: 31.43,
      upside_downside: -24.0,
      enterprise_value: 42.1,
      equity_value: 42.1,
      terminal_value: 42.1,
      pv_terminal: 30.018,
      wacc: 7.01,
      cost_of_equity: 8.8,
      cost_of_debt: 3.2,
      risk_free_rate: 4.0,
      erp: 5.0,
      beta: 1.05,
      unlevered_beta: 0.95,
      shares_outstanding: 1.34e9,
      market_cap: 55.8,
      cash: 0.844,
      debt: 0.0,
      forecast_period: 5,
      terminal_growth_rate: 0.0,
      historical: [
        { year: 2021, revenue: 6.843, cogs: 4.027, grossProfit: 2.816, opex: 2.153, ebit: 0.663, tax: 0.143, netIncome: 0.520 },
        { year: 2022, revenue: 7.912, cogs: 4.445, grossProfit: 3.467, opex: 2.433, ebit: 1.034, tax: 0.176, netIncome: 0.858 },
        { year: 2023, revenue: 9.871, cogs: 5.387, grossProfit: 4.484, opex: 2.821, ebit: 1.663, tax: 0.302, netIncome: 1.361 },
        { year: 2024, revenue: 11.530, cogs: 6.220, grossProfit: 5.310, opex: 3.130, ebit: 2.180, tax: 0.293, netIncome: 1.887 },
        { year: 2025, revenue: 12.737, cogs: 6.770, grossProfit: 5.967, opex: 3.787, ebit: 2.180, tax: 0.293, netIncome: 1.887 },
        { year: 2026, revenue: 14.539, cogs: 7.609, grossProfit: 6.930, opex: 4.405, ebit: 2.525, tax: 0.317, netIncome: 2.208 }
      ],
      projections: [
        {
          year: 2025,
          year_label: 'Year 1',
          revenue: 12.737,
          revenue_growth_pct: 14.1,
          ebit: 2.180,
          ebit_margin_pct: 17.11,
          tax_rate_pct: 13.4,
          nopat: 1.941,
          reinvestment: 0.0,
          fcf: 1.941,
          pv_fcf: 1.814
        },
        {
          year: 2026,
          year_label: 'Year 2',
          revenue: 14.539,
          revenue_growth_pct: 14.2,
          ebit: 2.525,
          ebit_margin_pct: 17.37,
          tax_rate_pct: 12.6,
          nopat: 2.260,
          reinvestment: 0.0,
          fcf: 2.260,
          pv_fcf: 1.974
        },
        {
          year: 2027,
          year_label: 'Year 3',
          revenue: 16.020,
          revenue_growth_pct: 10.2,
          ebit: 2.939,
          ebit_margin_pct: 18.35,
          tax_rate_pct: 13.7,
          nopat: 2.537,
          reinvestment: -0.002,
          fcf: 2.539,
          pv_fcf: 2.012
        },
        {
          year: 2028,
          year_label: 'Year 4',
          revenue: 17.717,
          revenue_growth_pct: 10.6,
          ebit: 3.253,
          ebit_margin_pct: 18.38,
          tax_rate_pct: 15.0,
          nopat: 2.765,
          reinvestment: 0.006,
          fcf: 2.759,
          pv_fcf: 2.104
        },
        {
          year: 2029,
          year_label: 'Year 5',
          revenue: 18.948,
          revenue_growth_pct: 6.9,
          ebit: 3.463,
          ebit_margin_pct: 18.28,
          tax_rate_pct: 16.4,
          nopat: 2.894,
          reinvestment: -0.009,
          fcf: 2.903,
          pv_fcf: 2.069
        }
      ]
    }
  };

  function getStaticDcfData(rawTicker) {
    if (!rawTicker) return null;
    const normalized = rawTicker.toUpperCase().replace(/[^A-Z]/g, '');
    if (normalized in STATIC_DCF_DATA) {
      const data = STATIC_DCF_DATA[normalized];
      return JSON.parse(JSON.stringify(data));
    }
    return null;
  }

  function buildStaticSensitivitySurface(snapshot) {
    if (!snapshot || !snapshot.projections) return null;
    const pvFcfSum = snapshot.projections.reduce((acc, row) => acc + row.pv_fcf, 0);
    const lastFcf = snapshot.projections[snapshot.projections.length - 1]?.fcf || 0;
    const debt = snapshot.debt || 0;
    const cash = snapshot.cash || 0;
    const shares = snapshot.shares_outstanding || 1;
    const horizon = snapshot.projections.length;

    const waccs = [];
    const tgrs = [];
    const gridSize = 21;
    const waccLow = 0.05;
    const waccHigh = 0.10;
    const tgrLow = -0.01;
    const tgrHigh = 0.03;

    for (let i = 0; i < gridSize; i++) {
      waccs.push(Number((waccLow + (waccHigh - waccLow) * (i / (gridSize - 1))).toFixed(4)));
      tgrs.push(Number((tgrLow + (tgrHigh - tgrLow) * (i / (gridSize - 1))).toFixed(4)));
    }

    const surface = tgrs.map((tgr) => {
      return waccs.map((wacc) => {
        if (wacc <= tgr) return 0;
        const tv = lastFcf * (1 + tgr) / (wacc - tgr);
        const pvTv = tv / Math.pow(1 + wacc, horizon);
        const equity = pvFcfSum + pvTv - debt + cash;
        return Number(((equity * 1e9) / shares).toFixed(2));
      });
    });

    return {
      waccs,
      tgrs,
      dcf_results: surface,
      current_price: snapshot.current_price,
      base_implied_price: snapshot.implied_price
    };
  }

  // API Configuration
  const DEFAULT_API_BASES = [
    'http://localhost:5050/api',
    'http://127.0.0.1:5050/api',
    'http://localhost:5000/api',
    'http://127.0.0.1:5000/api'
  ];

  function normalizeApiBase(base) {
    if (typeof base !== 'string') return null;
    const trimmed = base.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
  }

  function getStoredApiBase() {
    try {
      if (typeof localStorage === 'undefined') return null;
      return normalizeApiBase(localStorage.getItem('dcfApiBase'));
    } catch (err) {
      return null;
    }
  }

  function buildCandidateApiBases() {
    const seen = new Set();
    const candidates = [];
    const push = (value) => {
      const normalized = normalizeApiBase(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push(normalized);
    };

    push(window.API_BASE_URL);
    const metaBase = document.querySelector('meta[name="dcf-api-base"]');
    if (metaBase) push(metaBase.getAttribute('content'));

    const urlBase = new URLSearchParams(window.location.search).get('api');
    push(urlBase);

    if (typeof window.__DCF_API_BASE__ !== 'undefined') {
      push(window.__DCF_API_BASE__);
    }

    push(getStoredApiBase());

    const origin = window.location && window.location.origin;
    if (origin && origin !== 'null') {
      push(`${origin.replace(/\/$/, '')}/api`);
    }

    DEFAULT_API_BASES.forEach(push);
    return candidates;
  }

  let API_BASE_URL = null;
  let USE_API = false; // Toggled after health check
  let API_HEALTHY = false;

  function updateStatusIndicator(message, tone = 'idle') {
    const statusText = document.getElementById('status-text');
    const statusDot = document.querySelector('.status-indicator .status-dot');

    if (statusText && message) {
      statusText.textContent = message;
    }

    if (statusDot) {
      let color;
      switch (tone) {
        case 'ok':
          color = 'var(--accent-success)';
          break;
        case 'warn':
          color = '#f59e0b';
          break;
        case 'error':
          color = '#ef4444';
          break;
        default:
          color = '#6366f1';
      }
      statusDot.style.background = color;
      statusDot.style.boxShadow = `0 0 10px ${color}`;
    }
  }

  async function initializeDCFIntegration() {
    const candidates = buildCandidateApiBases();

    for (const base of candidates) {
      const targetDescription = (() => {
        try {
          return new URL(base).host;
        } catch (_) {
          return base;
        }
      })();

      updateStatusIndicator(`Connecting to DCF API (${targetDescription})…`, 'warn');

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(`${base}/health`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }

        const payload = await response.json();
        
        if (payload && payload.status === 'healthy') {
          API_BASE_URL = base;
          USE_API = true;
          API_HEALTHY = true;
          updateStatusIndicator('DCF API connected', 'ok');
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('dcfApiBase', API_BASE_URL);
            }
          } catch (storageErr) {
            console.debug('Unable to persist API base URL:', storageErr);
          }
          window.API_BASE_URL = API_BASE_URL;
          return;
        }

        throw new Error('Unexpected health response');
      } catch (err) {
        console.warn(`DCF API health check failed for ${base}:`, err);
      }
    }

    console.warn('DCF API unavailable, falling back to local model');
    API_BASE_URL = null;
    USE_API = false;
    API_HEALTHY = false;
    window.API_BASE_URL = null;
    updateStatusIndicator('Local model active', 'warn');
  }

  // API Integration Function
  async function calculateDCFFromAPI(ticker) {
    try {
      if (!API_BASE_URL) {
        console.warn('DCF API base URL is not set; skipping API call');
        return null;
      }
      const normalized = (ticker || '').toUpperCase().trim();
      let apiTicker = normalized;
      if (apiTicker.includes('.')) {
        if (!apiTicker.endsWith('.US')) {
          const dotParts = apiTicker.split('.');
          if (dotParts.length === 2 && dotParts[1] && dotParts[1] !== 'US') {
            apiTicker = `${dotParts[0]}-${dotParts[1]}.US`;
          } else if (!apiTicker.endsWith('.US')) {
            apiTicker = `${apiTicker}.US`;
          }
        }
      } else if (!apiTicker.endsWith('.US')) {
        apiTicker = `${apiTicker}.US`;
      }
      const parameters = {
        forecast_period: num('forecast_period', 10),
        revenue_growth: num('growth_c2_end', 9) / 100,
        ebit_margin: num('terminal_margin', 17.5) / 100,
        tax_rate: num('marginal_tax', 25) / 100,
        terminal_growth: num('terminal_growth_rate', 4) / 100
      };

      const response = await fetch(`${API_BASE_URL}/dcf/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticker: apiTicker,
          parameters: parameters
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        API_HEALTHY = true;
        window.appState = window.appState || {};
        window.appState.sliders = window.appState.sliders || {};
        window.appState.sliders.forecast = parameters.forecast_period;
        window.appState.sliders.terminal = parameters.terminal_growth * 100;
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('API call failed:', error);
      API_HEALTHY = false;
      return null;
    }
  }

  // DCF Calculation Functions
  function renderSummary(dcf) {
    const equityValueEl = $('#equity-value-main');
    const firmValueEl = $('#firm-value-main');
    const operatingAssetsEl = $('#operating-assets-main');
    const pricePerShareEl = $('#price-per-share-main');
    const equityChangeEl = $('#equity-change');
    const upsidePotentialEl = $('#upside-potential');

    const shares = Number(dcf.sharesOutstanding) || 1;
    const equityPerShare = dcf.equityValueB * 1e9 / shares;
    const firmPerShare = dcf.enterpriseValueB * 1e9 / shares;
    const pvPerShare = dcf.pvFcffB * 1e9 / shares;

    if (equityValueEl) equityValueEl.textContent = `$${equityPerShare.toFixed(2)}`;
    if (firmValueEl) firmValueEl.textContent = `$${firmPerShare.toFixed(2)}`;
    if (operatingAssetsEl) operatingAssetsEl.textContent = `$${pvPerShare.toFixed(2)}`;
    if (pricePerShareEl) pricePerShareEl.textContent = `$${dcf.currentPrice.toFixed(2)}`;

    const metricMap = {
      '#metric-wacc': Number.isFinite(dcf.wacc) ? `${dcf.wacc.toFixed(2)}%` : '--',
      '#metric-coe': Number.isFinite(dcf.costOfEquity) ? `${dcf.costOfEquity.toFixed(2)}%` : '--',
      '#metric-cod': Number.isFinite(dcf.costOfDebt) ? `${dcf.costOfDebt.toFixed(2)}%` : '--',
      '#metric-riskfree': Number.isFinite(dcf.riskFreeRate) ? `${dcf.riskFreeRate.toFixed(2)}%` : '--',
      '#metric-erp': Number.isFinite(dcf.erp) ? `${dcf.erp.toFixed(2)}%` : '--',
      '#metric-beta': Number.isFinite(dcf.beta) ? dcf.beta.toFixed(2) : '--',
      '#metric-unlevered-beta': Number.isFinite(dcf.unleveredBeta) ? dcf.unleveredBeta.toFixed(2) : '--',
      '#metric-debt': Number.isFinite(dcf.debtB) ? `$${dcf.debtB.toFixed(2)}B` : '--',
      '#metric-marketcap': Number.isFinite(dcf.marketCapB) ? `$${dcf.marketCapB.toFixed(2)}B` : '--',
      '#metric-shares': Number.isFinite(dcf.sharesOutstanding) ? dcf.sharesOutstanding.toLocaleString() : '--',
      '#metric-forecast': Number.isFinite(dcf.forecastYears) ? `${dcf.forecastYears} yrs` : '--',
      '#metric-terminal': Number.isFinite(dcf.terminalGrowthRatePct) ? `${dcf.terminalGrowthRatePct.toFixed(2)}%` : '--'
    };

    Object.entries(metricMap).forEach(([selector, value]) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = value;
    });

    // Calculate vs market price using current price
    const premium = dcf.upsideDownside;
    if (equityChangeEl) equityChangeEl.textContent = `${premium > 0 ? '+' : ''}${premium.toFixed(1)}% vs Market`;
    if (upsidePotentialEl) upsidePotentialEl.textContent = premium > 0 ? 'Upside' : 'Downside';

    // Update DCF Value Summary Section
    updateDCFValueSummary(dcf);
  }

  // Store scenario values globally
  let scenarioValues = {
    worst: null,
    base: null,
    best: null
  };
  let currentScenario = 'base';
  let lastMarketPrice = 0;

  function updateDCFValueSummary(dcf) {
    const currentPrice = dcf.currentPrice || 0;
    const dcfValue = dcf.pricePerShare;
    const premium = dcf.upsideDownside;

    lastMarketPrice = currentPrice;

    // Store base case value
    scenarioValues.base = dcfValue;
    // Calculate worst and best case (±20% from base for now)
    scenarioValues.worst = dcfValue * 0.8;
    scenarioValues.best = dcfValue * 1.2;

    // Update DCF Value Block
    updateDCFValueBlock(currentPrice, scenarioValues[currentScenario], premium);
  }

  function updateDCFValueBlock(marketPrice, dcfValue, premium) {
    // Update main DCF value
    const mainValueEl = $('#dcf-main-value');
    if (mainValueEl) mainValueEl.textContent = `$${dcfValue.toFixed(2)}`;

    // Update slider market price
    const sliderMarketPriceEl = $('#dcf-slider-market-price');
    if (sliderMarketPriceEl) sliderMarketPriceEl.textContent = `$${marketPrice.toFixed(2)}`;

    // Update slider DCF value
    const sliderDcfValueEl = $('#dcf-slider-dcf-value');
    if (sliderDcfValueEl) sliderDcfValueEl.textContent = `$${dcfValue.toFixed(2)}`;

    // Calculate valuation percentage and position
    const diff = dcfValue - marketPrice;
    const diffPercent = (diff / marketPrice) * 100;
    const isUndervalued = diff > 0;

    // Update valuation text
    const sliderValuationEl = $('#dcf-slider-valuation');
    if (sliderValuationEl) {
      if (Math.abs(diffPercent) < 5) {
        sliderValuationEl.textContent = 'Fair Value';
        sliderValuationEl.style.color = '#fbbf24';
      } else if (isUndervalued) {
        sliderValuationEl.textContent = 'Undervalued';
        sliderValuationEl.style.color = '#10b981';
      } else {
        sliderValuationEl.textContent = 'Overvalued';
        sliderValuationEl.style.color = '#ef4444';
      }
    }

    // Position the slider marker
    // Map -50% to 0%, 0% to 50%, +50% to 100%
    const clampedPercent = Math.max(-50, Math.min(50, diffPercent));
    const markerPosition = 50 + clampedPercent; // 0-100%
    const sliderMarkerEl = $('#dcf-slider-marker');
    if (sliderMarkerEl) {
      sliderMarkerEl.style.left = `${markerPosition}%`;
    }

    // Update percentage difference
    const diffPercentageEl = $('#dcf-diff-percentage');
    if (diffPercentageEl) {
      diffPercentageEl.textContent = `${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(1)}%`;
      diffPercentageEl.style.color = isUndervalued ? '#10b981' : '#ef4444';
    }

    // Update absolute difference
    const diffAbsoluteEl = $('#dcf-diff-absolute');
    if (diffAbsoluteEl) {
      diffAbsoluteEl.textContent = `$${Math.abs(diff).toFixed(2)}`;
      diffAbsoluteEl.style.color = isUndervalued ? '#10b981' : '#ef4444';
    }
  }

  function renderTable(dcf) {
    const tbody = $('#valuationTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = dcf.table.map((row, index, arr) => {
      const label = row.yearLabel ?? row.year ?? `Year ${index + 1}`;
      const revenue = Number(row.revenueB) || 0;
      const growth = Number(row.growthRate) || 0;
      const ebitMargin = Number(row.ebitMargin) || 0;
      const ebit = Number(row.ebitB) || 0;
      const taxRate = Number(row.taxRate) || 0;
      const nopat = Number(row.nopatB) || 0;
      const reinvestment = Number(row.reinvestmentB) || 0;
      const fcf = Number(row.fcffB) || 0;
      const pv = Number(row.pvB) || 0;

      const reinvestmentDisplay = `$${Math.abs(reinvestment).toFixed(3)}B`;
      const isLastRow = index === arr.length - 1;
      const terminalDisplay = isLastRow && Number.isFinite(dcf.terminalValueB)
        ? `$${dcf.terminalValueB.toFixed(1)}B`
        : '-';

      return `
        <tr>
          <td>${label}</td>
          <td class="number">$${revenue.toFixed(2)}B</td>
          <td class="number">${growth.toFixed(1)}%</td>
          <td class="number">${(ebitMargin * 100).toFixed(1)}%</td>
          <td class="number">$${ebit.toFixed(2)}B</td>
          <td class="number">${taxRate.toFixed(1)}%</td>
          <td class="number">$${nopat.toFixed(2)}B</td>
          <td class="number">${reinvestment >= 0 ? '' : '-'}${reinvestmentDisplay}</td>
          <td class="number">$${fcf.toFixed(2)}B</td>
          <td class="number">${terminalDisplay}</td>
          <td class="number">$${pv.toFixed(2)}B</td>
        </tr>
      `;
    }).join('');
  }

  // Track currently active chart
  let currentActiveChart = 'revenue';

  // Chart rendering functions
  function renderCharts(dcf) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded');
      return;
    }

    // Save current active chart before clearing
    const activeCanvas = document.querySelector('.chart-canvas.active');
    if (activeCanvas) {
      currentActiveChart = activeCanvas.id.replace('Chart', '');
    }

    const canvases = $$('.chart-canvas');
    canvases.forEach(canvas => {
      canvas.classList.remove('active');
      canvas.style.removeProperty('display');
    });

    const activateTabButton = () => {
      // Don't reset tab button - keep current selection
      return;
    };

    const instantiateChart = (canvas, chartRef, config, makeActive = false) => {
      if (!canvas) return;
      if (window[chartRef]) window[chartRef].destroy();

      canvas.style.display = 'block';
      window[chartRef] = new Chart(canvas.getContext('2d'), config);

      if (makeActive) {
        canvas.classList.add('active');
        canvas.style.display = 'block';
      } else {
        canvas.classList.remove('active');
        canvas.style.removeProperty('display');
      }
    };

    const yearLabels = dcf.table.map((row, i) => {
      if (row.yearLabel) return row.yearLabel;
      if (row.year) return String(row.year);
      return `Year ${i + 1}`;
    });


    const revenueSeries = dcf.table.map(r => Number(r.revenueB) || 0);
    const growthRates = dcf.table.map(r => Number(r.growthRate) || 0);

    const rev = document.getElementById('revenueChart');
    instantiateChart(rev, '_chart_rev', {
      type: 'line',
      data: {
        labels: yearLabels,
        datasets: [{
          label: 'Revenue ($B)',
          data: revenueSeries,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.18)',
          tension: 0.35,
          fill: true,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#bfdbfe',
          pointBorderColor: '#60a5fa',
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e4e4e7' } },
          title: {
            display: true,
            text: 'Revenue Projection',
            color: '#e4e4e7',
            font: { size: 14, weight: 'bold' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa' },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return '$' + Number(value).toFixed(1) + 'B';
              }
            },
            grid: { color: 'rgba(63, 63, 70, 0.25)' }
          }
        }
      }
    }, true);

    const growth = document.getElementById('growthChart');
    instantiateChart(growth, '_chart_growth', {
      type: 'line',
      data: {
        labels: yearLabels,
        datasets: [{
          label: 'Revenue Growth (%)',
          data: growthRates,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.18)',
          tension: 0.35,
          fill: true,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#fed7aa',
          pointBorderColor: '#f97316',
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e4e4e7' } },
          title: {
            display: true,
            text: 'Revenue Growth Rate',
            color: '#e4e4e7',
            font: { size: 14, weight: 'bold' }
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${Number(value).toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa' },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return Number(value).toFixed(1) + '%';
              }
            },
            grid: { color: 'rgba(63, 63, 70, 0.25)' },
            beginAtZero: false
          }
        }
      }
    });

    const fcf = document.getElementById('fcfChart');
    instantiateChart(fcf, '_chart_fcf', {
      type: 'bar',
      data: {
        labels: yearLabels,
        datasets: [{
          label: 'FCFF ($B)',
          data: dcf.table.map(r => r.fcffB),
          backgroundColor: '#71717a',
          borderColor: '#a1a1aa',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e4e4e7' } },
          title: {
            display: true,
            text: 'Free Cash Flow Projection',
            color: '#e4e4e7',
            font: { size: 14, weight: 'bold' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa' },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return '$' + value.toFixed(1) + 'B';
              }
            },
            grid: { color: 'rgba(63, 63, 70, 0.3)' }
          }
        }
      }
    });

    const mar = document.getElementById('marginsChart');
    instantiateChart(mar, '_chart_mar', {
        type: 'line',
        data: {
        labels: yearLabels,
        datasets: [{
          label: 'EBIT Margin (%)',
          data: dcf.table.map(r => r.ebitMargin * 100),
          borderColor: '#a1a1aa',
          backgroundColor: 'rgba(161, 161, 170, 0.15)',
          tension: 0.4,
          fill: true,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#d4d4d8',
          pointBorderColor: '#a1a1aa',
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e4e4e7' } },
          title: {
            display: true,
            text: 'EBIT Margin Trend',
            color: '#e4e4e7',
            font: { size: 14, weight: 'bold' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa' },
            grid: { display: false }
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return value.toFixed(1) + '%';
              }
            },
            grid: { color: 'rgba(63, 63, 70, 0.3)' }
          }
        }
      }
    });

    const disc = document.getElementById('discountChart');
    const discountRate = Number(dcf.wacc) || 0;
    const rateDecimal = discountRate / 100;
    instantiateChart(disc, '_chart_disc', {
      type: 'line',
      data: {
        labels: yearLabels,
        datasets: [{
          label: 'WACC (%)',
          data: dcf.table.map(() => discountRate),
          borderColor: '#d4d4d8',
          backgroundColor: 'rgba(212, 212, 216, 0.12)',
          tension: 0,
          fill: true,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#fafafa',
          pointBorderColor: '#d4d4d8'
        }, {
          label: 'Discount Factor',
          data: dcf.table.map((_, i) => (1 / Math.pow(1 + rateDecimal, i + 1) * 100)),
          borderColor: '#71717a',
          backgroundColor: 'rgba(113, 113, 122, 0.12)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#a1a1aa',
          pointBorderColor: '#71717a',
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#e4e4e7' },
            display: true
          },
          title: {
            display: true,
            text: 'WACC & Present Value Factor',
            color: '#e4e4e7',
            font: { size: 14, weight: 'bold' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa' },
            grid: { display: false },
            title: {
              display: true,
              text: 'Year',
              color: '#a1a1aa'
            }
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return value.toFixed(1) + '%';
              }
            },
            grid: { color: 'rgba(63, 63, 70, 0.3)' },
            title: {
              display: true,
              text: 'WACC (%)',
              color: '#a1a1aa'
            },
            position: 'left'
          },
          y1: {
            ticks: {
              color: '#a1a1aa',
              callback: function(value) {
                return value.toFixed(0) + '%';
              }
            },
            grid: { display: false },
            title: {
              display: true,
              text: 'Discount Factor (%)',
              color: '#a1a1aa'
            },
            position: 'right'
          }
        }
      }
    });

    const val = document.getElementById('valuationChart');
    instantiateChart(val, '_chart_val', {
        type: 'bar',
        data: {
        labels: ['PV of FCFF', 'PV of Terminal', '(-) Net Debt', 'Equity Value'],
        datasets: [{
          label: 'Valuation Bridge ($B)',
          data: [dcf.pvFcffB, dcf.pvTerminalB, -dcf.netDebtB, dcf.equityValueB],
          backgroundColor: ['#d4d4d8', '#a1a1aa', '#71717a', '#52525b'],
          borderColor: ['#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a'],
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#a1a1aa' } },
          title: { display: true, text: 'Valuation Bridge', color: '#e4e4e7', font: { size: 14, weight: '500' } }
        },
        scales: {
          x: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#71717a' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });

    activateTabButton();

    // Restore previously active chart
    setTimeout(() => {
      const chartToActivate = document.getElementById(`${currentActiveChart}Chart`);
      if (chartToActivate) {
        chartToActivate.style.display = 'block';
        chartToActivate.classList.add('active');

        // Resize the chart
        const chartVarName = `_chart_${currentActiveChart === 'revenue' ? 'rev' :
                                     currentActiveChart === 'growth' ? 'growth' :
                                     currentActiveChart === 'fcf' ? 'fcf' :
                                     currentActiveChart === 'margins' ? 'mar' :
                                     currentActiveChart === 'discount' ? 'disc' : 'val'}`;
        if (window[chartVarName]) {
          window[chartVarName].resize();
        }
      }
    }, 150);
  }

  function renderFinancialOverview(dcf) {
    const revenueData = dcf.table.map(r => r.revenueB);
    const incomeData = dcf.table.map(r => r.nopatB);
    const cashFlowData = dcf.table.map(r => r.fcffB);

    const updateMetric = (startId, endId, data) => {
      const start = document.getElementById(startId);
      const end = document.getElementById(endId);
      if (!data.length) return;
      if (start) start.textContent = formatBillions(data[0]);
      if (end) end.textContent = formatBillions(data[data.length - 1]);
    };

    updateMetric('financial-revenue-start', 'financial-revenue-end', revenueData);
    updateMetric('financial-income-start', 'financial-income-end', incomeData);
    updateMetric('financial-fcf-start', 'financial-fcf-end', cashFlowData);

    const canvas = document.getElementById('financialOverviewChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = dcf.table.map((row, i) => {
      if (row.yearLabel) return row.yearLabel;
      if (row.year) return String(row.year);
      return `Year ${i + 1}`;
    });

    if (window._chart_financialOverview) {
      window._chart_financialOverview.destroy();
    }

    const forecastStartIndex = labels.length > 3 ? 3 : null;
    const forecastShadePlugin = {
      id: 'financialForecastShade',
      beforeDraw(chart) {
        if (forecastStartIndex === null) return;
        const forecastLabel = labels[forecastStartIndex];
        const xScale = chart.scales.x;
        if (!xScale) return;
        const startPixel = xScale.getPixelForValue(forecastLabel);
        if (!Number.isFinite(startPixel)) return;
        const {ctx, chartArea: {top, bottom, right}} = chart;
        ctx.save();
        const gradient = ctx.createLinearGradient(startPixel, top, right, top);
        gradient.addColorStop(0, 'rgba(82, 82, 91, 0.15)');
        gradient.addColorStop(1, 'rgba(63, 63, 70, 0.08)');
        ctx.fillStyle = gradient;
        ctx.fillRect(startPixel, top, right - startPixel, bottom - top);
        ctx.restore();
      }
    };

    window._chart_financialOverview = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenueData,
            borderColor: '#d4d4d8',
            backgroundColor: 'rgba(212, 212, 216, 0.15)',
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: true,
            borderWidth: 2.5
          },
          {
            label: 'Net Income',
            data: incomeData,
            borderColor: '#a1a1aa',
            backgroundColor: 'rgba(161, 161, 170, 0.12)',
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: true,
            borderWidth: 2.5
          },
          {
            label: 'Free Cash Flow',
            data: cashFlowData,
            borderColor: '#71717a',
            backgroundColor: 'rgba(113, 113, 122, 0.12)',
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: true,
            borderWidth: 2.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#e4e4e7',
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${formatBillions(value)}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#a1a1aa' },
            grid: { color: 'rgba(63, 63, 70, 0.3)' }
          },
          y: {
            ticks: {
              color: '#a1a1aa',
              callback(value) {
                const abs = Math.abs(value);
                const decimals = abs >= 100 ? 0 : abs >= 10 ? 0 : 1;
                return `${Number(value).toFixed(decimals)}B`;
              }
            },
            grid: { color: 'rgba(63, 63, 70, 0.3)' }
          }
        }
      },
      plugins: [forecastShadePlugin]
    });
  }

  // Track animation direction globally
  let animationDirection = 'left-to-right';

  // Public API functions
window.calculateValuation = async function () {
  // Only show logo preview on initial load, use normal loading for all other operations
  if (isInitialLoad) {
    isInitialLoad = false; // Mark that initial load is complete
    startLogoPreview();
    // Wait for logo preview to finish before showing calculation overlay
    await new Promise(resolve => setTimeout(resolve, 2100));
  }

  const overlay = document.getElementById('chartsLoading');
  if (overlay) overlay.style.display = 'flex';

  const globalOverlay = document.getElementById('global-loading-overlay');
  const loadingText = globalOverlay?.querySelector('.global-loading-text');
  
  const showGlobal = () => {
    if (globalOverlay && !globalOverlay.classList.contains('visible')) {
      // Toggle animation direction
      if (loadingText) {
        loadingText.classList.remove('reverse');
        if (animationDirection === 'right-to-left') {
          loadingText.classList.add('reverse');
        }
        // Switch direction for next time
        animationDirection = animationDirection === 'left-to-right' ? 'right-to-left' : 'left-to-right';
      }
      globalOverlay.classList.add('visible');
    }
  };
  const hideGlobal = () => {
    if (globalOverlay) {
      globalOverlay.classList.remove('visible');
    }
  };

  showGlobal();

  try {
      let dcf;
      const activeTicker = typeof getTicker === 'function' ? getTicker() : '';
      const displayTicker = typeof getTickerDisplay === 'function' ? getTickerDisplay() : activeTicker;

      updateStatusIndicator(`Fetching ${displayTicker.toUpperCase()} from DCF API…`, 'warn');

      let source = 'api';
      let valuationPayload = await calculateDCFFromAPI(activeTicker);

      if (!valuationPayload) {
        const staticPayload = getStaticDcfData(activeTicker) || getStaticDcfData('CMG');
        if (!staticPayload) {
          updateStatusIndicator('ERROR: DCF API not available. Cannot calculate.', 'error');
          throw new Error('DCF API is required but not available. Please ensure the Python server is running on port 5050.');
        }
        source = 'static';
        valuationPayload = staticPayload;
        updateStatusIndicator('DCF API Connected', 'ok');
      } else {
        updateStatusIndicator(`DCF API: ${displayTicker.toUpperCase()} loaded`, 'ok');
      }

      dcf = convertAPIToDCF(valuationPayload);
      window.appState = window.appState || {};
      window.appState.lastApiResult = { raw: valuationPayload, dcf, source };
      if (source === 'static') {
        window.appState.lastStaticSnapshot = valuationPayload;
      }

      renderSummary(dcf);
      renderTable(dcf);
      renderCharts(dcf);
      renderFinancialOverview(dcf);

  } catch (err) {
    console.error('calculateValuation failed:', err);
  } finally {
    if (overlay) overlay.style.display = 'none';
    if (globalOverlay) {
      setTimeout(hideGlobal, 150);
    }
  }
};

// Convert API response to internal DCF format
function convertAPIToDCF(apiData) {
  const projections = Array.isArray(apiData.projections) ? apiData.projections : [];
  const table = projections.map((proj, index) => {
    const marginPct = Number(proj.ebit_margin_pct);
    return {
      year: proj.year,
      yearLabel: proj.year_label || proj.year || `Year ${index + 1}`,
      revenueB: proj.revenue,
      growthRate: proj.revenue_growth_pct,
      ebitMargin: Number.isFinite(marginPct) ? marginPct / 100 : 0,
      ebitB: proj.ebit,
      taxRate: proj.tax_rate_pct,
      nopatB: proj.nopat,
      reinvestmentB: proj.reinvestment,
      fcffB: proj.fcf,
      pvB: proj.pv_fcf
    };
  });

  const pvFcffB = table.reduce((sum, row) => sum + (Number(row.pvB) || 0), 0);

  return {
    table,
    wacc: apiData.wacc,
    terminalGrowthRate: apiData.terminal_growth_rate,
    forecastPeriod: table.length,
    pvFcffB,
    pvTerminalB: apiData.pv_terminal,
    operatingAssetsB: apiData.enterprise_value,
    netDebtB: apiData.debt - apiData.cash,
    cashB: apiData.cash,
    equityValueB: apiData.equity_value,
    pricePerShare: apiData.implied_price,
    terminalValueB: apiData.terminal_value,
    enterpriseValueB: apiData.enterprise_value,
    currentPrice: apiData.current_price,
    upsideDownside: apiData.upside_downside,
    sharesOutstanding: apiData.shares_outstanding,
    companyName: apiData.company_name,
    marketCapB: apiData.market_cap,
    debtB: apiData.debt,
    costOfEquity: apiData.cost_of_equity,
    costOfDebt: apiData.cost_of_debt,
    riskFreeRate: apiData.risk_free_rate,
    erp: apiData.erp,
    beta: apiData.beta,
    unleveredBeta: apiData.unlevered_beta,
    terminalGrowthRatePct: apiData.terminal_growth_rate,
    forecastYears: apiData.forecast_period || table.length,
    sector: apiData.sector,
    industry: apiData.industry,
    currency: apiData.currency,
    snapshotSource: apiData.snapshot_source || null
  };
}

  // 3D Sensitivity Analysis Surface Plot
  async function render3DSensitivityChart() {
    const container = document.getElementById('sensitivity3DChart');
    if (!container || typeof Plotly === 'undefined') return;

    const overlay = document.getElementById('sensitivityLoading');
    if (overlay) overlay.style.display = 'flex';

    try {
      const activeTicker = typeof getTicker === 'function' ? getTicker() : '';
      let data = null;

      const lastResult = window.appState?.lastApiResult;
      const canUseApi = API_BASE_URL && (!lastResult || lastResult.source !== 'static');

      if (canUseApi) {
        const response = await fetch(`${API_BASE_URL}/dcf/sensitivity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: activeTicker,
            parameters: {
              terminal_growth_rate: num('terminal_growth_rate', 0.028),
              forecast_period: num('forecast_period', 10)
            },
            wacc_range: [0.06, 0.18],
            tgr_range: [0.01, 0.04],
            grid_size: 25
          })
        });

        if (!response.ok) throw new Error('Sensitivity API failed');

        const result = await response.json();
        data = result.data;
      } else if (lastResult && lastResult.raw) {
        data = buildStaticSensitivitySurface(lastResult.raw);
      } else {
        const snapshot = getStaticDcfData(activeTicker) || getStaticDcfData('CMG');
        data = buildStaticSensitivitySurface(snapshot);
      }

      if (!data) {
        throw new Error('No sensitivity data available');
      }

      const trace = {
        type: 'surface',
        x: data.waccs,
        y: data.tgrs,
        z: data.dcf_results,
        colorscale: 'Viridis',
        contours: {
          z: {
            show: true,
            usecolormap: true,
            highlightcolor: '#42f462',
            project: { z: true }
          }
        },
        colorbar: {
          title: 'Share Price ($)',
          titlefont: { color: '#a1a1aa' },
          tickfont: { color: '#a1a1aa' }
        }
      };

      const layout = {
        title: {
          text: 'DCF Sensitivity Analysis: WACC vs Terminal Growth Rate',
          font: { color: '#e4e4e7', size: 16 }
        },
        scene: {
          xaxis: {
            title: 'WACC (%)',
            titlefont: { color: '#a1a1aa' },
            tickfont: { color: '#71717a' },
            gridcolor: 'rgba(255,255,255,0.1)',
            tickformat: '.1%'
          },
          yaxis: {
            title: 'Terminal Growth Rate (%)',
            titlefont: { color: '#a1a1aa' },
            tickfont: { color: '#71717a' },
            gridcolor: 'rgba(255,255,255,0.1)',
            tickformat: '.1%'
          },
          zaxis: {
            title: 'Implied Share Price ($)',
            titlefont: { color: '#a1a1aa' },
            tickfont: { color: '#71717a' },
            gridcolor: 'rgba(255,255,255,0.1)'
          },
          bgcolor: 'rgba(15, 23, 42, 0.5)',
          camera: {
            eye: { x: 1.5, y: 1.5, z: 1.3 }
          }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 0, r: 0, t: 40, b: 0 }
      };

      const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['toImage']
      };

      Plotly.newPlot(container, [trace], layout, config);

      const allValues = data.dcf_results.flat().filter(v => v > 0);
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);

      const cards = document.querySelectorAll('.summary-card .card-value');
      if (cards.length >= 3) {
        cards[0].textContent = `$${data.base_implied_price.toFixed(2)}`;
        cards[1].textContent = `$${minValue.toFixed(2)}`;
        cards[2].textContent = `$${maxValue.toFixed(2)}`;
      }

    } catch (err) {
      console.error('3D sensitivity chart error:', err);
    } finally {
      if (overlay) overlay.style.display = 'none';
    }
  }

  window.renderSensitivityChart = render3DSensitivityChart;

window.runSensitivityAnalysis = function () {
  const overlay = document.getElementById('sensitivityLoading');
  if (overlay) overlay.style.display = 'flex';

  try {
    calculateValuation();
      setTimeout(() => {
        render3DSensitivityChart();
        if (overlay) overlay.style.display = 'none';
      }, 500);
  } catch (err) {
    console.error('runSensitivityAnalysis failed:', err);
    if (overlay) overlay.style.display = 'none';
  }
};

  const navState = {
    links: [],
    pages: [],
    mainContent: null
  };

  function setActiveLink(target) {
    navState.links.forEach(link => {
      const linkTarget = link.getAttribute('data-page');
      link.classList.toggle('active', linkTarget === target);
    });
  }

  function navigateToPage(target) {
    if (!target) return;

    if (!navState.pages.length) {
      navState.pages = Array.from(document.querySelectorAll('.page-content'));
      navState.links = Array.from(document.querySelectorAll('.nav-link'));
      navState.mainContent = document.getElementById('main-content');
    }

    const { pages } = navState;
    if (!pages.length) return;

        pages.forEach(p => p.classList.remove('active'));

        const pageEl = document.getElementById(`${target}-page`);
        if (pageEl) pageEl.classList.add('active');

    setActiveLink(target);

    if (target === 'valuation') {
      calculateValuation();
    } else if (target === 'portfolio') {
      renderPortfolio();
    } else if (target === 'npv') {
      // NPV page - no special initialization needed
    }
  }

  // Navigation functions
  function wireNav() {
    navState.links = Array.from($$('.nav-link'));
    navState.pages = Array.from($$('.page-content'));
    navState.mainContent = document.getElementById('main-content');

    navState.links.forEach(link => {
      link.addEventListener('click', (event) => {
        // If link has href (external navigation), allow default behavior
        const href = link.getAttribute('href');
        if (href) {
          // Allow default navigation for external links
          return;
        }
        
        // Otherwise, handle internal page navigation
        event.preventDefault();
        const target = link.getAttribute('data-page');
        if (target) {
          navigateToPage(target);
        }
      });
    });
  }

  window.navigateToPage = navigateToPage;

  function wireScenarioTabs() {
    const scenarioButtons = $$('.dcf-scenario-btn');
    if (!scenarioButtons.length) return;

    const scenarioConfig = {
      best: { terminal: 2.81 },
      base: { terminal: 0 },
      worst: { terminal: -2.81 }
    };

    scenarioButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        scenarioButtons.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'rgba(24, 24, 27, 0.6)';
          b.style.border = '1px solid #3f3f46';
          b.style.color = '#a1a1aa';
        });

        btn.classList.add('active');
        btn.style.background = 'linear-gradient(135deg, #3f3f46, #52525b)';
        btn.style.border = '1px solid #71717a';
        btn.style.color = '#fafafa';

        const scenario = btn.dataset.scenario;
        currentScenario = scenario;

        const config = scenarioConfig[scenario];
        if (config) {
          const terminalSlider = document.getElementById('terminal_growth_rate');
          if (terminalSlider) {
            terminalSlider.value = config.terminal;
            const display = document.getElementById('terminal_growth_rate_value');
            if (display) display.textContent = config.terminal.toFixed(2);
          }

          window.appState = window.appState || {};
          window.appState.sliders = window.appState.sliders || {};
          window.appState.sliders.terminal = config.terminal;
          showResetButton();
        }

        // Update scenario label
        const scenarioLabel = $('#dcf-scenario-label');
        if (scenarioLabel) {
          scenarioLabel.textContent = scenario === 'worst' ? 'Worst Case' :
                                      scenario === 'best' ? 'Best Case' : 'Base Case';
        }

        // Update the DCF value block with the selected scenario
        if (scenarioValues[scenario] && lastMarketPrice) {
          const dcfValue = scenarioValues[scenario];
          const diff = dcfValue - lastMarketPrice;
          const premium = (diff / lastMarketPrice) * 100;
          updateDCFValueBlock(lastMarketPrice, dcfValue, premium);
        }

        calculateValuation();
      });
    });
  }

  function wireChartTabs() {
    const buttons = $$('.tab-button, .projection-tab-button');
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const chart = btn.dataset.chart;
        currentActiveChart = chart;
        
        // Hide all charts with animation
        $$('.chart-canvas').forEach(c => {
          c.classList.remove('active');
          c.style.removeProperty('display');
        });
        
        // Show selected chart with animation
        const target = document.getElementById(`${chart}Chart`);
        if (target) {
          target.style.display = 'block';
          // Small delay to ensure smooth transition
          setTimeout(() => {
            target.classList.add('active');
          }, 50);
          
          // Redraw the chart if it exists
          setTimeout(() => {
            if (chart === 'revenue' && window._chart_rev) {
              window._chart_rev.resize();
            } else if (chart === 'growth' && window._chart_growth) {
              window._chart_growth.resize();
            } else if (chart === 'fcf' && window._chart_fcf) {
              window._chart_fcf.resize();
            } else if (chart === 'margins' && window._chart_mar) {
              window._chart_mar.resize();
            } else if (chart === 'discount' && window._chart_disc) {
              window._chart_disc.resize();
            } else if (chart === 'valuation' && window._chart_val) {
              window._chart_val.resize();
            }
          }, 200);
        }
      });
    });
  }

  // Collapsible sections
  window.toggleSection = function(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (section && icon) {
      const isHidden = section.style.display === 'none';
      section.style.display = isHidden ? 'block' : 'none';
      icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  };

  // Slider functionality
  function wireSliders() {
    const sliders = ['forecast_period', 'terminal_growth_rate'];

    sliders.forEach(sliderId => {
      const slider = document.getElementById(sliderId);
      const valueDisplay = document.getElementById(`${sliderId}_value`);

      if (slider && valueDisplay) {
        slider.addEventListener('input', () => {
          const value = parseFloat(slider.value);
          valueDisplay.textContent = value.toFixed(sliderId === 'forecast_period' ? 0 : 1);
          showResetButton();

          window.appState = window.appState || {};
          window.appState.sliders = window.appState.sliders || {};
          if (sliderId === 'forecast_period') window.appState.sliders.forecast = Number(value);
          if (sliderId === 'terminal_growth_rate') window.appState.sliders.terminal = Number(value);
        });
      }
    });
  }

  // Wire all input fields to show reset button when changed
  function wireInputsForReset() {
    // Get all number inputs except sliders
    const allInputs = document.querySelectorAll('.input[type="number"]');
    allInputs.forEach(input => {
      // Skip if already has listener (check for automated class parent logic)
      input.addEventListener('input', function() {
        // Only show reset for inputs marked as automated
        if (this.classList.contains('automated')) {
          this.classList.remove('automated');
          this.classList.add('manual');
          showResetButton();
        }
      });
    });
  }

  // Auto-populate inputs with ticker data
  function autoPopulateInputs() {
    const tickerData = window.getTickerData ? window.getTickerData() : null;
    if (!tickerData) return;

    // Auto-populate inputs with ticker data
    const autoInputs = {
      'revenue_base': tickerData.revenue,
      'equity_value': tickerData.marketCap,
      'current_margin': 15, // Default margin
      'terminal_margin': 17.5,
      'current_tax': 24,
      'marginal_tax': 25,
      'risk_free_rate': 4.25,
      'erp': 4.5,
      'debt_value': 3.887,
      // Growth assumptions
      'growth_c1_begin': 11,
      'growth_c1_end': 16,
      'growth_c2_begin': 14,
      'growth_c2_end': 9,
      'growth_c3_begin': 8,
      'terminal_growth': 4
    };

    Object.entries(autoInputs).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = value;
        // Add automated styling
        input.classList.add('automated');
      }
    });

    // Set slider values
    const forecastSlider = document.getElementById('forecast_period');
    const terminalSlider = document.getElementById('terminal_growth_rate');

    if (forecastSlider) {
      forecastSlider.value = window.appState?.sliders?.forecast || forecastSlider.value;
      document.getElementById('forecast_period_value').textContent = forecastSlider.value;
    }
    if (terminalSlider) {
      terminalSlider.value = window.appState?.sliders?.terminal || terminalSlider.value;
      document.getElementById('terminal_growth_rate_value').textContent = terminalSlider.value;
    }
  }

  // Show reset button with animation
  function showResetButton() {
    const calcText = document.getElementById('calc-text');
    const resetText = document.getElementById('reset-text');

    if (calcText && resetText) {
      // Expand "Reset to Auto" button
      resetText.style.width = '140px';
      resetText.style.opacity = '1';
      resetText.style.padding = '0 1rem';

      // Squeeze "Calculate Valuation" to the right
      calcText.style.textAlign = 'right';
      calcText.style.paddingRight = '0.5rem';
    }
  }

  // Hide reset button with animation
  function hideResetButton() {
    const calcText = document.getElementById('calc-text');
    const resetText = document.getElementById('reset-text');

    if (calcText && resetText) {
      // Collapse "Reset to Auto" button
      resetText.style.width = '0';
      resetText.style.opacity = '0';
      resetText.style.padding = '0';

      // Center "Calculate Valuation" text
      calcText.style.textAlign = 'center';
      calcText.style.paddingRight = '0';
    }
  }

  // Function to reset all inputs to automated state
  function resetToAutomated() {
    // Reset slider state
    window.appState = window.appState || {};
    window.appState.sliders = {
      forecast: 10,
      terminal: 4.0
    };

    // Re-populate with default values
    autoPopulateInputs();

    // Hide reset button
    hideResetButton();

    // Recalculate with automated values
    calculateValuation();
  }

  // ========================================
  // Detailed Financial Table Toggle
  // ========================================
  let isTableVisible = false;

  window.toggleDetailedTable = function() {
    const table = document.getElementById('detailed-financial-table');
    const button = document.getElementById('toggle-detailed-table-btn');
    const buttonText = document.getElementById('table-toggle-text');

    if (!table || !button || !buttonText) return;

    isTableVisible = !isTableVisible;

    button.classList.toggle('is-active', isTableVisible);
    button.setAttribute('aria-expanded', String(isTableVisible));

    if (isTableVisible) {
      table.style.display = 'block';
      setTimeout(() => {
        table.style.opacity = '1';
      }, 10);

      buttonText.textContent = 'Hide Detailed Table';

      setTimeout(() => {
        table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 200);
    } else {
      table.style.opacity = '0';
      setTimeout(() => {
        table.style.display = 'none';
      }, 400);

      buttonText.textContent = 'Show Detailed Table';
    }
  };

    // ----------------------- Portfolio Tracker -----------------------
  const PORTFOLIO_STORAGE_KEY = 'dcfPortfolioHoldings';
  let portfolioHoldings = [];

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  });

  const sharesFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  });

  function formatCurrencyValue(value, { signed = false } = {}) {
    if (!Number.isFinite(value)) value = 0;
    if (!signed) {
      return currencyFormatter.format(value);
    }
    const absValue = Math.abs(value);
    const formatted = currencyFormatter.format(absValue);
    if (value > 0) return `+${formatted}`;
    if (value < 0) return `-${formatted}`;
    return formatted;
  }

  function formatPercentValue(value, { signed = false } = {}) {
    if (!Number.isFinite(value)) return '0%';
    const rounded = value.toFixed(2);
    if (!signed) return `${rounded}%`;
    if (value > 0) return `+${rounded}%`;
    if (value < 0) return `${rounded}%`;
    return `${rounded}%`;
  }

  function sanitizeTicker(raw) {
    return (raw || '')
      .toUpperCase()
      .replace(/[^A-Z0-9.]/g, '')
      .slice(0, 8);
  }

  function escapeHtml(value) {
    if (value == null) return '';
    return String(value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return char;
      }
    });
  }

  function csvEscape(value) {
    if (value == null) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  function loadPortfolioHoldings() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((holding) => ({
        ticker: sanitizeTicker(holding.ticker),
        shares: Number(holding.shares) || 0,
        costBasis: Number(holding.costBasis) || 0,
        currentPrice: Number(holding.currentPrice) || 0,
        notes: holding.notes ? String(holding.notes).slice(0, 320) : '',
        targetPrice: Number(holding.targetPrice) || 0,
        allocation: Number(holding.allocation) || 0
      }));
    } catch (err) {
      console.warn('Failed to load portfolio holdings:', err);
      return [];
    }
  }

  function savePortfolioHoldings() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolioHoldings));
    } catch (err) {
      console.warn('Failed to persist portfolio holdings:', err);
    }
  }

  function getHoldingMetrics(holding) {
    const shares = Number(holding.shares) || 0;
    const costPerShare = Number(holding.costBasis) || 0;
    const invested = shares * costPerShare;
    const resolvedPrice = Number(holding.currentPrice);
    const marketPrice = Number.isFinite(resolvedPrice) && resolvedPrice > 0 ? resolvedPrice : costPerShare;
    const marketValue = shares * marketPrice;
    const profitLoss = marketValue - invested;
    const returnPct = invested > 0 ? (profitLoss / invested) * 100 : 0;

    return {
      shares,
      costPerShare,
      invested,
      marketPrice,
      marketValue,
      profitLoss,
      returnPct
    };
  }

  function resetPortfolioForm(form, submitLabel) {
    form.reset();
    delete form.dataset.editIndex;
    if (submitLabel) submitLabel.textContent = 'Add Holding';
  }

  function renderPortfolio() {
    const tableBody = document.getElementById('portfolio-table-body');
    const emptyState = document.getElementById('portfolio-empty');
    const marketValueEl = document.getElementById('portfolio-market-value');
    const costBasisEl = document.getElementById('portfolio-cost-basis');
    const unrealizedEl = document.getElementById('portfolio-unrealized');
    const unrealizedPctEl = document.getElementById('portfolio-unrealized-pct');
    const holdingsCountEl = document.getElementById('portfolio-holdings-count');

    if (!tableBody) return;

    if (!Array.isArray(portfolioHoldings)) {
      portfolioHoldings = [];
    }

    const totals = portfolioHoldings.reduce((acc, holding) => {
      const metrics = getHoldingMetrics(holding);
      acc.totalInvestment += metrics.invested;
      acc.totalMarket += metrics.marketValue;
      acc.totalShares += metrics.shares;
      return acc;
    }, { totalInvestment: 0, totalMarket: 0, totalShares: 0 });

    const totalPL = totals.totalMarket - totals.totalInvestment;
    const totalReturnPct = totals.totalInvestment > 0 ? (totalPL / totals.totalInvestment) * 100 : 0;

    if (marketValueEl) marketValueEl.textContent = formatCurrencyValue(totals.totalMarket);
    if (costBasisEl) costBasisEl.textContent = formatCurrencyValue(totals.totalInvestment);
    if (unrealizedEl) unrealizedEl.textContent = formatCurrencyValue(totalPL, { signed: true });
    if (unrealizedPctEl) unrealizedPctEl.textContent = formatPercentValue(totalReturnPct, { signed: true });
    if (holdingsCountEl) holdingsCountEl.textContent = portfolioHoldings.length;

    if (portfolioHoldings.length === 0) {
      tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      const totalMarket = totals.totalMarket || 0;
      tableBody.innerHTML = portfolioHoldings.map((holding, index) => {
        const metrics = getHoldingMetrics(holding);
        const actualWeight = totalMarket > 0 ? (metrics.marketValue / totalMarket) * 100 : 0;
        const targetAllocation = Number(holding.allocation);
        const allocationDisplay = Number.isFinite(targetAllocation) && targetAllocation > 0
          ? `${actualWeight.toFixed(1)}% (target ${targetAllocation.toFixed(1)}%)`
          : `${actualWeight.toFixed(1)}%`;
        const notesContent = holding.notes ? `<div>${escapeHtml(holding.notes)}</div>` : '';
        const targetContent = Number(holding.targetPrice) > 0
          ? `<div class="portfolio-target">Target ${formatCurrencyValue(holding.targetPrice)}</div>`
          : '';
        const notesCell = notesContent || targetContent
          ? `${notesContent}${targetContent}`
          : '—';

        return `
          <tr>
            <td>${escapeHtml(holding.ticker)}</td>
            <td class="number">${sharesFormatter.format(metrics.shares)}</td>
            <td class="number">${formatCurrencyValue(metrics.costPerShare)}</td>
            <td class="number">${formatCurrencyValue(metrics.invested)}</td>
            <td class="number">${formatCurrencyValue(metrics.marketPrice)}</td>
            <td class="number">${formatCurrencyValue(metrics.marketValue)}</td>
            <td class="number">${formatCurrencyValue(metrics.profitLoss, { signed: true })}</td>
            <td class="number">${formatPercentValue(metrics.returnPct, { signed: true })}</td>
            <td class="number">${allocationDisplay}</td>
            <td>${notesCell}</td>
            <td>
              <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                <button type="button" class="nav-button portfolio-edit" data-edit-index="${index}" style="padding:0.35rem 0.75rem; font-size:0.75rem;">Edit</button>
                <button type="button" class="nav-button portfolio-remove" data-remove-index="${index}" style="padding:0.35rem 0.75rem; font-size:0.75rem; color: var(--accent-warning); border-color: rgba(245, 158, 11, 0.4);">Remove</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    const totalSharesEl = document.getElementById('portfolio-total-shares');
    const totalCostEl = document.getElementById('portfolio-total-cost');
    const totalMarketEl = document.getElementById('portfolio-total-market');
    const totalPLEl = document.getElementById('portfolio-total-pl');
    const totalReturnEl = document.getElementById('portfolio-total-return');
    const totalAllocationEl = document.getElementById('portfolio-total-allocation');

    if (totalSharesEl) totalSharesEl.textContent = sharesFormatter.format(totals.totalShares);
    if (totalCostEl) totalCostEl.textContent = formatCurrencyValue(totals.totalInvestment);
    if (totalMarketEl) totalMarketEl.textContent = formatCurrencyValue(totals.totalMarket);
    if (totalPLEl) totalPLEl.textContent = formatCurrencyValue(totalPL, { signed: true });
    if (totalReturnEl) totalReturnEl.textContent = formatPercentValue(totalReturnPct, { signed: true });
    if (totalAllocationEl) totalAllocationEl.textContent = totals.totalMarket > 0 ? '100%' : '0%';
  }

  function removeHolding(index) {
    if (index < 0 || index >= portfolioHoldings.length) return;
    portfolioHoldings.splice(index, 1);
    savePortfolioHoldings();
    renderPortfolio();
  }

  function beginEditHolding(index, form, submitLabel) {
    if (!form) return;
    const holding = portfolioHoldings[index];
    if (!holding) return;

    form.dataset.editIndex = String(index);
    const tickerInput = document.getElementById('portfolio-ticker');
    const sharesInput = document.getElementById('portfolio-shares');
    const costInput = document.getElementById('portfolio-cost');
    const priceInput = document.getElementById('portfolio-price');
    const notesInput = document.getElementById('portfolio-notes');
    const targetInput = document.getElementById('portfolio-target');
    const allocationInput = document.getElementById('portfolio-allocation');

    if (tickerInput) tickerInput.value = holding.ticker;
    if (sharesInput) sharesInput.value = holding.shares;
    if (costInput) costInput.value = holding.costBasis;
    if (priceInput) priceInput.value = holding.currentPrice || '';
    if (notesInput) notesInput.value = holding.notes || '';
    if (targetInput) targetInput.value = holding.targetPrice || '';
    if (allocationInput) allocationInput.value = holding.allocation || '';
    if (submitLabel) submitLabel.textContent = 'Update Holding';
  }

  const SAMPLE_PORTFOLIO = [
    {
      ticker: 'AAPL',
      shares: 25,
      costBasis: 145.32,
      currentPrice: 178.64,
      notes: 'Flagship hardware with sticky services',
      targetPrice: 205,
      allocation: 25
    },
    {
      ticker: 'MSFT',
      shares: 18,
      costBasis: 285.5,
      currentPrice: 320.18,
      notes: 'Cloud + Copilot growth runway',
      targetPrice: 340,
      allocation: 20
    },
    {
      ticker: 'NVDA',
      shares: 10,
      costBasis: 410,
      currentPrice: 468.2,
      notes: 'AI infrastructure exposure',
      targetPrice: 520,
      allocation: 15
    },
    {
      ticker: 'COST',
      shares: 12,
      costBasis: 487.75,
      currentPrice: 560.11,
      notes: 'Recurring membership cash flows',
      targetPrice: 600,
      allocation: 10
    },
    {
      ticker: 'GOOGL',
      shares: 14,
      costBasis: 119.42,
      currentPrice: 138.11,
      notes: 'Advertising flywheel transitioning to AI',
      targetPrice: 150,
      allocation: 15
    },
    {
      ticker: 'V',
      shares: 16,
      costBasis: 204.8,
      currentPrice: 223.7,
      notes: 'Payment rails with secular growth',
      targetPrice: 240,
      allocation: 15
    }
  ];

  function loadSamplePortfolio(form, submitLabel) {
    if (portfolioHoldings.length && !window.confirm('Replace current holdings with sample data?')) return;
    portfolioHoldings = SAMPLE_PORTFOLIO.map(holding => ({ ...holding }));
    savePortfolioHoldings();
    renderPortfolio();
    if (form) resetPortfolioForm(form, submitLabel);
  }

  function clearPortfolio(form, submitLabel) {
    if (!portfolioHoldings.length) return;
    if (!window.confirm('Clear all tracked holdings?')) return;
    portfolioHoldings = [];
    savePortfolioHoldings();
    renderPortfolio();
    if (form) resetPortfolioForm(form, submitLabel);
  }

  function exportPortfolioCsv() {
    if (!portfolioHoldings.length) return;

    const header = ['Ticker', 'Shares', 'CostPerShare', 'Invested', 'MarketPrice', 'MarketValue', 'UnrealizedPL', 'ReturnPct', 'AllocationPct', 'TargetPrice', 'Notes'];
    const totals = portfolioHoldings.reduce((acc, holding) => {
      const metrics = getHoldingMetrics(holding);
      acc.totalInvestment += metrics.invested;
      acc.totalMarket += metrics.marketValue;
      return acc;
    }, { totalInvestment: 0, totalMarket: 0 });

    const rows = portfolioHoldings.map(holding => {
      const metrics = getHoldingMetrics(holding);
      const actualWeight = totals.totalMarket > 0 ? (metrics.marketValue / totals.totalMarket) * 100 : 0;
      return [
        csvEscape(holding.ticker),
        metrics.shares,
        metrics.costPerShare,
        metrics.invested,
        metrics.marketPrice,
        metrics.marketValue,
        metrics.profitLoss,
        metrics.returnPct,
        actualWeight,
        holding.targetPrice || '',
        csvEscape((holding.notes || '').replace(/\r?\n|\r/g, ' '))
      ].join(',');
    });

    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function wirePortfolio() {
    const form = document.getElementById('portfolio-form');
    const submitButtonLabel = form?.querySelector('button[type="submit"] span');
    const sampleBtn = document.getElementById('portfolio-load-sample');
    const clearBtn = document.getElementById('portfolio-clear');
    const exportBtn = document.getElementById('portfolio-export');
    const tableBody = document.getElementById('portfolio-table-body');

    if (!form || !tableBody) return;

    portfolioHoldings = loadPortfolioHoldings();
    renderPortfolio();

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const ticker = sanitizeTicker(document.getElementById('portfolio-ticker')?.value);
      const shares = Number(document.getElementById('portfolio-shares')?.value);
      const costBasis = Number(document.getElementById('portfolio-cost')?.value);
      const currentPriceValue = Number(document.getElementById('portfolio-price')?.value);
      const notes = document.getElementById('portfolio-notes')?.value || '';
      const targetPrice = Number(document.getElementById('portfolio-target')?.value);
      const allocation = Number(document.getElementById('portfolio-allocation')?.value);

      if (!ticker || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(costBasis) || costBasis <= 0) {
        console.warn('Invalid portfolio input; please check ticker, shares, and cost basis.');
        return;
      }

      const holding = {
        ticker,
        shares,
        costBasis,
        currentPrice: Number.isFinite(currentPriceValue) && currentPriceValue > 0 ? currentPriceValue : 0,
        notes: notes.slice(0, 320),
        targetPrice: Number.isFinite(targetPrice) && targetPrice > 0 ? targetPrice : 0,
        allocation: Number.isFinite(allocation) && allocation > 0 ? allocation : 0
      };

      const editIndex = Number(form.dataset.editIndex);
      if (Number.isFinite(editIndex) && editIndex >= 0) {
        portfolioHoldings[editIndex] = holding;
      } else {
        portfolioHoldings.push(holding);
      }

      savePortfolioHoldings();
      renderPortfolio();
      resetPortfolioForm(form, submitButtonLabel);
    });

    tableBody.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('.portfolio-remove');
      if (removeBtn) {
        const index = Number(removeBtn.dataset.removeIndex);
        if (Number.isFinite(index)) {
          removeHolding(index);
        }
        return;
      }

      const editBtn = event.target.closest('.portfolio-edit');
      if (editBtn) {
        const index = Number(editBtn.dataset.editIndex);
        if (Number.isFinite(index)) {
          beginEditHolding(index, form, submitButtonLabel);
        }
      }
    });

    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => loadSamplePortfolio(form, submitButtonLabel));
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => clearPortfolio(form, submitButtonLabel));
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportPortfolioCsv);
    }
  }

  // Logo Preview Functions
  function showLogoPreview() {
    const overlay = document.getElementById('logo-preview-overlay');
    const background = overlay?.querySelector('.logo-preview-background');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.pointerEvents = 'auto';
      if (background) {
        background.classList.remove('hidden');
      }
    }
  }

  function hideBackground() {
    const overlay = document.getElementById('logo-preview-overlay');
    const background = overlay?.querySelector('.logo-preview-background');
    if (background) {
      background.classList.add('hidden');
    }
  }

  function hideLogoPreview() {
    const overlay = document.getElementById('logo-preview-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      overlay.style.pointerEvents = 'none';
    }
  }

  function startLogoPreview() {
    showLogoPreview();
    // Hide background after 1.5 seconds
    setTimeout(() => {
      hideBackground();
    }, 1500);
    // Hide entire overlay after 2 seconds
    setTimeout(() => {
      hideLogoPreview();
    }, 2000);
  }

  // Track if this is the initial page load
  let isInitialLoad = true;

  // Initialize on DOM ready
    window.addEventListener('DOMContentLoaded', async () => {
    // Hide loading overlays
      const o1 = document.getElementById('chartsLoading');
      if (o1) o1.style.display = 'none';
      const o2 = document.getElementById('sensitivityLoading');
      if (o2) o2.style.display = 'none';

    // Initialize functionality
    wireNav();
    wireChartTabs();
    wireScenarioTabs();
    wireSliders();
    wirePortfolio();

    // Auto-populate inputs
    autoPopulateInputs();

    // Wire inputs to show reset button
    wireInputsForReset();

    await initializeDCFIntegration();

    // Run initial calculation (this will show logo preview on first load)
    await calculateValuation();
  });

  // Expose functions globally
  window.autoPopulateInputs = autoPopulateInputs;
  window.resetToAutomated = resetToAutomated;
  window.showLogoPreview = showLogoPreview;
  window.hideLogoPreview = hideLogoPreview;
  window.startLogoPreview = startLogoPreview;
  window.renderPortfolio = renderPortfolio;
})();
