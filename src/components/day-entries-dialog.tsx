
"use client";

import { format } from "date-fns";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Entry } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import React from "react";

type DayEntriesDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  entries: Entry[];
  onAddEntry: () => void;
  onEditEntry: (entry: Entry) => void;
};

export function DayEntriesDialog({
  isOpen,
  onClose,
  date,
  entries,
  onAddEntry,
  onEditEntry
}: DayEntriesDialogProps) {

  const sortedEntries = React.useMemo(() => 
    [...entries].sort((a, b) => {
        if (a.type === 'income' && b.type === 'bill') return -1;
        if (a.type === 'bill' && b.type === 'income') return 1;
        return a.name.localeCompare(b.name);
    }), [entries]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entries for {format(date, "MMMM d, yyyy")}</DialogTitle>
          <DialogDescription>
            Review all bills and income for the selected day.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
            {sortedEntries.length > 0 ? (
                <div className="space-y-3">
                    {sortedEntries.map((entry) => (
                        <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-card border cursor-pointer hover:bg-muted/50"
                            onClick={() => onEditEntry(entry)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-full", entry.type === 'bill' ? 'bg-destructive/20' : 'bg-accent/20')}>
                                    {entry.type === 'bill' ? (
                                        <ArrowDown className="h-5 w-5 text-destructive" />
                                    ) : (
                                        <ArrowUp className="h-5 w-5 text-emerald-500" />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold">{entry.name}</span>
                                    <span className={cn("text-lg font-bold", entry.type === 'bill' ? 'text-destructive' : 'text-emerald-600')}>
                                        {formatCurrency(entry.amount)}
                                    </span>
                                </div>
                            </div>
                            
                            {entry.recurrence && entry.recurrence !== 'none' && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full capitalize">
                                    {entry.recurrence === '12months' ? 'Annually' : entry.recurrence.replace('months', ' mos')}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <p>No entries for this day.</p>
                </div>
            )}
        </ScrollArea>
        <DialogFooter className="sm:justify-between gap-2 flex-col-reverse sm:flex-row">
           <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onAddEntry}>
            <Plus className="mr-2 h-4 w-4" /> Add New Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

