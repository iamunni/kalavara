'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SpendingChart } from '@/components/analytics/SpendingChart';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { MerchantList } from '@/components/analytics/MerchantList';
import { formatAmount } from '@/lib/utils/currency';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface Summary {
  totalSpend: number;
  totalIncome: number;
  netChange: number;
  transactionCount: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  byMerchant: Array<{
    merchantName: string;
    amount: number;
    count: number;
  }>;
}

interface TrendData {
  date: string;
  amount: number;
  count: number;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'month' | '3months' | '6months'>('month');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      let from: Date;

      switch (timeRange) {
        case '3months':
          from = startOfMonth(subMonths(now, 2));
          break;
        case '6months':
          from = startOfMonth(subMonths(now, 5));
          break;
        default:
          from = startOfMonth(now);
      }

      const to = endOfMonth(now);
      const params = `from=${from.toISOString()}&to=${to.toISOString()}`;

      const [summaryRes, trendsRes] = await Promise.all([
        fetch(`/api/analytics/summary?${params}`),
        fetch(`/api/analytics/trends?${params}&groupBy=${timeRange === 'month' ? 'day' : 'week'}`),
      ]);

      const summaryData = await summaryRes.json();
      const trendsData = await trendsRes.json();

      if (summaryData.success) setSummary(summaryData.data);
      if (trendsData.success) setTrends(trendsData.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please sign in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Your spending insights and trends</p>
        </div>

        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="3months">3 Months</TabsTrigger>
            <TabsTrigger value="6months">6 Months</TabsTrigger>
          </TabsList>
        </Tabs>
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
            <CardTitle className="text-sm font-medium">Avg/Day</CardTitle>
            <span className="text-xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(Math.round((summary?.totalSpend || 0) / 30))}
            </div>
            <p className="text-xs text-muted-foreground">Daily average</p>
          </CardContent>
        </Card>
      </div>

      {/* Spending Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Trend</CardTitle>
          <CardDescription>Your spending pattern over time</CardDescription>
        </CardHeader>
        <CardContent>
          <SpendingChart data={trends} />
        </CardContent>
      </Card>

      {/* Category and Merchant breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
            <CardDescription>Where your money goes</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={summary?.byCategory || []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
            <CardDescription>Your most frequent spending destinations</CardDescription>
          </CardHeader>
          <CardContent>
            <MerchantList data={summary?.byMerchant || []} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
