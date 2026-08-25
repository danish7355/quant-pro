import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "gen-lang-client-0285806294",
  appId: "1:302897307064:web:8207b99f713ab1bc7b834d",
  apiKey: "AIzaSyADTAJQt_04VUOOE0RqSJ7nOvWPKye-o-0",
  authDomain: "gen-lang-client-0285806294.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixcryptofutur-bafc30be-8456-4548-b8c4-ac91463e9dc0",
  storageBucket: "gen-lang-client-0285806294.firebasestorage.app",
  messagingSenderId: "302897307064",
  measurementId: "",
  oAuthClientId: "302897307064-klv33mcngt6ejms55dp5q8qikihci0lb.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

let firebaseConfig = null;

// Try loading from environment variable (for Render/production)
if (process.env.FIREBASE_CONFIG) {
  try {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
  } catch(e) {
    console.error("Invalid JSON in FIREBASE_CONFIG env var");
  }
}

// Fallback to local file (for AI Studio)
if (!firebaseConfig) {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    // Fallback to embedded default config to ensure Firestore is always active
    firebaseConfig = DEFAULT_FIREBASE_CONFIG;
  }
}

let app = null;
export let db: any = null;

try {
  const configToUse = firebaseConfig || DEFAULT_FIREBASE_CONFIG;
  app = initializeApp(configToUse);
  db = getFirestore(app, configToUse.firestoreDatabaseId);
  console.log("[FIREBASE] Initialized Firestore successfully.");
} catch (e) {
  console.error("[FIREBASE] Initialization error:", e);
}
