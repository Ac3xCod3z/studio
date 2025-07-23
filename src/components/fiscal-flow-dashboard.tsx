
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { useMedia } from "react-use";

import { EntryDialog } from "./entry-dialog";
import { SettingsDialog } from "./settings-dialog";
import { DayEntriesDialog } from "./day-entries-dialog";
import { MonthlyBreakdownDialog } from "./monthly-breakdown-dialog";
import { Logo } from "./icons";
import { Settings, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import type { Entry, RolloverPreference, MonthlyLeftovers } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "./fiscal-flow-calendar";
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO, isBefore, getDate, setDate, startOfWeek, endOfWeek, add, getDay, isSameDay, addMonths } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { recurrenceIntervalMonths } from "@/lib/constants";
import { ScrollArea } from "./ui/scroll-area";
import { scheduleNotifications, cancelAllNotifications } from "@/lib/notification-manager";
import { useToast } from "@/hooks/use-toast";

const generateRecurringInstances = (entry: Entry, start: Date, end: Date): Entry[] => {
    const instances: Entry[] = [];
    if (!entry.date) return [];
    const originalEntryDate = new Date(entry.date + 'T00:00:00');
    
    if (isBefore(end, originalEntryDate)) return [];

    if (entry.recurrence === 'weekly') {
        let currentDate = startOfWeek(originalEntryDate);
         while (isBefore(currentDate, start)) {
            currentDate = add(currentDate, { weeks: 1 });
        }

        while (isBefore(currentDate, end)) {
            if (currentDate >= start) {
                 instances.push({
                    ...entry,
                    date: format(currentDate, 'yyyy-MM-dd'),
                    id: `${entry.id}-${format(currentDate, 'yyyy-MM-dd')}` // Instance ID
                });
            }
            currentDate = add(currentDate, { weeks: 1 });
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

                if (isSameMonth(finalDate, recurringDate)) {
                    instances.push({ 
                        ...entry, 
                        date: format(finalDate, 'yyyy-MM-dd'), 
                        id: `${entry.id}-${format(finalDate, 'yyyy-MM-dd')}` 
                    });
                }
             }
             
             let nextDate = add(recurringDate, { months: recurrenceInterval });
             // If the next date is the same month (e.g. jumping from Jan 31 to Feb 28), ensure we don't get stuck
             if (isSameMonth(nextDate, recurringDate)) {
                 nextDate = add(startOfMonth(recurringDate), { months: recurrenceInterval + 1 });
             }
             recurringDate = nextDate;
        }
        return instances;
    }

    return [];
};


