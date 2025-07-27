
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMedia } from "react-use";

import { Logo } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entry, RolloverPreference, WeeklyBalances } from "@/lib/types";
import { CentsiCalendar, SidebarContent } from "@/components/centsi-calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isBefore, getDay, add, setDate, getDate, startOfWeek, endOfWeek, isSameDay, addMonths, parseISO, isSameMonth, differenceInCalendarMonths, isAfter, eachWeekOfInterval } from "date-fns";
import { toZonedTime } from 'date-fns-tz';
import { recurrenceIntervalMonths } from "@/lib/constants";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

type SharedData = {
  entries: Entry[];
  rollover: RolloverPreference;
  timezone: string;
};


const generateRecurringInstances = (entry: Entry, start: Date, end: Date): Entry[] => {
    const instances: Entry[] = [];
    if (!entry.date) return [];
    
    const originalEntryDate = parseISO(entry.date);
    
    if (isAfter(originalEntryDate, end)) return [];

    if (entry.recurrence === 'weekly') {
        let currentDate = startOfWeek(originalEntryDate, { weekStartsOn: getDay(originalEntryDate) });
        while (isBefore(currentDate, start)) {
            currentDate = add(currentDate, { weeks: 1 });
        }
        while (isBefore(currentDate, end) || isSameDay(currentDate, end)) {
            if (!isBefore(currentDate, start)) {
                instances.push({
                    ...entry,
                    date: format(currentDate, 'yyyy-MM-dd'),
                    id: `${entry.id}-${format(currentDate, 'yyyy-MM-dd')}`
                });
            }
            currentDate = add(currentDate, { weeks: 1 });
        }
        return instances;
    }
    
    const recurrenceInterval = entry.recurrence ? recurrenceIntervalMonths[entry.recurrence as keyof typeof recurrenceIntervalMonths] : 0;
    if (entry.recurrence && entry.recurrence !== 'none' && recurrenceInterval > 0) {
        let currentDate = originalEntryDate;
        
        if (isBefore(currentDate, start)) {
            const monthsDiff = differenceInCalendarMonths(start, currentDate);
            currentDate = add(currentDate, { months: Math.floor(monthsDiff / recurrenceInterval) * recurrenceInterval });
        }
        
        while (isBefore(currentDate, end) || isSameDay(currentDate, end)) {
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

    return [];
};


const parseDateInTimezone = (dateString: string, timeZone: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export default function ViewOnlyCalendar() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [weeklyBalances, setWeeklyBalances] = useState<WeeklyBalances>({});

  const isMobile = useMedia("(max-width: 1024px)", false);

  useEffect(() => {
    const encodedData = searchParams.get("data");
    if (encodedData) {
      try {
        const decodedString = atob(decodeURIComponent(encodedData));
        const parsedData = JSON.parse(decodedString);
        // Basic validation
        if (parsedData && Array.isArray(parsedData.entries) && parsedData.timezone) {
            setData(parsedData);
        } else {
            throw new Error("Invalid data structure");
        }
      } catch (e) {
        console.error("Failed to parse shared data:", e);
        setError("The shared link is invalid or corrupted. Please ask for a new link.");
      }
    } else {
        setError("No data provided in the link. Please use a valid share link.");
    }
  }, [searchParams]);

  const allGeneratedEntries = useMemo(() => {
    if (!data) return [];
    
    const { entries } = data;
    if (entries.length === 0) return [];
    
    const viewStart = startOfMonth(subMonths(new Date(), 12));
    const viewEnd = endOfMonth(addMonths(new Date(), 24));

    return entries.flatMap((e) => {
        const instances: Entry[] = [];
        if (e.recurrence === 'none' || !e.recurrence) {
            const entryDate = parseISO(e.date);
            if(entryDate >= viewStart && entryDate <= viewEnd) {
                instances.push(e);
            }
        } else {
            instances.push(...generateRecurringInstances(e, viewStart, viewEnd));
        }
        return instances;
    });
  }, [data]);
  
  useEffect(() => {
    if (!data || allGeneratedEntries.length === 0) {
        setWeeklyBalances({});
        return;
    }

    const { rollover, timezone } = data;
    const newWeeklyBalances: WeeklyBalances = {};
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
        
        const endOfWeekBalance = lastWeekBalance + income - bills;
        newWeeklyBalances[weekKey] = { start: lastWeekBalance, end: endOfWeekBalance };
        lastWeekBalance = rollover === 'carryover' ? endOfWeekBalance : 0;
    });
    
    if (JSON.stringify(newWeeklyBalances) !== JSON.stringify(weeklyBalances)) {
        setWeeklyBalances(newWeeklyBalances);
    }
  }, [allGeneratedEntries, data, weeklyBalances]);

  const weeklyTotals = useMemo(() => {
    if (!data) {
      return { income: 0, bills: 0, net: 0, startOfWeekBalance: 0 };
    }
    const { timezone } = data;
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

    return {
        income: weeklyIncome,
        bills: weeklyBills,
        net: endOfWeekBalance,
        startOfWeekBalance: startOfWeekBalance,
    };
  }, [data, allGeneratedEntries, selectedDate, weeklyBalances]);


  if (error) {
    return (
        <div className="flex items-center justify-center h-screen bg-background p-4">
             <Alert variant="destructive" className="max-w-lg">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Error Loading Shared Calendar</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </div>
    )
  }

  if (!data) {
    // This state will be covered by the Suspense fallback in the parent
    return null;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">Centsi (View Only)</span>
        </div>
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
      </header>

      <CentsiCalendar
        entries={data.entries}
        generatedEntries={allGeneratedEntries}
        setEntries={() => {}} // No-op
        timezone={data.timezone}
        openNewEntryDialog={() => {}} // No-op
        setEditingEntry={() => {}} // No-op
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={() => {}} // No-op
        isMobile={isMobile}
        openDayEntriesDialog={() => {}} // No-op for read-only view
        isReadOnly={true}
        weeklyBalances={weeklyBalances}
        weeklyTotals={weeklyTotals}
        isSelectionMode={false}
        toggleSelectionMode={() => {}}
        selectedIds={[]}
        setSelectedIds={() => {}}
        onBulkDelete={() => {}}
      />
    </div>
  );
}
