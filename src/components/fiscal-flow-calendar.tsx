// src/components/fiscal-flow-calendar.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  parseISO,
  isBefore,
  differenceInCalendarMonths,
  eachWeekOfInterval,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus, ArrowUp, ArrowDown, Repeat, Trash2, X } from "lucide-react";

import useLocalStorage from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
    isMobile: boolean;
    openMobileSheet: () => void;
}

export function FiscalFlowCalendar({
    entries,
    setEntries,
    rollover,
    timezone,
    openNewEntryDialog,
    setEditingEntry,
    setSelectedDate: setGlobalSelectedDate,
    setEntryDialogOpen,
    isMobile,
    openMobileSheet,
}: FiscalFlowCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthlyLeftovers, setMonthlyLeftovers] = useLocalStorage<MonthlyLeftovers>("fiscalFlowLeftovers", {});
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
      if (isSelectionMode) {
          handleDaySelection(day);
      } else {
        setSelectedDate(day);
        setGlobalSelectedDate(day);
        if (isMobile) {
            openMobileSheet();
        }
      }
  }
  
  const handleDaySelection = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    setSelectedDays(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (newSelected.has(dayKey)) {
            newSelected.delete(dayKey);
        } else {
            newSelected.add(dayKey);
        }
        return newSelected;
    });
  };

  const handleDeleteSelected = () => {
    setEntries(prevEntries => 
        prevEntries.filter(entry => !selectedDays.has(entry.date))
    );
    setIsSelectionMode(false);
    setSelectedDays(new Set());
  };

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
    
    const weeksInMonth = eachWeekOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth)
    });

    let remainingRollover = previousMonthLeftover;
    
    const weeksData = weeksInMonth.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        const weekEntries = entriesForCurrentMonth.filter(e => {
            const entryDate = parseDateInTimezone(e.date, timezone);
            return entryDate >= weekStart && entryDate <= weekEnd;
        });

        const income = weekEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const bills = weekEntries.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
        const net = income - bills;

        let rolloverApplied = 0;
        if (net < 0 && remainingRollover > 0) {
            rolloverApplied = Math.min(Math.abs(net), remainingRollover);
            remainingRollover -= rolloverApplied;
        }

        return {
            week: getWeek(weekStart),
            income,
            bills,
            net: net + rolloverApplied,
            rolloverApplied,
        };
    });

    const selectedWeekData = weeksData.find(w => getWeek(selectedDate) === w.week) || {
        week: getWeek(selectedDate),
        income: 0,
        bills: 0,
        net: 0,
        rolloverApplied: 0
    };

    return {
      monthlyTotals: { 
        bills: monthlyBills, 
        income: currentMonthIncome, 
        net: monthlyNet, 
        endOfMonthBalance: endOfMonthBalance, 
        rollover: previousMonthLeftover,
        monthKey
      },
      weeklyTotals: selectedWeekData,
      entriesForCurrentMonth,
    };
  }, [entries, currentMonth, selectedDate, rollover, monthlyLeftovers, timezone]);

  useEffect(() => {
    const { monthKey, endOfMonthBalance } = monthlyTotals;
    if (monthlyLeftovers[monthKey] !== endOfMonthBalance) {
      setMonthlyLeftovers(prev => ({...prev, [monthKey]: endOfMonthBalance }));
    }
  }, [monthlyTotals.monthKey, monthlyTotals.endOfMonthBalance, setMonthlyLeftovers, monthlyLeftovers]);

  const Sidebar = () => (
    <SidebarContent 
      weeklyTotals={weeklyTotals}
      monthlyTotals={monthlyTotals}
      isMobile={isMobile}
      selectedDate={selectedDate}
    />
  )

  return (
    <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl sm:text-2xl font-bold">{format(currentMonth, "MMMM yyyy")}</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              {!isSelectionMode ? (
                <>
                    <Button variant="outline" onClick={() => setIsSelectionMode(true)}>Select</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setCurrentMonth(new Date())} className="px-2 sm:px-4">Today</Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </>
              ) : (
                <>
                    <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedDays.size === 0}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedDays.size})
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedDays(new Set()); }}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-muted-foreground text-xs sm:text-sm">
            {WEEKDAYS.map((day) => (<div key={day}>{day}</div>))}
          </div>
          <div className="grid grid-cols-7 grid-rows-5 gap-1 mt-1">
            {daysInMonth.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
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
                    "relative flex flex-col h-24 sm:h-32 rounded-lg p-1 sm:p-2 border transition-colors",
                    !isSelectionMode && "cursor-pointer",
                    !isSameMonth(day, currentMonth) ? "bg-muted/50 text-muted-foreground" : "bg-card",
                    !isSelectionMode && isSameMonth(day, currentMonth) && "hover:bg-card/80",
                    isToday(day) && "border-primary",
                    isSameDay(day, selectedDate) && !isSelectionMode && "ring-2 ring-primary"
                  )}
                  onClick={() => handleDayClick(day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs sm:text-base">{format(day, "d")}</span>
                    {!isSelectionMode && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openNewEntryDialog(day); }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                    {isSelectionMode && dayEntries.length > 0 && (
                        <Checkbox 
                            checked={selectedDays.has(dayKey)}
                            onCheckedChange={() => handleDaySelection(day)}
                            className="h-5 w-5"
                        />
                    )}
                  </div>
                  <ScrollArea className="flex-1 mt-1">
                    <div className="space-y-1 text-[10px] sm:text-xs">
                      {dayEntries.map(entry => (
                          <div 
                              key={entry.id} 
                              onClick={(e) => { if (!isSelectionMode) { e.stopPropagation(); openEditEntryDialog(entry); } }}
                              onDragStart={(e) => handleDragStart(e, entry.id)}
                              draggable={!isSelectionMode}
                              className={cn(
                                  "p-1 rounded-md truncate",
                                  !isSelectionMode && "cursor-grab active:cursor-grabbing",
                                  entry.type === 'bill' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground',
                                  draggingEntryId === entry.id && 'opacity-50',
                                  isSelectionMode && 'opacity-70'
                              )}
                          >
                              <span className="hidden sm:inline">{entry.name}: </span>{formatCurrency(entry.amount)}
                          </div>
                      ))}
                    </div>
                  </ScrollArea>
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
          <aside className="w-[350px] border-l overflow-y-auto hidden lg:block">
            <Sidebar />
          </aside>
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

export const SidebarContent = ({
  weeklyTotals,
  monthlyTotals,
  isMobile,
  selectedDate,
}: {
  weeklyTotals: any,
  monthlyTotals: any,
  isMobile: boolean,
  selectedDate: Date,
}) => (
  <ScrollArea className="h-full">
    <div className="flex flex-col gap-6 p-4 md:p-6">
        <h2 className="text-2xl font-bold">
          {isMobile ? format(selectedDate, "MMM d, yyyy") : "Summary"}
        </h2>
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Week {weeklyTotals.week}</h3>
            <SummaryCard title="Income" amount={weeklyTotals.income} icon={<ArrowUp className="text-emerald-500" />} />
            <SummaryCard title="Bills Due" amount={weeklyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
            {weeklyTotals.rolloverApplied > 0 && (
                <SummaryCard title="Rollover Applied" amount={weeklyTotals.rolloverApplied} icon={<Repeat />} />
            )}
            <SummaryCard title="Weekly Net" amount={weeklyTotals.net} variant={weeklyTotals.net >= 0 ? 'positive' : 'negative'} />
        </div>
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Month</h3>
            <SummaryCard title="Total Income" amount={monthlyTotals.income} icon={<ArrowUp className="text-emerald-500" />} />
            <SummaryCard title="Total Bills" amount={monthlyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
            <SummaryCard title="Monthly Net" amount={monthlyTotals.net} variant={monthlyTotals.net >= 0 ? 'positive' : 'negative'} />
        </div>
    </div>
  </ScrollArea>
);
