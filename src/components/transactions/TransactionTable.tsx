'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatAmount } from '@/lib/utils/currency';
import { formatDate } from '@/lib/utils/date';

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

interface TransactionTableProps {
  transactions: Transaction[];
  onEdit?: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export function TransactionTable({
  transactions,
  onEdit,
  onLoadMore,
  hasMore,
  loading,
}: TransactionTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="w-[80px]">Bank</TableHead>
            <TableHead className="text-right w-[120px]">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No transactions found. Try syncing your emails.
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((tx) => (
              <TableRow
                key={tx.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onEdit?.(tx.id)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {formatDate(new Date(tx.transactionDate), 'dd MMM')}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{tx.cleanMerchant}</span>
                    {tx.subcategory && (
                      <span className="text-xs text-muted-foreground">{tx.subcategory}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{tx.categoryIcon || '📦'}</span>
                    <span className="text-sm">{tx.categoryName || 'Uncategorized'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {tx.sourceBank}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={
                      tx.type === 'credit' ? 'text-green-600 font-medium' : 'text-foreground'
                    }
                  >
                    {tx.type === 'credit' ? '+' : '-'}
                    {formatAmount(tx.amount, tx.currency)}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="flex justify-center p-4 border-t">
          <Button variant="outline" onClick={onLoadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
