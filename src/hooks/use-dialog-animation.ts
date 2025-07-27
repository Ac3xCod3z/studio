// src/hooks/use-dialog-animation.ts
"use client";

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

export function useDialogAnimation(isOpen: boolean, onAfterClose?: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
    }
  }, [isOpen]);
  
  useEffect(() => {
    // Wait until the component is rendered and refs are attached
    if (!isRendered || !dialogRef.current || !overlayRef.current) {
        return;
    }

    if (isOpen) {
      // Entrance Animation
      gsap.timeline()
        .set([dialogRef.current, overlayRef.current], { display: 'grid', immediateRender: false })
        .to(overlayRef.current, { opacity: 1, duration: 0.3, ease: 'power2.inOut' })
        .fromTo(dialogRef.current, 
          { scale: 0.95, opacity: 0, y: 20 },
          { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' }, 
          "-=0.2"
        );
    } else {
      // Exit Animation
      gsap.timeline({
          onComplete: () => {
            setIsRendered(false);
            if (onAfterClose) onAfterClose();
          }
        })
        .to(dialogRef.current, { scale: 0.95, opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' })
        .to(overlayRef.current, { opacity: 0, duration: 0.2, ease: 'power2.out' }, "-=0.1")
        .set([dialogRef.current, overlayRef.current], { display: 'none' });
    }
  }, [isOpen, isRendered, onAfterClose]);

  return { dialogRef, overlayRef, isRendered };
}
