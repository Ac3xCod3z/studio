
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import type { BudgetScore } from '@/lib/types';

interface BudgetScoreWidgetProps {
  score: BudgetScore;
}

const getScoreColor = (scoreValue: number) => {
  if (scoreValue >= 75) return 'hsl(var(--primary))'; // Green
  if (scoreValue >= 50) return 'hsl(var(--accent))'; // Yellow
  return 'hsl(var(--destructive))'; // Red
};

export const BudgetScoreWidget: React.FC<BudgetScoreWidgetProps> = ({ score }) => {
  const scoreColor = getScoreColor(score.score);
  
  const chartData = [
    { name: 'Score', value: score.score, color: scoreColor },
    { name: 'Remaining', value: 100 - score.score, color: 'hsl(var(--muted))' },
  ];

  return (
    <Card className="bg-background/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sensei's Evaluation
        </CardTitle>
        <CardDescription>{score.commentary}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto h-40 w-40">
            <PieChart width={160} height={160}>
                 <Pie
                    data={chartData}
                    cx={75}
                    cy={75}
                    innerRadius={60}
                    outerRadius={75}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={0}
                    dataKey="value"
                    stroke="none"
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
            </PieChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-4xl font-bold" style={{ color: scoreColor }}>
                    {score.score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};
