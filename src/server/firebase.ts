import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

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
    console.warn("No Firebase config found. Sync will be disabled.");
  }
}

let app = null;
export let db = null;

if (firebaseConfig) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
