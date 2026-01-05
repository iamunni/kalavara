'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TransactionTable } from '@/components/transactions/TransactionTable';
import { TransactionFilters, FilterState } from '@/components/transactions/TransactionFilters';
import { formatAmount } from '@/lib/utils/currency';
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns';

interface Summary {
  totalSpend: number;
  totalIncome: number;
  netChange: number;
  transactionCount: number;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit';
  rawMerchant: string;
  cleanMerchant: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  subcategory: string | null;
  transactionDate: Date;
  source: string;
  sourceBank: string;
  sourceRef: string | null;
  confidence: number;
  isVerified: boolean;
}

// Generate month options for last 12 months
function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = subMonths(now, i);
    options.push({
      value: i.toString(),
      label: format(date, 'MMMM yyyy'),
      date,
    });
  }
  return options;
}

export default function DashboardPage() {
  const { status } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('0');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({});

  const monthOptions = getMonthOptions();

  // Get date range for selected month
  const getDateRange = useCallback(() => {
    const monthIndex = parseInt(selectedMonth);
    const targetDate = subMonths(new Date(), monthIndex);
    return {
      from: startOfMonth(targetDate),
      to: endOfMonth(targetDate),
    };
  }, [selectedMonth]);

  // Fetch summary data
  const fetchSummary = useCallback(async () => {
    const { from, to } = getDateRange();
    const params = `from=${from.toISOString()}&to=${to.toISOString()}`;

    try {
      const response = await fetch(`/api/analytics/summary?${params}`);
      const data = await response.json();
      if (data.success) {
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, [getDateRange]);

  // Fetch transactions
  const fetchTransactions = useCallback(
    async (pageNum: number, append = false) => {
      setTransactionsLoading(true);
      const { from, to } = getDateRange();

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '50',
          from: from.toISOString(),
          to: to.toISOString(),
        });

        // Apply additional filters
        if (filters.category) params.set('category', filters.category);
        if (filters.type) params.set('type', filters.type);
        if (filters.minAmount) params.set('minAmount', filters.minAmount);
        if (filters.maxAmount) params.set('maxAmount', filters.maxAmount);

        const response = await fetch(`/api/transactions?${params}`);
        const data = await response.json();

        if (data.success) {
          setTransactions((prev) => (append ? [...prev, ...data.data] : data.data));
          setHasMore(data.hasMore);
          setTotal(data.total);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setTransactionsLoading(false);
      }
    },
    [getDateRange, filters]
  );

  // Initial load and when month changes
  useEffect(() => {
    if (status === 'authenticated') {
      setLoading(true);
      setPage(1);
      Promise.all([fetchSummary(), fetchTransactions(1)]).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [status, selectedMonth, fetchSummary, fetchTransactions]);

  // When filters change (but not month)
  useEffect(() => {
    if (status === 'authenticated') {
      setPage(1);
      fetchTransactions(1);
    }
  }, [filters]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTransactions(nextPage, true);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Unauthenticated view
  if (status !== 'authenticated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Kalavara</h1>
          <p className="text-xl text-muted-foreground max-w-md">
            Automatically track your expenses from bank email notifications. No manual entry required.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 max-w-3xl">
          <Card>
            <CardHeader className="text-center">
              <span className="text-3xl">📧</span>
              <CardTitle className="text-lg">Email Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Automatically fetch and parse transaction emails from your bank
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <span className="text-3xl">🤖</span>
              <CardTitle className="text-lg">Smart Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI-powered categorization to organize your spending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <span className="text-3xl">📊</span>
              <CardTitle className="text-lg">Deep Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualize spending patterns and track your financial health
              </p>
            </CardContent>
          </Card>
        </div>

        <Button size="lg" onClick={() => signIn('google')}>
          Sign in with Google to Get Started
        </Button>

        <p className="text-xs text-muted-foreground max-w-md">
          Requires Gmail access to read bank transaction emails. Your data stays local.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const selectedMonthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || '';
  const daysInMonth = new Date().getDate();

  return (
    <div className="space-y-6">
      {/* Header with month selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">{selectedMonthLabel}</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <span className="text-xl">💸</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(summary?.totalSpend || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.transactionCount || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <span className="text-xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatAmount(summary?.totalIncome || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Credits received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Change</CardTitle>
            <span className="text-xl">📊</span>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (summary?.netChange || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {(summary?.netChange || 0) >= 0 ? '+' : ''}
              {formatAmount(summary?.netChange || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Income - Expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Avg</CardTitle>
            <span className="text-xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(Math.round((summary?.totalSpend || 0) / daysInMonth))}
            </div>
            <p className="text-xs text-muted-foreground">Per day this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Transactions ({total})
          </h2>
        </div>

        <TransactionFilters onFilterChange={handleFilterChange} />

        <TransactionTable
          transactions={transactions}
          hasMore={hasMore}
          loading={transactionsLoading}
          onLoadMore={handleLoadMore}
        />
      </div>
    </div>
  );
}
