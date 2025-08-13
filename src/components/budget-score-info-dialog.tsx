
"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface BudgetScoreInfoDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const InfoPoint = ({ title, children, badgeText }: { title: string, children: React.ReactNode, badgeText: string }) => (
    <div className="flex items-start gap-4">
        <Badge variant="secondary" className="mt-1 whitespace-nowrap">{badgeText}</Badge>
        <div>
            <h4 className="font-semibold">{title}</h4>
            <p className="text-sm text-muted-foreground">{children}</p>
        </div>
    </div>
);


export function BudgetScoreInfoDialog({ isOpen, onClose }: BudgetScoreInfoDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Sensei's Evaluation Explained</DialogTitle>
                    <DialogDescription>
                        Your Budget Health Score is a measure of your financial discipline. Here's how the Sensei grades your progress.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <InfoPoint title="Spending vs. Income" badgeText="40%">
                        This is the core of your training. A lower ratio of spending to income means you have more control and a higher score.
                    </InfoPoint>
                     <InfoPoint title="Savings Rate" badgeText="35%">
                        The true sign of a master is what they keep. The more of your income you save, the stronger your financial stance becomes.
                    </InfoPoint>
                     <InfoPoint title="Debt Management" badgeText="25%">
                        Sensei rewards those who face their debts. A lower percentage of your income going to debt payments strengthens your score.
                    </InfoPoint>
                </div>
                <div className="text-center text-xs text-muted-foreground pt-4">
                    Improve these areas, and you shall achieve financial enlightenment.
                </div>
                 <DialogFooter>
                    <Button onClick={onClose} className="w-full">Understood</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
