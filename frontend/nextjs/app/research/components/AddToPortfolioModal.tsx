'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './AddToPortfolioModal.module.css';

interface AddToPortfolioModalProps {
  ticker: string;
  currentPrice?: number;
  onClose: () => void;
}

export default function AddToPortfolioModal({ ticker, currentPrice, onClose }: AddToPortfolioModalProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    action: 'buy' as 'buy' | 'sell' | 'short_sell',
    orderType: 'market' as 'market' | 'limit_buy' | 'limit_sell' | 'stop_loss',
    quantity: 0,
    price: currentPrice || 0,
    commission: 5,
    notes: '',
  });

  useEffect(() => {
    const handler = (event: any) => {
      const field = event?.detail?.field as keyof typeof formData;
      const value = event?.detail?.value;
      if (!field) return;
      setFormData((prev) => {
        const next = { ...prev };
        if (field === 'quantity' || field === 'price' || field === 'commission') {
          const num = parseFloat(value);
          if (!isNaN(num)) (next as any)[field] = num;
        } else if (field === 'action') {
          if (['buy', 'sell', 'short_sell'].includes(value)) (next as any)[field] = value;
        } else if (field === 'orderType') {
          if (['market', 'limit_buy', 'limit_sell', 'stop_loss'].includes(value)) (next as any)[field] = value;
        } else if (field === 'notes') {
          (next as any)[field] = String(value);
        }
        return next;
      });
    };
    window.addEventListener('assistant:setTradeField', handler);
    return () => window.removeEventListener('assistant:setTradeField', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get existing trades from localStorage
    const existingTrades = JSON.parse(localStorage.getItem('fina3010_trades') || '[]');
    
    // Create new trade
    const newTrade = {
      id: Date.now().toString(),
      date: formData.date,
      ticker: ticker.toUpperCase(),
      orderType: formData.orderType,
      action: formData.action,
      quantity: formData.quantity,
      price: formData.price,
      commission: formData.commission,
      totalCost: formData.quantity * formData.price + formData.commission,
      notes: formData.notes,
      status: 'open',
    };

    // Add to trades
    existingTrades.push(newTrade);
    localStorage.setItem('fina3010_trades', JSON.stringify(existingTrades));

    // Navigate to trading page
    router.push('/trading');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Add {ticker} to Portfolio</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Ticker</label>
              <input
                type="text"
                value={ticker.toUpperCase()}
                disabled
                className={styles.disabledInput}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Action *</label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                required
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="short_sell">Short Sell</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Order Type *</label>
              <select
                value={formData.orderType}
                onChange={(e) => setFormData({ ...formData, orderType: e.target.value as any })}
                required
              >
                <option value="market">Market Order</option>
                <option value="limit_buy">Limit Buy Order</option>
                <option value="limit_sell">Limit Sell Order</option>
                <option value="stop_loss">Stop-Loss Order</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Quantity *</label>
              <input
                type="number"
                value={formData.quantity || ''}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                placeholder="100"
                min="1"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Price per Share *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                placeholder={currentPrice ? currentPrice.toFixed(2) : '0.00'}
                min="0.01"
                required
              />
              {currentPrice && (
                <small className={styles.hint}>Current: ${currentPrice.toFixed(2)}</small>
              )}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Commission</label>
              <input
                type="number"
                step="0.01"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) || 5 })}
                min="0"
              />
              <small className={styles.hint}>Default: $5 per FINA3010 rules</small>
            </div>
            <div className={styles.formGroup} style={{ gridColumn: 'span 1' }}>
              <label>Total Cost</label>
              <div className={styles.totalCost}>
                ${((formData.quantity * formData.price) + formData.commission).toFixed(2)}
              </div>
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginTop: '1rem' }}>
            <label>Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any notes about this trade..."
              rows={3}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={!formData.quantity || !formData.price || formData.quantity <= 0 || formData.price <= 0}
            >
              Add to Portfolio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
