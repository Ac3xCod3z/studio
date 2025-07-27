
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
    // Ensure MotionPathPlugin is registered on the client
    if (typeof window !== "undefined" && (window as any).MotionPathPlugin) {
        gsap.registerPlugin((window as any).MotionPathPlugin);
    } else {
        // Handle case where plugin might not be loaded, maybe from a script tag
        // For this setup, it's bundled, but this is a safe fallback.
    }
      
    const tl = gsap.timeline({
      onComplete: () => {
        setAnimationComplete(true);
      },
    });

    // 1. Fade in logo and name
    tl.fromTo([logoRef.current, nameRef.current], 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.2 }
    )
    .add("swirl", "+=0.5") 
    // 2. Animate name in a circular path into the logo
    .to(nameRef.current, {
        duration: 1.2,
        opacity: 0,
        scale: 0.1,
        motionPath: {
            path: [{x: 60, y: -30}, {x: 0, y: -60}, {x: -60, y: -30}, {x: 0, y: 0}],
            curviness: 1.25,
            autoRotate: false,
        },
        ease: 'power1.in',
        transformOrigin: "center center",
    }, "swirl")
    .to(logoRef.current, 
        { opacity: 0, scale: 0.8, duration: 0.5, ease: 'power2.in' },
        "-=0.5" 
    )
    .to(containerRef.current, 
        { opacity: 0, duration: 0.3, ease: 'power2.in' },
        "-=0.3"
    );
  }, []);

  if (animationComplete) {
    return <CentsiDashboard />;
  }

  return (
    <div ref={containerRef} className="flex h-screen w-full items-center justify-center bg-background flex-col gap-4 overflow-hidden">
      <div ref={logoRef}>
        <Logo className="h-20 w-20 text-primary" />
      </div>
      <div ref={nameRef}>
        <h1 className="text-4xl font-bold tracking-tight">Centsei</h1>
      </div>
    </div>
  );
}
