'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const navItems = [
  {href: '/', label: '채팅'},
  {href: '/image', label: '이미지 생성'},
  {href: '/video', label: '영상 생성'},
  {href: '/music', label: '음악 생성'},
];

export function TopNavigation() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0f1720]/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10 xl:px-16">
        <Link className="text-lg font-semibold tracking-[-0.02em] text-white" href="/">
          장사한컷
        </Link>
        <nav className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-[#111827]'
                    : 'bg-white/5 text-white/72 hover:bg-white/10 hover:text-white'
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
