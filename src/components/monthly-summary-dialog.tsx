
"use client";

import React from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Repeat, TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatCurrency } from '@/lib/utils';


type MonthlySummary = {
    income: number;
    bills: number;
    net: number;
    startOfMonthBalance: number;
    endOfMonthBalance: number;
}

type MonthlySummaryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  summary: MonthlySummary;
  currentMonth: Date;
};

function SummaryCard({ title, amount, icon, description, variant = 'default', className }: { title: string, amount: number, icon?: React.ReactNode, description?: string, variant?: 'default' | 'positive' | 'negative', className?: string }) {
    const amountColor = variant === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : variant === 'negative' ? 'text-destructive' : '';
    return (
        <Card className={cn(className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold", amountColor)}>{formatCurrency(amount)}</div>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </CardContent>
        </Card>
    );
}

export function MonthlySummaryDialog({
  isOpen,
  onClose,
  summary,
  currentMonth,
}: MonthlySummaryDialogProps) {

  if (!isOpen) {
    return null;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
            <DialogTitle>
                {format(currentMonth, 'MMMM yyyy')} Summary
            </DialogTitle>
            <DialogDescription>
                A high-level overview of your finances for the month.
            </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <SummaryCard 
                        title="Total Income" 
                        amount={summary.income} 
                        icon={<ArrowUp className="text-emerald-500" />} 
                    />
                    <SummaryCard 
                        title="Total Bills" 
                        amount={summary.bills} 
                        icon={<ArrowDown className="text-destructive" />} 
                    />
                    <SummaryCard 
                        title="Rollover" 
                        amount={summary.startOfMonthBalance} 
                        icon={<Repeat />} 
                        description="From previous month"
                    />
                    <SummaryCard 
                        title="Monthly Net" 
                        amount={summary.net} 
                        icon={summary.net >= 0 ? <TrendingUp className="text-emerald-500"/> : <TrendingDown className="text-destructive"/>}
                        description="Income - Bills"
                        variant={summary.net >= 0 ? 'positive' : 'negative'}
                    />
                </div>

                <Card className="col-span-1 md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">End-of-Month Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-3xl font-bold", summary.endOfMonthBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                            {formatCurrency(summary.endOfMonthBalance)}
                        </div>
                        <p className="text-xs text-muted-foreground">(Rollover + Income) - Bills</p>
                    </CardContent>
                </Card>

            </div>

            <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
                Close
            </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
