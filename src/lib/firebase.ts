import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth'; // Optional: if auth is needed
import { getFirebaseConfig } from './firebaseConfig';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth; // Optional

const firebaseConfig = getFirebaseConfig();

if (firebaseConfig.projectId) { // Only initialize if projectId is available
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  db = getFirestore(app);
  auth = getAuth(app); // Optional: initialize auth
} else {
  // Firebase is not configured, db and auth will be undefined.
  // Components should handle this gracefully.
  console.warn("Firebase not initialized due to missing configuration.");
}

// @ts-ignore
export { app, db, auth };
