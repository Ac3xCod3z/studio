
// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  "projectId": "fiscalflow-xbjkx",
  "appId": "1:988219596746:web:aabca84ab7b409cba03933",
  "storageBucket": "fiscalflow-xbjkx.firebasestorage.app",
  "apiKey": "AIzaSyCHSnFE6N8V8tcXCYDx1Y45E7oOcFK4mT4",
  "authDomain": "fiscalflow-xbjkx.web.app",
  "messagingSenderId": "988219596746"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

export { app, auth, googleProvider };
