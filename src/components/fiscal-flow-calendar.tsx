// src/components/fiscal-flow-calendar.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isToday,
  isSameMonth,
  isSameDay,
  getWeek,
  getDate,
  setMonth,
  setYear,
  parseISO,
  isBefore,
  differenceInCalendarMonths,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus, Menu, ArrowUp, ArrowDown, Repeat } from "lucide-react";
import { useMedia } from "react-use";

import useLocalStorage from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn, formatCurrency } from "@/lib/utils";
import type { Entry, RolloverPreference, MonthlyLeftovers, RecurrenceInterval } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const recurrenceIntervalMonths: Record<RecurrenceInterval, number> = {
  none: 0,
  monthly: 1,
  bimonthly: 2,
  '3months': 3,
  '6months': 6,
  '12months': 12,
};

// Helper to parse 'YYYY-MM-DD' string into a Date object within a specific timezone.
// This prevents the date from shifting to the previous day.
const parseDateInTimezone = (dateString: string, timeZone: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return toZonedTime(new Date(year, month - 1, day), timeZone);
};

type FiscalFlowCalendarProps = {
    entries: Entry[];
    setEntries: (value: Entry[] | ((val: Entry[]) => Entry[])) => void;
    rollover: RolloverPreference;
    timezone: string;
    openNewEntryDialog: (date: Date) => void;
    setEditingEntry: (entry: Entry | null) => void;
    setSelectedDate: (date: Date) => void;
    setEntryDialogOpen: (isOpen: boolean) => void;
}

