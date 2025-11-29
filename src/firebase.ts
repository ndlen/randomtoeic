// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCn8dlupBnlcfvEzEtF8FKseQIfk7uYxPM",
    authDomain: "taikhoanpro-f4f55.firebaseapp.com",
    databaseURL: "https://taikhoanpro-f4f55-default-rtdb.firebaseio.com",
    projectId: "taikhoanpro-f4f55",
    storageBucket: "taikhoanpro-f4f55.firebasestorage.app",
    messagingSenderId: "301180423403",
    appId: "1:301180423403:web:81cac15a0fb3d892d382ae",
    measurementId: "G-RGYRMZ5604",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
