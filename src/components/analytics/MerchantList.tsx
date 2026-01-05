'use client';

import { formatAmount } from '@/lib/utils/currency';

interface MerchantData {
  merchantName: string;
  amount: number;
  count: number;
}

interface MerchantListProps {
  data: MerchantData[];
}

export function MerchantList({ data }: MerchantListProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No merchant data available
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((m) => m.amount));

  return (
    <div className="space-y-3">
      {data.map((merchant, index) => (
        <div key={merchant.merchantName} className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm w-5">{index + 1}.</span>
              <span className="font-medium truncate max-w-[200px]">{merchant.merchantName}</span>
              <span className="text-xs text-muted-foreground">
                ({merchant.count} txn{merchant.count !== 1 ? 's' : ''})
              </span>
            </div>
            <span className="font-medium">{formatAmount(merchant.amount)}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-7">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(merchant.amount / maxAmount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
