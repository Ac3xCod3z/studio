
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

// Custom hook for using localStorage that syncs between tabs
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setStoredValue(JSON.parse(item));
        } else {
          window.localStorage.setItem(key, JSON.stringify(initialValue));
        }
      } catch (error) {
        console.log(error);
        setStoredValue(initialValue);
      }
    }
  }, [key, initialValue, isClient]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    if (!isClient) return;

    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Save state
      setStoredValue(valueToStore);
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      // We dispatch a custom event so every useLocalStorage hook are notified
      window.dispatchEvent(new Event("local-storage"));
    } catch (error) {
      console.log(error);
    }
  }, [key, storedValue, isClient]);

  const handleStorageChange = useCallback(
    (event: Event) => {
      if ((event as StorageEvent)?.key && (event as StorageEvent).key !== key) {
        return;
      }
      try {
        const item = window.localStorage.getItem(key);
        setStoredValue(item ? JSON.parse(item) : initialValue);
      } catch (error) {
        console.log(error);
      }
    },
    [key, initialValue]
  );
  
  useEffect(() => {
    if (isClient) {
      window.addEventListener("storage", handleStorageChange);
      window.addEventListener("local-storage", handleStorageChange);

      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("local-storage", handleStorageChange);
      };
    }
  }, [handleStorageChange, isClient]);

  return [storedValue, setValue];
}

export default useLocalStorage;

    