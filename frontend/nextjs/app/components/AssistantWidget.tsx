'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './AssistantWidget.module.css';

type Message = { role: 'user' | 'assistant'; content: string };

export default function AssistantWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I can help you use the FINA3010 workspace. You can say things like "research AAPL" or "add this to my portfolio".' },
  ]);
  const [loading, setLoading] = useState(false);

  const maybeHandleLocalAction = (text: string) => {
    const cleaned = text.trim();
    const lowered = cleaned.toLowerCase();

    // 1) Add-to-portfolio intent, works when you're already on a stock page
    if (
      /\badd\b.*\bportfolio\b/i.test(lowered) ||
      /\bput\b.*\bportfolio\b/i.test(lowered) ||
      /\badd it to my portfolio\b/i.test(lowered)
    ) {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/research')) {
        window.dispatchEvent(new CustomEvent('assistant:addToPortfolio'));
      }
      return;
    }

    // 2) Field updates inside the AddToPortfolio modal (when open)
    const quantityMatch = cleaned.match(/quantity\s*(is|=)\s*([0-9]+(\.[0-9]+)?)/i);
    if (quantityMatch) {
      const qty = parseFloat(quantityMatch[2]);
      if (!isNaN(qty)) {
        window.dispatchEvent(new CustomEvent('assistant:setTradeField', { detail: { field: 'quantity', value: qty } }));
      }
      return;
    }

    const priceMatch = cleaned.match(/price\s*(is|=)\s*([0-9]+(\.[0-9]+)?)/i);
    if (priceMatch) {
      const price = parseFloat(priceMatch[2]);
      if (!isNaN(price)) {
        window.dispatchEvent(new CustomEvent('assistant:setTradeField', { detail: { field: 'price', value: price } }));
      }
      return;
    }

    const commissionMatch = cleaned.match(/commission\s*(is|=)\s*([0-9]+(\.[0-9]+)?)/i);
    if (commissionMatch) {
      const commission = parseFloat(commissionMatch[2]);
      if (!isNaN(commission)) {
        window.dispatchEvent(new CustomEvent('assistant:setTradeField', { detail: { field: 'commission', value: commission } }));
      }
      return;
    }

    const actionMatch = cleaned.match(/\b(buy|sell|short\s*sell)\b/i);
    if (actionMatch) {
      const action = actionMatch[1].toLowerCase().replace(/\s+/g, '_');
      window.dispatchEvent(new CustomEvent('assistant:setTradeField', { detail: { field: 'action', value: action } }));
      return;
    }

    const orderMatch = cleaned.match(/\b(market|limit buy|limit sell|stop[-\s]?loss)\b/i);
    if (orderMatch) {
      const raw = orderMatch[1].toLowerCase().replace(/\s+/g, '_').replace('stop-_loss', 'stop_loss');
      const orderType =
        raw === 'limit_buy' ? 'limit_buy' :
        raw === 'limit_sell' ? 'limit_sell' :
        raw.startsWith('stop') ? 'stop_loss' : 'market';
      window.dispatchEvent(new CustomEvent('assistant:setTradeField', { detail: { field: 'orderType', value: orderType } }));
      return;
    }

    const notesMatch = cleaned.match(/note\s*(is|=)\s*(.+)$/i);
    if (notesMatch) {
      const note = notesMatch[2].trim();
      if (note) {
        window.dispatchEvent(new CustomEvent('assistant:setTradeField', { detail: { field: 'notes', value: note } }));
      }
      return;
    }

    // 2) Research intent with ticker extraction
    const patterns = [
      /(re)?search\s+([A-Za-z]{1,5})/i,
      /analy[sz]e\s+([A-Za-z]{1,5})/i,
      /lookup\s+([A-Za-z]{1,5})/i,
      /check\s+([A-Za-z]{1,5})/i,
      /\b([A-Za-z]{1,5})\b.*(research|analysis|analy[sz]e|lookup|check)/i,
      /^([A-Za-z]{1,5})$/, // bare ticker
    ];

    let ticker: string | null = null;
    for (const p of patterns) {
      const m = cleaned.match(p);
      if (m) {
        ticker = (m[2] || m[1] || '').toUpperCase();
        break;
      }
    }

    if (!ticker) return;

    router.push('/research');
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('assistant:research', {
          detail: { ticker },
        }),
      );
    }, 350);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    maybeHandleLocalAction(userMsg.content);
    setLoading(true);
    try {
      const res = await fetch('/api/assistant/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([...nextMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages([...nextMessages, { role: 'assistant', content: 'Sorry, I could not reply right now.' }]);
      }
    } catch (e) {
      setMessages([...nextMessages, { role: 'assistant', content: 'Assistant unavailable right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.floating}>
        <button className={styles.toggle} onClick={() => setOpen(!open)}>
          {open ? 'Close Helper' : 'Helper'}
        </button>
      </div>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>Companion</span>
            <button className={styles.close} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className={styles.messages}>
            {messages.map((m, idx) => (
              <div key={idx} className={styles.msg}>
                <strong>{m.role === 'user' ? 'You' : 'Assistant'}: </strong>
                <span>{m.content}</span>
              </div>
            ))}
          </div>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask how to use research, trading, watchlist..."
              onKeyDown={(e) => e.key === 'Enter' && !loading && sendMessage()}
            />
            <button className={styles.send} onClick={sendMessage} disabled={loading}>
              {loading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

