'use client';

import { useState } from 'react';
import styles from './ProjectNPV.module.css';

export default function ProjectNPVPage() {
  const [initialCost, setInitialCost] = useState(-500);
  const [requiredReturn, setRequiredReturn] = useState(10);
  const [cashFlows, setCashFlows] = useState<number[]>([0, 0, 0, 0, 0]);
  const [npvResult, setNpvResult] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateNPV = () => {
    setIsCalculating(true);
    
    // Calculate NPV: NPV = -C0 + Σ(CFt / (1 + r)^t)
    let npv = initialCost;
    cashFlows.forEach((cf, index) => {
      const year = index + 1;
      npv += cf / Math.pow(1 + requiredReturn / 100, year);
    });

    setNpvResult(npv);
    setIsCalculating(false);
  };

  const addYear = () => {
    setCashFlows([...cashFlows, 0]);
  };

  const updateCashFlow = (index: number, value: number) => {
    const updated = [...cashFlows];
    updated[index] = value;
    setCashFlows(updated);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Company Valuation Project</h1>
          <p>Algorithmic project valuation and portfolio optimization tool</p>
        </div>
        <div className={styles.logo}>ARQAM</div>
      </header>

      <nav className={styles.navTabs}>
        <button className={styles.tabActive}>VALUATION</button>
        <button className={styles.tab}>PORTFOLIO OPTIMIZATION</button>
        <button className={styles.tab}>SENTIMENT ANALYSIS</button>
      </nav>

      <div className={styles.subNav}>
        <button className={styles.subTabActive}>Project</button>
        <button className={styles.subTab}>NPV Calculation</button>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.calculatorSection}>
          <h2>Project NPV Calculator</h2>
          <p>Compute NPV for a project using an initial outlay, required return, and annual cash flows.</p>

          <div className={styles.formGroup}>
            <label>
              INITIAL COST (Co) *
              <input
                type="number"
                value={initialCost}
                onChange={(e) => setInitialCost(parseFloat(e.target.value) || 0)}
                className={styles.input}
              />
            </label>
            <small>Enter as negative value for cash outflow (e.g., -500 for $500 investment)</small>
          </div>

          <div className={styles.formGroup}>
            <label>
              REQUIRED RETURN (%) *
              <input
                type="number"
                value={requiredReturn}
                onChange={(e) => setRequiredReturn(parseFloat(e.target.value) || 0)}
                className={styles.input}
              />
            </label>
            <small>Minimum acceptable annual return rate (e.g., 10 for 10%)</small>
          </div>

          <div className={styles.formGroup}>
            <label>Annual Cash Flows</label>
            <div className={styles.cashFlows}>
              {cashFlows.map((cf, index) => (
                <div key={index} className={styles.cashFlowRow}>
                  <span>YEAR {index + 1}</span>
                  <input
                    type="number"
                    value={cf}
                    onChange={(e) => updateCashFlow(index, parseFloat(e.target.value) || 0)}
                    className={styles.input}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
            <button onClick={addYear} className={styles.addButton}>+ Add Year</button>
          </div>

          <button onClick={calculateNPV} className={styles.calculateButton} disabled={isCalculating}>
            {isCalculating ? 'Calculating...' : 'Calculate NPV'}
          </button>
        </div>

        <div className={styles.resultsSection}>
          <h2>NPV Results</h2>
          {npvResult !== null ? (
            <div className={styles.resultCard}>
              <div className={styles.npvValue}>
                ${npvResult.toFixed(2)}
              </div>
              <div className={styles.npvLabel}>Net Present Value</div>
              {npvResult > 0 && <div className={styles.success}>Project is profitable</div>}
              {npvResult < 0 && <div className={styles.error}>Project is not profitable</div>}
              {npvResult === 0 && <div className={styles.warning}>Project breaks even</div>}
            </div>
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>📊</div>
              <h3>Ready to Calculate</h3>
              <p>Enter your project parameters and cash flows above, then click "Calculate NPV" to see the results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
