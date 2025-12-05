// API base
function getNPVAPIBase() {
    if (window.API_BASE_URL) return window.API_BASE_URL.replace(/\/api$/, '');
    const metaBase = document.querySelector('meta[name="dcf-api-base"]')?.getAttribute('content');
    if (metaBase) return metaBase.replace(/\/api$/, '');
    return 'http://localhost:5050';
}
const API_BASE = getNPVAPIBase();

// Helpers for scoped IDs
const pid = (prefix, id) => (prefix ? `${prefix}-${id}` : id);
const scopeEl = (prefix, id) => document.getElementById(pid(prefix, id));

// Track last calculated NPV for inline sensitivity
let lastNPVCalculation = null;

function addCashFlowYear(prefix = '') {
    const container = scopeEl(prefix, 'cash-flow-tbody');
    if (!container) return;
    
    let grid = container.querySelector('#cash-flow-grid');
    if (!grid) {
        grid = document.createElement('div');
        grid.id = 'cash-flow-grid';
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;';
        container.appendChild(grid);
    }
    
    const currentCards = grid.querySelectorAll('.cash-flow-card').length;
    const newYear = currentCards + 1;

    const newCard = document.createElement('div');
    newCard.className = 'cash-flow-card';
    newCard.setAttribute('data-year', newYear);
    newCard.style.cssText = 'background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1rem; position: relative;';
    newCard.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <div style="font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase;">Year ${newYear}</div>
            <button type="button" class="ghost-button cash-flow-remove-btn" style="padding: 0.25rem 0.55rem; font-size: 0.75rem; display: none;" onclick="removeCashFlowYear('${prefix}', ${newYear})">Remove</button>
        </div>
        <div class="input-control">
            <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6b7280; font-size: 0.875rem;">$</span>
            <input type="number" class="input cash-flow-input-field" data-year="${newYear}" placeholder="" step="0.01" style="padding-left: 2rem;">
        </div>
    `;

    grid.appendChild(newCard);
    
    // Update remove button visibility
    updateRemoveButtonVisibility(prefix);
}

function removeCashFlowYear(prefix = '', year) {
    const container = scopeEl(prefix, 'cash-flow-tbody');
    if (!container) return;
    const grid = container.querySelector('#cash-flow-grid');
    if (!grid) return;
    
    const cards = grid.querySelectorAll('.cash-flow-card');
    
    if (cards.length <= 5) {
        showNPVError(prefix, 'At least 5 years of cash flows are required');
        return;
    }

    const cardToRemove = grid.querySelector(`.cash-flow-card[data-year="${year}"]`);
    if (cardToRemove) {
        cardToRemove.style.opacity = '0';
        cardToRemove.style.transform = 'scale(0.9)';
        cardToRemove.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            cardToRemove.remove();
            renumberCashFlowCards(prefix);
            updateRemoveButtonVisibility(prefix);
        }, 300);
    }
}

function renumberCashFlowCards(prefix = '') {
    const container = scopeEl(prefix, 'cash-flow-tbody');
    if (!container) return;
    const grid = container.querySelector('#cash-flow-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.cash-flow-card');
    
    cards.forEach((card, index) => {
        const newYear = index + 1;
        card.setAttribute('data-year', newYear);
        
        const yearLabel = card.querySelector('div > div:first-child');
        if (yearLabel) {
            yearLabel.textContent = `Year ${newYear}`;
        }
        
        const input = card.querySelector('.cash-flow-input-field');
        if (input) {
            input.setAttribute('data-year', newYear);
        }
        
        const removeBtn = card.querySelector('.cash-flow-remove-btn');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeCashFlowYear('${prefix}', ${newYear})`);
        }
    });
}

function updateRemoveButtonVisibility(prefix = '') {
    const container = scopeEl(prefix, 'cash-flow-tbody');
    if (!container) return;
    const grid = container.querySelector('#cash-flow-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.cash-flow-card');
    const totalCards = cards.length;
    
    cards.forEach((card, index) => {
        const removeBtn = card.querySelector('.cash-flow-remove-btn');
        if (removeBtn) {
            if (totalCards > 5) {
                removeBtn.style.display = 'inline-flex';
                removeBtn.style.visibility = 'visible';
            } else {
                if (index < 5) {
                    removeBtn.style.display = 'none';
                    removeBtn.style.visibility = 'hidden';
                } else {
                    removeBtn.style.display = 'inline-flex';
                    removeBtn.style.visibility = 'visible';
                }
            }
        }
    });
}

