// src/hooks/use-dialog-animation.ts
"use client";

import { useRef, useEffect } from 'react';
import gsap from 'gsap';

export function useDialogAnimation(isOpen: boolean, onAfterClose?: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    gsap.set(dialogRef.current, { scale: 0.9, opacity: 0, display: 'none' });
    gsap.set(overlayRef.current, { opacity: 0, display: 'none' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      tl.current = gsap.timeline()
        .set([dialogRef.current, overlayRef.current], { display: 'grid' })
        .to(overlayRef.current, { opacity: 1, duration: 0.3, ease: 'power2.inOut' })
        .to(dialogRef.current, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }, "-=0.2");
    } else if (tl.current) {
      gsap.timeline()
        .to(dialogRef.current, { scale: 0.95, opacity: 0, duration: 0.3, ease: 'power2.in' })
        .to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.out' }, "-=0.1")
        .set([dialogRef.current, overlayRef.current], { display: 'none' })
        .call(() => {
            if (onAfterClose) {
                onAfterClose();
            }
        });
    }
  }, [isOpen, onAfterClose]);

  return { dialogRef, overlayRef };
}