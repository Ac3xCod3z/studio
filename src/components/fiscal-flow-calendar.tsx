
// src/components/fiscal-flow-calendar.tsx
"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
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
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus, ArrowUp, ArrowDown, Trash2, TrendingUp, TrendingDown, Repeat } from "lucide-react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatCurrency } from "@/lib/utils";
import type { Entry, WeeklyBalances } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";

if (typeof window !== "undefined") {
    gsap.registerPlugin(MotionPathPlugin);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseDateInTimezone = (dateString: string, timeZone: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return toZonedTime(new Date(year, month - 1, day), timeZone);
};

type FiscalFlowCalendarProps = {
    entries: Entry[];
    generatedEntries: Entry[];
    setEntries: (value: Entry[] | ((val: Entry[]) => Entry[])) => void;
    timezone: string;
    openNewEntryDialog: (date: Date) => void;
    setEditingEntry: (entry: Entry | null) => void;
    setSelectedDate: (date: Date) => void;
    setEntryDialogOpen: (isOpen: boolean) => void;
    isMobile: boolean;
    openDayEntriesDialog: () => void;
    isReadOnly?: boolean;
    weeklyBalances: WeeklyBalances;
    weeklyTotals: any;
    isSelectionMode: boolean;
    toggleSelectionMode: () => void;
    selectedIds: string[];
    setSelectedIds: (ids: string[] | ((current: string[]) => string[])) => void;
    onBulkDelete: () => void;
}

export function FiscalFlowCalendar({
    entries,
    generatedEntries,
    setEntries,
    timezone,
    openNewEntryDialog,
    setEditingEntry,
    setSelectedDate: setGlobalSelectedDate,
    setEntryDialogOpen,
    isMobile,
    openDayEntriesDialog,
    isReadOnly = false,
    weeklyBalances,
    weeklyTotals,
    isSelectionMode,
    toggleSelectionMode,
    selectedIds,
    setSelectedIds,
    onBulkDelete,
}: FiscalFlowCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [touchDraggingEntry, setTouchDraggingEntry] = useState<Entry | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);


  const { daysWithEntries } = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const daysInMonth = eachDayOfInterval({ start, end });
    
    const daysMap = new Map<string, { day: Date; entries: Entry[] }>();
    
    daysInMonth.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        daysMap.set(dayKey, { day, entries: [] });
    });
    
    generatedEntries.forEach(entry => {
        const entryDayStr = format(parseDateInTimezone(entry.date, timezone), 'yyyy-MM-dd');
        if (daysMap.has(entryDayStr)) {
            daysMap.get(entryDayStr)!.entries.push(entry);
        }
    });

    daysMap.forEach(dayData => {
        dayData.entries.sort((a, b) => {
            if (a.type === 'income' && b.type === 'bill') return -1;
            if (a.type === 'bill' && b.type === 'income') return 1;
            return a.name.localeCompare(b.name);
        });
    });

    return { daysWithEntries: Array.from(daysMap.values()) };
}, [currentMonth, generatedEntries, timezone]);
  
  const getOriginalIdFromInstance = (instanceId: string) => {
    const parts = instanceId.split('-');
    if (parts.length > 5) { // Assuming UUID is 5 parts
        return parts.slice(0, 5).join('-');
    }
    return instanceId;
  }

  const handleDayClick = (day: Date, dayEntries: Entry[]) => {
      if (isReadOnly) return;
      
      setSelectedDate(day);
      setGlobalSelectedDate(day);
      
      if (dayEntries.length > 0 && !isSelectionMode) {
          openDayEntriesDialog();
          return;
      }
      
      if (isSelectionMode) {
          const entryIdsOnDay = dayEntries.map(e => getOriginalIdFromInstance(e.id));
          const uniqueEntryIds = [...new Set(entryIdsOnDay)];
          const areAllSelected = uniqueEntryIds.every(id => selectedIds.includes(id));
          
          setSelectedIds(currentSelectedIds => {
            const otherIds = currentSelectedIds.filter(id => !uniqueEntryIds.includes(id));
            if (areAllSelected) {
              return otherIds;
            } else {
              return [...otherIds, ...uniqueEntryIds];
            }
          });
      }
  }

  const entryIsRecurringInstance = (entryId: string) => {
      return entryId.match(/.*-\d{4}-\d{2}-\d{2}$/);
  }

  const openEditEntryDialog = (entry: Entry) => {
    if (isReadOnly || isSelectionMode) return;
    const originalEntryId = getOriginalIdFromInstance(entry.id);
    const originalEntry = entries.find(e => e.id === originalEntryId) || entry;

    setEditingEntry(originalEntry);
    setGlobalSelectedDate(parseDateInTimezone(originalEntry.date, timezone));
    setEntryDialogOpen(true);
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, entry: Entry) => {
    if (isReadOnly || isSelectionMode || entryIsRecurringInstance(entry.id)) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.effectAllowed = 'move';
    setDraggingEntryId(entry.id);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isReadOnly || isSelectionMode) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLDivElement;
    if (!target.classList.contains('ring-2')) {
        // Debounce or check before adding class
        calendarRef.current?.querySelectorAll('[data-day-cell]').forEach(cell => {
            cell.classList.remove('ring-2', 'ring-primary');
        });
        target.classList.add('ring-2', 'ring-primary');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetDate: Date) => {
    if (isReadOnly || isSelectionMode) return;
    e.preventDefault();
    if (draggingEntryId) {
      setEntries(prevEntries => 
        prevEntries.map(entry => 
          entry.id === draggingEntryId 
            ? { ...entry, date: format(targetDate, 'yyyy-MM-dd'), recurrence: 'none' } 
            : entry
        )
      );
    }
    setDraggingEntryId(null);
     calendarRef.current?.querySelectorAll('[data-day-cell]').forEach(cell => {
       cell.classList.remove('ring-2', 'ring-primary');
    });
  };

  // Touch handlers for mobile drag-and-drop
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, entry: Entry) => {
    if (isReadOnly || isSelectionMode || entryIsRecurringInstance(entry.id)) return;
    setTouchDraggingEntry(entry);
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchDraggingEntry || !calendarRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    
    // Visually highlight the day cell being hovered over
    if (targetElement) {
        const dayCell = targetElement.closest('[data-day-cell]');
        calendarRef.current.querySelectorAll('[data-day-cell]').forEach(cell => {
            cell.classList.remove('bg-primary/20', 'ring-2', 'ring-primary');
        });
        if (dayCell) {
            dayCell.classList.add('bg-primary/20', 'ring-2', 'ring-primary');
        }
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchDraggingEntry || !calendarRef.current) return;
    
    // Find the drop target
    const touch = e.changedTouches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (targetElement) {
        const dayCell = targetElement.closest('[data-day-cell]');
        if (dayCell) {
            const targetDateStr = dayCell.getAttribute('data-date');
            if (targetDateStr) {
                 setEntries(prevEntries => 
                    prevEntries.map(entry => 
                        entry.id === getOriginalIdFromInstance(touchDraggingEntry.id)
                        ? { ...entry, date: targetDateStr, recurrence: 'none' }
                        : entry
                    )
                );
            }
        }
    }
    
    // Cleanup
    calendarRef.current.querySelectorAll('[data-day-cell]').forEach(cell => {
       cell.classList.remove('bg-primary/20', 'ring-2', 'ring-primary');
    });
    setTouchDraggingEntry(null);
  };


  const Sidebar = () => (
    <SidebarContent 
      weeklyTotals={weeklyTotals}
      selectedDate={selectedDate}
    />
  )

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
        <main 
            ref={calendarRef}
            className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6"
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{format(currentMonth, "MMMM yyyy")}</h1>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" onClick={toggleSelectionMode}>
                {isSelectionMode ? 'Cancel' : 'Select'}
              </Button>
               {isSelectionMode && selectedIds.length > 0 && (
                 <Button variant="destructive" onClick={onBulkDelete}>
                   <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedIds.length})
                 </Button>
                )}
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCurrentMonth(new Date())} className="px-2 sm:px-4">Today</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center font-semibold text-muted-foreground text-xs sm:text-sm">
            {WEEKDAYS.map((day) => (<div key={day} className="py-2">{day}</div>))}
          </div>
          <div className="grid grid-cols-7 grid-rows-5 gap-1.5 md:gap-2">
            {daysWithEntries.map(({ day, entries: dayEntries }, index) => {
              const dayHasSelectedEntry = dayEntries.some(e => selectedIds.includes(getOriginalIdFromInstance(e.id)))
              const dayStr = format(day, 'yyyy-MM-dd');
              const isCorner = index === 0 || index === 6 || index === 28 || index === 34;

              return (
                <div
                  key={dayStr}
                  data-day-cell
                  data-date={dayStr}
                  className={cn(
                    "relative flex flex-col h-28 sm:h-36 rounded-xl p-2 border transition-all duration-300 ease-in-out transform group",
                    !isReadOnly && "cursor-pointer",
                    !isSameMonth(day, currentMonth) ? "bg-muted/50 text-muted-foreground" : "bg-card",
                    !isReadOnly && isSameMonth(day, currentMonth) && !isSelectionMode && "hover:bg-accent hover:shadow-md hover:-translate-y-1",
                    isCorner && "border-primary/50",
                    isSameDay(day, selectedDate) && !isSelectionMode && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isSelectionMode && "hover:bg-primary/10",
                    isSelectionMode && dayHasSelectedEntry && "ring-2 ring-primary bg-primary/20",

                  )}
                  onClick={() => handleDayClick(day, dayEntries)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn("font-bold text-xs sm:text-base", isToday(day) && "text-primary")}>{format(day, "d")}</span>
                    {!isReadOnly && !isSelectionMode && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-foreground/50 hover:text-foreground" onClick={(e) => { e.stopPropagation(); openNewEntryDialog(day); }}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                    {isSelectionMode && dayEntries.length > 0 && (
                        <Checkbox 
                            className="h-5 w-5"
                            checked={dayEntries.every(e => selectedIds.includes(getOriginalIdFromInstance(e.id)))}
                        />
                    )}
                  </div>
                  <ScrollArea className="flex-1 mt-1 -mx-2 px-2">
                    <div className="space-y-1.5 text-xs sm:text-sm">
                      {dayEntries.map(entry => (
                          <div 
                              key={entry.id}
                              onClick={(e) => { e.stopPropagation(); openEditEntryDialog(entry); }}
                              onDragStart={(e) => handleDragStart(e, entry)}
                              onTouchStart={(e) => handleTouchStart(e, entry)}
                              draggable={!isReadOnly && !isSelectionMode && !entryIsRecurringInstance(entry.id)}
                              className={cn(
                                  "px-2 py-1 rounded-full text-left flex items-center gap-2 transition-all duration-200",
                                  isMobile && 'touch-none',
                                  !entryIsRecurringInstance(entry.id) && !isReadOnly && !isSelectionMode && "cursor-grab active:cursor-grabbing hover:shadow-lg",
                                  (draggingEntryId === entry.id || touchDraggingEntry?.id === entry.id) && 'opacity-50 scale-105 shadow-xl',
                                  isSelectionMode && selectedIds.includes(getOriginalIdFromInstance(entry.id)) && "opacity-60",
                                  "bg-secondary/50 hover:bg-secondary",
                              )}
                          >
                            <div className={cn("p-1.5 rounded-full", entry.type === 'bill' ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-500')}>
                               {entry.type === 'bill' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                            </div>
                            <span className="flex-1 truncate font-medium">{entry.name}</span>
                            <span className="font-semibold">{formatCurrency(entry.amount)}</span>
                          </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </main>
        {!isMobile && (
          <aside className="w-[350px] border-l bg-secondary/30 overflow-y-auto hidden lg:block">
            <Sidebar />
          </aside>
        )}
      </div>
  );
}


function SummaryCard({ title, amount, icon, description, variant = 'default', className }: { title: string, amount: number, icon?: React.ReactNode, description?: string, variant?: 'default' | 'positive' | 'negative', className?: string }) {
    const amountColor = variant === 'positive' ? 'text-emerald-500' : variant === 'negative' ? 'text-destructive' : '';
    return (
        <Card className={cn("bg-background/50 backdrop-blur-sm", className)}>
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

export const SidebarContent = ({
  weeklyTotals,
  selectedDate,
}: {
  weeklyTotals: any;
  selectedDate: Date;
}) => {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Week of {format(startOfWeek(selectedDate), "MMM d")}</h3>
            <SummaryCard title="Starting Balance" amount={weeklyTotals.startOfWeekBalance} icon={<Repeat className="h-4 w-4 text-muted-foreground" />} description="From previous week" />
            <SummaryCard title="Income" amount={weeklyTotals.income} icon={<ArrowUp className="text-emerald-500" />} />
            <SummaryCard title="Bills Due" amount={weeklyTotals.bills} icon={<ArrowDown className="text-destructive" />} />
            <SummaryCard 
              title="Weekly Status" 
              amount={weeklyTotals.status} 
              icon={weeklyTotals.status >= 0 ? <TrendingUp className="text-emerald-500" /> : <TrendingDown className="text-destructive" />}
              variant={weeklyTotals.status >= 0 ? 'positive' : 'negative'}
              description={weeklyTotals.status >= 0 ? 'Surplus for the week' : 'Deficit for the week'}
            />
            <SummaryCard title="End of Week Balance" amount={weeklyTotals.net} variant={weeklyTotals.net >= 0 ? 'positive' : 'negative'} />
        </div>
    </div>
  );
};
