'use client';

import { Pie, PieChart, Cell } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  amount: number;
  count: number;
  percentage: number;
}

interface CategoryBreakdownProps {
  data: CategoryData[];
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  // Build chart config from data
  const chartConfig = data.reduce((acc, cat) => {
    acc[cat.categoryName] = {
      label: cat.categoryName,
      color: cat.categoryColor,
    };
    return acc;
  }, {} as ChartConfig);

  // Convert to chart format
  const chartData = data.map((cat) => ({
    name: cat.categoryName,
    value: cat.amount / 100, // Convert paise to rupees
    fill: cat.categoryColor,
    icon: cat.categoryIcon,
    percentage: cat.percentage,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No spending data available
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <ChartContainer config={chartConfig} className="h-[300px] w-full md:w-1/2">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={60}
            paddingAngle={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => [
                  `₹${Number(value).toLocaleString('en-IN')}`,
                  name,
                ]}
              />
            }
          />
        </PieChart>
      </ChartContainer>

      <div className="flex-1 space-y-2">
        {chartData.slice(0, 6).map((cat) => (
          <div key={cat.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.fill }}
              />
              <span className="text-sm">{cat.icon} {cat.name}</span>
            </div>
            <div className="text-right">
              <span className="font-medium">₹{cat.value.toLocaleString('en-IN')}</span>
              <span className="text-xs text-muted-foreground ml-2">({cat.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
