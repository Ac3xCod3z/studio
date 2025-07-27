
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMedia } from "react-use";

import { Logo } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entry, RolloverPreference } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "@/components/fiscal-flow-calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isBefore, getDay, add, setDate, getDate, startOfWeek, endOfWeek, isSameDay, addMonths, parseISO, isSameMonth } from "date-fns";
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


// This is a simplified version of the dashboard's data calculation logic
// for the mobile summary sheet.
const calculateMobileSummary = (
    allGeneratedEntries: Entry[], 
    rollover: RolloverPreference, 
    timezone: string, 
    selectedDate: Date,
    monthlyLeftovers: any
) => {
    if (!allGeneratedEntries.length) {
      return { weeklyTotals: { income: 0, bills: 0, net: 0, rolloverApplied: 0 } };
    }

    const weekStart = startOfWeek(selectedDate);
    const weekEnd = endOfWeek(selectedDate);
    const weekEntries = allGeneratedEntries.filter(e => {
        const entryDate = parseDateInTimezone(e.date, timezone);
        return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const weeklyIncome = weekEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
    const weeklyBills = weekEntries.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
    const initialWeeklyNet = weeklyIncome - weeklyBills;
    
    // Determine the relevant previous month for rollover based on the week's start date
    const prevMonthKey = format(subMonths(weekStart, 1), 'yyyy-MM');
    const startOfWeekLeftover = (rollover === 'carryover' && monthlyLeftovers[prevMonthKey]) || 0;

    let rolloverApplied = 0;
    if (initialWeeklyNet < 0 && startOfWeekLeftover > 0) {
        rolloverApplied = Math.min(Math.abs(initialWeeklyNet), startOfWeekLeftover);
    }
    
    const finalWeeklyNet = initialWeeklyNet + rolloverApplied;
    
    return {
      weeklyTotals: {
          income: weeklyIncome,
          bills: weeklyBills,
          net: finalWeeklyNet,
          rolloverApplied,
      }
    };
};

export default function ViewOnlyCalendar() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [monthlyLeftovers, setMonthlyLeftovers] = useState<any>({});

  const isMobile = useMedia("(max-width: 1024px)", false);

  useEffect(() => {
    const encodedData = searchParams.get("data");
    if (encodedData) {
      try {
        const decodedString = atob(decodeURIComponent(encodedData));
        const parsedData = JSON.parse(decodedString);
        setData(parsedData);
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
  }, [data]);
  
  useEffect(() => {
    if (!data || allGeneratedEntries.length === 0) {
        setMonthlyLeftovers({});
        return;
    }
    const { rollover, timezone } = data;
    const oldestEntry = allGeneratedEntries.reduce((oldest, entry) => {
        const entryDate = parseISO(entry.date);
        return entryDate < oldest ? entryDate : oldest;
    }, new Date());

    const start = startOfMonth(oldestEntry);
    const end = new Date(); 
    
    const newLeftovers: any = {};
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
  }, [allGeneratedEntries, data, monthlyLeftovers]);

  const mobileSummaryData = data ? calculateMobileSummary(allGeneratedEntries, data.rollover, data.timezone, selectedDate, monthlyLeftovers) : null;
  const weeklyTotals = mobileSummaryData ? mobileSummaryData.weeklyTotals : { income: 0, bills: 0, net: 0, rolloverApplied: 0 };


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
    // This state will be covered by the Suspense fallback
    return null;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">FiscalFlow (View Only)</span>
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
              {mobileSummaryData && (
                <ScrollArea className="flex-1">
                    <SidebarContent
                      weeklyTotals={mobileSummaryData.weeklyTotals}
                      selectedDate={selectedDate}
                    />
                </ScrollArea>
              )}
            </SheetContent>
          </Sheet>
        )}
      </header>

      <FiscalFlowCalendar
        entries={data.entries}
        generatedEntries={allGeneratedEntries}
        setEntries={() => {}} // No-op
        rollover={data.rollover}
        timezone={data.timezone}
        openNewEntryDialog={() => {}} // No-op
        setEditingEntry={() => {}} // No-op
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={() => {}} // No-op
        isMobile={isMobile}
        openDayEntriesDialog={() => {}} // No-op for read-only view
        isReadOnly={true}
        monthlyLeftovers={monthlyLeftovers}
        weeklyTotals={weeklyTotals}
        onOpenBreakdown={() => {}} // No-op
      />
    </div>
  );
}
