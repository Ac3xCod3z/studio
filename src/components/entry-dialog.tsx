
"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarIcon, Trash2, Copy } from "lucide-react";

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
import type { Entry } from "@/lib/types";
import { BillCategories, RecurrenceOptions } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";

const formSchema = z.object({
  type: z.enum(["bill", "income"], { required_error: "You need to select an entry type." }),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  date: z.date({ required_error: "A date is required." }),
  recurrence: z.enum(RecurrenceOptions),
  category: z.enum(BillCategories).optional(),
  isPaid: z.boolean().optional(),
  isAutoPay: z.boolean().optional(),
});

type EntryFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<Entry, "id" | 'date'> & { id?: string; date: Date; originalDate?: string }) => void;
  onDelete?: (id: string) => void;
  onCopy?: (entry: Entry) => void;
  entry: Entry | null;
  selectedDate: Date;
  timezone: string;
};

// Helper function to parse YYYY-MM-DD string as a date in the specified timezone
const parseDateInTimezone = (dateString: string, timeZone: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export function EntryDialog({ isOpen, onClose, onSave, onDelete, onCopy, entry, selectedDate, timezone }: EntryFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const entryType = form.watch("type");
  const isAutoPay = form.watch("isAutoPay");

   React.useEffect(() => {
    if (isOpen) {
      // If we are copying (entry.id is empty), use the selected date from calendar
      const resetDate = entry && entry.id ? parseDateInTimezone(entry.date, timezone) : selectedDate;
      const isInstancePaid = entry?.recurrence !== 'none'
        ? entry?.exceptions?.[entry.date]?.isPaid ?? entry.isPaid
        : entry?.isPaid ?? false;

      form.reset({
        type: entry?.type || "bill",
        name: entry?.name || "",
        amount: entry?.amount || 0,
        date: resetDate,
        recurrence: entry?.recurrence || 'none',
        category: entry?.category,
        isPaid: entry && !entry.id ? false : isInstancePaid, // Not paid if it's a new copy
        isAutoPay: entry?.isAutoPay || false,
      });
    }
  }, [isOpen, selectedDate, entry, timezone, form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    const dataToSave = {
      ...values,
      originalDate: entry?.date, // Pass the specific date of the instance being edited
    };
    
    if (values.type !== 'bill') {
      dataToSave.category = undefined;
      dataToSave.isAutoPay = undefined;
    }

    if (entry && entry.id) {
      // The ID passed back is the ID of the original master entry
      const originalId = entry.id.includes('-') ? entry.id.split('-').slice(0, 5).join('-') : entry.id;
      onSave({ ...dataToSave, id: originalId });
    } else {
      // New entry or a copy (which has no id)
      onSave({ ...dataToSave, id: undefined });
    }
    onClose();
  }
  
  const handleDelete = () => {
    if (entry && entry.id && onDelete) {
        const originalId = entry.id.includes('-') ? entry.id.split('-').slice(0, 5).join('-') : entry.id;
        onDelete(originalId);
        onClose();
    }
  }

  const handleCopy = () => {
    if (entry && onCopy) {
      onCopy(entry);
    }
  }

  const isEditing = entry && entry.id;

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Entry" : "Add New Entry"}</DialogTitle>
            <DialogDescription>
                {isEditing ? "Update the details of your financial entry." : "Add a new bill or income to your calendar."}
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                {(entryType === 'bill') && (
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {BillCategories.map(cat => (
                            <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                )}

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
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a recurrence interval" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="bimonthly">Every 2 months</SelectItem>
                            <SelectItem value="3months">Every 3 months</SelectItem>
                            <SelectItem value="6months">Every 6 months</SelectItem>
                            <SelectItem value="12months">Annually</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                {entryType === 'bill' && (
                  <FormField
                    control={form.control}
                    name="isAutoPay"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Set up as Auto-Pay
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                )}
                
                {(!isAutoPay || entryType === 'income') && (
                    <FormField
                    control={form.control}
                    name="isPaid"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                            Mark as {entryType === 'bill' ? 'Paid' : 'Received'}
                            </FormLabel>
                        </div>
                        </FormItem>
                    )}
                    />
                )}

                <DialogFooter className="pt-4 sm:justify-between flex-wrap">
                    <div className="flex gap-2 justify-start">
                        {isEditing && (
                            <>
                                {onCopy && (
                                    <Button type="button" variant="outline" onClick={handleCopy} size="icon">
                                        <Copy className="h-4 w-4" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                )}
                                {onDelete && (
                                    <Button type="button" variant="destructive" onClick={handleDelete} size="icon">
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete</span>
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </div>
                </DialogFooter>
            </form>
            </Form>
        </DialogContent>
    </Dialog>
  );
}
