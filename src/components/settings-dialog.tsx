

"use client";

import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Sparkles, Loader2, Bell, BellOff, Share2, Check, Copy, Moon, Sun, Repeat, Download, Upload } from "lucide-react";
import { useTheme } from "next-themes";

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
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

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
};

export function SettingsDialog({
  isOpen,
  onClose,
  rolloverPreference,
  onRolloverPreferenceChange,
  timezone,
  onTimezoneChange,
  onNotificationsToggle,
}: SettingsDialogProps) {
  const [recommendation, setRecommendation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage('centseiNotificationsEnabled', false);
  const [entries, setEntries] = useLocalStorage<Entry[]>("centseiEntries", []);
  const [shareLink, setShareLink] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const { setTheme, theme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
        if ("Notification" in window) {
            setNotificationPermission(Notification.permission);
        }
        setShareLink('');
        setHasCopied(false);
    }
  }, [isOpen]);

  const handleExportData = () => {
    try {
      const dataToExport = {
        entries,
        rolloverPreference,
        timezone
      };
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `centsei_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Your data has been downloaded." });
    } catch (error) {
       toast({ title: "Export Failed", description: "Could not export your data.", variant: "destructive" });
    }
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') {
                throw new Error("File is not readable");
            }
            const importedData = JSON.parse(text);

            // Basic validation
            if (importedData && Array.isArray(importedData.entries) && importedData.rolloverPreference && importedData.timezone) {
                setEntries(importedData.entries);
                onRolloverPreferenceChange(importedData.rolloverPreference);
                onTimezoneChange(importedData.timezone);
                toast({ title: "Import Successful!", description: "Your data has been loaded. The app will now reload." });
                
                setTimeout(() => {
                  window.location.reload();
                }, 1500);

            } else {
                throw new Error("Invalid or corrupted data file.");
            }
        } catch (error: any) {
            toast({ title: "Import Failed", description: error.message || "Could not import data from the selected file.", variant: "destructive" });
        }
    };
    reader.readAsText(file);
    // Reset file input
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleNotificationToggle = async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          toast({ title: "Notifications not supported", description: "Your browser does not support this feature.", variant: "destructive" });
          return;
      }

      if (notificationsEnabled) {
          // If currently enabled, the user wants to disable them.
          setNotificationsEnabled(false);
          onNotificationsToggle(false);
          toast({ title: "Notifications Disabled", description: "You will no longer receive bill reminders." });
      } else {
          // If currently disabled, the user wants to enable them.
          if (notificationPermission === 'granted') {
              setNotificationsEnabled(true);
              onNotificationsToggle(true);
              toast({ title: "Notifications Enabled!", description: "You'll receive reminders for upcoming bills." });
          } else if (notificationPermission === 'denied') {
              toast({ title: "Notifications Blocked", description: "You need to enable notifications in your browser settings.", variant: "destructive" });
          } else {
              const permission = await Notification.requestPermission();
              setNotificationPermission(permission);
              if (permission === 'granted') {
                  setNotificationsEnabled(true);
                  onNotificationsToggle(true);
                  toast({ title: "Notifications Enabled!", description: "You'll receive reminders for upcoming bills." });
              } else {
                  toast({ title: "Notifications Blocked", description: "You did not grant permission for notifications.", variant: "destructive" });
              }
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

  if (!isOpen) {
    return null;
  }
  
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
                  <h3 className="font-semibold">Appearance</h3>
                  <Tabs value={theme} onValueChange={setTheme} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="light">
                              <Sun className="mr-2 h-4 w-4" />
                              Light
                          </TabsTrigger>
                          <TabsTrigger value="dark">
                              <Moon className="mr-2 h-4 w-4" />
                              Dark
                          </TabsTrigger>
                          <TabsTrigger value="system">System</TabsTrigger>
                      </TabsList>
                  </Tabs>
              </div>

              <Separator />
              
              <div className="space-y-2">
                  <h3 className="font-semibold">Data Management</h3>
                   <p className="text-sm text-muted-foreground">Export your data to a file or import it to sync across devices.</p>
                   <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handleExportData} variant="outline">
                            <Download className="mr-2 h-4 w-4" /> Export Data
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                           <Upload className="mr-2 h-4 w-4" /> Import Data
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImportData}
                            className="hidden"
                            accept="application/json"
                        />
                   </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                  <h3 className="font-semibold">Share Calendar</h3>
                  <p className="text-sm text-muted-foreground">Generate a read-only link to share your calendar with others.</p>
                  <Button onClick={handleGenerateShareLink} className="w-full btn-primary-hover">
                      <Share2 className="mr-2 h-4 w-4" /> Generate Share Link
                  </Button>
                  {shareLink && (
                      <div className="p-2 border rounded-md bg-muted">
                          <p className="text-sm text-muted-foreground break-all mb-2">{shareLink}</p>
                          <Button onClick={handleCopyToClipboard} size="sm" className="w-full btn-primary-hover">
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
                      className="w-full btn-primary-hover"
                      variant={notificationsEnabled ? 'secondary' : 'default'}
                      disabled={notificationPermission === 'denied'}
                  >
                      {notificationsEnabled ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
                      {notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
                  </Button>
                  {notificationPermission === 'denied' && (
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
                      <Button type="submit" disabled={isLoading} className="w-full btn-primary-hover">
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
