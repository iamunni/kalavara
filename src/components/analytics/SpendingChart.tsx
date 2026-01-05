'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface TrendData {
  date: string;
  amount: number;
  count: number;
}

interface SpendingChartProps {
  data: TrendData[];
}

const chartConfig = {
  amount: {
    label: 'Spending',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function SpendingChart({ data }: SpendingChartProps) {
  // Convert paise to rupees for display
  const chartData = data.map((d) => ({
    ...d,
    amount: d.amount / 100,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <AreaChart
        accessibilityLayer
        data={chartData}
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => {
            // Format date for display
            if (value.includes('W')) return value; // Week format
            const parts = value.split('-');
            if (parts.length === 2) return `${parts[1]}/${parts[0].slice(2)}`; // Month
            return `${parts[2]}/${parts[1]}`; // Day
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `₹${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Spent']}
            />
          }
        />
        <defs>
          <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          dataKey="amount"
          type="monotone"
          fill="url(#fillAmount)"
          fillOpacity={0.4}
          stroke="var(--color-amount)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
