
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
import { add, endOfMonth, format, getDay, isBefore, isSameMonth, setDate, startOfMonth, getDate } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { type Entry, type BillCategory, BillCategories } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { recurrenceIntervalMonths } from '@/lib/constants';

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
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const generateRecurringInstances = (entry: Entry): Entry[] => {
        const instances: Entry[] = [];
        const originalEntryDate = new Date(entry.date + 'T00:00:00');
        
        if (isBefore(end, originalEntryDate)) return [];

        if (entry.recurrence === 'weekly') {
            const originalDayOfWeek = getDay(originalEntryDate);
            let currentDate = start;
            while (isBefore(currentDate, end)) {
                if (getDay(currentDate) === originalDayOfWeek && (currentDate >= originalEntryDate)) {
                    instances.push({ ...entry, date: format(currentDate, 'yyyy-MM-dd') });
                }
                currentDate = add(currentDate, { days: 1 });
            }
            return instances;
        }
        
        const recurrenceInterval = entry.recurrence ? recurrenceIntervalMonths[entry.recurrence as keyof typeof recurrenceIntervalMonths] : 0;
        if (entry.recurrence && entry.recurrence !== 'none' && recurrenceInterval > 0) {
            let recurringDate = originalEntryDate;
            while(isBefore(recurringDate, end)) {
                 if (recurringDate >= start) {
                    const lastDayOfMonth = endOfMonth(recurringDate).getDate();
                    const originalDay = getDate(originalEntryDate);
                    const dayForMonth = Math.min(originalDay, lastDayOfMonth);
                    const finalDate = setDate(recurringDate, dayForMonth);

                    if (isSameMonth(finalDate, currentMonth)) {
                        instances.push({ ...entry, date: format(finalDate, 'yyyy-MM-dd') });
                    }
                 }
                 recurringDate = add(recurringDate, { months: recurrenceInterval });
            }
            return instances;
        }
        return [];
    };

    const monthlyBills = entries
        .filter(entry => entry.type === 'bill')
        .flatMap(entry => {
            if (entry.recurrence === 'none') {
                const entryDate = toZonedTime(entry.date, timezone);
                return isSameMonth(entryDate, currentMonth) ? [entry] : [];
            }
            return generateRecurringInstances(entry);
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
                                content={<ChartTooltipContent 
                                    hideLabel 
                                    formatter={(value) => formatCurrency(value as number)}
                                />}
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
