
"use client";

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { isSameMonth } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { type Entry, type BillCategory, BillCategories } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

type MonthlyBreakdownDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  entries: Entry[];
  currentMonth: Date;
  timezone: string;
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(200 80% 50%)',
  'hsl(40 80% 50%)',
  'hsl(280 80% 50%)',
  'hsl(120 80% 40%)',
  'hsl(320 80% 50%)',
  'hsl(80 80% 50%)',
  'hsl(0 0% 50%)',
];

export function MonthlyBreakdownDialog({
  isOpen,
  onClose,
  entries,
  currentMonth,
  timezone,
}: MonthlyBreakdownDialogProps) {
  const breakdownData = useMemo(() => {
    const monthlyBills = entries.filter((entry) => {
      const entryDate = toZonedTime(entry.date, timezone);
      return entry.type === 'bill' && isSameMonth(entryDate, currentMonth);
    });

    const breakdown: Record<BillCategory, number> = Object.fromEntries(
        BillCategories.map(cat => [cat, 0])
    ) as Record<BillCategory, number>;
    
    let total = 0;

    for (const bill of monthlyBills) {
      if (bill.category) {
        breakdown[bill.category] += bill.amount;
      } else {
        breakdown['other'] += bill.amount; // Default to 'other' if no category
      }
      total += bill.amount;
    }
    
    const sortedBreakdown = Object.entries(breakdown)
        .filter(([, amount]) => amount > 0)
        .sort(([, a], [, b]) => b - a) as [BillCategory, number][];

    return { breakdown: sortedBreakdown, total };
  }, [entries, currentMonth, timezone]);

  const chartData = useMemo(() => {
    return breakdownData.breakdown.map(([name, value]) => ({
      name,
      value,
    }));
  }, [breakdownData]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Monthly Bill Breakdown for {format(currentMonth, 'MMMM yyyy')}
          </DialogTitle>
          <DialogDescription>
            A summary of your expenses by category for the selected month.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {chartData.length > 0 && (
                 <div className="w-full h-[250px] flex items-center justify-center">
                    <ChartContainer config={{}} className="mx-auto aspect-square h-full">
                        <PieChart>
                            <Tooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={60}
                                strokeWidth={5}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                </div>
            )}
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownData.breakdown.length > 0 ? (
                  breakdownData.breakdown.map(([category, amount]) => (
                    <TableRow key={category}>
                      <TableCell className="font-medium capitalize">{category}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No bills with categories found for this month.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right text-lg font-bold">
                    {formatCurrency(breakdownData.total)}
                  </TableHead>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
