
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
  isBefore,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus, ArrowUp, ArrowDown, Repeat, PieChart, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatCurrency } from "@/lib/utils";
import type { Entry, RolloverPreference, MonthlyLeftovers } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseDateInTimezone = (dateString: string, timeZone: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return toZonedTime(new Date(year, month - 1, day), timeZone);
};

type FiscalFlowCalendarProps = {
    entries: Entry[];
    generatedEntries: Entry[];
    setEntries: (value: Entry[] | ((val: Entry[]) => Entry[])) => void;
    rollover: RolloverPreference;
    timezone: string;
    openNewEntryDialog: (date: Date) => void;
    setEditingEntry: (entry: Entry | null) => void;
    setSelectedDate: (date: Date) => void;
    setEntryDialogOpen: (isOpen: boolean) => void;
    isMobile: boolean;
    openDayEntriesDialog: () => void;
    isReadOnly?: boolean;
    monthlyLeftovers: MonthlyLeftovers;
    weeklyTotals: any;
    onOpenBreakdown: () => void;
    isSelectionMode: boolean;
    toggleSelectionMode: () => void;
    selectedIds: string[];
    setSelectedIds: (ids: string[]) => void;
    onBulkDelete: () => void;
}

export function FiscalFlowCalendar({
    entries,
    generatedEntries,
    setEntries,
    rollover,
    timezone,
    openNewEntryDialog,
    setEditingEntry,
    setSelectedDate: setGlobalSelectedDate,
    setEntryDialogOpen,
    isMobile,
    openDayEntriesDialog,
    isReadOnly = false,
    monthlyLeftovers,
    weeklyTotals,
    onOpenBreakdown,
    isSelectionMode,
    toggleSelectionMode,
    selectedIds,
    setSelectedIds,
    onBulkDelete,
}: FiscalFlowCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);

  const { daysWithEntries } = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const daysInMonth = eachDayOfInterval({ start, end });
    
    const daysMap = new Map<string, { day: Date; entries: Entry[] }>();
    
    daysInMonth.forEach(day => {
        daysMap.set(format(day, 'yyyy-MM-dd'), { day, entries: [] });
    });
    
    generatedEntries.forEach(entry => {
        const entryDayStr = format(parseDateInTimezone(entry.date, timezone), 'yyyy-MM-dd');
        if (daysMap.has(entryDayStr)) {
            daysMap.get(entryDayStr)!.entries.push(entry);
        }
    });

    daysMap.forEach(dayData => {
        dayData.entries.sort((a, b) => {
            if (a.type === 'income' && b.type === 'bill') return -1;
            if (a.type === 'bill' && b.type === 'income') return 1;
            return a.name.localeCompare(b.name);
        });
    });

    return { daysWithEntries: Array.from(daysMap.values()) };
}, [currentMonth, generatedEntries, timezone]);
  
  const getOriginalIdFromInstance = (instanceId: string) => {
    // e.g. 'uuid-2024-08-15' -> 'uuid'
    const parts = instanceId.split('-');
    if (parts.length > 5) { // Assuming UUID is 5 parts
        return parts.slice(0, parts.length - 3).join('-');
    }
    return instanceId;
  }

  const handleDayClick = (day: Date, dayEntries: Entry[]) => {
      if (isReadOnly) return;
      
      if (isSelectionMode) {
          const entryIdsOnDay = dayEntries.map(e => getOriginalIdFromInstance(e.id));
          const uniqueEntryIds = [...new Set(entryIdsOnDay)];
          const areAllSelected = uniqueEntryIds.every(id => selectedIds.includes(id));
          
          if (areAllSelected) {
              // Deselect all entries on this day
              setSelectedIds(selectedIds.filter(id => !uniqueEntryIds.includes(id)));
          } else {
              // Select all entries on this day
              setSelectedIds([...new Set([...selectedIds, ...uniqueEntryIds])]);
          }
          return;
      }

      setSelectedDate(day);
      setGlobalSelectedDate(day);

      if (isMobile) {
        if (dayEntries.length > 0) {
            openDayEntriesDialog();
        }
      }
  }

  const entryIsRecurringInstance = (entryId: string) => {
      // e.g. 'uuid-2024-08-15'
      return entryId.match(/.*-\d{4}-\d{2}-\d{2}$/);
  }

  const openEditEntryDialog = (entry: Entry) => {
    if (isReadOnly || isSelectionMode) return;
    const originalEntryId = getOriginalIdFromInstance(entry.id);
    const originalEntry = entries.find(e => e.id === originalEntryId) || entry;

    setEditingEntry(originalEntry);
    setGlobalSelectedDate(parseDateInTimezone(originalEntry.date, timezone));
    setEntryDialogOpen(true);
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, entry: Entry) => {
    if (isReadOnly || isSelectionMode || entryIsRecurringInstance(entry.id)) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.effectAllowed = 'move';
    setDraggingEntryId(entry.id);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isReadOnly || isSelectionMode) return;
    e.preventDefault(); 
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
    if (isReadOnly || isSelectionMode) return;
    e.preventDefault();
    if (draggingEntryId) {
      setEntries(prevEntries => 
        prevEntries.map(entry => 
          entry.id === draggingEntryId 
            ? { ...entry, date: format(targetDate, 'yyyy-MM-dd'), recurrence: 'none' } // Dropping makes it non-recurring
            : entry
        )
      );
    }
    setDraggingEntryId(null);
  };

  const monthlyTotals = useMemo(() => {
    const monthKey = format(currentMonth, 'yyyy-MM');
    const prevMonthKey = format(subMonths(currentMonth, 1), 'yyyy-MM');
    const previousMonthLeftover = (rollover === 'carryover' && monthlyLeftovers[prevMonthKey]) || 0;
    
    const entriesForCurrentMonth = generatedEntries.filter(e => isSameMonth(parseDateInTimezone(e.date, timezone), currentMonth));
    const monthlyBills = entriesForCurrentMonth.filter((e) => e.type === "bill").reduce((sum, e) => sum + e.amount, 0);
    const currentMonthIncome = entriesForCurrentMonth.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    
    const monthlyNet = currentMonthIncome - monthlyBills;
    const endOfMonthBalance = currentMonthIncome + previousMonthLeftover - monthlyBills;
    
    return {
        bills: monthlyBills, 
        income: currentMonthIncome, 
        net: monthlyNet, 
        endOfMonthBalance: endOfMonthBalance, 
        rollover: previousMonthLeftover,
        monthKey
    };
  }, [generatedEntries, currentMonth, rollover, monthlyLeftovers, timezone]);


  const Sidebar = () => (
    <SidebarContent 
      weeklyTotals={weeklyTotals}
      selectedDate={selectedDate}
    />
  )

  return (
    <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl sm:text-2xl font-bold">{format(currentMonth, "MMMM yyyy")}</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" onClick={toggleSelectionMode}>
                {isSelectionMode ? 'Cancel' : 'Select'}
              </Button>
               {isSelectionMode && selectedIds.length > 0 && (
                 <Button variant="destructive" onClick={onBulkDelete}>
                   <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedIds.length})
                 </Button>
                )}
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentMonth(new Date())} className="px-2 sm:px-4">Today</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-muted-foreground text-xs sm:text-sm">
            {WEEKDAYS.map((day) => (<div key={day}>{day}</div>))}
          </div>
          <div className="grid grid-cols-7 grid-rows-5 gap-1 mt-1">
            {daysWithEntries.map(({ day, entries: dayEntries }) => {
              const dayHasSelectedEntry = dayEntries.some(e => selectedIds.includes(getOriginalIdFromInstance(e.id)))
              return (
                <div
                  key={format(day, 'yyyy-MM-dd')}
                  className={cn(
                    "relative flex flex-col h-24 sm:h-32 rounded-lg p-1 sm:p-2 border transition-colors",
                    !isReadOnly && "cursor-pointer",
                    !isSameMonth(day, currentMonth) ? "bg-muted/50 text-muted-foreground" : "bg-card",
                    !isReadOnly && isSameMonth(day, currentMonth) && !isSelectionMode && "hover:bg-card/80",
                    isToday(day) && "border-primary",
                    isSameDay(day, selectedDate) && !isSelectionMode && "ring-2 ring-primary",
                    isSelectionMode && "hover:bg-primary/10",
                    isSelectionMode && dayHasSelectedEntry && "ring-2 ring-primary bg-primary/20",

                  )}
                  onClick={() => handleDayClick(day, dayEntries)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs sm:text-base">{format(day, "d")}</span>
                    {!isReadOnly && !isSelectionMode && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openNewEntryDialog(day); }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                    {isSelectionMode && dayEntries.length > 0 && (
                        <Checkbox 
                            className="h-5 w-5"
                            checked={dayEntries.every(e => selectedIds.includes(getOriginalIdFromInstance(e.id)))}
                        />
                    )}
                  </div>
                  <ScrollArea className="flex-1 mt-1">
                    <div className="space-y-1 text-[10px] sm:text-xs">
                      {dayEntries.map(entry => (
                          <div 
                              key={entry.id}
                              onClick={(e) => { e.stopPropagation(); openEditEntryDialog(entry); }}
                              onDragStart={(e) => handleDragStart(e, entry)}
                              draggable={!isReadOnly && !isSelectionMode && !entryIsRecurringInstance(entry.id)}
                              className={cn(
                                  "p-1 rounded-md truncate flex items-center gap-2",
                                  !entryIsRecurringInstance(entry.id) && !isReadOnly && !isSelectionMode && "cursor-grab active:cursor-grabbing",
                                  entry.type === 'bill' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground',
                                  draggingEntryId === entry.id && 'opacity-50',
                                  isSelectionMode && selectedIds.includes(getOriginalIdFromInstance(entry.id)) && "opacity-60",
                              )}
                          >
                            <span className="flex-1 truncate"><span className="hidden sm:inline">{entry.name}: </span>{formatCurrency(entry.amount)}</span>
                          </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
          <div className="mt-6 border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-center md:text-left">
                {format(currentMonth, "MMMM")} Summary
              </h2>
              <Button onClick={onOpenBreakdown} variant="outline" size="sm">
                <PieChart className="mr-2 h-4 w-4" /> View Breakdown
              </Button>
            </div>
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
                title="Rollover"
                amount={monthlyTotals.rollover}
                icon={<Repeat />}
                description="From previous month"
              />
              <SummaryCard
                title="Monthly Net"
                amount={monthlyTotals.net}
                variant={monthlyTotals.net >= 0 ? 'positive' : 'negative'}
                description="Income - Bills"
              />
              <SummaryCard
                title="End-of-Month Balance"
                amount={monthlyTotals.endOfMonthBalance}
                variant={monthlyTotals.endOfMonthBalance >= 0 ? 'positive' : 'negative'}
                className="md:col-span-2 lg:col-span-4"
                description="(Income + Rollover) - Bills"
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
  selectedDate,
}: {
  weeklyTotals: any;
  selectedDate: Date;
}) => (
  <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="space-y-4">
          <h3 className="font-semibold text-lg">Week of {format(startOfWeek(selectedDate), "MMM d")}</h3>
          <SummaryCard title="Income" amount={weeklyTotals.income} icon={<ArrowUp className="text-emerald-500" />} />
          <SummaryCard title="Bills Due" amount={weeklyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
          {weeklyTotals.rolloverApplied > 0 && (
              <SummaryCard title="Rollover Applied" amount={weeklyTotals.rolloverApplied} icon={<Repeat />} />
          )}
          <SummaryCard title="Weekly Net" amount={weeklyTotals.net} variant={weeklyTotals.net >= 0 ? 'positive' : 'negative'} />
      </div>
  </div>
);
