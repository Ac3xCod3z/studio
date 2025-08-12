

"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { gsap } from 'gsap';
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Logo } from './icons';
import { Skeleton } from './ui/skeleton';

const CentseiDashboard = dynamic(() => import('@/components/centsei-dashboard'), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Logo height={40} width={40} />
          <span className="font-bold text-lg">Centsei</span>
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
        <aside className="w-[350px] border-l overflow-y-auto p-6 hidden lg:block">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-24 w-full mb-4" />
          <Skeleton className="h-24 w-full" />
        </aside>
      </div>
    </div>
  );
}

export default function CentseiLoader() {
  const [animationComplete, setAnimationComplete] = useState(false);
  const logoRef = useRef(null);
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const taglineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
        gsap.registerPlugin(MotionPathPlugin);
    }
      
    const tl = gsap.timeline({
      onComplete: () => {
        setAnimationComplete(true);
      },
    });

    tl.fromTo([logoRef.current, textRef.current, taglineRef.current], 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.2 }
    )
    .add("end", "+=1.5")
    .to([logoRef.current, textRef.current, taglineRef.current], 
        { opacity: 0, scale: 0.8, duration: 0.5, ease: 'power2.in' },
        "end" 
    )
    .to(containerRef.current, 
        { opacity: 0, duration: 0.3, ease: 'power2.in' },
        "-=0.3"
    );
  }, []);

  if (animationComplete) {
    return <CentseiDashboard />;
  }

  return (
    <div ref={containerRef} className="relative flex h-screen w-full items-center justify-center bg-background flex-col gap-4 overflow-hidden">
      <div className='flex flex-col items-center justify-center gap-4'>
        <div ref={logoRef}>
             <Logo
                width={200}
                height={200}
            />
        </div>
         <h1 ref={textRef} className="text-4xl font-bold">Centsei</h1>
      </div>
      <div ref={taglineRef} className='absolute bottom-20'>
          <p className='text-muted-foreground'>Your Wallets Mr.Miyagi</p>
      </div>
    </div>
  );
}
