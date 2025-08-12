
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { useMedia } from "react-use";

import { EntryDialog } from "./entry-dialog";
import { SettingsDialog } from "./settings-dialog";
import { DayEntriesDialog } from "./day-entries-dialog";
import { MonthlyBreakdownDialog } from "./monthly-breakdown-dialog";
import { MonthlySummaryDialog } from "./monthly-summary-dialog";
import { CalculatorDialog } from "./calculator-dialog"; // Import the new component
import { Logo } from "./icons";
import { Settings, Menu, Plus, Trash2, BarChartBig, PieChart, CheckCircle2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Entry, RolloverPreference, WeeklyBalances, SelectedInstance } from "@/lib/types";
import { CentseiCalendar, SidebarContent } from "./centsei-calendar";
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, isBefore, getDate, setDate, startOfWeek, endOfWeek, add, getDay, isSameDay, addMonths, parseISO, differenceInCalendarMonths, isAfter, eachWeekOfInterval, lastDayOfMonth, set } from "date-fns";
import { toZonedTime } from 'date-fns-tz';
import { recurrenceIntervalMonths } from "@/lib/constants";
import { ScrollArea } from "./ui/scroll-area";
import { scheduleNotifications, cancelAllNotifications } from "@/lib/notification-manager";
import { useToast } from "@/hooks/use-toast";

const generateRecurringInstances = (entry: Entry, start: Date, end: Date, timezone: string): Entry[] => {
    if (!entry.date) return [];

    const nowInTimezone = toZonedTime(new Date(), timezone);
    const todayInTimezone = set(nowInTimezone, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });
    
    // A map to hold final instances, ensuring no duplicate dates.
    const instanceMap = new Map<string, Entry>();

    const createInstance = (date: Date, overridePaidStatus?: boolean): Entry => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const exception = entry.exceptions?.[dateStr];
        
        let isPaid = overridePaidStatus ?? false;

        if (exception && typeof exception.isPaid === 'boolean') {
            isPaid = exception.isPaid;
        } else if (entry.recurrence === 'none') {
            isPaid = entry.isPaid ?? false;
        } else {
            const isPast = isBefore(date, todayInTimezone);
            const isToday = isSameDay(date, todayInTimezone);
            const isAfter9AM = nowInTimezone.getHours() >= 9;

            if (isPast) {
                isPaid = entry.type === 'income' || !!entry.isAutoPay;
            } else if (isToday && isAfter9AM) {
                isPaid = entry.type === 'income' || !!entry.isAutoPay;
            }
        }
        
        return {
            ...entry,
            date: dateStr,
            id: `${entry.id}-${dateStr}`,
            isPaid: isPaid,
            order: exception?.order ?? entry.order,
        };
    };

    const potentialDates: Date[] = [];
    if (entry.recurrence === 'none') {
        const entryDate = parseISO(entry.date);
        if (entryDate >= start && entryDate <= end) {
            potentialDates.push(entryDate);
        }
    } else {
        const originalEntryDate = parseISO(entry.date);
        const recurrenceInterval = entry.recurrence ? recurrenceIntervalMonths[entry.recurrence] : 0;
        if (recurrenceInterval > 0) {
            let currentDate = originalEntryDate;
            
            if (isBefore(currentDate, start)) {
                const monthsDiff = differenceInCalendarMonths(start, currentDate);
                const numIntervals = Math.max(0, Math.floor(monthsDiff / recurrenceInterval));
                if (numIntervals > 0) {
                    currentDate = add(currentDate, { months: numIntervals * recurrenceInterval });
                }
            }
            while (isBefore(currentDate, start)) {
                currentDate = add(currentDate, { months: recurrenceInterval });
            }
            
            while (currentDate <= end) {
                const originalDay = getDate(originalEntryDate);
                const lastDayInCurrentMonth = lastDayOfMonth(currentDate).getDate();
                const dayForMonth = Math.min(originalDay, lastDayInCurrentMonth);
                const finalDate = setDate(currentDate, dayForMonth);

                if (finalDate >= start && finalDate <= end && isSameMonth(finalDate, currentDate)) {
                    potentialDates.push(finalDate);
                }
                currentDate = add(currentDate, { months: recurrenceInterval });
            }
        } else if (entry.recurrence === 'weekly' || entry.recurrence === 'bi-weekly') {
             const weeksToAdd = entry.recurrence === 'weekly' ? 1 : 2;
             let currentDate = originalEntryDate;
             while (isBefore(currentDate, start)) {
                 currentDate = add(currentDate, { weeks: weeksToAdd });
             }
             while (currentDate <= end) {
                 if (currentDate >= start) {
                    potentialDates.push(currentDate);
                 }
                 currentDate = add(currentDate, { weeks: weeksToAdd });
             }
        }
    }

    potentialDates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!instanceMap.has(dateStr)) {
            const instance = createInstance(date, entry.exceptions?.[dateStr]?.isPaid);
            instanceMap.set(dateStr, instance);
        }
    });
    
    if (entry.exceptions) {
        Object.entries(entry.exceptions).forEach(([dateStr, exception]) => {
             const exceptionDate = parseISO(dateStr);
             if (exceptionDate >= start && exceptionDate <= end) {
                const existingInstance = instanceMap.get(dateStr);
                if (existingInstance) {
                    // Update existing instance with exception data
                    if (exception.isPaid !== undefined) existingInstance.isPaid = exception.isPaid;
                    if (exception.order !== undefined) existingInstance.order = exception.order;
                } else {
                    // This could be a moved entry, or a paid instance from the past we want to preserve
                     instanceMap.set(dateStr, {
                        ...entry,
                        date: dateStr,
                        id: `${entry.id}-${dateStr}`,
                        isPaid: exception.isPaid ?? false,
                        order: exception.order ?? entry.order,
                    });
                }
             }

             if (exception.movedTo) {
                const movedToDate = parseISO(exception.movedTo);
                if (movedToDate >= start && movedToDate <= end && !instanceMap.has(exception.movedTo)) {
                    instanceMap.set(exception.movedTo, {
                        ...entry,
                        id: `${entry.id}-${exception.movedTo}`,
                        date: exception.movedTo,
                        isPaid: exception.isPaid ?? false,
                        order: exception.order ?? entry.order,
                    });
                }
             }
        });
    }

    return Array.from(instanceMap.values());
};


