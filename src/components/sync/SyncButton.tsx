'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncType, setSyncType] = useState<'normal' | 'full' | null>(null);
  const { toast } = useToast();

  async function handleSync(fullSync = false) {
    setIsSyncing(true);
    setSyncType(fullSync ? 'full' : 'normal');
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullSync }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: fullSync ? 'Backfill complete' : 'Sync complete',
          description: `Found ${data.newTransactions} new transactions (${data.duplicates} duplicates skipped)`,
        });
        // Reload to show new data
        window.location.reload();
      } else {
        toast({
          title: 'Sync failed',
          description: data.error || 'An error occurred',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Network error',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
      setSyncType(null);
    }
  }

  if (isSyncing) {
    return (
      <Button disabled variant="outline" size="sm">
        <span className="mr-2 animate-spin">⟳</span>
        {syncType === 'full' ? 'Backfilling (6 months)...' : 'Syncing...'}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <span className="mr-2">🔄</span>
          Sync
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleSync(false)}>
          <span className="mr-2">⚡</span>
          Quick Sync (last 7 days)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSync(true)}>
          <span className="mr-2">📅</span>
          Full Backfill (last 6 months)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
