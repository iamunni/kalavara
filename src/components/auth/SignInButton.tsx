'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function SignInButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <Button variant="ghost" disabled>
        Loading...
      </Button>
    );
  }

  if (session?.user) {
    const initials = session.user.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || session.user.email?.[0].toUpperCase() || '?';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage src={session.user.image || undefined} alt={session.user.name || 'User'} />
              <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              {session.user.name && <p className="font-medium">{session.user.name}</p>}
              {session.user.email && (
                <p className="w-[200px] truncate text-sm text-muted-foreground">{session.user.email}</p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings">Settings</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={() => signIn('google')} variant="default">
      Sign in with Google
    </Button>
  );
}
