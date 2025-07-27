// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "TODO: REPLACE WITH YOUR API KEY",
  authDomain: "TODO: REPLACE WITH YOUR AUTH DOMAIN",
  projectId: "TODO: REPLACE WITH YOUR PROJECT ID",
  storageBucket: "TODO: REPLACE WITH YOUR STORAGE BUCKET",
  messagingSenderId: "TODO: REPLACE WITH YOUR MESSAGING SENDER ID",
  appId: "TODO: REPLACE WITH YOUR APP ID"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

export { app, auth, googleProvider };
