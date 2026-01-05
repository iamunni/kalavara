'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Bank } from '@/types';

interface Settings {
  openaiApiKey: string | null;
  hasApiKey: boolean;
  defaultCurrency: string;
  enabledBanks: string[];
  autoSyncOnLoad: boolean;
}

const ALL_BANKS = [Bank.HDFC, Bank.SIB, Bank.ICICI, Bank.AXIS, Bank.KOTAK, Bank.YES];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSettings();
    }
  }, [status]);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openaiApiKey: apiKey }),
      });

      const data = await response.json();
      if (data.success) {
        toast({ title: 'API key saved', description: 'Your OpenAI API key has been saved' });
        setApiKey('');
        fetchSettings();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save API key',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleBank(bank: string) {
    if (!settings) return;

    const newBanks = settings.enabledBanks.includes(bank)
      ? settings.enabledBanks.filter((b) => b !== bank)
      : [...settings.enabledBanks, bank];

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledBanks: newBanks }),
      });

      if (response.ok) {
        setSettings({ ...settings, enabledBanks: newBanks });
      }
    } catch (error) {
      console.error('Error updating banks:', error);
    }
  }

  async function toggleAutoSync() {
    if (!settings) return;

    const newValue = !settings.autoSyncOnLoad;

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSyncOnLoad: newValue }),
      });

      if (response.ok) {
        setSettings({ ...settings, autoSyncOnLoad: newValue });
      }
    } catch (error) {
      console.error('Error updating auto-sync:', error);
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please sign in to view settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your expense tracker preferences</p>
      </div>

      {/* OpenAI API Key */}
      <Card>
        <CardHeader>
          <CardTitle>OpenAI API Key</CardTitle>
          <CardDescription>
            Used for automatic transaction categorization and merchant name cleaning.
            Get your key from{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              OpenAI Platform
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.hasApiKey && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Current Key</Badge>
              <code className="text-sm text-muted-foreground">{settings.openaiApiKey}</code>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={saveApiKey} disabled={saving || !apiKey.trim()}>
              {saving ? 'Saving...' : settings?.hasApiKey ? 'Update' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enabled Banks */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Banks</CardTitle>
          <CardDescription>Select which bank emails to process during sync</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ALL_BANKS.map((bank) => (
              <Badge
                key={bank}
                variant={settings?.enabledBanks.includes(bank) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleBank(bank)}
              >
                {bank}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Settings</CardTitle>
          <CardDescription>Configure how transactions are synced</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-sync on page load</p>
              <p className="text-sm text-muted-foreground">
                Automatically check for new transactions when you open the app
              </p>
            </div>
            <Button
              variant={settings?.autoSyncOnLoad ? 'default' : 'outline'}
              onClick={toggleAutoSync}
            >
              {settings?.autoSyncOnLoad ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your connected account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{session.user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{session.user.name || 'Not set'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