const parseDateInTimezone = (dateString: string, timeZone: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export default function CentseiDashboard() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("centseiEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("centseiRollover", "carryover");
  const [timezone, setTimezone] = useLocalStorage<string>('centseiTimezone', 'UTC');
  const [weeklyBalances, setWeeklyBalances] = useLocalStorage<WeeklyBalances>("centseiWeeklyBalances", {});
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('centseiNotificationsEnabled', false);

  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isDayEntriesDialogOpen, setDayEntriesDialogOpen] = useState(false);
  const [isBreakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [isCalculatorDialogOpen, setCalculatorDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useMedia("(max-width: 1024px)", false);
  const { toast } = useToast();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedInstances, setSelectedInstances] = useState<SelectedInstance[]>([]);
  const [isBulkDeleteAlertOpen, setBulkDeleteAlertOpen] = useState(false);
  const [isBulkCompleteAlertOpen, setBulkCompleteAlertOpen] = useState(false);
  const [moveOperation, setMoveOperation] = useState<{ entry: Entry, newDate: string } | null>(null);


  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev);
    setSelectedInstances([]);
  }, []);

  const handleBulkDelete = () => {
    const masterIdsToDelete = [...new Set(selectedInstances.map(i => i.masterId))];
    setEntries(prev => prev.filter(e => !masterIdsToDelete.includes(e.id)));
    toggleSelectionMode();
    setBulkDeleteAlertOpen(false);
    toast({ title: `${selectedInstances.length} entries deleted.` });
  };
  
  const getOriginalIdFromInstance = (instanceId: string) => {
    const parts = instanceId.split('-');
    if (parts.length > 5) { // Assuming UUID is 5 parts for master
        return parts.slice(0, 5).join('-');
    }
    return instanceId; // It's likely a non-recurring master ID
  }

  const handleConfirmMove = () => {
    if (!moveOperation) return;

    const { entry: movedEntry, newDate } = moveOperation;
    const masterId = getOriginalIdFromInstance(movedEntry.id);
    const originalDateStr = movedEntry.date;

    setEntries(prevEntries => {
        const masterEntryIndex = prevEntries.findIndex(e => e.id === masterId);
        if (masterEntryIndex === -1) return prevEntries;

        const updatedEntries = [...prevEntries];
        const masterEntry = { ...updatedEntries[masterEntryIndex] };
        
        if (masterEntry.recurrence === 'none') {
            // Simple date change for non-recurring entries
            masterEntry.date = newDate;
        } else {
            // It's a recurring entry, create an exception
             masterEntry.exceptions = {
                ...masterEntry.exceptions,
                [originalDateStr]: {
                    ...masterEntry.exceptions?.[originalDateStr],
                    movedTo: newDate
                }
            };
        }
        
        updatedEntries[masterEntryIndex] = masterEntry;
        return updatedEntries;
    });

    setMoveOperation(null);
    toast({ title: "Entry Moved", description: `Moved "${movedEntry.name}" to ${format(parseISO(newDate), 'PPP')}.` });
  };
  
  const handleBulkMarkAsComplete = () => {
    setEntries(prev => {
        const updatedEntries = [...prev];
        selectedInstances.forEach(instance => {
            const masterEntryIndex = updatedEntries.findIndex(e => e.id === instance.masterId);
            if (masterEntryIndex !== -1) {
                const masterEntry = updatedEntries[masterEntryIndex];
                if (masterEntry.recurrence !== 'none') {
                    // It's a recurring entry, add an exception
                    const updatedExceptions = { ...masterEntry.exceptions, [instance.date]: { ...masterEntry.exceptions?.[instance.date], isPaid: true } };
                    updatedEntries[masterEntryIndex] = { ...masterEntry, exceptions: updatedExceptions };
                } else {
                    // It's a non-recurring entry
                    updatedEntries[masterEntryIndex] = { ...masterEntry, isPaid: true };
                }
            }
        });
        return updatedEntries;
    });
    setBulkCompleteAlertOpen(false);
    toast({ title: `${selectedInstances.length} entries marked as complete.`});
    toggleSelectionMode();
  };

  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
  };
  
  useEffect(() => {
    if (!isMounted) return;
    if (notificationsEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        scheduleNotifications(entries, timezone, toast);
      } else {
        // This case might happen if permissions are revoked after being enabled.
        setNotificationsEnabled(false);
      }
    } else {
      cancelAllNotifications(toast);
    }
  }, [entries, timezone, notificationsEnabled, setNotificationsEnabled, toast, isMounted]);


  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered with scope:', registration.scope);
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      }
    };
    registerServiceWorker();

    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!localStorage.getItem('centseiTimezone') && detectedTimezone) {
        setTimezone(detectedTimezone);
    }
  }, [setTimezone]);


  const handleEntrySave = (entryData: Omit<Entry, "id" | 'date'> & { id?: string; date: Date, originalDate?: string }) => {
    const formattedDate = format(entryData.date, 'yyyy-MM-dd');
    
    setEntries(prev => {
        let prevEntries = [...prev];
        if (entryData.id) {
            // This is an existing entry, find it
            const entryIndex = prevEntries.findIndex(e => e.id === entryData.id);
            if (entryIndex === -1) return prev;

            const updatedEntries = [...prevEntries];
            const originalEntry = updatedEntries[entryIndex];
            
            const isRecurring = originalEntry.recurrence !== 'none';
            
            // If it's a recurring entry and we are changing its paid status
            if (isRecurring && typeof entryData.isPaid === 'boolean' && entryData.originalDate) {
                const updatedExceptions = { ...originalEntry.exceptions };

                if (entryData.isPaid) {
                  updatedExceptions[entryData.originalDate] = { ...updatedExceptions[entryData.originalDate], isPaid: true };
                } else {
                  // If unchecking, remove the paid status but keep other exception data
                  if (updatedExceptions[entryData.originalDate]) {
                    delete updatedExceptions[entryData.originalDate].isPaid;
                    // If no other exception properties exist, remove the exception object
                    if(Object.keys(updatedExceptions[entryData.originalDate]).length === 0){
                        delete updatedExceptions[entryData.originalDate]
                    }
                  }
                }
                
                updatedEntries[entryIndex] = {
                    ...originalEntry,
                    ...entryData,
                    date: formattedDate, // The master date might change
                    exceptions: updatedExceptions,
                    isPaid: originalEntry.isPaid, // Keep master isPaid unchanged
                };
            } else {
                 // For non-recurring entries or other property changes
                updatedEntries[entryIndex] = {
                    ...originalEntry,
                    ...entryData,
                    date: formattedDate,
                };
            }
            return updatedEntries;
        }
        
        // This is a new entry
        const entriesForDate = prevEntries.filter(e => e.date === formattedDate);
        const newEntry: Entry = {
            ...entryData,
            id: crypto.randomUUID(),
            order: entriesForDate.length,
            date: formattedDate,
            recurrence: entryData.recurrence,
        };
        
        return [...prevEntries, newEntry];
    });
  };

  const handleEntryDelete = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setEntryDialogOpen(false);
    setEditingEntry(null);
  };
  
  const handleEntryCopy = (entryToCopy: Entry) => {
    setEditingEntry({
      ...entryToCopy,
      // Clear the ID to indicate it's a new entry
      id: '', 
      // Reset paid status for the copy
      isPaid: false, 
    });
    // The dialog useEffect will handle resetting the date to selectedDate
    setEntryDialogOpen(true);
  };

  const openNewEntryDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };
  
  const allGeneratedEntries = useMemo(() => {
    if (!isMounted || entries.length === 0) return [];
    
    const viewStart = startOfMonth(subMonths(new Date(), 6));
    const viewEnd = endOfMonth(addMonths(new Date(), 12));

    return entries.flatMap((e) => generateRecurringInstances(e, viewStart, viewEnd, timezone));
  }, [entries, isMounted, timezone]);

  useEffect(() => {
    if (!isMounted) return;

    const newWeeklyBalances: WeeklyBalances = {};
    if (allGeneratedEntries.length > 0) {
        const sortedEntries = allGeneratedEntries.sort((a,b) => a.date.localeCompare(b.date));
        
        const firstDate = parseISO(sortedEntries[0].date);
        const lastDate = parseISO(sortedEntries[sortedEntries.length - 1].date);
        
        const weeks = eachWeekOfInterval({ start: firstDate, end: lastDate });
        let lastWeekBalance = 0;

        weeks.forEach(weekStart => {
            const weekEnd = endOfWeek(weekStart);
            const weekKey = format(weekStart, 'yyyy-MM-dd');

            const entriesForWeek = allGeneratedEntries.filter(e => {
                const entryDate = parseDateInTimezone(e.date, timezone);
                return entryDate >= weekStart && entryDate <= weekEnd;
            });
            
            const income = entriesForWeek.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
            const bills = entriesForWeek.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
            
            let currentWeekStartBalance = lastWeekBalance;
            if (rollover === 'reset' && getDay(weekStart) === startOfWeek(new Date()).getDay() && weekStart.getDate() <= 7) {
                // Logic for monthly reset if needed, currently not fully implemented
            }

            const endOfWeekBalance = currentWeekStartBalance + income - bills;
            newWeeklyBalances[weekKey] = { start: currentWeekStartBalance, end: endOfWeekBalance };
            lastWeekBalance = endOfWeekBalance;
        });
    }
    
    if (JSON.stringify(newWeeklyBalances) !== JSON.stringify(weeklyBalances)) {
        setWeeklyBalances(newWeeklyBalances);
    }

  }, [isMounted, allGeneratedEntries, timezone, rollover, setWeeklyBalances, weeklyBalances]);


  const { dayEntries, weeklyTotals, monthlySummary} = useMemo(() => {
      if (!allGeneratedEntries.length) {
        return {
          dayEntries: [],
          weeklyTotals: { income: 0, bills: 0, net: 0, startOfWeekBalance: 0, status: 0 },
          monthlySummary: { income: 0, bills: 0, net: 0, startOfMonthBalance: 0, endOfMonthBalance: 0 }
        };
      }

      const dayEntries = allGeneratedEntries.filter((e) => isSameDay(parseDateInTimezone(e.date, timezone), selectedDate));
      
      const weekStart = startOfWeek(selectedDate);
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      const weekBalanceInfo = weeklyBalances[weekKey];
      const startOfWeekBalance = weekBalanceInfo ? weekBalanceInfo.start : 0;
      const endOfWeekBalance = weekBalanceInfo ? weekBalanceInfo.end : 0;

      const weekEntries = allGeneratedEntries.filter(e => {
          const entryDate = parseDateInTimezone(e.date, timezone);
          return entryDate >= weekStart && entryDate <= endOfWeek(weekStart);
      });

      const weeklyIncome = weekEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
      const weeklyBills = weekEntries.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
      const weeklyStatus = weeklyIncome - weeklyBills;

      // Monthly Summary Calculation
      const monthStart = startOfMonth(selectedDate);
      
      const monthEntries = allGeneratedEntries.filter(e => isSameMonth(parseDateInTimezone(e.date, timezone), selectedDate));
      const monthlyIncome = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const monthlyBills = monthEntries.filter(e => e.type === 'bill').reduce((s, e) => s + e.amount, 0);

      const firstWeekOfMonthKey = format(startOfWeek(monthStart), 'yyyy-MM-dd');
      const startOfMonthBalance = weeklyBalances[firstWeekOfMonthKey]?.start || 0;
      
      const endOfMonthBalance = startOfMonthBalance + monthlyIncome - monthlyBills;

      return {
        dayEntries,
        weeklyTotals: {
            income: weeklyIncome,
            bills: weeklyBills,
            net: endOfWeekBalance,
            startOfWeekBalance: startOfWeekBalance,
            status: weeklyStatus,
        },
        monthlySummary: {
            income: monthlyIncome,
            bills: monthlyBills,
            net: monthlyIncome - monthlyBills,
            startOfMonthBalance: startOfMonthBalance,
            endOfMonthBalance,
        }
      }
  }, [selectedDate, allGeneratedEntries, timezone, weeklyBalances]);


  if (!isMounted) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
            <div className="flex items-center gap-2">
                <Logo />
                 <h1 className="text-xl font-bold tracking-tight hidden md:block">Centsei</h1>
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
            <Logo />
            <h1 className="text-xl font-bold tracking-tight hidden md:block">Centsei</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isSelectionMode && (
            <Button onClick={() => openNewEntryDialog(new Date())} size="sm" className="hidden md:flex">
              <Plus className="-ml-1 mr-2 h-4 w-4" /> Add Entry
            </Button>
          )}
           <Button onClick={() => setSummaryDialogOpen(true)} variant="outline" size="sm" className="hidden md:flex">
              <BarChartBig className="mr-2 h-4 w-4" /> Monthly Summary
            </Button>
            <Button onClick={() => setBreakdownDialogOpen(true)} variant="outline" size="sm" className="hidden md:flex">
              <PieChart className="mr-2 h-4 w-4" /> Category Breakdown
            </Button>
           {isSelectionMode && selectedInstances.length > 0 && (
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setBulkCompleteAlertOpen(true)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Complete ({selectedInstances.length})
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteAlertOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedInstances.length})
                </Button>
            </div>
           )}
          <Button onClick={() => setCalculatorDialogOpen(true)} variant="ghost" size="icon">
            <Calculator className="h-5 w-5" />
          </Button>
          <Button onClick={() => setSettingsDialogOpen(true)} variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>


          {isMobile && (
            <Sheet open={isMobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                  <Button variant="ghost" size="icon"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0 flex flex-col bg-secondary/30">
                 <SheetHeader className="p-4 md:p-6 border-b shrink-0 bg-background">
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
                   <div className="p-4 flex flex-col gap-2 border-t">
                     <Button onClick={() => { setSummaryDialogOpen(true); setMobileSheetOpen(false); }} variant="outline" className="w-full">
                        <BarChartBig className="mr-2 h-4 w-4" /> Monthly Summary
                    </Button>
                     <Button onClick={() => { setBreakdownDialogOpen(true); setMobileSheetOpen(false); }} variant="outline" className="w-full">
                        <PieChart className="mr-2 h-4 w-4" /> Category Breakdown
                    </Button>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      
      <CentseiCalendar 
        entries={entries}
        setEntries={setEntries}
        generatedEntries={allGeneratedEntries}
        timezone={timezone}
        openNewEntryDialog={openNewEntryDialog}
        setEditingEntry={setEditingEntry}
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={setEntryDialogOpen}
        openDayEntriesDialog={() => setDayEntriesDialogOpen(true)}
        weeklyBalances={weeklyBalances}
        weeklyTotals={weeklyTotals}
        isSelectionMode={isSelectionMode}
        toggleSelectionMode={toggleSelectionMode}
        selectedInstances={selectedInstances}
        setSelectedInstances={setSelectedInstances}
        onBulkDelete={() => setBulkDeleteAlertOpen(true)}
        onMoveRequest={(entry, newDate) => setMoveOperation({ entry, newDate })}
      />
      
      <EntryDialog 
        isOpen={isEntryDialogOpen}
        onClose={() => setEntryDialogOpen(false)}
        onSave={handleEntrySave}
        onDelete={handleEntryDelete}
        onCopy={handleEntryCopy}
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
            setEditingEntry(entry);
            setEntryDialogOpen(true);
        }}
      />

       <MonthlyBreakdownDialog
        isOpen={isBreakdownDialogOpen}
        onClose={() => setBreakdownDialogOpen(false)}
        entries={allGeneratedEntries}
        currentMonth={selectedDate}
        timezone={timezone}
      />
      
       <MonthlySummaryDialog
        isOpen={isSummaryDialogOpen}
        onClose={() => setSummaryDialogOpen(false)}
        summary={monthlySummary}
        currentMonth={selectedDate}
      />

      <CalculatorDialog
        isOpen={isCalculatorDialogOpen}
        onClose={() => setCalculatorDialogOpen(false)}
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

       <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setBulkDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected {selectedInstances.length} entries from your calendar. This will remove the original entry and all of its future recurring instances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isBulkCompleteAlertOpen} onOpenChange={setBulkCompleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Complete</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the {selectedInstances.length} selected entries as complete. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkMarkAsComplete}>
              Mark as Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={!!moveOperation} onOpenChange={(isOpen) => !isOpen && setMoveOperation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Move</AlertDialogTitle>
            <AlertDialogDescription>
                This will move the entry and all its future recurrences. Are you sure you want to move <strong>{moveOperation?.entry.name}</strong> to <strong>{moveOperation && format(parseISO(moveOperation.newDate), 'PPP')}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMoveOperation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMove}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
