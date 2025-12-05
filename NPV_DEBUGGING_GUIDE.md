# NPV Calculator - Debugging Guide

## Current Status

The NPV calculator has been implemented with **client-side calculation** (no API call). All required elements are present in the HTML, and the JavaScript code is syntactically correct.

---

## How to Test NPV Calculator

### Step 1: Open the Page
```bash
open http://localhost:3000/project-npv.html
```

### Step 2: Open Browser Console
- Press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac)
- Click on the **Console** tab

### Step 3: Check for JavaScript Errors
Look for any red error messages in the console. If you see errors, note them down.

### Step 4: Test the Calculator

#### Enter Sample Data:
1. **Initial Cost**: `-100000` (negative number, this is an investment)
2. **Required Return**: `10` (10% discount rate)
3. **Cash Flows**:
   - Year 1: `30000`
   - Year 2: `40000`
   - Year 3: `50000`
   - Year 4: `40000`
   - Year 5: `30000`

#### Click "Calculate NPV" Button

### Step 5: Check Console Logs
You should see these console messages:
```
=== NPV Calculation Started ===
Initial Cost: -100000
Required Return: 10
Cash flow inputs found: 5
Cash flows: [30000, 40000, 50000, 40000, 30000]
NPV Calculation Result: {npv: ..., irr: ..., decision: ..., ...}
Displaying NPV results: ...
=== NPV Calculation Complete ===
```

### Step 6: Check Results Display
On the right panel, you should see:
- **Net Present Value**: Large number displayed
- **Decision**: "Project should be accepted (NPV > 0)" or "Project should be rejected (NPV ≤ 0)"
- **Metrics Grid**: IRR, Initial Cost, Required Return, Project Duration
- **Discount Table**: Table showing each year's calculations

---

## Expected NPV Result for Sample Data

Using the sample data above:
- Initial Cost: -$100,000
- Cash Flows: $30K, $40K, $50K, $40K, $30K at 10% discount rate

**Expected NPV**: Approximately **$45,595**

Formula:
```
NPV = -100,000
    + 30,000/(1.10)^1
    + 40,000/(1.10)^2
    + 50,000/(1.10)^3
    + 40,000/(1.10)^4
    + 30,000/(1.10)^5

NPV = -100,000 + 27,273 + 33,058 + 37,566 + 27,321 + 18,628
NPV ≈ $43,846
```

**Expected IRR**: Approximately **25-30%**

---

## Troubleshooting

### Problem 1: Console shows "calculateNPV is not defined"
**Solution**: The npv-module.js script isn't loading
- Check: `view-source:http://localhost:3000/project-npv.html`
- Look for: `<script defer src="js/npv-module.js?v=1"></script>`
- If missing, the HTML file needs to be fixed

### Problem 2: Console shows "=== NPV Calculation Started ===" but then stops
**Cause**: Validation error (invalid inputs)
**Check**: Look for error message on the page (red box below calculate button)

### Problem 3: Console shows all logs but no results appear
**Cause**: Display function not updating the results container
**Check Console for**: "Error: npv-results-container not found!"
**If yes**: The HTML element ID is missing or incorrect

### Problem 4: Button doesn't respond to clicks
**Cause**: Click event not attached
**Test in Console**:
```javascript
// Check if function exists
typeof calculateNPV
// Should return: "function"

// Check if button exists
document.getElementById('calculate-npv-button')
// Should return: <button id="calculate-npv-button" ...>

// Try calling function manually
calculateNPV()
// Should trigger calculation
```

### Problem 5: Results display but numbers are wrong
**Check**:
- Initial cost should be negative (investment)
- Required return should be a percentage (e.g., 10 for 10%)
- Cash flows should be positive (incoming cash)

---

## Manual Testing in Console

If the button doesn't work, try running the calculation manually:

```javascript
// Test 1: Check if all required elements exist
console.log('Initial Cost Input:', document.getElementById('initial-cost'));
console.log('Required Return Input:', document.getElementById('required-return'));
console.log('Cash Flow Inputs:', document.querySelectorAll('.cash-flow-input'));
console.log('Calculate Button:', document.getElementById('calculate-npv-button'));
console.log('Results Container:', document.getElementById('npv-results-container'));

// Test 2: Set sample values
document.getElementById('initial-cost').value = '-100000';
document.getElementById('required-return').value = '10';
const cashFlowInputs = document.querySelectorAll('.cash-flow-input');
cashFlowInputs[0].value = '30000';
cashFlowInputs[1].value = '40000';
cashFlowInputs[2].value = '50000';
cashFlowInputs[3].value = '40000';
cashFlowInputs[4].value = '30000';

// Test 3: Call function manually
calculateNPV();
```

---

## What Was Implemented

### Client-Side NPV Calculation
The calculator now works **offline** without calling any backend API.

**File**: `/frontend/public/js/npv-module.js`

**Functions**:
1. `calculateNPV()` - Main calculation function
2. `calculateIRR()` - Newton-Raphson method for Internal Rate of Return
3. `displayNPVResults()` - Renders results on the page
4. `displayDiscountTable()` - Shows year-by-year breakdown
5. `formatCurrency()` - Formats numbers as $XM, $XK, etc.
6. `addCashFlowYear()` - Adds new cash flow row
7. `removeCashFlowYear()` - Removes cash flow row

### NPV Formula
```javascript
NPV = Initial Cost + Σ (Cash Flow_t / (1 + r)^t)
```

Where:
- `Initial Cost` = Usually negative (investment)
- `Cash Flow_t` = Cash flow in year t
- `r` = Discount rate (required return as decimal)
- `t` = Year number

### IRR Calculation
Uses **Newton-Raphson iterative method**:
```javascript
IRR = rate where NPV = 0
```

Algorithm:
1. Start with initial guess (10%)
2. Calculate NPV at current rate
3. Calculate derivative (dNPV/dr)
4. Update rate: `new_rate = old_rate - NPV / derivative`
5. Repeat until convergence (< 0.01% difference)

---

## Files Modified

### 1. `/frontend/public/js/npv-module.js`
- Removed API call to `/api/project/npv`
- Added client-side NPV calculation
- Added Newton-Raphson IRR calculation
- Added console logging for debugging

### 2. `/frontend/public/project-npv.html`
- Already has all required elements:
  - `id="initial-cost"`
  - `id="required-return"`
  - `class="cash-flow-input"`
  - `id="calculate-npv-button"` with `onclick="calculateNPV()"`
  - `id="npv-results-container"`
  - `id="npv-discount-table-section"`
  - `id="npv-error-message"`

---

## Next Steps

1. **Open the page**: `http://localhost:3000/project-npv.html`
2. **Open console** (F12)
3. **Enter test data** (see Step 4 above)
4. **Click "Calculate NPV"**
5. **Check console logs**
6. **Report what you see**:
   - Are there any error messages?
   - Do you see the console logs?
   - Do results appear on the page?
   - What NPV value is shown?

---

## Known Working

✅ Backend server running on port 8000
✅ Frontend server running on port 3000
✅ DCF Valuation tab working
✅ Sentiment Analysis tab working
✅ Tab navigation working
✅ CSS styling applied
✅ JavaScript syntax valid
✅ All HTML elements present

## Currently Testing

⏳ NPV Calculator client-side calculation
⏳ Display of NPV results
⏳ Discount table rendering

---

## Support

If you see any errors in the console or unexpected behavior, please report:
1. **Exact error message** from console
2. **What you entered** in the input fields
3. **What happened** vs what you expected
4. **Screenshot** if helpful

This will help identify the exact issue and fix it immediately.
