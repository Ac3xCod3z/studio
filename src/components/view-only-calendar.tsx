

"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useMedia } from "react-use";

import { Logo } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entry, RolloverPreference, WeeklyBalances } from "@/lib/types";
import { CentseiCalendar, SidebarContent } from "@/components/centsei-calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isBefore, getDay, add, setDate, getDate, startOfWeek, endOfWeek, isSameDay, addMonths, parseISO, isSameMonth, differenceInCalendarMonths, isAfter, eachWeekOfInterval, lastDayOfMonth, set } from "date-fns";
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
    
    const { entries, timezone } = data;
    if (entries.length === 0) return [];
    
    const viewStart = startOfMonth(subMonths(new Date(), 12));
    const viewEnd = endOfMonth(addMonths(new Date(), 24));

    return entries.flatMap((e) => generateRecurringInstances(e, viewStart, viewEnd, timezone));
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
        
        let currentWeekStartBalance = lastWeekBalance;
        if (rollover === 'reset' && getDay(weekStart) === startOfWeek(new Date()).getDay() && weekStart.getDate() <= 7) {
           // currently not implemented
        }

        const endOfWeekBalance = currentWeekStartBalance + income - bills;
        newWeeklyBalances[weekKey] = { start: currentWeekStartBalance, end: endOfWeekBalance };
        lastWeekBalance = endOfWeekBalance;
    });
    
    if (JSON.stringify(newWeeklyBalances) !== JSON.stringify(weeklyBalances)) {
        setWeeklyBalances(newWeeklyBalances);
    }
  }, [allGeneratedEntries, data, weeklyBalances]);

  const weeklyTotals = useMemo(() => {
    if (!data) {
      return { income: 0, bills: 0, net: 0, startOfWeekBalance: 0, status: 0 };
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
        status: weeklyIncome - weeklyBills,
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
           <Logo height={50} width={50} />
           <span className="text-xl font-bold">Centsei</span>
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

      <CentseiCalendar
        entries={data.entries}
        generatedEntries={allGeneratedEntries}
        setEntries={() => {}} // No-op
        timezone={data.timezone}
        openNewEntryDialog={() => {}} // No-op
        setEditingEntry={() => {}} // No-op
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={() => {}} // No-op
        openDayEntriesDialog={() => {}} // No-op for read-only view
        isReadOnly={true}
        weeklyBalances={weeklyBalances}
        weeklyTotals={weeklyTotals}
        isSelectionMode={false}
        toggleSelectionMode={() => {}}
        selectedInstances={[]}
        setSelectedInstances={() => {}}
        onBulkDelete={() => {}}
        onMoveRequest={() => {}}
      />
    </div>
  );
}
