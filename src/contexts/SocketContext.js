import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useFirebase } from './FirebaseContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
	const [socket, setSocket] = useState(null);
	const { auth } = useFirebase();

	useEffect(() => {
		if (!auth.currentUser) {
			console.log('No user logged in, not connecting socket');
			return;
		}

		console.log('Initializing socket connection for user:', auth.currentUser.uid);

		// Initialize socket connection
		const newSocket = io('http://localhost:8000', {
			auth: {
				token: auth.currentUser.uid, // Send user ID for authentication
			},
			transports: ['polling', 'websocket']
		});

		// Socket event listeners
		newSocket.on('connect', () => {
			console.log('Connected to socket server');

			// Set user ID on the server
			newSocket.emit('set_user_id', auth.currentUser.uid);

			// Join a user-specific room for receiving messages
			const userRoom = `user-${auth.currentUser.uid}`;
			newSocket.emit('join_room', userRoom);
			console.log(`Joined user-specific room: ${userRoom}`);
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
