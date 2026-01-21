'use client';

import { usePathname } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';
import styles from './RouteTransition.module.css';

export default function RouteTransition({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'enter' | 'idle'>('enter');

  useEffect(() => {
    setPhase('enter');
    const t = window.setTimeout(() => setPhase('idle'), 220);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
      key={pathname}
      className={`${styles.wrap} ${phase === 'enter' ? styles.enter : styles.idle}`}
    >
      {children}
    </div>
  );
}

