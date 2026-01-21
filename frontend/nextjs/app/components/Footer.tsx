import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      style={{
        marginTop: '3rem',
        padding: '1.75rem 2rem',
        borderTop: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0.06) 100%)',
        color: 'var(--muted)',
        fontSize: '0.9rem',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                color: 'var(--text)',
                fontWeight: 750,
                letterSpacing: '0.06em',
                fontSize: '1rem',
              }}
            >
              ARQAM
            </span>
            <span
              style={{
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--muted)',
                fontWeight: 600,
              }}
            >
              FINA3010
            </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--text)',
                  fontWeight: 650,
                  fontSize: '0.9rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    width: '36px',
                    height: '34px',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src="/cuhk-logo.png"
                    alt="Chinese University of Hong Kong logo"
                    width={62}
                    height={34}
                    style={{
                      display: 'block',
                      objectFit: 'cover',
                      objectPosition: 'left center',
                      mixBlendMode: 'multiply',
                    }}
                  />
                </span>
                Chinese University of Hong Kong
              </span>
            </div>
          <span style={{ color: 'var(--muted)', maxWidth: '520px', lineHeight: 1.5 }}>
            Research, valuation, and trading workspace for the MarketWatch simulation cohort.
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            alignItems: 'flex-end',
            justifyContent: 'center',
            minWidth: '260px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        <Link
          href="/learn"
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            color: '#0f172a',
            textDecoration: 'none',
            background: 'transparent',
            fontWeight: 600,
          }}
        >
          Learning Center
        </Link>
        <a
          href="https://www.linkedin.com/in/artemisradin"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            color: '#0f172a',
            textDecoration: 'none',
            background: 'transparent',
            fontWeight: 600,
          }}
        >
          LinkedIn · Artemis Radin
        </a>
        <a
          href="mailto:artemis.radin.work@gmail.com"
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            color: '#0f172a',
            textDecoration: 'none',
            background: 'transparent',
            fontWeight: 600,
          }}
        >
          Contact
        </a>
      </div>
        <span
          style={{
            color: 'var(--muted)',
            textAlign: 'right',
            lineHeight: 1.5,
            fontSize: '0.7rem',
            maxWidth: '500px',
          }}
        >
          This application is provided solely by the author for personal stock analysis. The Chinese University of Hong Kong has no affiliation, endorsement, or involvement.
        </span>
        </div>
      </div>
    </footer>
  );
}
