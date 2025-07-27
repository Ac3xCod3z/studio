
"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Sparkles, Loader2, Bell, BellOff, Share2, Check, Copy } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { Entry, RolloverPreference } from "@/lib/types";
import { getRolloverRecommendation } from "@/ai/flows/rollover-optimization";
import { useToast } from "@/hooks/use-toast";
import { timezones } from "@/lib/timezones";
import { ScrollArea } from "./ui/scroll-area";
import useLocalStorage from "@/hooks/use-local-storage";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, type User, type AuthProvider } from "firebase/auth";

const formSchema = z.object({
  incomeLevel: z.coerce.number().positive({ message: "Income must be a positive number." }),
  financialGoals: z.string().min(10, { message: "Please describe your financial goals in a bit more detail." }),
});

type SettingsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  rolloverPreference: RolloverPreference;
  onRolloverPreferenceChange: (preference: RolloverPreference) => void;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  onNotificationsToggle: (enabled: boolean) => void;
  user: User | null;
  setUser: (user: User | null) => void;
};

export function SettingsDialog({
  isOpen,
  onClose,
  rolloverPreference,
  onRolloverPreferenceChange,
  timezone,
  onTimezoneChange,
  onNotificationsToggle,
  user,
  setUser
}: SettingsDialogProps) {
  const [recommendation, setRecommendation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [notificationStatus, setNotificationStatus] = useState("default");
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('fiscalFlowNotificationsEnabled', false);
  const [entries] = useLocalStorage<Entry[]>("fiscalFlowEntries", []);
  const [shareLink, setShareLink] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }
    // Reset share link state when dialog opens
    setShareLink('');
    setHasCopied(false);
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast({ title: "Signed in successfully!" });
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      toast({ title: "Sign-in failed", description: "Could not sign in with Google.", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    toast({ title: "Signed out." });
  };

  const handleNotificationToggle = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        toast({ title: "Notifications not supported", description: "Your browser does not support notifications.", variant: "destructive" });
        return;
    }

    if (notificationStatus === 'granted') {
        setNotificationsEnabled(false);
        onNotificationsToggle(false);
        toast({ title: "Notifications Disabled", description: "You will no longer receive bill reminders." });
    } else {
        const permission = await Notification.requestPermission();
        setNotificationStatus(permission);
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            onNotificationsToggle(true);
            toast({ title: "Notifications Enabled!", description: "You'll receive reminders for upcoming bills." });
        } else {
            toast({ title: "Notifications Blocked", description: "You need to enable notifications in your browser settings.", variant: "destructive" });
        }
    }
  };

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

  const handleGenerateShareLink = () => {
    const dataToShare = {
        entries,
        rollover: rolloverPreference,
        timezone
    };
    const jsonString = JSON.stringify(dataToShare);
    const encodedData = encodeURIComponent(btoa(jsonString));
    const url = `${window.location.origin}/view?data=${encodedData}`;
    setShareLink(url);
    setHasCopied(false);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
        setHasCopied(true);
        toast({ title: "Copied to Clipboard!", description: "The shareable link has been copied." });
        setTimeout(() => setHasCopied(false), 2000); // Reset icon after 2s
    }, (err) => {
        console.error('Could not copy text: ', err);
        toast({ title: "Copy Failed", description: "Could not copy the link to your clipboard.", variant: "destructive" });
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your application preferences and integrations.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="px-6">
          <div className="space-y-4 py-4">
             <div className="space-y-2">
                <h3 className="font-semibold">Google Calendar</h3>
                <p className="text-sm text-muted-foreground">
                    {user ? `Connected as ${user.displayName}.` : "Connect your account to sync your financial entries."}
                </p>
                {user ? (
                    <Button onClick={handleSignOut} className="w-full" variant="secondary">Sign Out</Button>
                ) : (
                    <Button onClick={handleGoogleSignIn} className="w-full">
                        Connect Google Calendar
                    </Button>
                )}
            </div>

            <Separator />

             <div className="space-y-2">
                <h3 className="font-semibold">Share Calendar</h3>
                <p className="text-sm text-muted-foreground">Generate a read-only link to share your calendar with others.</p>
                <Button onClick={handleGenerateShareLink} className="w-full">
                    <Share2 className="mr-2 h-4 w-4" /> Generate Share Link
                </Button>
                {shareLink && (
                    <div className="p-2 border rounded-md bg-muted">
                        <p className="text-sm text-muted-foreground break-all mb-2">{shareLink}</p>
                        <Button onClick={handleCopyToClipboard} size="sm" className="w-full">
                            {hasCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                            {hasCopied ? 'Copied!' : 'Copy Link'}
                        </Button>
                    </div>
                )}
            </div>

            <Separator />
            
             <div className="space-y-2">
                <h3 className="font-semibold">Notifications</h3>
                <p className="text-sm text-muted-foreground">Get reminders for your upcoming bills, delivered right to your device.</p>
                <Button 
                    onClick={handleNotificationToggle} 
                    className="w-full"
                    variant={notificationsEnabled && notificationStatus === 'granted' ? 'secondary' : 'default'}
                    disabled={notificationStatus === 'denied'}
                >
                    {notificationsEnabled && notificationStatus === 'granted' ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
                    {notificationsEnabled && notificationStatus === 'granted' ? 'Disable Notifications' : 'Enable Notifications'}
                </Button>
                 {notificationStatus === 'denied' && (
                    <p className="text-xs text-destructive text-center">You have blocked notifications. Please enable them in your browser settings.</p>
                )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="timezone" className="font-semibold">Timezone</Label>
              <p className="text-sm text-muted-foreground">Select your local timezone to ensure dates are handled correctly.</p>
              <Select onValueChange={onTimezoneChange} defaultValue={timezone}>
                <SelectTrigger id="timezone" className="w-full">
                  <SelectValue placeholder="Select a timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />
            
            <div className="space-y-4">
                <h3 className="font-semibold">Rollover Preference</h3>
                <p className="text-sm text-muted-foreground">Choose how leftover funds are handled at the end of each month.</p>
                <RadioGroup
                    value={rolloverPreference}
                    onValueChange={(value) => onRolloverPreferenceChange(value as RolloverPreference)}
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
                <p className="text-sm text-muted-foreground">Not sure which rollover option to choose? Let our AI help you decide based on your goals.</p>
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
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 pt-2">
          <Button type="button" onClick={onClose} className="w-full">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