export function FiscalFlowCalendar({
    entries,
    setEntries,
    rollover,
    timezone,
    openNewEntryDialog,
    setEditingEntry,
    setSelectedDate: setGlobalSelectedDate,
    setEntryDialogOpen
}: FiscalFlowCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyLeftovers, setMonthlyLeftovers] = useLocalStorage<MonthlyLeftovers>("fiscalFlowLeftovers", {});
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);

  const isMobile = useMedia("(max-width: 768px)", false);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
      setSelectedDate(day);
      setGlobalSelectedDate(day);
  }

  const openEditEntryDialog = (entry: Entry) => {
    setEditingEntry(entry);
    setGlobalSelectedDate(parseDateInTimezone(entry.date, timezone));
    setEntryDialogOpen(true);
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, entryId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingEntryId(entryId);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
    e.preventDefault();
    if (draggingEntryId) {
      setEntries(prevEntries => 
        prevEntries.map(entry => 
          entry.id === draggingEntryId 
            ? { ...entry, date: format(targetDate, 'yyyy-MM-dd') }
            : entry
        )
      );
    }
    setDraggingEntryId(null);
  };

  const { monthlyTotals, weeklyTotals, entriesForCurrentMonth } = useMemo(() => {
    const monthKey = format(currentMonth, 'yyyy-MM');
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthKey = format(prevMonth, 'yyyy-MM');
    const previousMonthLeftover = (rollover === 'carryover' && monthlyLeftovers[prevMonthKey]) || 0;

    const entriesForCurrentMonth = entries.flatMap((e) => {
      const recurrenceInterval = e.recurrence ? recurrenceIntervalMonths[e.recurrence] : 0;
      if (e.recurrence && e.recurrence !== 'none' && recurrenceInterval > 0) {
        const originalEntryDate = parseISO(e.date);
        
        if (isBefore(startOfMonth(currentMonth), startOfMonth(originalEntryDate))) {
            return [];
        }

        const monthDiff = differenceInCalendarMonths(currentMonth, originalEntryDate);
        if (monthDiff < 0 || monthDiff % recurrenceInterval !== 0) {
            return [];
        }
        
        const lastDayOfCurrentMonth = endOfMonth(currentMonth).getDate();
        const originalDay = getDate(originalEntryDate);
        const dayForCurrentMonth = Math.min(originalDay, lastDayOfCurrentMonth);
        const recurringDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayForCurrentMonth);
        
        return [{ ...e, date: format(recurringDate, 'yyyy-MM-dd') }];
      } else {
        const entryDate = parseDateInTimezone(e.date, timezone);
        if (isSameMonth(entryDate, currentMonth)) {
          return [e];
        }
        return [];
      }
    });

    const monthlyBills = entriesForCurrentMonth.filter((e) => e.type === "bill").reduce((sum, e) => sum + e.amount, 0);
    const currentMonthIncome = entriesForCurrentMonth.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    
    const monthlyNet = currentMonthIncome - monthlyBills;
    const endOfMonthBalance = currentMonthIncome + previousMonthLeftover - monthlyBills;

    const start = startOfWeek(selectedDate);
    const end = endOfWeek(selectedDate);
    const weekEntries = entriesForCurrentMonth.filter(e => {
        const entryDate = parseDateInTimezone(e.date, timezone);
        return entryDate >= start && entryDate <= end;
    });

    const weeklyBills = weekEntries.filter((e) => e.type === "bill").reduce((sum, e) => sum + e.amount, 0);
    const weeklyIncome = weekEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    const weeklyNet = weeklyIncome - weeklyBills;
    
    return {
      monthlyTotals: { 
        bills: monthlyBills, 
        income: currentMonthIncome, 
        net: monthlyNet, 
        endOfMonthBalance: endOfMonthBalance, 
        rollover: previousMonthLeftover,
        monthKey
      },
      weeklyTotals: { bills: weeklyBills, income: weeklyIncome, net: weeklyNet, week: getWeek(selectedDate) },
      entriesForCurrentMonth,
    };
  }, [entries, currentMonth, selectedDate, rollover, monthlyLeftovers, timezone]);

  useEffect(() => {
    const { monthKey, endOfMonthBalance } = monthlyTotals;
    if (monthlyLeftovers[monthKey] !== endOfMonthBalance) {
      setMonthlyLeftovers(prev => ({...prev, [monthKey]: endOfMonthBalance }));
    }
  }, [monthlyTotals.monthKey, monthlyTotals.endOfMonthBalance, setMonthlyLeftovers, monthlyLeftovers]);


  const SidebarContent = () => (
    <div className="flex flex-col gap-6 p-4 md:p-6 h-full bg-card md:bg-transparent">
        <h2 className="text-2xl font-bold">Summary</h2>
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Week {weeklyTotals.week}</h3>
            <SummaryCard title="Income" amount={weeklyTotals.income} icon={<ArrowUp className="text-emerald-500" />} />
            <SummaryCard title="Bills Due" amount={weeklyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
            <SummaryCard title="Weekly Net" amount={weeklyTotals.net} variant={weeklyTotals.net >= 0 ? 'positive' : 'negative'} />
        </div>
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Month</h3>
            <SummaryCard title="Total Income" amount={monthlyTotals.income} icon={<ArrowUp className="text-emerald-500" />} />
            <SummaryCard title="Total Bills" amount={monthlyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
            <SummaryCard title="Monthly Net" amount={monthlyTotals.net} variant={monthlyTotals.net >= 0 ? 'positive' : 'negative'} />
        </div>
    </div>
  );

  return (
    <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{format(currentMonth, "MMMM yyyy")}</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-muted-foreground text-sm">
            {WEEKDAYS.map((day) => (<div key={day}>{day}</div>))}
          </div>
          <div className="grid grid-cols-7 grid-rows-5 gap-1 mt-1">
            {daysInMonth.map((day) => {
              const dayEntries = entriesForCurrentMonth
                .filter((e) => {
                    const entryDate = parseDateInTimezone(e.date, timezone);
                    return isSameDay(entryDate, day);
                })
                .sort((a, b) => {
                    if (a.type === 'income' && b.type === 'bill') return -1;
                    if (a.type === 'bill' && b.type === 'income') return 1;
                    return 0;
                });

              return (
                <div
                  key={day.toString()}
                  className={cn(
                    "relative flex flex-col h-32 rounded-lg p-2 border transition-colors cursor-pointer",
                    !isSameMonth(day, currentMonth) ? "bg-muted/50 text-muted-foreground" : "bg-card hover:bg-card/80",
                    isToday(day) && "border-primary",
                    isSameDay(day, selectedDate) && "ring-2 ring-primary"
                  )}
                  onClick={() => handleDayClick(day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{format(day, "d")}</span>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openNewEntryDialog(day); }}>
                        <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto mt-1 space-y-1 text-xs">
                    {dayEntries.map(entry => (
                        <div 
                            key={entry.id} 
                            onClick={(e) => { e.stopPropagation(); openEditEntryDialog(entry); }}
                            onDragStart={(e) => handleDragStart(e, entry.id)}
                            draggable="true"
                            className={cn(
                                "p-1 rounded-md truncate cursor-grab active:cursor-grabbing",
                                entry.type === 'bill' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground',
                                draggingEntryId === entry.id && 'opacity-50'
                            )}
                        >
                            {entry.name}: {formatCurrency(entry.amount)}
                        </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t pt-6">
            <h2 className="text-xl font-bold mb-4 text-center md:text-left">
              {format(currentMonth, "MMMM")} Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                title="Total Income"
                amount={monthlyTotals.income}
                icon={<ArrowUp className="text-emerald-500" />}
              />
              <SummaryCard
                title="Total Bills"
                amount={monthlyTotals.bills}
                icon={<ArrowDown className="text-destructive" />}
              />
              <SummaryCard
                title="Monthly Net"
                amount={monthlyTotals.net}
                variant={monthlyTotals.net >= 0 ? 'positive' : 'negative'}
              />
              <SummaryCard
                title="Rollover"
                amount={monthlyTotals.rollover}
                icon={<Repeat />}
                description="From previous month"
              />
              <SummaryCard
                title="End-of-Month Balance"
                amount={monthlyTotals.endOfMonthBalance}
                variant={monthlyTotals.endOfMonthBalance >= 0 ? 'positive' : 'negative'}
                className="md:col-span-2 lg:col-span-4"
              />
            </div>
          </div>
        </main>
        {!isMobile && (
          <aside className="w-[350px] border-l overflow-y-auto">
            <SidebarContent />
          </aside>
        )}
        {isMobile && (
             <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          )}
      </div>
  );
}


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
