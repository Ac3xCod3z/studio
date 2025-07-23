
"use client";

import { useState, useEffect, useCallback } from 'react';

// This function checks if we are running on the server.
const isServer = typeof window === 'undefined';

// This function attempts to parse a JSON string, returning null if it fails.
function parseJSON<T>(value: string | null): T | undefined {
  try {
    return value === 'undefined' ? undefined : JSON.parse(value ?? '');
  } catch {
    console.warn(`parsing error on', { value }`);
    return undefined;
  }
}

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  
  // This function reads the value from localStorage.
  const readValue = useCallback((): T => {
    // Prevent build errors "window is not defined"
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

  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      // Prevent build errors "window is not defined"
       if (isServer) {
        console.warn(
          `Tried setting localStorage key “${key}” even though environment is not a client`,
        );
      }
      
      try {
        // Allow value to be a function so we have same API as useState
        const newValue = value instanceof Function ? value(readValue()) : value;
        
        // Save to local storage
        window.localStorage.setItem(key, JSON.stringify(newValue));
        
        // Save state
        setStoredValue(newValue);

        // We dispatch a custom event so every useLocalStorage hook are notified
        window.dispatchEvent(new Event('local-storage'));
      } catch (error) {
        console.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key, readValue]
  );
  
  useEffect(() => {
    setStoredValue(readValue());
  }, []);

  return [storedValue, setValue];
}

export default useLocalStorage;
