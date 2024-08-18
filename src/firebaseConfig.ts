// src/firebaseConfig.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD0dzBt1Jy6Y5bSvSBEv4POJ5-y3svy8OM",
    authDomain: "schedule-monkey.firebaseapp.com",
    projectId: "schedule-monkey",
    storageBucket: "schedule-monkey.appspot.com",
    messagingSenderId: "961952350219",
    appId: "1:961952350219:web:c50d96572b17dcb37a870e",
    measurementId: "G-BVJJ5M3PD6"
  };


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { db, auth, provider, signInWithPopup };
