import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error logging in with Google', error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error logging out', error);
  }
};

export const saveSettingsToDB = async (uid: string, settings: any) => {
  try {
    await setDoc(doc(db, 'users', uid, 'data', 'settings'), {
      settingsStr: JSON.stringify(settings),
      updatedAt: Date.now()
    }, { merge: true });
  } catch(e) {
    console.error("Error saving settings to db", e);
  }
};

export const saveStateToDB = async (uid: string, state: any) => {
  try {
    const { balance, positions, tradeLogs, equitySnapshots } = state;
    await setDoc(doc(db, 'users', uid, 'data', 'state'), {
      balance: typeof balance === 'number' ? balance : 10000,
      positionsStr: JSON.stringify(Array.isArray(positions) ? positions : []),
      tradeLogsStr: JSON.stringify(Array.isArray(tradeLogs) ? tradeLogs.slice(0, 100) : []),
      equitySnapshotsStr: JSON.stringify(Array.isArray(equitySnapshots) ? equitySnapshots.slice(-100) : []),
      updatedAt: Date.now()
    }, { merge: true });
  } catch(e) {
    console.error("Error saving state to db", e);
  }
};
