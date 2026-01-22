import Card from './components/Card';

export default function Home() {
  return (
    <div
      style={{
        padding: '3rem 2rem',
        maxWidth: '1100px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <header
        style={{
          marginBottom: '2rem',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: '2rem',
          alignItems: 'center',
          animation: 'fadeIn 0.6s ease-out',
        }}
      >
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <img src="/arqam-logo-v2.svg" alt="ARQAM" style={{ height: '56px', width: 'auto' }} />
          </div>
          <p style={{ fontSize: '0.9rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.5rem' }}>
            FINA3010 / MarketWatch Simulation
          </p>
          <h1
            style={{
              fontSize: '2.4rem',
              fontWeight: 720,
              marginBottom: '0.6rem',
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Trading Analysis Workspace
          </h1>
          <p
            style={{
              fontSize: '1rem',
              color: '#4b5563',
              margin: 0,
              fontWeight: 450,
              lineHeight: 1.6,
              maxWidth: '640px',
            }}
          >
            Research, risk, sentiment, portfolio tracking, and reporting—all in one disciplined interface built for your simulation period.
          </p>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1.1rem 1.25rem', boxShadow: '0 6px 16px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.92rem', color: '#111827' }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Starting Value</div>
              <div style={{ fontWeight: 650 }}>$100,000</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Trades Required</div>
              <div style={{ fontWeight: 650 }}>Min 20 / Max 200</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Commission</div>
              <div style={{ fontWeight: 650 }}>$5 per trade</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>Position Size</div>
              <div style={{ fontWeight: 650 }}>5–10% per asset</div>
            </div>
          </div>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginTop: '0.5rem',
        }}
      >
        <Card
          title="Stock Research"
          description="Analyze stocks before trading. DCF valuation, sentiment analysis, and risk metrics."
          href="/research"
          color="#0f172a"
        />
        <Card
          title="Portfolio Builder"
          description="Plan and optimize your portfolio composition before executing trades."
          href="/builder"
          color="#0f172a"
        />
        <Card
          title="Trading Portfolio"
          description="Track your MarketWatch trades, monitor performance, and analyze your portfolio."
          href="/trading"
          color="#0f172a"
        />
        <Card
          title="Learning Center"
          description="Learn about order types, trading strategies, and portfolio construction."
          href="/learn"
          color="#0f172a"
        />
        <Card
          title="Reports & Analytics"
          description="Generate reports for presentations and your final reflection report."
          href="/reports"
          color="#0f172a"
        />
        <Card
          title="Watchlist"
          description="Track and rank stocks using unified 0-100 scoring system."
          href="/watchlist"
          color="#0f172a"
        />
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem 1.25rem',
          background: '#f2f3f6',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          color: '#1f2937',
          fontSize: '0.95rem',
        }}
      >
        <div style={{ fontWeight: 650 }}>Reminder:</div>
        <div style={{ color: '#374151' }}>
          No day trading · No margin · Limit trades to 50% of daily volume · Stay active across the period.
        </div>
      </div>
    </div>
  );
}
