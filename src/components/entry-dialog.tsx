
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
import type { Entry } from "@/lib/types";
import { BillCategories } from "@/lib/types";

const formSchema = z.object({
  type: z.enum(["bill", "income"], { required_error: "You need to select an entry type." }),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
  date: z.date({ required_error: "A date is required." }),
  recurrence: z.enum(["none", "weekly", "monthly", "bimonthly", "3months", "6months", "12months"]).default("none"),
  category: z.enum(BillCategories).optional(),
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
    const [year, month, day] = dateString.split('-').map(Number);
    return toZonedTime(new Date(year, month - 1, day), timeZone);
};


export function EntryDialog({ isOpen, onClose, onSave, onDelete, entry, selectedDate, timezone }: EntryFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const entryType = form.watch("type");

   React.useEffect(() => {
    if (isOpen) {
      const resetDate = entry ? parseDateInTimezone(entry.date, timezone) : selectedDate;
      form.reset({
        type: entry?.type || "bill",
        name: entry?.name || "",
        amount: entry?.amount || 0,
        date: resetDate,
        recurrence: entry?.recurrence || 'none',
        category: entry?.category,
      });
    }
  }, [isOpen, selectedDate, entry, timezone, form.reset, form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    const dataToSave: Omit<Entry, 'id'> & {id?: string} = {
      ...values,
      date: format(values.date, "yyyy-MM-dd"),
    };
    
    if (values.type !== 'bill') {
      dataToSave.category = undefined;
    }

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

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
            <DialogTitle>{entry ? "Edit Entry" : "Add New Entry"}</DialogTitle>
            <DialogDescription>
                {entry ? "Update the details of your financial entry." : "Add a new bill or income to your calendar."}
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
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="bimonthly">Every 2 months</SelectItem>
                            <SelectItem value="3months">Every 3 months</SelectItem>
                            <SelectItem value="6months">Every 6 months</SelectItem>
                            <SelectItem value="12months">Every 12 months</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <DialogFooter className="pt-4 sm:justify-between">
                {entry && onDelete && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                )}
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
