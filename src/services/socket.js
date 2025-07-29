import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';
let socket = null;
let roomName = null;

// Generate room name function - exact copy from your backend
const generateRoomName = (senderId, receiverId) => {
	const sortedIDs = [senderId, receiverId].sort();
	return `${sortedIDs[0]}-${sortedIDs[1]}`;
};

export const connectSocket = (userId) => {
	if (!socket) {
		socket = io(SOCKET_URL, {
			auth: { userId },
			transports: ['polling', 'websocket'],
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			timeout: 20000,
			withCredentials: true,
			forceNew: true,
		});

		socket.on('connect', () => {
			console.log('Socket connected successfully');
		});

		socket.on('connect_error', (error) => {
			console.error('Socket connection error:', error.message);
		});

		socket.on('disconnect', (reason) => {
			console.log('Socket disconnected:', reason);
			if (reason === 'io server disconnect') {
				socket.connect();
			}
		});

		socket.on('error', (error) => {
			console.error('Socket error:', error);
		});
	}
	return socket;
};

export const disconnectSocket = () => {
	if (socket) {
		if (roomName) {
			socket.emit('leave room', roomName);
		}
		socket.removeAllListeners();
		socket.disconnect();
		socket = null;
		roomName = null;
		console.log('Socket disconnected and cleaned up');
	}
};

// Join room using your exact logic
export const joinRoom = (senderId, receiverId) => {
	// let name=	generateRoomName(senderId, receiverId);

	console.log('joining room', senderId, receiverId);

	roomName = generateRoomName(senderId, receiverId);
	console.log('roomName', roomName);
	socket.emit('join room', roomName);
	console.log('Joined room:', roomName);
};

export const leaveRoom = () => {
	if (!socket?.connected || !roomName) return;

	try {
		socket.emit('leave room', roomName);
		console.log('Left room:', roomName);
		roomName = null;
	} catch (error) {
		console.error('Error leaving room:', error);
	}
};

export const sendMessage = (message) => {
	if (!socket) {
		console.error('Socket not initialized');
		return;
	}

	if (!socket.connected) {
		console.error('Socket not connected');
		return;
	}

	if (!roomName) {
		console.error('No room joined');
		return;
	}

	try {
		socket.emit(
			'send_message',
			{
				...message,
				room: roomName,
			},
			(response) => {
				if (response?.error) {
					console.error('Error sending message:', response.error);
				} else {
					console.log('Message sent successfully to room:', roomName);
				}
			}
		);
	} catch (error) {
		console.error('Error emitting message:', error);
	}
};

export const isConnected = () => {
	return socket?.connected || false;
};

export const getCurrentRoom = () => roomName;

export const getSocket = () => socket;
