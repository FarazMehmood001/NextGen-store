// shared/config/firebase-config.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  collectionGroup,
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Single Unified Firebase Project Config shared by both Admin and User
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAsaAfXyuEgHA0c7EWgOXlY0TA8WvDtNxA",
  authDomain: "e-commerce-website-56f34.firebaseapp.com",
  projectId: "e-commerce-website-56f34",
  storageBucket: "e-commerce-website-56f34.firebasestorage.app",
  messagingSenderId: "705890208265",
  appId: "1:705890208265:web:df56e18d369aa3dfb786d8"
};

const STORAGE_KEY = 'aura_firebase_custom_config';

export function getStoredFirebaseConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not read custom Firebase config from localStorage:', e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveStoredFirebaseConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Error saving Firebase config:', e);
    return false;
  }
}

// Initialize Shared Firebase App
let app = null;
let auth = null;
let db = null;
let isFirebaseConnected = false;

try {
  const firebaseConfig = getStoredFirebaseConfig();
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId && !firebaseConfig.apiKey.includes('DummyKey')) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseConnected = true;
    console.log('✅ [Shared Firebase] Connected successfully to project:', firebaseConfig.projectId);
  } else {
    console.log('ℹ️ [Shared Firebase] Initialized in local/smart sync mode.');
  }
} catch (error) {
  console.warn('Firebase initialization error, local sync active:', error);
  isFirebaseConnected = false;
}

export { 
  app, 
  auth, 
  db, 
  isFirebaseConnected,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  collection, 
  collectionGroup,
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
};
