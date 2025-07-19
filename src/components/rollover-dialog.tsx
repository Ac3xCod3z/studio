"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Sparkles, Loader2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { RolloverPreference } from "@/lib/types";
import { getRolloverRecommendation } from "@/ai/flows/rollover-optimization";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  incomeLevel: z.coerce.number().positive({ message: "Income must be a positive number." }),
  financialGoals: z.string().min(10, { message: "Please describe your financial goals in a bit more detail." }),
});

type RolloverDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  preference: RolloverPreference;
  onPreferenceChange: (preference: RolloverPreference) => void;
};

export function RolloverDialog({ isOpen, onClose, preference, onPreferenceChange }: RolloverDialogProps) {
  const [recommendation, setRecommendation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { incomeLevel: 5000, financialGoals: "Save for a down payment on a house and build an emergency fund." },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setRecommendation("");
    try {
      const result = await getRolloverRecommendation(values);
      setRecommendation(result.recommendation);
    } catch (error) {
      console.error("Failed to get recommendation:", error);
      toast({
        variant: "destructive",
        title: "AI Recommendation Failed",
        description: "Could not get a recommendation at this time. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rollover Preference</DialogTitle>
          <DialogDescription>
            Choose how leftover funds are handled at the end of each month.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <RadioGroup
                value={preference}
                onValueChange={(value) => onPreferenceChange(value as RolloverPreference)}
                className="space-y-2"
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="carryover" id="carryover" />
                    <Label htmlFor="carryover" className="font-bold">Carry Over</Label>
                </div>
                <p className="pl-6 text-sm text-muted-foreground">Any leftover funds from this month will be added to next month's starting balance.</p>

                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="reset" id="reset" />
                    <Label htmlFor="reset" className="font-bold">Reset</Label>
                </div>
                 <p className="pl-6 text-sm text-muted-foreground">Each month starts fresh. Leftover funds are not automatically tracked into the next month.</p>
            </RadioGroup>
        </div>

        <Separator />
        
        <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent-foreground/80" /> AI Recommendation</h3>
             <p className="text-sm text-muted-foreground">Not sure which to choose? Let our AI help you decide based on your goals.</p>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="incomeLevel"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Average Monthly Income</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g. 5000" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="financialGoals"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Financial Goals</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g. Pay off debt, save for vacation..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Get Recommendation
                </Button>
            </form>
            </Form>
            {recommendation && (
                 <Alert>
                    <AlertTitle>AI Suggestion</AlertTitle>
                    <AlertDescription>
                        {recommendation}
                    </AlertDescription>
                </Alert>
            )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
