"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Entry, RecurrenceInterval } from "@/lib/types";

const formSchema = z.object({
  type: z.enum(["bill", "income"], { required_error: "You need to select an entry type." }),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  date: z.date({ required_error: "A date is required." }),
  recurrence: z.enum(["none", "monthly", "bimonthly", "3months", "6months", "12months"]).default("none"),
});

type EntryFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<Entry, "id"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  entry: Entry | null;
  selectedDate: Date;
  timezone: string;
};

// Helper function to parse YYYY-MM-DD string as a date in the specified timezone
const parseDateInTimezone = (dateString: string, timeZone: string) => {
    // Splits the date string 'YYYY-MM-DD' into parts.
    const [year, month, day] = dateString.split('-').map(Number);
    // Creates a new Date object using the provided timezone.
    // This correctly interprets the date parts in the context of the given timezone,
    // avoiding shifts that happen when the browser's local timezone is different.
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export function EntryDialog({ isOpen, onClose, onSave, onDelete, entry, selectedDate, timezone }: EntryFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // Zod will handle validation, defaultValues can be initialized later in useEffect
  });

   React.useEffect(() => {
    if (isOpen) {
      if (entry) {
        // When editing, parse the stored date string in the context of the selected timezone
        const entryDateInTimezone = parseDateInTimezone(entry.date, timezone);
        form.reset({
          type: entry.type,
          name: entry.name,
          amount: entry.amount,
          date: entryDateInTimezone,
          recurrence: entry.recurrence || 'none',
        });
      } else {
        // For new entries, use the selectedDate from the calendar directly.
        // It's already a Date object from the user's interaction.
        form.reset({
          type: "bill",
          name: "",
          amount: 0,
          date: selectedDate,
          recurrence: 'none',
        });
      }
    }
  }, [isOpen, selectedDate, entry, form, timezone]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    const dataToSave = {
      ...values,
      // Format as YYYY-MM-DD for storage. The `values.date` is already correct.
      date: format(values.date, "yyyy-MM-dd"),
    };
    if (entry) {
      onSave({ ...dataToSave, id: entry.id });
    } else {
      onSave(dataToSave);
    }
    onClose();
  }
  
  const handleDelete = () => {
    if (entry && onDelete) {
      onDelete(entry.id);
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Entry" : "Add New Entry"}</DialogTitle>
          <DialogDescription>
            {entry ? "Update the details of your financial entry." : "Add a new bill or income to your calendar."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Entry Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="bill" />
                        </FormControl>
                        <FormLabel className="font-normal">Bill</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="income" />
                        </FormControl>
                        <FormLabel className="font-normal">Income</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name / Source</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Rent, Paycheck" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recurrence"
              render={({ field }) => (
                <FormItem>
                   <FormLabel>Recurrence</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a recurrence interval" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="bimonthly">Every 2 months</SelectItem>
                      <SelectItem value="3months">Every 3 months</SelectItem>
                      <SelectItem value="6months">Every 6 months</SelectItem>
                      <SelectItem value="12months">Annually (12 months)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sm:justify-between">
                {entry && (
                     <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                )}
               <div className="flex gap-2">
                 <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                 <Button type="submit">Save</Button>
               </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
