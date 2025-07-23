
"use client";

import { useState, useEffect, useCallback } from 'react';

const isServer = typeof window === 'undefined';

function parseJSON<T>(value: string | null): T | undefined {
  try {
    return value === 'undefined' ? undefined : JSON.parse(value ?? '');
  } catch {
    console.warn('parsing error on', { value });
    return undefined;
  }
}

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  
  const readValue = useCallback((): T => {
    if (isServer) {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (parseJSON(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      if (isServer) {
        console.warn(`Tried setting localStorage key “${key}” on the server.`);
        return;
      }
      try {
        // Same as useState's setter function, allows reading previous value
        const newValue = value instanceof Function ? value(readValue()) : value;
        window.localStorage.setItem(key, JSON.stringify(newValue));
        setStoredValue(newValue);
      } catch (error) {
        console.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key, readValue]
  );
  
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  return [storedValue, setValue];
}

export default useLocalStorage;
    
