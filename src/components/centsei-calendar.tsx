// src/components/centsei-calendar.tsx
"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  add,
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
  getYear,
  setYear,
  setMonth,
  getMonth,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus, ArrowUp, ArrowDown, Trash2, TrendingUp, TrendingDown, Repeat, CalendarIcon, Check } from "lucide-react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatCurrency } from "@/lib/utils";
import type { Entry, WeeklyBalances, SelectedInstance } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useMedia } from "react-use";

if (typeof window !== "undefined") {
    gsap.registerPlugin(MotionPathPlugin);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseDateInTimezone = (dateString: string, timeZone: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return toZonedTime(new Date(year, month - 1, day), timeZone);
};

type CentseiCalendarProps = {
    entries: Entry[];
    generatedEntries: Entry[];
    setEntries: (value: Entry[] | ((val: Entry[]) => Entry[])) => void;
    timezone: string;
    openNewEntryDialog: (date: Date) => void;
    setEditingEntry: (entry: Entry | null) => void;
    setSelectedDate: (date: Date) => void;
    setEntryDialogOpen: (isOpen: boolean) => void;
    openDayEntriesDialog: () => void;
    isReadOnly?: boolean;
    weeklyBalances: WeeklyBalances;
    weeklyTotals: any;
    isSelectionMode: boolean;
    toggleSelectionMode: () => void;
    selectedInstances: SelectedInstance[];
    setSelectedInstances: (instances: SelectedInstance[] | ((current: SelectedInstance[]) => SelectedInstance[])) => void;
    onBulkDelete: () => void;
}

export function CentseiCalendar({
    entries,
    generatedEntries,
    setEntries,
    timezone,
    openNewEntryDialog,
    setEditingEntry,
    setSelectedDate: setGlobalSelectedDate,
    setEntryDialogOpen,
    openDayEntriesDialog,
    isReadOnly = false,
    weeklyBalances,
    weeklyTotals,
    isSelectionMode,
    toggleSelectionMode,
    selectedInstances,
    setSelectedInstances,
    onBulkDelete,
}: CentseiCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isMonthPickerOpen, setMonthPickerOpen] = useState(false);
  const isMobile = useMedia("(max-width: 1024px)", false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const draggedElementRef = useRef<HTMLDivElement | null>(null);
  // Use a ref for the dragging entry to prevent re-renders, which cause flickering
  const draggingEntryRef = useRef<Entry | null>(null);
  const [dragVisual, setDragVisual] = useState<string | null>(null);

  const selectedInstanceIds = useMemo(() => selectedInstances.map(i => i.instanceId), [selectedInstances]);

  const { daysWithEntries, allGeneratedEntries } = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const daysInMonth = eachDayOfInterval({ start, end });
    
    const daysMap = new Map<string, { day: Date; entries: Entry[] }>();
    
    daysInMonth.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        daysMap.set(dayKey, { day, entries: [] });
    });
    
    const allEntries = generatedEntries;
    allEntries.forEach(entry => {
        const entryDayStr = format(parseDateInTimezone(entry.date, timezone), 'yyyy-MM-dd');
        if (daysMap.has(entryDayStr)) {
            daysMap.get(entryDayStr)!.entries.push(entry);
        }
    });

    daysMap.forEach(dayData => {
        dayData.entries.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });

    return { daysWithEntries: Array.from(daysMap.values()), allGeneratedEntries: allEntries };
}, [currentMonth, generatedEntries, timezone]);
  
  const getOriginalIdFromInstance = (instanceId: string) => {
    const parts = instanceId.split('-');
    if (parts.length > 5) { // Assuming UUID is 5 parts for master
        return parts.slice(0, 5).join('-');
    }
    return instanceId; // It's likely a non-recurring master ID
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
          const instancesOnDay: SelectedInstance[] = dayEntries.map(e => ({
            instanceId: e.id,
            masterId: getOriginalIdFromInstance(e.id),
            date: e.date,
          }));
          const instanceIdsOnDay = instancesOnDay.map(i => i.instanceId);

          const areAllSelected = instanceIdsOnDay.every(id => selectedInstanceIds.includes(id));
          
          setSelectedInstances(currentSelected => {
            const otherInstances = currentSelected.filter(i => !instanceIdsOnDay.includes(i.instanceId));
            if (areAllSelected) {
              return otherInstances;
            } else {
              return [...otherInstances, ...instancesOnDay];
            }
          });
      }
  }

  const openEditEntryDialog = (entry: Entry) => {
    if (isReadOnly || isSelectionMode) return;
    const originalEntryId = getOriginalIdFromInstance(entry.id);
    const originalEntry = entries.find(e => e.id === originalEntryId) || entry;
    const instanceWithDate = { ...originalEntry, date: entry.date, id: entry.id };
    setEditingEntry(instanceWithDate);
    setGlobalSelectedDate(parseDateInTimezone(entry.date, timezone));
    setEntryDialogOpen(true);
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, entry: Entry) => {
    if (isReadOnly || isSelectionMode) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.effectAllowed = 'move';
    isDraggingRef.current = true;
    draggingEntryRef.current = entry;
    draggedElementRef.current = e.currentTarget;
    e.dataTransfer.setData('text/plain', entry.id); // Necessary for Firefox
    setDragVisual(entry.id); // Use state only for visual ghosting
  };
  
  const handleDragEnd = () => {
    isDraggingRef.current = false;
    draggingEntryRef.current = null;
    draggedElementRef.current = null;
    setDragVisual(null);
    calendarRef.current?.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isReadOnly || isSelectionMode || !isDraggingRef.current) return;
    e.preventDefault();
    
    calendarRef.current?.querySelectorAll('.drop-indicator').forEach(el => el.remove());

    const dayCell = (e.target as HTMLElement).closest('[data-day-cell]');
    if (!dayCell) return;

    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator h-1 bg-primary rounded-full my-1';
    
    const entryContainer = dayCell.querySelector('.entry-list-container');
    if (!entryContainer) return;

    const dropTarget = (e.target as HTMLElement).closest('[data-entry-id]');

    if (dropTarget && dropTarget !== draggedElementRef.current) {
        const rect = dropTarget.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;
        if (isAfter) {
            dropTarget.parentNode?.insertBefore(indicator, dropTarget.nextSibling);
        } else {
            dropTarget.parentNode?.insertBefore(indicator, dropTarget);
        }
    } else if (!dropTarget) { // Dragging over empty space in day cell
        entryContainer.appendChild(indicator);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
     if (e.relatedTarget && (e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
        return;
    }
    calendarRef.current?.querySelectorAll('.drop-indicator').forEach(el => el.remove());
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (isReadOnly || isSelectionMode || !draggingEntryRef.current) {
        handleDragEnd();
        return;
    }
    e.preventDefault();
    
    const draggingEntry = draggingEntryRef.current;
    
    const dayCell = (e.target as HTMLElement).closest('[data-day-cell]');
    if (!dayCell) {
        handleDragEnd();
        return;
    }

    const targetDateStr = dayCell.getAttribute('data-date');
    if (!targetDateStr) {
        handleDragEnd();
        return;
    }

    const indicator = calendarRef.current?.querySelector('.drop-indicator');
    const masterId = getOriginalIdFromInstance(draggingEntry.id);
    
    setEntries(prevEntries => {
        let masterEntries = [...prevEntries];
        const masterEntryIndex = masterEntries.findIndex(entry => entry.id === masterId);

        if (masterEntryIndex === -1) {
            return prevEntries; // Should not happen
        }

        const isSameDayDrop = draggingEntry.date === targetDateStr;

        // --- Calculate new order based on indicator position ---
        const entryContainer = indicator?.parentElement;
        const siblings = Array.from(entryContainer?.children || []).filter(c => c.hasAttribute('data-entry-id') && c !== draggedElementRef.current);
        
        let targetOrder = 0;
        if (indicator) {
            const prevSiblingEl = indicator.previousElementSibling;
            const nextSiblingEl = indicator.nextElementSibling;
            
            const getOrderFromEl = (el: Element | null) => {
                const id = el?.getAttribute('data-entry-id');
                // Find from all generated entries as it might be on a different day
                const entry = generatedEntries.find(ge => ge.id === id);
                return entry?.order;
            }

            const prevOrder = getOrderFromEl(prevSiblingEl);
            const nextOrder = getOrderFromEl(nextSiblingEl);

            if (typeof prevOrder === 'number' && typeof nextOrder === 'number') {
                targetOrder = (prevOrder + nextOrder) / 2;
            } else if (typeof prevOrder === 'number') {
                targetOrder = prevOrder + 1;
            } else if (typeof nextOrder === 'number') {
                targetOrder = nextOrder - 1;
            } else {
                 targetOrder = 0; // It's the only item
            }
        } else {
            // No indicator, drop at the end
            targetOrder = siblings.length > 0 ? (Math.max(...siblings.map(s => {
                const id = s.getAttribute('data-entry-id');
                const entry = generatedEntries.find(ge => ge.id === id);
                return entry?.order ?? 0;
            })) + 1) : 0;
        }


        if (!isSameDayDrop) {
            // Moving to a new day
            const masterEntry = { ...masterEntries[masterEntryIndex] };
            if (masterEntry.recurrence === 'none') {
                masterEntry.date = targetDateStr;
                masterEntry.order = targetOrder;
                masterEntries[masterEntryIndex] = masterEntry;
            } else {
                // For recurring, create an exception for the move
                const updatedExceptions = { ...masterEntry.exceptions };
                updatedExceptions[draggingEntry.date] = { ...updatedExceptions[draggingEntry.date], movedTo: targetDateStr, order: targetOrder };
                masterEntry.exceptions = updatedExceptions;
                masterEntries[masterEntryIndex] = masterEntry;
                // Note: The logic to actually RENDER this moved exception needs to be implemented
                // in the generation logic. This is a complex change.
                // For now, we simplify and just change the master date.
                masterEntry.date = targetDateStr;
                masterEntry.order = targetOrder;
                masterEntries[masterEntryIndex] = masterEntry;
            }
        }

        // Reorder entries for the target day, including the dragged one
        const entriesOnTargetDay = masterEntries
            .filter(entry => entry.date === targetDateStr)
            .map(e => e.id === masterId ? {...e, order: targetOrder} : e) // inject dragged entry with its new order
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        // Renormalize ordering for the target day
        entriesOnTargetDay.forEach((entry, index) => {
            const idxToUpdate = masterEntries.findIndex(me => me.id === entry.id);
            if (idxToUpdate !== -1) {
                masterEntries[idxToUpdate].order = index;
            }
        });
        
        // Renormalize ordering for the source day if it was different
        if (!isSameDayDrop) {
            const entriesOnSourceDay = masterEntries
                .filter(entry => entry.date === draggingEntry.date && entry.id !== masterId)
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            
            entriesOnSourceDay.forEach((entry, index) => {
                const idxToUpdate = masterEntries.findIndex(me => me.id === entry.id);
                if (idxToUpdate !== -1) {
                    masterEntries[idxToUpdate].order = index;
                }
            });
        }
        
        return masterEntries;
    });

    handleDragEnd();
};
  
  const cancelDragTimeout = useCallback(() => {
    if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
    }
  }, []);
  
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, entry: Entry) => {
    if (isReadOnly || isSelectionMode) return;
    
    cancelDragTimeout();
    
    dragTimeoutRef.current = setTimeout(() => {
        isDraggingRef.current = true;
        draggingEntryRef.current = entry;
        draggedElementRef.current = e.currentTarget;
        setDragVisual(entry.id);
        if (navigator.vibrate) navigator.vibrate(50);
        
        const clone = e.currentTarget.cloneNode(true) as HTMLElement;
        clone.id = 'drag-clone';
        clone.style.position = 'absolute';
        clone.style.pointerEvents = 'none';
        clone.style.zIndex = '1000';
        clone.style.opacity = '0.8';
        document.body.appendChild(clone);
        
        const touch = e.touches[0];
        clone.style.left = `${touch.clientX - clone.offsetWidth / 2}px`;
        clone.style.top = `${touch.clientY - clone.offsetHeight / 2}px`;

    }, 500); 
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) {
        cancelDragTimeout();
        return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const clone = document.getElementById('drag-clone');
    if (clone) {
        clone.style.left = `${touch.clientX - clone.offsetWidth / 2}px`;
        clone.style.top = `${touch.clientY - clone.offsetHeight / 2}px`;
    }

    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetElement) return;

    const syntheticEvent = {
        preventDefault: () => {},
        target: targetElement,
        clientY: touch.clientY,
    } as unknown as React.DragEvent<HTMLDivElement>;

    handleDragOver(syntheticEvent);
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    cancelDragTimeout();
    
    const clone = document.getElementById('drag-clone');
    if (clone) clone.remove();

    if (!isDraggingRef.current) return;
    
    const touch = e.changedTouches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (targetElement) {
        const syntheticEvent = {
            preventDefault: () => {},
            target: targetElement,
        } as unknown as React.DragEvent<HTMLDivElement>;
        handleDrop(syntheticEvent);
    }
    
    handleDragEnd();
  };

  const Sidebar = () => (
    <SidebarContent 
      weeklyTotals={weeklyTotals}
      selectedDate={selectedDate}
    />
  )

  const years = Array.from({length: 21}, (_, i) => getYear(new Date()) - 10 + i);

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
        <main 
            ref={calendarRef}
            className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6"
            onDragLeave={handleDragLeave}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <Popover open={isMonthPickerOpen} onOpenChange={setMonthPickerOpen}>
                <PopoverTrigger asChild>
                    <button className="text-2xl sm:text-3xl font-bold tracking-tight text-left hover:text-primary transition-colors focus:outline-none rounded-md px-2 -mx-2 py-1">
                        {format(currentMonth, "MMMM yyyy")}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <div className="p-4">
                        <Select
                            value={String(getYear(currentMonth))}
                            onValueChange={(year) => setCurrentMonth(setYear(currentMonth, parseInt(year)))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(year => (
                                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2 p-4 pt-0">
                        {MONTHS.map((month, index) => (
                            <Button
                                key={month}
                                variant={getMonth(currentMonth) === index ? "default" : "ghost"}
                                onClick={() => {
                                    setCurrentMonth(setMonth(currentMonth, index));
                                    setMonthPickerOpen(false);
                                }}
                            >
                                {month}
                            </Button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectionMode}>
                {isSelectionMode ? 'Cancel' : 'Select'}
              </Button>
               {isSelectionMode && selectedInstances.length > 0 && (
                 <Button variant="destructive" size="sm" onClick={onBulkDelete}>
                   <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedInstances.length})
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
              const dayHasSelectedEntry = dayEntries.some(e => selectedInstanceIds.includes(e.id))
              const dayStr = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={dayStr}
                  data-day-cell
                  data-date={dayStr}
                  className={cn(
                    "relative flex flex-col h-36 md:h-44 rounded-xl p-2 border transition-colors",
                    !isReadOnly && "cursor-pointer",
                    !isSameMonth(day, currentMonth) ? "bg-muted/50 text-muted-foreground" : "bg-card",
                    !isReadOnly && isSameMonth(day, currentMonth) && !isSelectionMode && "hover:bg-accent/50",
                    isSameDay(day, selectedDate) && !isSelectionMode && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isSelectionMode && "hover:bg-primary/10",
                    isSelectionMode && dayHasSelectedEntry && "ring-2 ring-primary bg-primary/20",

                  )}
                  onClick={() => handleDayClick(day, dayEntries)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
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
                            checked={dayEntries.every(e => selectedInstanceIds.includes(e.id))}
                        />
                    )}
                  </div>
                  <ScrollArea className="flex-1 mt-1 -mx-2 px-2">
                    <div className="space-y-1.5 text-xs sm:text-sm entry-list-container">
                      {dayEntries.map(entry => (
                          <div 
                              key={entry.id}
                              data-entry-id={entry.id}
                              onClick={(e) => { e.stopPropagation(); openEditEntryDialog(entry); }}
                              onDragStart={(e) => handleDragStart(e, entry)}
                              onDragEnd={handleDragEnd}
                              onTouchStart={(e) => handleTouchStart(e, entry)}
                              onTouchMove={handleTouchMove}
                              onTouchEnd={handleTouchEnd}
                              draggable={!isReadOnly && !isSelectionMode}
                              className={cn(
                                  "px-2 py-1 rounded-full text-left flex items-center gap-2 transition-all duration-200 group",
                                  isMobile ? 'touch-action-pan-y' : '',
                                  !isReadOnly && !isSelectionMode && "cursor-grab active:cursor-grabbing hover:shadow-lg",
                                  (dragVisual === entry.id) && 'opacity-30',
                                  isSelectionMode && selectedInstanceIds.includes(entry.id) && "opacity-60",
                                  "bg-secondary/50 hover:bg-secondary",
                                  entry.isPaid && "opacity-50 bg-secondary/30",
                              )}
                          >
                            <div className={cn(
                                "p-1.5 rounded-full",
                                entry.isPaid ? 'bg-muted-foreground/20 text-muted-foreground' : entry.type === 'bill' ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-500'
                            )}>
                               {entry.isPaid ? <Check className="h-3 w-3" /> : entry.type === 'bill' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                            </div>
                            <span className={cn("flex-1 truncate font-medium", entry.isPaid && "line-through")}>{entry.name}</span>
                            <span className={cn("font-semibold", entry.isPaid && "line-through")}>{formatCurrency(entry.amount)}</span>
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
