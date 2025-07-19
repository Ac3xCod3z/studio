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
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Settings, Menu, ArrowUp, ArrowDown } from "lucide-react";
import { useMedia } from "react-use";

import useLocalStorage from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { EntryDialog } from "./entry-dialog";
import { RolloverDialog } from "./rollover-dialog";
import { Logo } from "./icons";
import { cn, formatCurrency } from "@/lib/utils";
import type { Entry, RolloverPreference, MonthlyLeftovers } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FiscalFlowDashboard() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("fiscalFlowRollover", "carryover");
  const [monthlyLeftovers, setMonthlyLeftovers] = useLocalStorage<MonthlyLeftovers>("fiscalFlowLeftovers", {});
  
  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isRolloverDialogOpen, setRolloverDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const isMobile = useMedia("(max-width: 768px)", false);

  const daysInMonth = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const { monthlyTotals, weeklyTotals, previousMonthLeftover } = useMemo(() => {
    const monthKey = format(currentMonth, 'yyyy-MM');
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthKey = format(prevMonth, 'yyyy-MM');
    const previousMonthLeftover = (rollover === 'carryover' && monthlyLeftovers[prevMonthKey]) || 0;

    const currentMonthEntries = entries.filter((e) => isSameMonth(new Date(e.date), currentMonth));
    const monthlyBills = currentMonthEntries.filter((e) => e.type === "bill").reduce((sum, e) => sum + e.amount, 0);
    const monthlyIncome = currentMonthEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0) + previousMonthLeftover;
    const monthlyNet = monthlyIncome - monthlyBills;

    const start = startOfWeek(selectedDate);
    const end = endOfWeek(selectedDate);
    const weekEntries = entries.filter(e => {
        const entryDate = new Date(e.date);
        return entryDate >= start && entryDate <= end;
    });

    const weeklyBills = weekEntries.filter((e) => e.type === "bill").reduce((sum, e) => sum + e.amount, 0);
    const weeklyIncome = weekEntries.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    const weeklyNet = weeklyIncome - weeklyBills;
    
    return {
      monthlyTotals: { bills: monthlyBills, income: monthlyIncome, net: monthlyNet, monthKey },
      weeklyTotals: { bills: weeklyBills, income: weeklyIncome, net: weeklyNet, week: getWeek(selectedDate) },
      previousMonthLeftover
    };
  }, [entries, currentMonth, selectedDate, rollover, monthlyLeftovers]);

  useEffect(() => {
    const { monthKey, net } = monthlyTotals;
    if (monthlyLeftovers[monthKey] !== net) {
      setMonthlyLeftovers(prev => ({...prev, [monthKey]: net }));
    }
  }, [monthlyTotals, setMonthlyLeftovers, monthlyLeftovers]);

  const handleEntrySave = useCallback((entryData: Omit<Entry, "id"> & { id?: string }) => {
    setEntries((prev) => {
      if (entryData.id) {
        return prev.map((e) => (e.id === entryData.id ? { ...e, ...entryData } : e));
      }
      return [...prev, { ...entryData, id: crypto.randomUUID() }];
    });
  }, [setEntries]);

  const handleEntryDelete = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, [setEntries]);

  const openNewEntryDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };
  
  const openEditEntryDialog = (entry: Entry) => {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  }

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
            <SummaryCard title="Total Income" amount={monthlyTotals.income} icon={<ArrowUp className="text-emerald-500" />} description={previousMonthLeftover > 0 ? `${formatCurrency(previousMonthLeftover)} rolled over` : undefined} />
            <SummaryCard title="Total Bills" amount={monthlyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
            <SummaryCard title="Monthly Net" amount={monthlyTotals.net} variant={monthlyTotals.net >= 0 ? 'positive' : 'negative'} />
        </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">FiscalFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => openNewEntryDialog(new Date())} size="sm" className="hidden md:flex">
            <Plus className="-ml-1 mr-2 h-4 w-4" /> Add Entry
          </Button>
          <Button onClick={() => setRolloverDialogOpen(true)} variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
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
      </header>

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
              const dayEntries = entries.filter((e) => isSameDay(new Date(e.date), day));
              return (
                <div
                  key={day.toString()}
                  className={cn(
                    "relative flex flex-col h-32 rounded-lg p-2 border transition-colors cursor-pointer",
                    !isSameMonth(day, currentMonth) ? "bg-muted/50 text-muted-foreground" : "bg-card hover:bg-card/80",
                    isToday(day) && "border-primary",
                    isSameDay(day, selectedDate) && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{format(day, "d")}</span>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openNewEntryDialog(day); }}>
                        <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto mt-1 space-y-1 text-xs">
                    {dayEntries.map(entry => (
                        <div key={entry.id} onClick={(e) => { e.stopPropagation(); openEditEntryDialog(entry); }}
                            className={cn(
                                "p-1 rounded-md truncate",
                                entry.type === 'bill' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SummaryCard
                title="Total Income"
                amount={monthlyTotals.income}
                icon={<ArrowUp className="text-emerald-500" />}
                description={previousMonthLeftover > 0 ? `${formatCurrency(previousMonthLeftover)} rolled over` : undefined}
              />
              <SummaryCard
                title="Total Bills"
                amount={monthlyTotals.bills}
                icon={<ArrowDown className="text-destructive" />}
              />
              <SummaryCard
                title="Month Net"
                amount={monthlyTotals.net}
                variant={monthlyTotals.net >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>
        </main>
        {!isMobile && (
          <aside className="w-[350px] border-l overflow-y-auto">
            <SidebarContent />
          </aside>
        )}
      </div>

      <EntryDialog 
        isOpen={isEntryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        onSave={handleEntrySave}
        onDelete={handleEntryDelete}
        entry={editingEntry}
        selectedDate={selectedDate}
      />
      
      <RolloverDialog 
        isOpen={isRolloverDialogOpen}
        onClose={() => setRolloverDialogOpen(false)}
        preference={rollover}
        onPreferenceChange={setRollover}
      />
    </div>
  );
}

function SummaryCard({ title, amount, icon, description, variant = 'default' }: { title: string, amount: number, icon?: React.ReactNode, description?: string, variant?: 'default' | 'positive' | 'negative' }) {
    const amountColor = variant === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : variant === 'negative' ? 'text-destructive' : '';
    return (
        <Card>
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

    