"use client";

import React, { useState, useEffect, useMemo } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { useMedia } from "react-use";

import { EntryDialog } from "./entry-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Logo } from "./icons";
import { Settings, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import type { Entry, RolloverPreference } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "./fiscal-flow-calendar";
import { format, subMonths, startOfMonth, endOfMonth, eachWeekOfInterval, getWeek, isSameMonth, parseISO, isBefore, differenceInCalendarMonths, getDate, endOfWeek, getDay, eachDayOfInterval, setDate } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { recurrenceIntervalMonths } from "@/lib/constants";
import { ScrollArea } from "./ui/scroll-area";


export default function FiscalFlowDashboard() {
  const [isClient, setIsClient] = useState(false);
  const [entries, setEntries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("fiscalFlowRollover", "carryover");
  const [timezone, setTimezone] = useLocalStorage<string>('fiscalFlowTimezone', 'UTC');
  const [monthlyLeftovers, setMonthlyLeftovers] = useLocalStorage<any>("fiscalFlowLeftovers", {});

  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const isMobile = useMedia("(max-width: 1024px)", false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
        if (!localStorage.getItem('fiscalFlowTimezone')) {
            setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        }
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
              console.log('SW registered: ', registration);
            }).catch(registrationError => {
              console.log('SW registration failed: ', registrationError);
            });
          });
        }
    }
  }, [isClient, setTimezone]);

  const handleEntrySave = (entryData: Omit<Entry, "id"> & { id?: string }) => {
    setEntries((prev) => {
      if (entryData.id) {
        return prev.map((e) => (e.id === entryData.id ? { ...e, ...entryData } as Entry : e));
      }
      return [...prev, { ...entryData, id: crypto.randomUUID() } as Entry];
    });
  };

  const handleEntryDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const openNewEntryDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };
  
  const parseDateInTimezone = (dateString: string, timeZone: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
  };

  const mobileSummaryData = useMemo(() => {
    if (!isMobile) return null;

    const currentMonth = selectedDate; // Use selected date for context
    const monthKey = format(currentMonth, 'yyyy-MM');
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthKey = format(prevMonth, 'yyyy-MM');
    const previousMonthLeftover = (rollover === 'carryover' && monthlyLeftovers[prevMonthKey]) || 0;

    const entriesForCurrentMonth = entries.flatMap((e) => {
      const originalEntryDate = parseISO(e.date);

      if (isBefore(startOfMonth(currentMonth), startOfMonth(originalEntryDate))) {
        return [];
      }
      
      if (e.recurrence === 'weekly') {
        const originalDayOfWeek = getDay(originalEntryDate);
        const daysInCurrentMonth = eachDayOfInterval({
          start: startOfMonth(currentMonth),
          end: endOfMonth(currentMonth),
        });

        return daysInCurrentMonth
          .filter(day => getDay(day) === originalDayOfWeek)
          .map(recurringDate => ({
            ...e,
            date: format(recurringDate, 'yyyy-MM-dd'),
            id: `${e.id}-${format(recurringDate, 'yyyy-MM-dd')}`
          }));
      }

      const recurrenceInterval = e.recurrence ? recurrenceIntervalMonths[e.recurrence] : 0;
      if (e.recurrence && e.recurrence !== 'none' && recurrenceInterval > 0) {
        const monthDiff = differenceInCalendarMonths(currentMonth, originalEntryDate);
        if (monthDiff < 0 || monthDiff % recurrenceInterval !== 0) {
            return [];
        }
        
        const lastDayOfCurrentMonth = endOfMonth(currentMonth).getDate();
        const originalDay = getDate(originalEntryDate);
        const dayForCurrentMonth = Math.min(originalDay, lastDayOfCurrentMonth);
        const recurringDate = setDate(currentMonth, dayForCurrentMonth);
        
        return [{ ...e, date: format(recurringDate, 'yyyy-MM-dd'), id: `${e.id}-${format(recurringDate, 'yyyy-MM-dd')}` }];
      }
      
      const entryDate = parseDateInTimezone(e.date, timezone);
      if (isSameMonth(entryDate, currentMonth)) {
        return [e];
      }
      return [];
    });
    
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

        return { week: getWeek(weekStart), income, bills, net: net + rolloverApplied, rolloverApplied };
    });

    const selectedWeekData = weeksData.find(w => getWeek(selectedDate) === w.week) || {
        week: getWeek(selectedDate), income: 0, bills: 0, net: 0, rolloverApplied: 0
    };

    return {
      weeklyTotals: selectedWeekData,
    };
  }, [isMobile, selectedDate, entries, rollover, monthlyLeftovers, timezone]);


  if (!isClient) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
            <div className="flex items-center gap-2">
                <Logo className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">FiscalFlow</span>
            </div>
            <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-28 hidden md:flex" />
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-10 md:hidden" />
            </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
             <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <Skeleton className="h-8 w-48 mb-4" />
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 35 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-lg" />
                    ))}
                </div>
             </main>
             <aside className="w-[350px] border-l overflow-y-auto p-6 hidden lg:block">
                <Skeleton className="h-8 w-32 mb-6" />
                <Skeleton className="h-24 w-full mb-4" />
                <Skeleton className="h-24 w-full" />
             </aside>
        </div>
      </div>
    );
  }

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
          <Button onClick={() => setSettingsDialogOpen(true)} variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
          {isMobile && (
            <Sheet open={isMobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                  <Button variant="ghost" size="icon"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col">
                 <SheetHeader className="p-4 md:p-6 border-b shrink-0">
                    <SheetTitle>Summary</SheetTitle>
                    <SheetDescription>
                        Weekly summary for {format(selectedDate, "MMM d, yyyy")}.
                    </SheetDescription>
                </SheetHeader>
                  {mobileSummaryData && (
                    <ScrollArea className="flex-1">
                      <SidebarContent
                        weeklyTotals={mobileSummaryData.weeklyTotals}
                        isMobile={true}
                        selectedDate={selectedDate}
                      />
                    </ScrollArea>
                  )}
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      
      <FiscalFlowCalendar 
        entries={entries}
        setEntries={setEntries}
        rollover={rollover}
        timezone={timezone}
        openNewEntryDialog={openNewEntryDialog}
        setEditingEntry={setEditingEntry}
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={setEntryDialogOpen}
        isMobile={isMobile}
        openMobileSheet={() => setMobileSheetOpen(true)}
      />
      
      <EntryDialog 
        isOpen={isEntryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        onSave={handleEntrySave}
        onDelete={handleEntryDelete}
        entry={editingEntry}
        selectedDate={selectedDate}
        timezone={timezone}
      />
      
      <SettingsDialog 
        isOpen={isSettingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        rolloverPreference={rollover}
        onRolloverPreferenceChange={setRollover}
        timezone={timezone}
        onTimezoneChange={setTimezone}
      />
    </div>
  );
}
