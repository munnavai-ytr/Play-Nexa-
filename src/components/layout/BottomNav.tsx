'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Film, Play, Library, User } from 'lucide-react';

interface NavTab {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const tabs: NavTab[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/movies', label: 'Movies', icon: Film },
  { href: '/shorts', label: 'Shorts', icon: Play },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] flex h-16 items-stretch border-t border-grovix-border bg-grovix-secondary"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex min-w-[20%] flex-col items-center justify-center active:scale-90 transition-transform duration-100 ${
              active ? 'text-grovix-purple' : 'text-grovix-muted'
            }`}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
            <span
              className={`mt-1 text-[10px] leading-tight ${
                active ? 'font-semibold' : 'font-normal'
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
