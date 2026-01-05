'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface FiltersProps {
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  from?: string;
  to?: string;
  category?: string;
  type?: string;
  minAmount?: string;
  maxAmount?: string;
}

export function TransactionFilters({ onFilterChange }: FiltersProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<FilterState>({});

  useEffect(() => {
    // Fetch categories
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCategories(data.data);
        }
      });
  }, []);

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-card border rounded-lg">
      <div className="flex gap-2 items-center">
        <label className="text-sm text-muted-foreground">From</label>
        <Input
          type="date"
          value={filters.from || ''}
          onChange={(e) => handleChange('from', e.target.value)}
          className="w-[150px]"
        />
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm text-muted-foreground">To</label>
        <Input
          type="date"
          value={filters.to || ''}
          onChange={(e) => handleChange('to', e.target.value)}
          className="w-[150px]"
        />
      </div>

      <Select
        value={filters.category || 'all'}
        onValueChange={(v) => handleChange('category', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.type || 'all'}
        onValueChange={(v) => handleChange('type', v === 'all' ? '' : v)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="debit">Spent</SelectItem>
          <SelectItem value="credit">Received</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex gap-2 items-center">
        <Input
          type="number"
          placeholder="Min ₹"
          value={filters.minAmount || ''}
          onChange={(e) => handleChange('minAmount', e.target.value ? String(parseInt(e.target.value) * 100) : '')}
          className="w-[100px]"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max ₹"
          value={filters.maxAmount || ''}
          onChange={(e) => handleChange('maxAmount', e.target.value ? String(parseInt(e.target.value) * 100) : '')}
          className="w-[100px]"
        />
      </div>

      <Button variant="ghost" size="sm" onClick={clearFilters}>
        Clear
      </Button>
    </div>
  );
}
