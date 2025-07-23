
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

// A wrapper for window.addEventListener that is type-safe and cleans up after itself
function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
) {
  const savedHandler = React.useRef(handler);

  React.useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  React.useEffect(() => {
    const isSupported = typeof window !== 'undefined' && window.addEventListener;
    if (!isSupported) return;

    const eventListener = (event: Event) => savedHandler.current(event as WindowEventMap[K]);
    window.addEventListener(eventName, eventListener);

    return () => {
      window.removeEventListener(eventName, eventListener);
    };
  }, [eventName, handler]);
}

// Custom hook for using localStorage that syncs between tabs
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item) {
                setStoredValue(JSON.parse(item));
            }
        } catch (error) {
            console.log(error);
            setStoredValue(initialValue);
        }
    }, [key, initialValue]);
    
    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
                // Dispatch a custom event that will be picked up by the event listener
                window.dispatchEvent(new StorageEvent('storage', { key }));
            }
        } catch (error) {
            console.log(error);
        }
    }, [key, storedValue]);
    
    const handleStorageChange = useCallback((event: StorageEvent) => {
        if (event.key === key) {
             try {
                const item = window.localStorage.getItem(key);
                setStoredValue(item ? JSON.parse(item) : initialValue);
            } catch (error) {
                console.error(error);
            }
        }
    }, [key, initialValue]);

    // Listen for changes to this key in other tabs
    useEventListener('storage', handleStorageChange);


    return [storedValue, setValue];
}

export default useLocalStorage;