const parseDateInTimezone = (dateString: string, timeZone: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export default function FiscalFlowDashboard() {
  const [isClient, setIsClient] = useState(false);
  const [entries, setEntries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("fiscalFlowRollover", "carryover");
  const [timezone, setTimezone] = useLocalStorage<string>('fiscalFlowTimezone', 'UTC');
  const [monthlyLeftovers, setMonthlyLeftovers] = useLocalStorage<MonthlyLeftovers>("fiscalFlowLeftovers", {});
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fiscalFlowNotificationsEnabled', false);

  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isDayEntriesDialogOpen, setDayEntriesDialogOpen] = useState(false);
  const [isBreakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const isMobile = useMedia("(max-width: 1024px)", false);
  const { toast } = useToast();

  const handleNotificationsToggle = useCallback((enabled: boolean) => {
    setNotificationsEnabled(enabled);
  }, [setNotificationsEnabled]);

  useEffect(() => {
    if (isClient && notificationsEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        scheduleNotifications(entries, timezone, toast);
      } else {
        setNotificationsEnabled(false);
      }
    } else if (isClient && !notificationsEnabled) {
      cancelAllNotifications(toast);
    }
  }, [isClient, entries, timezone, notificationsEnabled, setNotificationsEnabled, toast]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!localStorage.getItem('fiscalFlowTimezone') && detectedTimezone) {
            setTimezone(detectedTimezone);
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
    setEntryDialogOpen(false);
    setEditingEntry(null);
  };

  const openNewEntryDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };
  
  const allGeneratedEntries = useMemo(() => {
    if (entries.length === 0) return [];
    
    const oldestEntry = entries.reduce((oldest, entry) => {
      const entryDate = new Date(entry.date);
      return entryDate < oldest ? entryDate : oldest;
    }, new Date());
    const start = startOfMonth(oldestEntry);
    const end = endOfMonth(add(new Date(), { years: 2 })); // Project 2 years into the future

    return entries.flatMap((e) => {
        const instances: Entry[] = [];
        if (e.recurrence === 'none') {
            instances.push(e);
        } else {
            instances.push(...generateRecurringInstances(e, start, end));
        }
        return instances;
    });
  }, [entries]);

  useEffect(() => {
    if (allGeneratedEntries.length === 0) {
        setMonthlyLeftovers({});
        return;
    }
    const oldestEntry = allGeneratedEntries.reduce((oldest, entry) => {
        const entryDate = new Date(entry.date);
        return entryDate < oldest ? entryDate : oldest;
    }, new Date());

    const start = startOfMonth(oldestEntry);
    const end = new Date(); 
    
    const newLeftovers: MonthlyLeftovers = {};
    let current = start;
    let lastMonthLeftover = 0;

    while(isBefore(current, end)) {
        const monthKey = format(current, 'yyyy-MM');
        
        const entriesForMonth = allGeneratedEntries.filter(e => isSameMonth(parseDateInTimezone(e.date, timezone), current));
        const income = entriesForMonth.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const bills = entriesForMonth.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
        
        const endOfMonthBalance = income + (rollover === 'carryover' ? lastMonthLeftover : 0) - bills;

        newLeftovers[monthKey] = endOfMonthBalance;
        lastMonthLeftover = endOfMonthBalance;
        
        current = addMonths(current, 1);
    }
    
    // Check if an update is actually needed to prevent infinite loops
    if (JSON.stringify(newLeftovers) !== JSON.stringify(monthlyLeftovers)) {
        setMonthlyLeftovers(newLeftovers);
    }
  }, [allGeneratedEntries, rollover, timezone, setMonthlyLeftovers]);


  const { entriesForCurrentMonthView, dayEntries, weeklyTotals} = useMemo(() => {
      if (!allGeneratedEntries.length) {
        return {
          entriesForCurrentMonthView: [],
          dayEntries: [],
          weeklyTotals: { income: 0, bills: 0, net: 0, rolloverApplied: 0 }
        };
      }
      const currentMonth = selectedDate;
      const calendarStart = startOfWeek(startOfMonth(currentMonth));
      const calendarEnd = endOfWeek(endOfMonth(currentMonth));

      const entriesForCurrentMonthView = allGeneratedEntries.filter(e => {
        const entryDate = parseDateInTimezone(e.date, timezone);
        return entryDate >= calendarStart && entryDate <= calendarEnd;
      });

      const dayEntries = entriesForCurrentMonthView.filter((e) => isSameDay(parseDateInTimezone(e.date, timezone), selectedDate));

      const weekStart = startOfWeek(selectedDate);
      const weekEnd = endOfWeek(selectedDate);
      const weekEntries = entriesForCurrentMonthView.filter(e => {
          const entryDate = parseDateInTimezone(e.date, timezone);
          return entryDate >= weekStart && entryDate <= weekEnd;
      });

      const weeklyIncome = weekEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
      const weeklyBills = weekEntries.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
      const initialWeeklyNet = weeklyIncome - weeklyBills;
      
      const prevMonthKey = format(subMonths(weekStart, 1), 'yyyy-MM');
      const startOfWeekLeftover = (rollover === 'carryover' && monthlyLeftovers[prevMonthKey]) || 0;

      let rolloverApplied = 0;
      if (initialWeeklyNet < 0 && startOfWeekLeftover > 0) {
          rolloverApplied = Math.min(Math.abs(initialWeeklyNet), startOfWeekLeftover);
      }
      
      const finalWeeklyNet = initialWeeklyNet + rolloverApplied;

      return {
        entriesForCurrentMonthView,
        dayEntries,
        weeklyTotals: {
            income: weeklyIncome,
            bills: weeklyBills,
            net: finalWeeklyNet,
            rolloverApplied,
        }
      }
  }, [selectedDate, allGeneratedEntries, timezone, rollover, monthlyLeftovers]);

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
                <ScrollArea className="flex-1">
                  <SidebarContent
                    weeklyTotals={weeklyTotals}
                    selectedDate={selectedDate}
                  />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      
      <FiscalFlowCalendar 
        entries={entries}
        setEntries={setEntries}
        generatedEntries={allGeneratedEntries}
        rollover={rollover}
        timezone={timezone}
        openNewEntryDialog={openNewEntryDialog}
        setEditingEntry={setEditingEntry}
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={setEntryDialogOpen}
        isMobile={isMobile}
        openDayEntriesDialog={() => setDayEntriesDialogOpen(true)}
        onOpenBreakdown={() => setBreakdownDialogOpen(true)}
        monthlyLeftovers={monthlyLeftovers}
        setMonthlyLeftovers={setMonthlyLeftovers}
        weeklyTotals={weeklyTotals}
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
      
      <DayEntriesDialog
        isOpen={isDayEntriesDialogOpen}
        onClose={() => setDayEntriesDialogOpen(false)}
        date={selectedDate}
        entries={dayEntries}
        onAddEntry={() => {
            setDayEntriesDialogOpen(false);
            openNewEntryDialog(selectedDate);
        }}
        onEditEntry={(entry) => {
            setDayEntriesDialogOpen(false);
            const originalEntry = entries.find(e => e.id === entry.id.split('-')[0]) || entry;
            setEditingEntry(originalEntry);
            setEntryDialogOpen(true);
        }}
      />

       <MonthlyBreakdownDialog
        isOpen={isBreakdownDialogOpen}
        onClose={() => setBreakdownDialogOpen(false)}
        entries={entries}
        currentMonth={selectedDate}
        timezone={timezone}
      />

      <SettingsDialog 
        isOpen={isSettingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        rolloverPreference={rollover}
        onRolloverPreferenceChange={setRollover}
        timezone={timezone}
        onTimezoneChange={setTimezone}
        onNotificationsToggle={handleNotificationsToggle}
      />
    </div>
  );
}

