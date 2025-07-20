
"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMedia } from "react-use";

import { Logo } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entry, RolloverPreference } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "@/components/fiscal-flow-calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isBefore, getDay, add, setDate, getDate, startOfWeek, endOfWeek } from "date-fns";
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

// This is a simplified version of the dashboard's data calculation logic
// for the mobile summary sheet.
const calculateMobileSummary = (
    entries: Entry[], 
    rollover: RolloverPreference, 
    timezone: string, 
    selectedDate: Date,
    monthlyLeftovers: any
) => {
    const currentMonth = selectedDate;
    const monthKey = format(currentMonth, 'yyyy-MM');
    const prevMonth = subMonths(currentMonth, 1);
    const prevMonthKey = format(prevMonth, 'yyyy-MM');

    const calendarInterval = {
        start: startOfWeek(startOfMonth(currentMonth)),
        end: endOfWeek(endOfMonth(currentMonth))
    }
    
    const generateRecurringInstances = (entry: Entry, start: Date, end: Date): Entry[] => {
        const instances: Entry[] = [];
        const originalEntryDate = new Date(entry.date + 'T00:00:00'); // Treat as local to avoid timezone shifts from parseISO
        
        if (isBefore(end, originalEntryDate)) return [];

        if (entry.recurrence === 'weekly') {
            const originalDayOfWeek = getDay(originalEntryDate);
            let currentDate = startOfWeek(start);
            while (isBefore(currentDate, end)) {
                if (getDay(currentDate) === originalDayOfWeek && (currentDate >= originalEntryDate)) {
                    instances.push({
                        ...entry,
                        date: format(currentDate, 'yyyy-MM-dd'),
                        id: `${entry.id}-${format(currentDate, 'yyyy-MM-dd')}`
                    });
                }
                currentDate = add(currentDate, { days: 1 });
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

                    instances.push({ 
                        ...entry, 
                        date: format(finalDate, 'yyyy-MM-dd'), 
                        id: `${entry.id}-${format(finalDate, 'yyyy-MM-dd')}` 
                    });
                 }
                 recurringDate = add(recurringDate, { months: recurrenceInterval });
            }
            return instances;
        }

        return [];
    };

    const parseDateInTimezone = (dateString: string, timeZone: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return toZonedTime(new Date(year, month - 1, day), timeZone);
    };

    const entriesForGrid = entries.flatMap((e) => {
        const entryDate = parseDateInTimezone(e.date, timezone);
        const instances: Entry[] = [];
        if (e.recurrence === 'none') {
            if (entryDate >= calendarInterval.start && entryDate <= calendarInterval.end) {
                instances.push(e);
            }
        } else {
            instances.push(...generateRecurringInstances(e, calendarInterval.start, calendarInterval.end));
        }
        return instances;
    });

    const weekStart = startOfWeek(selectedDate);
    const weekEnd = endOfWeek(selectedDate);
    const weekEntries = entriesForGrid.filter(e => {
        const entryDate = parseDateInTimezone(e.date, timezone);
        return entryDate >= weekStart && entryDate <= weekEnd;
    });

    const weeklyIncome = weekEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
    const weeklyBills = weekEntries.filter(e => e.type === 'bill').reduce((sum, e) => sum + e.amount, 0);
    const weeklyNet = weeklyIncome - weeklyBills;
    
    const isFirstWeekOfMonth = isBefore(weekStart, startOfMonth(currentMonth));
    const weeklyRolloverSourceKey = isFirstWeekOfMonth ? format(subMonths(currentMonth,1), 'yyyy-MM') : prevMonthKey;
    const weeklyPreviousLeftover = (rollover === 'carryover' && monthlyLeftovers[weeklyRolloverSourceKey]) || 0;

    let rolloverApplied = 0;
    if (weeklyNet < 0 && weeklyPreviousLeftover > 0) {
        rolloverApplied = Math.min(Math.abs(weeklyNet), weeklyPreviousLeftover);
    }
    
    return {
      weeklyTotals: {
          income: weeklyIncome,
          bills: weeklyBills,
          net: weeklyNet + rolloverApplied,
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
  const [monthlyLeftovers, setMonthlyLeftovers] = useState({});

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

  const mobileSummaryData = data ? calculateMobileSummary(data.entries, data.rollover, data.timezone, selectedDate, monthlyLeftovers) : null;

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
        setMonthlyLeftovers={setMonthlyLeftovers}
      />
    </div>
  );
}
