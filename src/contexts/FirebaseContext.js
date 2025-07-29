import React, { createContext, useContext } from 'react';
import { app, auth, db } from '../firebase-init';

// Create context outside of any function
const FirebaseContext = createContext({
	app: null,
	auth: null,
	db: null,
});

// Export the provider component
export function FirebaseProvider({ children }) {
	const value = {
		app,
		auth,
		db,
	};

	return (
		<FirebaseContext.Provider value={value}>
			{children}
		</FirebaseContext.Provider>
	);
}

// Export the hook
export function useFirebase() {
	const context = useContext(FirebaseContext);
	if (!context) {
		throw new Error('useFirebase must be used within a FirebaseProvider');
	}
	return context;
}
