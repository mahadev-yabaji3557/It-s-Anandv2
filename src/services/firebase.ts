import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, Database } from 'firebase/database';
import { Toilet, FeedbackReport, AlertRecord } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig.databaseURL && firebaseConfig.apiKey);
};

let db: Database | null = null;

if (isFirebaseConfigured()) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.info('Connected to Firebase Realtime Database');
  } catch (err) {
    console.warn('Firebase init fallback:', err);
  }
}

export const subscribeToToilets = (callback: (toilets: Record<string, Toilet>) => void): (() => void) => {
  if (!db) return () => {};
  const toiletsRef = ref(db, 'smartrail/toilets');
  const unsubscribe = onValue(toiletsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
  return () => unsubscribe();
};

export const updateToiletStatusInFirebase = async (toiletId: string, updates: Partial<Toilet>): Promise<boolean> => {
  if (!db) return false;
  try {
    const toiletRef = ref(db, 'smartrail/toilets/' + toiletId);
    await update(toiletRef, {
      ...updates,
      lastUpdated: new Date().toLocaleTimeString()
    });
    return true;
  } catch (error) {
    console.error('Failed to update toilet in Firebase:', error);
    return false;
  }
};

export const submitFeedbackToFirebase = async (feedback: FeedbackReport): Promise<boolean> => {
  if (!db) return false;
  try {
    const feedbacksRef = ref(db, 'smartrail/feedbacks');
    const newFeedbackRef = push(feedbacksRef);
    await set(newFeedbackRef, feedback);
    return true;
  } catch (error) {
    console.error('Failed to submit feedback to Firebase:', error);
    return false;
  }
};

export const pushAlertToFirebase = async (alert: AlertRecord): Promise<boolean> => {
  if (!db) return false;
  try {
    const alertsRef = ref(db, 'smartrail/alerts/' + alert.id);
    await set(alertsRef, alert);
    return true;
  } catch (error) {
    console.error('Failed to write alert to Firebase:', error);
    return false;
  }
};
