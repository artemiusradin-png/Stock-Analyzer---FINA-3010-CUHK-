'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './NavBar.module.css';

export default function NavBar() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  // Don't show nav bar on home page
  if (isHomePage) {
    return null;
  }

  return (
    <nav className={styles.navBar}>
      <div className={styles.navContent}>
        <Link href="/" className={styles.logo}>
          <img src="/arqam-logo.svg" alt="ARQAM" className={styles.logoImage} />
        </Link>
        
        <div className={styles.navLinks}>
          <Link 
            href="/research" 
            className={`${styles.navLink} ${pathname === '/research' ? styles.active : ''}`}
          >
            Stock Research
          </Link>
          <Link 
            href="/watchlist" 
            className={`${styles.navLink} ${pathname === '/watchlist' ? styles.active : ''}`}
          >
            Watchlist
          </Link>
          <Link 
            href="/builder" 
            className={`${styles.navLink} ${pathname === '/builder' ? styles.active : ''}`}
          >
            Portfolio Builder
          </Link>
          <Link 
            href="/trading" 
            className={`${styles.navLink} ${pathname === '/trading' ? styles.active : ''}`}
          >
            Trading Portfolio
          </Link>
          <Link 
            href="/reports" 
            className={`${styles.navLink} ${pathname === '/reports' ? styles.active : ''}`}
          >
            Reports
          </Link>
        </div>
      </div>
    </nav>
  );
}
