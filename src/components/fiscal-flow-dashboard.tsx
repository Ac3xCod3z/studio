"use client";

import React, { useState, useEffect } from "react";
import useLocalStorage from "@/hooks/use-local-storage";
import { useMedia } from "react-use";

import { EntryDialog } from "./entry-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Logo } from "./icons";
import { Settings, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Entry, RolloverPreference } from "@/lib/types";
import { FiscalFlowCalendar, SidebarContent } from "./fiscal-flow-calendar";

export default function FiscalFlowDashboard() {
  const [isClient, setIsClient] = useState(false);
  const [entries, setEntries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [rollover, setRollover] = useLocalStorage<RolloverPreference>("fiscalFlowRollover", "carryover");
  const [timezone, setTimezone] = useLocalStorage<string>('fiscalFlowTimezone', 'UTC');
  
  const [isEntryDialogOpen, setEntryDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const isMobile = useMedia("(max-width: 1024px)", false);

  useEffect(() => {
    setIsClient(true);
    // Set default timezone on client if not already set
    if (localStorage.getItem('fiscalFlowTimezone') === null) {
        setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
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
  };

  const openNewEntryDialog = (date: Date) => {
    setSelectedDate(date);
    setEditingEntry(null);
    setEntryDialogOpen(true);
  };

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
             <aside className="w-[350px] border-l overflow-y-auto p-6 hidden md:block">
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
              <SheetContent side="right" className="w-[300px] sm:w-[400px] p-0">
                  {/* The content is rendered dynamically inside the sheet based on a dummy calendar instance */}
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      
      <FiscalFlowCalendar 
        entries={entries}
        setEntries={setEntries}
        rollover={rollover}
        timezone={timezone}
        openNewEntryDialog={openNewEntryDialog}
        setEditingEntry={setEditingEntry}
        setSelectedDate={setSelectedDate}
        setEntryDialogOpen={setEntryDialogOpen}
        isMobile={isMobile}
        openMobileSheet={() => setMobileSheetOpen(true)}
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
      
      <SettingsDialog 
        isOpen={isSettingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        rolloverPreference={rollover}
        onRolloverPreferenceChange={setRollover}
        timezone={timezone}
        onTimezoneChange={setTimezone}
      />
    </div>
  );
}
