

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { useMedia } from "react-use";
import { auth } from "@/lib/firebase";
import type { User } from "firebase/auth";
import { getRedirectResult, signOut } from "firebase/auth";

import { EntryDialog } from "./entry-dialog";
import { SettingsDialog } from "./settings-dialog";
import { DayEntriesDialog } from "./day-entries-dialog";
import { MonthlyBreakdownDialog } from "./monthly-breakdown-dialog";
import { MonthlySummaryDialog } from "./monthly-summary-dialog";
import { Logo } from "./icons";
import { Settings, Menu, Plus, CalendarSync, Loader2, LogOut, Trash2, BarChartBig, PieChart, Repeat } from "lucide-react";
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
import type { Entry, RolloverPreference, WeeklyBalances } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "./fiscal-flow-calendar";
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, isBefore, getDate, setDate, startOfWeek, endOfWeek, add, getDay, isSameDay, addMonths, parseISO, differenceInCalendarMonths, isAfter, eachWeekOfInterval, getWeek, lastDayOfMonth } from "date-fns";
import { toZonedTime } from 'date-fns-tz';
import { recurrenceIntervalMonths } from "@/lib/constants";
import { ScrollArea } from "./ui/scroll-area";
import { scheduleNotifications, cancelAllNotifications } from "@/lib/notification-manager";
import { useToast } from "@/hooks/use-toast";
import { syncToGoogleCalendar } from "@/ai/flows/sync-to-google-calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


const generateRecurringInstances = (entry: Entry, start: Date, end: Date): Entry[] => {
    const instances: Entry[] = [];
    if (!entry.date) return [];
    
    // Use parseISO to correctly handle YYYY-MM-DD as a UTC date
    // to prevent off-by-one day errors due to timezone conversion.
    const originalEntryDate = parseISO(entry.date);
    
    if (isAfter(originalEntryDate, end)) return [];

    if (entry.recurrence === 'weekly' || entry.recurrence === 'bi-weekly') {
        const weeksToAdd = entry.recurrence === 'weekly' ? 1 : 2;
        let currentDate = startOfWeek(originalEntryDate, { weekStartsOn: getDay(originalEntryDate) });
        while (isBefore(currentDate, start)) {
            currentDate = add(currentDate, { weeks: weeksToAdd });
        }
        while (isBefore(currentDate, end) || isSameDay(currentDate, end)) {
            if (!isBefore(currentDate, start)) {
                instances.push({
                    ...entry,
                    date: format(currentDate, 'yyyy-MM-dd'),
                    id: `${entry.id}-${format(currentDate, 'yyyy-MM-dd')}`
                });
            }
            currentDate = add(currentDate, { weeks: weeksToAdd });
        }
        return instances;
    }
    
    const recurrenceInterval = entry.recurrence ? recurrenceIntervalMonths[entry.recurrence as keyof typeof recurrenceIntervalMonths] : 0;
    if (entry.recurrence && entry.recurrence !== 'none' && recurrenceInterval > 0) {
        let currentDate = originalEntryDate;
        
        // Fast-forward to the relevant period
        if (isBefore(currentDate, start)) {
            const monthsDiff = differenceInCalendarMonths(start, currentDate);
            currentDate = add(currentDate, { months: Math.floor(monthsDiff / recurrenceInterval) * recurrenceInterval });
        }
        
        while (isBefore(currentDate, end) || isSameDay(currentDate, end)) {
            // Check if date is within the desired range [start, end]
            if ((isAfter(currentDate, start) || isSameDay(currentDate, start)) && (isBefore(currentDate, end) || isSameDay(currentDate, end))) {
                const originalDay = getDate(originalEntryDate);
                const lastDayOfMonth = endOfMonth(currentDate).getDate();
                const dayForMonth = Math.min(originalDay, lastDayOfMonth);
                const finalDate = setDate(currentDate, dayForMonth);

                if (isSameMonth(finalDate, currentDate)) {
                     instances.push({ 
                        ...entry, 
                        date: format(finalDate, 'yyyy-MM-dd'), 
                        id: `${entry.id}-${format(finalDate, 'yyyy-MM-dd')}` 
                    });
                }
            }
            currentDate = add(currentDate, { months: recurrenceInterval });
        }
        return instances;
    }

    // Handle non-recurring entries
    if (entry.recurrence === 'none' || !entry.recurrence) {
        const entryDate = parseISO(entry.date);
        if (entryDate >= start && entryDate <= end) {
            instances.push(entry);
        }
    }
    return instances;
};


