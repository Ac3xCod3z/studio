
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { add, endOfMonth, format, getDay, isBefore, isSameMonth, setDate, startOfMonth, getDate, differenceInCalendarMonths, parseISO, isAfter } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { type Entry, type BillCategory, BillCategories } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
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
        const originalEntryDate = toZonedTime(parseISO(entry.date), timezone);

        if (entry.recurrence === 'weekly') {
            let currentDate = originalEntryDate;
            // Move to the first occurrence that is on or after the start of the breakdown month
            while (isBefore(currentDate, start)) {
                currentDate = add(currentDate, { weeks: 1 });
            }
            // Add all occurrences within the breakdown month
            while (isBefore(currentDate, end) || isSameMonth(currentDate, end)) {
                instances.push({ ...entry, date: format(currentDate, 'yyyy-MM-dd') });
                currentDate = add(currentDate, { weeks: 1 });
            }
            return instances;
        }

        const recurrenceInterval = entry.recurrence ? recurrenceIntervalMonths[entry.recurrence as keyof typeof recurrenceIntervalMonths] : 0;
        if (entry.recurrence && entry.recurrence !== 'none' && recurrenceInterval > 0) {
            let currentDate = originalEntryDate;
            
            // Fast-forward to the current month's potential start
            if (isBefore(currentDate, start)) {
                const monthsDiff = differenceInCalendarMonths(start, currentDate);
                if (monthsDiff > 0) {
                    const monthsToAdd = Math.floor(monthsDiff / recurrenceInterval) * recurrenceInterval;
                    currentDate = add(currentDate, { months: monthsToAdd });
                }
            }

            // Iterate through potential dates and add valid ones
            while (isBefore(currentDate, end) || isSameMonth(currentDate, end)) {
                if (isAfter(currentDate, originalEntryDate) || isSameMonth(currentDate, originalEntryDate)) {
                    // Make sure we haven't overshot the month
                    if (isSameMonth(currentDate, currentMonth)) {
                        const lastDayOfMonth = endOfMonth(currentDate).getDate();
                        const originalDay = getDate(originalEntryDate);
                        const dayForMonth = Math.min(originalDay, lastDayOfMonth);
                        const finalDate = setDate(currentDate, dayForMonth);
                        instances.push({ ...entry, date: format(finalDate, 'yyyy-MM-dd') });
                    }
                }
                currentDate = add(currentDate, { months: recurrenceInterval });
            }

            return instances;
        }
        return [];
    };

    const monthlyBills = entries
        .filter(entry => entry.type === 'bill')
        .flatMap(entry => {
            if (entry.recurrence === 'none') {
                const entryDate = toZonedTime(parseISO(entry.date), timezone);
                return isSameMonth(entryDate, currentMonth) ? [entry] : [];
            }
            return generateRecurringInstances(entry);
        });

    const breakdown: Record<BillCategory, { total: number, entries: Entry[] }> = Object.fromEntries(
        BillCategories.map(cat => [cat, { total: 0, entries: [] }])
    ) as Record<BillCategory, { total: number, entries: Entry[] }>;
    
    let total = 0;

    for (const bill of monthlyBills) {
      const category = bill.category || 'other';
      if (!breakdown[category]) {
        breakdown[category] = { total: 0, entries: [] };
      }
      breakdown[category].total += bill.amount;
      breakdown[category].entries.push(bill);
      total += bill.amount;
    }
    
    const sortedBreakdown = Object.entries(breakdown)
        .map(([category, data]) => ({ category: category as BillCategory, ...data}))
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total);

    return { breakdown: sortedBreakdown, total };
  }, [entries, currentMonth, timezone]);

  const chartData = useMemo(() => {
    return breakdownData.breakdown.map(({ category, total }) => ({
      name: category,
      value: total,
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
            A summary of your expenses by category. Click a category to see details.
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
            
            <Accordion type="single" collapsible className="w-full">
                {breakdownData.breakdown.length > 0 ? (
                  breakdownData.breakdown.map(({ category, total, entries }) => (
                    <AccordionItem value={category} key={category}>
                       <AccordionTrigger className="hover:no-underline">
                           <div className="flex justify-between w-full pr-4">
                                <span className="font-medium capitalize">{category}</span>
                                <span>{formatCurrency(total)}</span>
                           </div>
                       </AccordionTrigger>
                       <AccordionContent>
                           <Table>
                               <TableBody>
                                   {entries.sort((a,b) => a.name.localeCompare(b.name)).map((entry, idx) => (
                                       <TableRow key={`${entry.id}-${idx}`}>
                                           <TableCell>{entry.name}</TableCell>
                                           <TableCell className="text-right">{formatCurrency(entry.amount)}</TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </AccordionContent>
                    </AccordionItem>
                  ))
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No bills with categories found for this month.
                    </div>
                )}
            </Accordion>
             <div className="border-t mt-4 pt-4 flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(breakdownData.total)}</span>
             </div>
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
