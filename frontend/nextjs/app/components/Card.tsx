'use client';

import Link from 'next/link';
import { useState } from 'react';

interface CardProps {
  title: string;
  description: string;
  href: string;
  color: string;
}

export default function Card({ title, description, href, color }: CardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          padding: '1.6rem',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          borderLeft: isHovered ? '4px solid #111827' : '4px solid transparent',
          boxShadow: isHovered
            ? '0 10px 26px rgba(15, 23, 42, 0.10)'
            : '0 6px 18px rgba(15, 23, 42, 0.06)',
          transition: 'all 0.25s ease',
          cursor: 'pointer',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
          gap: '0.5rem',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 700, 
            marginBottom: '0.35rem', 
            color: '#0f172a',
          }}>
            {title}
          </h3>
          <p style={{ 
            fontSize: '0.95rem', 
            color: '#475569', 
            margin: 0, 
            lineHeight: 1.6, 
            flex: 1,
            fontWeight: 400,
          }}>
            {description}
          </p>
          <div style={{ 
            marginTop: '1.1rem', 
            color: '#111827', 
            fontWeight: 600, 
            fontSize: '0.9rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'transform 0.25s ease',
            transform: isHovered ? 'translateX(3px)' : 'translateX(0)',
            textDecoration: 'none',
          }}>
            <span>Open</span>
            <span style={{ fontSize: '1rem' }}>→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
