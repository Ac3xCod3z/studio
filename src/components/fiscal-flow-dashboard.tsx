
"use client";

import React, { useState, useEffect, useMemo } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { useMedia } from "react-use";
import { auth } from "@/lib/firebase";
import type { User } from "firebase/auth";
import { getRedirectResult, signOut } from "firebase/auth";

import { EntryDialog } from "./entry-dialog";
import { SettingsDialog } from "./settings-dialog";
import { DayEntriesDialog } from "./day-entries-dialog";
import { MonthlyBreakdownDialog } from "./monthly-breakdown-dialog";
import { Logo } from "./icons";
import { Settings, Menu, Plus, CalendarSync, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import type { Entry, RolloverPreference, MonthlyLeftovers } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "./fiscal-flow-calendar";
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, isBefore, getDate, setDate, startOfWeek, endOfWeek, add, getDay, isSameDay, addMonths, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
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
    // Treat as local to avoid timezone shifts from parseISO
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
  const [entries, setEntries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("fiscalFlowRollover", "carryover");
  const [timezone, setTimezone] = useLocalStorage<string>('fiscalFlowTimezone', 'UTC');
  const [monthlyLeftovers, setMonthlyLeftovers] = useLocalStorage<MonthlyLeftovers>("fiscalFlowLeftovers", {});
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fiscalFlowNotificationsEnabled', false);
  const [user, setUser] = useState<User | null>(null);

  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [isDayEntriesDialogOpen, setDayEntriesDialogOpen] = useState(false);
  const [isBreakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [isMounted, setIsMounted] = useState(false);
  const isMobile = useMedia("(max-width: 1024px)", false);
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        setUser(user);
        setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
      const handleRedirectResult = async () => {
          try {
              const result = await getRedirectResult(auth);
              if (result) {
                  setUser(result.user);
                  toast({ title: "Signed in successfully!" });
              }
          } catch (error: any) {
              console.error("Google Sign-In Redirect Error:", error);
              toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
          } finally {
              setIsAuthLoading(false);
          }
      };
      // Only run this if not loading from onAuthStateChanged
      if(isAuthLoading) {
        handleRedirectResult();
      }
  }, [toast, isAuthLoading]);

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
        const entryDate = parseISO(entry.date);
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
    
    if (JSON.stringify(newLeftovers) !== JSON.stringify(monthlyLeftovers)) {
        setMonthlyLeftovers(newLeftovers);
    }
  }, [allGeneratedEntries, rollover, timezone, setMonthlyLeftovers, monthlyLeftovers]);


  const { dayEntries, weeklyTotals} = useMemo(() => {
      if (!allGeneratedEntries.length) {
        return {
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
        dayEntries,
        weeklyTotals: {
            income: weeklyIncome,
            bills: weeklyBills,
            net: finalWeeklyNet,
            rolloverApplied,
        }
      }
  }, [selectedDate, allGeneratedEntries, timezone, rollover, monthlyLeftovers]);

  const handleSyncCalendar = async () => {
    if (!user) {
        toast({ title: "Not Signed In", description: "Please connect your Google Account in Settings first.", variant: "destructive" });
        return;
    }
    setIsSyncing(true);
    try {
        const accessToken = await user.getIdToken(true);
        const result = await syncToGoogleCalendar({
            entries: allGeneratedEntries.filter(e => isSameMonth(parseDateInTimezone(e.date, timezone), selectedDate)),
            timezone,
            accessToken,
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
                <DropdownMenuItem onClick={handleSyncCalendar} disabled={isSyncing}>
                  {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                      <CalendarSync className="mr-2 h-4 w-4" />
                  )}
                  <span>Sync Calendar</span>
                </DropdownMenuItem>
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
            const originalEntry = entries.find(e => e.id.startsWith(entry.id.split('-')[0])) || entry;
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
        user={user}
        setUser={setUser}
      />
    </div>
  );
}
