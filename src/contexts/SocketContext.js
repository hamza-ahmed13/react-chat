import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useFirebase } from './FirebaseContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
	const [socket, setSocket] = useState(null);
	const { auth } = useFirebase();

	useEffect(() => {
		// Initialize socket connection
		const newSocket = io('http://localhost:3000', {
			auth: {
				token: auth.currentUser?.uid, // Send user ID for authentication
			},
		});

		// Socket event listeners
		newSocket.on('connect', () => {
			console.log('Connected to socket server');
		});

		newSocket.on('connect_error', (error) => {
			console.error('Socket connection error:', error);
		});

		setSocket(newSocket);

		// Cleanup on unmount
		return () => {
			newSocket.close();
		};
	}, [auth.currentUser]);

	return (
		<SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
	);
}

export function useSocket() {
	const socket = useContext(SocketContext);
	if (socket === undefined) {
		throw new Error('useSocket must be used within a SocketProvider');
	}
	return socket;
}
