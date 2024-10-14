// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_KEY,
  authDomain: "bdbdgmain.firebaseapp.com",
  projectId: "bdbdgmain",
  storageBucket: "bdbdgmain.appspot.com",
  databaseURL:
    "https://bdbdgmain-default-rtdb.asia-southeast1.firebasedatabase.app",
  messagingSenderId: "193967452980",
  appId: "1:193967452980:web:c98e06d5312714483a6b61",
  measurementId: "G-JXECRGC3L2",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const database = getDatabase(app);
