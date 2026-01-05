'use client';

import { SignInButton } from '@/components/auth/SignInButton';
import { SyncButton } from '@/components/sync/SyncButton';
import { useSession } from 'next-auth/react';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or page title could go here */}
      </div>

      <div className="flex items-center gap-4">
        {session && <SyncButton />}
        <SignInButton />
      </div>
    </header>
  );
}
