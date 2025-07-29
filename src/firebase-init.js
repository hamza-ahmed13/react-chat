import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: 'AIzaSyAhN5k4TNTDbeJJwwJBFvph2KB1NLsXJmw',
	authDomain: 'chat-app-8a674.firebaseapp.com',
	projectId: 'chat-app-8a674',
	storageBucket: 'chat-app-8a674.appspot.com',
	messagingSenderId: '2713332737',
	appId: '1:2713332737:web:d6a1c7e006095d91d6a400',
	databaseURL: `https://${process.env.REACT_APP_PROJECT_ID}.firebaseio.com`,
};

// Initialize Firebase only once using singleton pattern
class Firebase {
	constructor() {
		if (!Firebase.instance) {
			try {
				console.log('Initializing Firebase with config:', {
					...firebaseConfig,
					apiKey: '***', // Hide sensitive data in logs
				});

				// Initialize Firebase
				const app = initializeApp(firebaseConfig);

				// Initialize Auth
				const auth = getAuth(app);

				// Initialize Firestore with custom settings
				const db = initializeFirestore(app, {
					experimentalForceLongPolling: true,
					experimentalAutoDetectLongPolling: false,
					useFetchStreams: false,
					cacheSizeBytes: CACHE_SIZE_UNLIMITED,
				});

				this.app = app;
				this.auth = auth;
				this.db = db;

				Firebase.instance = this;
				console.log('Firebase initialized successfully');
			} catch (error) {
				console.error('Error initializing Firebase:', error);
				throw error;
			}
		}

		return Firebase.instance;
	}
}

const firebase = new Firebase();

// Export initialized instances
export const app = firebase.app;
export const auth = firebase.auth;
export const db = firebase.db;