function showNPVError(prefix = '', message) {
    const errorDiv = scopeEl(prefix, 'npv-error-message');
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function hideNPVError(prefix = '') {
    const errorDiv = scopeEl(prefix, 'npv-error-message');
    if (errorDiv) errorDiv.style.display = 'none';
}

async function calculateNPVScoped(prefix = '') {
    hideNPVError(prefix);

    const initialCostEl = scopeEl(prefix, 'initial-cost');
    const requiredReturnEl = scopeEl(prefix, 'required-return');
    const resultsContainer = scopeEl(prefix, 'npv-results-container');
    const button = scopeEl(prefix, 'calculate-npv-button');
    const tbody = scopeEl(prefix, 'cash-flow-tbody');

    if (!initialCostEl || !requiredReturnEl || !resultsContainer || !button || !tbody) {
        console.error('NPV: missing elements for prefix', prefix);
        return;
    }

    const initialCost = parseFloat(initialCostEl.value);
    const requiredReturn = parseFloat(requiredReturnEl.value);

    if (isNaN(initialCost)) {
        showNPVError(prefix, 'Please enter a valid Initial Cost');
        return;
    }
    if (isNaN(requiredReturn) || requiredReturn <= 0) {
        showNPVError(prefix, 'Please enter a valid Required Return (must be positive)');
        return;
    }

    const cashFlowInputs = tbody.querySelectorAll('.cash-flow-input-field, .cash-flow-input');
    const cashFlows = [];
    for (let input of cashFlowInputs) {
        const value = parseFloat(input.value);
        if (isNaN(value)) {
            showNPVError(prefix, 'Please enter valid numeric values for all cash flows');
            return;
        }
        cashFlows.push(value);
    }
    if (cashFlows.length === 0) {
        showNPVError(prefix, 'Please add at least one year of cash flows');
        return;
    }

    const originalText = button.innerHTML;
    button.innerHTML = '<span>Calculating...</span>';
    button.disabled = true;

    try {
        const discountRate = requiredReturn / 100;
        // FIX: Initial investment is a NEGATIVE cash flow (outflow)
        let npv = -Math.abs(initialCost);
        const discountTable = [];

        // FIX: Display initial cost as negative in table
        discountTable.push({
            year: 0,
            cash_flow: -Math.abs(initialCost),
            discount_factor: 1.0,
            present_value: -Math.abs(initialCost)
        });

        cashFlows.forEach((cf, idx) => {
            const year = idx + 1;
            const df = 1 / Math.pow(1 + discountRate, year);
            const pv = cf * df;
            npv += pv;
            discountTable.push({
                year,
                cash_flow: cf,
                discount_factor: df,
                present_value: pv
            });
        });

        let irr = null;
        try {
            // FIX: IRR needs negative initial cost
            irr = calculateIRR([-Math.abs(initialCost), ...cashFlows]);
        } catch (e) {
            irr = null;
        }

        const data = {
            npv,
            irr,
            decision: npv > 0 ? 'accept' : 'reject',
            initial_cost: initialCost,
            required_return: discountRate,
            discount_table: discountTable,
            project_duration: cashFlows.length
        };

        // Save last calculation for inline sensitivity
        lastNPVCalculation = {
            inputs: {
                initialCost,
                requiredReturnRate: discountRate,
                cashFlows: [...cashFlows]
            },
            results: data
        };

        // Show sensitivity block after first calculation
        const sensSection = document.getElementById('npv-inline-sensitivity');
        if (sensSection) sensSection.style.display = 'block';

        displayNPVResults(prefix, data);
    } catch (err) {
        console.error('NPV calculation error:', err);
        showNPVError(prefix, err.message || 'Failed to calculate NPV. Please try again.');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}

function calculateNPV() {
    return calculateNPVScoped('');
}

/**
 * Calculate IRR using Newton-Raphson method
 */
function calculateIRR(cashFlows, maxIterations = 100, tolerance = 0.0001) {
    // Initial guess
    let irr = 0.1;

    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let dnpv = 0;

        for (let t = 0; t < cashFlows.length; t++) {
            npv += cashFlows[t] / Math.pow(1 + irr, t);
            dnpv -= t * cashFlows[t] / Math.pow(1 + irr, t + 1);
        }

        const newIrr = irr - npv / dnpv;

        if (Math.abs(newIrr - irr) < tolerance) {
            return newIrr;
        }

        irr = newIrr;
    }

    return irr;
}

/**
 * Display NPV results (scoped)
 */
function displayNPVResults(prefix, data) {
    const container = scopeEl(prefix, 'npv-results-container');
    if (!container) return;

    // Format NPV
    const npvFormatted = formatCurrency(data.npv);
    const irrFormatted = data.irr ? `${(data.irr * 100).toFixed(2)}%` : 'N/A';

    // Determine decision color and text
    const isAccept = data.decision === 'accept';
    const decisionColor = isAccept ? '#10b981' : '#ef4444';
    const decisionText = isAccept ? 'Project should be accepted (NPV > 0)' : 'Project should be rejected (NPV ≤ 0)';
    const decisionIcon = isAccept ? '✓' : '✗';

    // Build results HTML (light theme)
    container.innerHTML = `
        <div style="padding: 1rem;">
            <!-- NPV Value -->
            <div style="text-align: center; margin-bottom: 1.5rem; padding: 1.25rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 10px;">
                <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Net Present Value</div>
                <div style="font-size: 2.4rem; font-weight: 700; color: ${decisionColor}; margin-bottom: 0.5rem;">${npvFormatted}</div>
            </div>

            <!-- Decision -->
            <div style="padding: 1rem; background: ${isAccept ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)'}; border: 1px solid ${isAccept ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}; border-radius: 10px; margin-bottom: 1.25rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="font-size: 1.5rem;">${decisionIcon}</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: ${decisionColor};">${decisionText}</div>
                </div>
            </div>

            <!-- Metrics Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
                <div style="padding: 0.9rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">IRR</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">${irrFormatted}</div>
                </div>
                <div style="padding: 0.9rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">Initial Cost</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">${formatCurrency(data.initial_cost || parseFloat(scopeEl(prefix, 'initial-cost').value))}</div>
                </div>
                <div style="padding: 0.9rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">Required Return</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">${scopeEl(prefix, 'required-return').value}%</div>
                </div>
                <div style="padding: 0.9rem; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
                    <div style="font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem;">Project Duration</div>
                    <div style="font-size: 1.25rem; font-weight: 700; color: #0f172a;">${data.discount_table ? data.discount_table.length - 1 : 'N/A'} years</div>
                </div>
            </div>
        </div>
    `;

    // Display discount table if available
    if (data.discount_table && data.discount_table.length > 0) {
        displayDiscountTable(prefix, data.discount_table);
    }
}

/**
 * Display discount table
 */
function displayDiscountTable(prefix, discountTable) {
    const section = scopeEl(prefix, 'npv-discount-table-section');
    const tbody = scopeEl(prefix, 'npv-discount-tbody');
    if (!section || !tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Add rows
    discountTable.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="number">${row.year === 0 ? 'Initial (Year 0)' : `Year ${row.year}`}</td>
            <td class="number">${formatCurrency(row.cash_flow)}</td>
            <td class="number">${row.discount_factor.toFixed(4)}</td>
            <td class="number">${formatCurrency(row.present_value)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Show the section
    section.style.display = 'block';
}

/**
 * Inline sensitivity for Project NPV (uses last calculated inputs)
 */
function runInlineNPVSensitivity() {
    if (!lastNPVCalculation) {
        showNPVError('', 'Calculate NPV first to run sensitivity');
        return;
    }

    const range = parseFloat(document.getElementById('npv-sens-range')?.value || '0');
    const steps = parseInt(document.getElementById('npv-sens-steps')?.value || '0');
    if (isNaN(range) || range <= 0) {
        showNPVError('', 'Enter a valid sensitivity range');
        return;
    }
    if (isNaN(steps) || steps < 3) {
        showNPVError('', 'Steps should be at least 3');
        return;
    }

    const { initialCost, cashFlows } = lastNPVCalculation.inputs;
    const baseR = lastNPVCalculation.inputs.requiredReturnRate ?? 0;
    if (baseR <= 0) {
        showNPVError('', 'Base required return is missing; recalculate NPV first');
        return;
    }
    const minAdj = -range / 100;
    const maxAdj = range / 100;
    const results = [];

    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const adj = minAdj + (maxAdj - minAdj) * t;
        const r = baseR * (1 + adj); // r is decimal (e.g., 0.10)
        let npv = initialCost;
        cashFlows.forEach((cf, idx) => {
            const year = idx + 1;
            const pv = cf / Math.pow(1 + r, year);
            npv += pv;
        });
        results.push({
            label: `${(r * 100).toFixed(2)}%`,
            rate: r,
            npv
        });
    }

    displayNPVSensitivityResults(results);
}

function displayNPVSensitivityResults(results) {
    const container = document.getElementById('npv-sensitivity-results');
    if (!container) return;

    if (!results || !results.length) {
        container.innerHTML = '<div class="placeholder-text">No sensitivity results</div>';
        return;
    }

    const rows = results.map(r => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 0.65rem 0.75rem; font-weight: 600; color: #0f172a;">${r.label}</td>
            <td style="padding: 0.65rem 0.75rem; text-align: right; color: ${r.npv >= 0 ? '#10b981' : '#ef4444'}; font-weight: 700;">
                ${formatCurrency(r.npv)}
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <thead style="background: #f8fafc; border-bottom: 1px solid #e5e7eb;">
                    <tr>
                        <th style="padding: 0.65rem 0.75rem; text-align: left; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.04em;">Required Return</th>
                        <th style="padding: 0.65rem 0.75rem; text-align: right; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.04em;">NPV</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
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

// Make functions globally available
window.addCashFlowYear = addCashFlowYear;
window.removeCashFlowYear = removeCashFlowYear;
window.updateRemoveButtonVisibility = updateRemoveButtonVisibility;
window.calculateNPV = calculateNPV;
window.calculateNPVScoped = calculateNPVScoped;
window.runInlineNPVSensitivity = runInlineNPVSensitivity;
