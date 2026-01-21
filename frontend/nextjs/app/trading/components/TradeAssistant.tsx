'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './TradeAssistant.module.css';

interface Trade {
  date?: string;
  ticker?: string;
  orderType?: 'market' | 'limit_buy' | 'limit_sell' | 'stop_loss';
  action?: 'buy' | 'sell' | 'short_sell';
  quantity?: number;
  price?: number;
  commission?: number;
  notes?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  trade?: Trade;
}

interface TradeAssistantProps {
  onAddTrade: (trade: Omit<Trade, 'id'>) => void;
  onClose: () => void;
}

export default function TradeAssistant({ onAddTrade, onClose }: TradeAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I can help you add trades to your journal. Just describe your trade in natural language. For example: "I bought 100 shares of AAPL at $150 on January 15th"',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<Trade | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/trading/parse-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse trade');
      }

      const data = await response.json();
      const { trade, suggestions, can_add } = data;

      // Show the extracted trade
      const assistantMessage: Message = {
        role: 'assistant',
        content: suggestions || 'I extracted the following trade information:',
        trade,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setPendingTrade(trade);

      if (can_add && trade.ticker && trade.action && trade.quantity && trade.price) {
        // Auto-suggest adding if all critical fields are present
        setPendingTrade(trade);
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}. Please try rephrasing your trade description.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTrade = () => {
    if (!pendingTrade) return;

    // Validate required fields
    if (!pendingTrade.date || !pendingTrade.ticker || !pendingTrade.action || !pendingTrade.quantity || !pendingTrade.price) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Please provide all required fields (date, ticker, action, quantity, price) before adding the trade.',
        },
      ]);
      return;
    }

    onAddTrade({
      date: pendingTrade.date,
      ticker: pendingTrade.ticker,
      orderType: pendingTrade.orderType || 'market',
      action: pendingTrade.action,
      quantity: pendingTrade.quantity,
      price: pendingTrade.price,
      commission: pendingTrade.commission || 5,
      notes: pendingTrade.notes,
    });

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '✓ Trade added successfully! You can describe another trade or close this window.',
      },
    ]);
    setPendingTrade(null);
  };

  const handleEditTrade = (field: keyof Trade, value: any) => {
    if (!pendingTrade) return;
    setPendingTrade({ ...pendingTrade, [field]: value });
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Trade Assistant</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.messages}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`${styles.message} ${styles[msg.role]}`}>
              <div className={styles.messageContent}>{msg.content}</div>
              {msg.trade && (
                <div className={styles.tradePreview}>
                  <div className={styles.tradeFields}>
                    <div className={styles.field}>
                      <label>Date</label>
                      <input
                        type="date"
                        value={msg.trade.date || ''}
                        onChange={(e) => handleEditTrade('date', e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Ticker *</label>
                      <input
                        type="text"
                        value={msg.trade.ticker || ''}
                        onChange={(e) => handleEditTrade('ticker', e.target.value.toUpperCase())}
                        placeholder="AAPL"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Action *</label>
                      <select
                        value={msg.trade.action || ''}
                        onChange={(e) => handleEditTrade('action', e.target.value)}
                      >
                        <option value="">Select...</option>
                        <option value="buy">Buy</option>
                        <option value="sell">Sell</option>
                        <option value="short_sell">Short Sell</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Order Type</label>
                      <select
                        value={msg.trade.orderType || 'market'}
                        onChange={(e) => handleEditTrade('orderType', e.target.value)}
                      >
                        <option value="market">Market</option>
                        <option value="limit_buy">Limit Buy</option>
                        <option value="limit_sell">Limit Sell</option>
                        <option value="stop_loss">Stop-Loss</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label>Quantity *</label>
                      <input
                        type="number"
                        value={msg.trade.quantity || ''}
                        onChange={(e) => handleEditTrade('quantity', parseFloat(e.target.value) || 0)}
                        placeholder="100"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={msg.trade.price || ''}
                        onChange={(e) => handleEditTrade('price', parseFloat(e.target.value) || 0)}
                        placeholder="150.00"
                      />
                    </div>
                    <div className={styles.field}>
                      <label>Commission</label>
                      <input
                        type="number"
                        step="0.01"
                        value={msg.trade.commission || 5}
                        onChange={(e) => handleEditTrade('commission', parseFloat(e.target.value) || 5)}
                      />
                    </div>
                    <div className={styles.field} style={{ gridColumn: 'span 2' }}>
                      <label>Notes</label>
                      <textarea
                        value={msg.trade.notes || ''}
                        onChange={(e) => handleEditTrade('notes', e.target.value)}
                        placeholder="Optional notes..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className={styles.tradeActions}>
                    <button
                      className={styles.addButton}
                      onClick={handleAddTrade}
                      disabled={
                        !pendingTrade?.date ||
                        !pendingTrade?.ticker ||
                        !pendingTrade?.action ||
                        !pendingTrade?.quantity ||
                        !pendingTrade?.price
                      }
                    >
                      Add to Journal
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.messageContent}>Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Describe your trade... (e.g., 'Bought 100 AAPL at $150 on Jan 15')"
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