const parseDateInTimezone = (dateString: string, timeZone: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export default function FiscalFlowDashboard() {
  const [entries, setEntries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("fiscalFlowRollover", "carryover");
  const [timezone, setTimezone] = useLocalStorage<string>('fiscalFlowTimezone', 'UTC');
  const [weeklyBalances, setWeeklyBalances] = useLocalStorage<WeeklyBalances>("fiscalFlowWeeklyBalances", {});
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fiscalFlowNotificationsEnabled', false);
  const [user, setUser] = useState<User | null>(null);

  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isDayEntriesDialogOpen, setDayEntriesDialogOpen] = useState(false);
  const [isBreakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useMedia("(max-width: 1024px)", false);
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteAlertOpen, setBulkDeleteAlertOpen] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => !prev);
    setSelectedIds([]);
  }, []);

  const handleBulkDelete = () => {
    setEntries(prev => prev.filter(e => !selectedIds.includes(e.id)));
    toggleSelectionMode();
    setBulkDeleteAlertOpen(false);
    toast({ title: `${selectedIds.length} entries deleted.` });
  };


  useEffect(() => {
    // This effect should only run once on mount to handle the initial auth state.
    const processAuth = async () => {
        setIsAuthLoading(true);
        try {
            const result = await getRedirectResult(auth);
            if (result) {
                // User has just signed in via redirect.
                // The onAuthStateChanged listener below will handle setting the user.
                setUser(result.user);
                toast({ title: "Signed in successfully!" });
            }
        } catch (error: any) {
            console.error("Google Sign-In Redirect Error:", error);
            toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
        } finally {
            // After processing the redirect, set up the state listener.
            // This is the single source of truth for the user's auth state.
            const unsubscribe = auth.onAuthStateChanged(currentUser => {
                if(!user) { // Prevent re-setting user if already set by redirect
                    setUser(currentUser);
                }
                setIsAuthLoading(false); // Stop loading once we have the auth state.
            });
            // Cleanup the listener on unmount.
            return () => unsubscribe();
        }
    };
    processAuth();
  }, [toast, user]);
  

  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
  };
  
  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    toast({ title: "Signed out." });
  };

  useEffect(() => {
    if (notificationsEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        scheduleNotifications(entries, timezone, toast);
      } else {
        setNotificationsEnabled(false);
      }
    } else {
      cancelAllNotifications(toast);
    }
  }, [entries, timezone, notificationsEnabled, setNotificationsEnabled, toast]);


  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
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
  }, [setTimezone]);


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
    if (!isMounted || entries.length === 0) return [];
    
    const viewStart = startOfMonth(subMonths(new Date(), 6));
    const viewEnd = endOfMonth(addMonths(new Date(), 12));

    return entries.flatMap((e) => {
        return generateRecurringInstances(e, viewStart, viewEnd);
    });
  }, [entries, isMounted]);

  useEffect(() => {
    if (!isMounted) return;

    const newWeeklyBalances: WeeklyBalances = {};
    if (allGeneratedEntries.length > 0) {
        const sortedEntries = allGeneratedEntries.sort((a,b) => a.date.localeCompare(b.date));
        
        const firstDate = parseISO(sortedEntries[0].date);
        const lastDate = parseISO(sortedEntries[sortedEntries.length - 1].date);
        
        // Ensure the interval covers full weeks
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
    
    // Only update state if the calculated object is different
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
      const monthEnd = endOfMonth(selectedDate);
      
      const monthEntries = allGeneratedEntries.filter(e => isSameMonth(parseDateInTimezone(e.date, timezone), selectedDate));
      const monthlyIncome = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
      const monthlyBills = monthEntries.filter(e => e.type === 'bill').reduce((s, e) => s + e.amount, 0);

      const firstWeekOfMonthKey = format(startOfWeek(monthStart), 'yyyy-MM-dd');
      const startOfMonthBalance = weeklyBalances[firstWeekOfMonthKey]?.start || 0;
      
      const lastWeekOfMonthKey = format(startOfWeek(monthEnd), 'yyyy-MM-dd');
      const endOfMonthBalance = weeklyBalances[lastWeekOfMonthKey]?.end || 0;


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
            endOfMonthBalance: endOfMonthBalance,
        }
      }
  }, [selectedDate, allGeneratedEntries, timezone, weeklyBalances]);

  const handleSyncCalendar = async () => {
    if (!user) {
        toast({ title: "Not Signed In", description: "Please connect your Google Account in Settings first.", variant: "destructive" });
        return;
    }
    setIsSyncing(true);
    try {
        const idToken = await user.getIdToken();
        const result = await syncToGoogleCalendar({
            entries: allGeneratedEntries.filter(e => isSameMonth(parseDateInTimezone(e.date, timezone), selectedDate)),
            timezone,
            accessToken: idToken,
        });

        toast({
            title: "Sync Complete!",
            description: `${result.syncedCount} events were synced to your Google Calendar.`,
        });

    } catch (error) {
        console.error("Google Calendar Sync Error:", error);
        toast({ title: "Sync Failed", description: "Could not sync events to Google Calendar.", variant: "destructive" });
    } finally {
        setIsSyncing(false);
    }
  };

  if (!isMounted || isAuthLoading) {
    return (
      <div className="flex h-screen w-full flex-col bg-background">
        <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
            <div className="flex items-center gap-2">
                <Logo className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">Centsei</span>
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
            <span className="text-xl font-bold">Centsei</span>
        </div>
        <div className="flex items-center gap-2">
          {!isSelectionMode && (
            <Button onClick={() => openNewEntryDialog(new Date())} size="sm" className="hidden md:flex btn-primary-hover">
              <Plus className="-ml-1 mr-2 h-4 w-4" /> Add Entry
            </Button>
          )}
           <Button onClick={() => setSummaryDialogOpen(true)} variant="outline" size="sm" className="hidden md:flex">
              <BarChartBig className="mr-2 h-4 w-4" /> Monthly Summary
            </Button>
            <Button onClick={() => setBreakdownDialogOpen(true)} variant="outline" size="sm" className="hidden md:flex">
              <PieChart className="mr-2 h-4 w-4" /> Category Breakdown
            </Button>
           {isSelectionMode && selectedIds.length > 0 && (
             <Button variant="destructive" size="sm" onClick={() => setBulkDeleteAlertOpen(true)}>
               <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedIds.length})
             </Button>
           )}
          {user && (
            <Button onClick={handleSyncCalendar} disabled={isSyncing} variant="outline" size="sm" className="hidden md:flex">
              {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <CalendarSync className="mr-2 h-4 w-4" />
              )}
              <span>Sync Calendar</span>
            </Button>
          )}
          <Button onClick={() => setSettingsDialogOpen(true)} variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
                    <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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
                    {user && (
                      <Button onClick={handleSyncCalendar} disabled={isSyncing} variant="outline" className="w-full">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarSync className="mr-2 h-4 w-4" />}
                        Sync Calendar
                      </Button>
                    )}
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
      
      <FiscalFlowCalendar 
        entries={entries}
        setEntries={setEntries}
        generatedEntries={allGeneratedEntries}
        timezone={timezone}
        openNewEntryDialog={openNewEntryDialog}
        setEditingEntry={setEditingEntry}
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={setEntryDialogOpen}
        isMobile={isMobile}
        openDayEntriesDialog={() => setDayEntriesDialogOpen(true)}
        weeklyBalances={weeklyBalances}
        weeklyTotals={weeklyTotals}
        isSelectionMode={isSelectionMode}
        toggleSelectionMode={toggleSelectionMode}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onBulkDelete={() => setBulkDeleteAlertOpen(true)}
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
            const originalEntryId = getOriginalIdFromInstance(entry.id);
            const originalEntry = entries.find(e => e.id === originalEntryId) || entry;
            setEditingEntry(originalEntry);
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


      <SettingsDialog 
        isOpen={isSettingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        rolloverPreference={rollover}
        onRolloverPreferenceChange={setRollover}
        timezone={timezone}
        onTimezoneChange={setTimezone}
        onNotificationsToggle={handleNotificationsToggle}
        user={user}
      />

       <AlertDialog open={isBulkDeleteAlertOpen} onOpenChange={setBulkDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected {selectedIds.length} entries from your calendar. This will remove the original entry and all of its future recurring instances.
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
    </div>
  );
}
    

    