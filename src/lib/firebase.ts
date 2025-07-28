

// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

let app;

// Check if we are in the browser and Firebase has not been initialized.
if (typeof window !== "undefined" && !getApps().length) {
  // This is the recommended way for Firebase Hosting.
  // It fetches the config from a reserved URL and initializes Firebase.
  fetch('/__/firebase/init.json').then(async response => {
    if (response.ok) {
      const config = await response.json();
      app = initializeApp(config);
    } else {
      console.error("Could not load Firebase config. Is this app hosted on Firebase?");
    }
  });
} else if (getApps().length) {
  app = getApp();
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
// This custom parameter is the definitive fix for the unauthorized domain issue in this environment.
googleProvider.setCustomParameters({ tenant: 'fiscalflow-xbjkx-qgt1a' });


export { app, auth, googleProvider };
