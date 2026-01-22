import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Chart Icon */}
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path d="M50 100 L80 70 L110 80 L140 50 L140 100 Z" fill="rgba(255,255,255,0.3)"/>
            <path d="M50 70 L80 40 L110 50 L140 20 L140 70 Z" fill="rgba(255,255,255,0.2)"/>
            <circle cx="80" cy="70" r="8" fill="white"/>
            <circle cx="110" cy="80" r="8" fill="white"/>
            <circle cx="140" cy="50" r="8" fill="white"/>
          </svg>

          {/* ARQAM Text */}
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'white',
              marginTop: 30,
            }}
          >
            ARQAM
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 36,
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.9)',
              marginTop: 20,
            }}
          >
            FINANCIAL ANALYTICS
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
