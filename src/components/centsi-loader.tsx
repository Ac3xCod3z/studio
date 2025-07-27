
"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { gsap } from 'gsap';
import { Logo } from './icons';
import { Skeleton } from './ui/skeleton';

const CentsiDashboard = dynamic(() => import('@/components/centsi-dashboard'), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

function DashboardSkeleton() {
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">Centsei</span>
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

export default function CentsiLoader() {
  const [animationComplete, setAnimationComplete] = useState(false);
  const logoRef = useRef(null);
  const nameRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    gsap.timeline({
      onComplete: () => {
        setAnimationComplete(true);
      },
    })
    .fromTo([logoRef.current, nameRef.current], 
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 1, ease: 'power2.out', stagger: 0.2 }
    )
    .to([logoRef.current, nameRef.current], 
        { opacity: 0, duration: 0.7, ease: 'power2.in', delay: 1.5 }
    )
    .to(containerRef.current, 
        { opacity: 0, duration: 0.5, ease: 'power2.in' },
        "-=0.5"
    );
  }, []);

  if (animationComplete) {
    return <CentsiDashboard />;
  }

  return (
    <div ref={containerRef} className="flex h-screen w-full items-center justify-center bg-background flex-col gap-4">
      <div ref={logoRef}>
        <Logo className="h-24 w-24 text-primary" />
      </div>
      <div ref={nameRef}>
        <h1 className="text-4xl font-bold tracking-tight">Centsei</h1>
      </div>
    </div>
  );
}
