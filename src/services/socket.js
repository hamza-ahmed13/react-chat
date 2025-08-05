import io from 'socket.io-client';

let socket;

export const connectSocket = (userId) => {
	// If socket exists and is connected, return it
	if (socket && socket.connected) {
		console.log('Reusing existing socket connection:', socket.id);
		return socket;
	}

	// If socket exists but is disconnected, disconnect it first
	if (socket && !socket.connected) {
		console.log('Disconnecting old socket before creating new one');
		socket.disconnect();
		socket = null;
	}

	console.log('Creating new socket connection for user:', userId);
	socket = io('http://localhost:3000', {
		autoConnect: true,
		forceNew: true,
		timeout: 5000, // Reduced timeout for faster connection
		transports: ['websocket', 'polling'], // Prioritize websocket for better performance
		upgrade: true,
		rememberUpgrade: true,
		extraHeaders: {
			'ngrok-skip-browser-warning': 'true',
		},
	});

	socket.on('connect', () => {
		console.log('Socket connected:', socket.id);
		// Set user ID after connection
		socket.emit('set_user_id', userId);
	});

	socket.on('disconnect', (reason) => {
		console.log('Socket disconnected:', reason);
		// Attempt to reconnect if disconnected unexpectedly
		if (reason === 'io server disconnect') {
			// The disconnection was initiated by the server, you need to reconnect manually
			console.log('Server disconnected socket, attempting to reconnect...');
			setTimeout(() => {
				if (socket) socket.connect();
			}, 1000);
		}
	});

	socket.on('connect_error', (error) => {
		console.error('Socket connection error:', error);
	});

	socket.on('reconnect', (attemptNumber) => {
		console.log('Socket reconnected after', attemptNumber, 'attempts');
		// Re-emit user ID after reconnection
		socket.emit('set_user_id', userId);
	});

	return socket;
};

export const disconnectSocket = () => {
	if (socket) {
		socket.disconnect();
		socket = null;
	}
};

export const joinRoom = (roomName) => {
	if (!socket || !socket.connected) {
		console.warn('Socket not connected, cannot join room:', roomName);
		return;
	}
	console.log('Joining room:', roomName);
	socket.emit('join_room', roomName);

	// Listen for confirmation
	socket.once(`joined_room_${roomName}`, () => {
		console.log('Successfully joined room:', roomName);
	});
};

export const leaveRoom = (roomName) => {
	if (!socket || !socket.connected) {
		console.warn('Socket not connected, cannot leave room:', roomName);
		return;
	}
	console.log('Leaving room:', roomName);
	socket.emit('leave_room', roomName);
};

export const sendMessage = async (messageData) => {
	if (!socket || !socket.connected) {
		console.error('Socket not connected, cannot send message');
		throw new Error('Socket not connected');
	}

	console.log('Sending message via socket:', messageData);

	const roomName = generateRoomName(
		messageData.senderId,
		messageData.receiverId
	);

	try {
		// Send message via socket
		socket.emit('send_message', {
			message: messageData.text,
			user_id: messageData.senderId,
			receiver_id: messageData.receiverId,
			conversation_id: roomName,
		});

		console.log('Message sent successfully');
		return true;
	} catch (error) {
		console.error('Error sending message:', error);
		throw error;
	}
};

// GROUP SOCKET FUNCTIONS (for real-time events only)
export const joinGroup = (groupId) => {
	if (!socket || !socket.connected) {
		console.warn('Socket not connected, cannot join group:', groupId);
		return;
	}
	console.log('Joining group:', groupId);
	socket.emit('join_group', groupId);

	// Listen for confirmation
	socket.once(`joined_group_${groupId}`, () => {
		console.log('Successfully joined group:', groupId);
	});
};

export const leaveGroup = (groupId) => {
	if (!socket || !socket.connected) {
		console.warn('Socket not connected, cannot leave group:', groupId);
		return;
	}
	console.log('Leaving group:', groupId);
	socket.emit('leave_group', groupId);
};

// GROUP TYPING FUNCTIONS
export const emitGroupTyping = (userId, groupId) => {
	if (!socket || !socket.connected) return;
	socket.emit('group_typing', { group_id: groupId, user_id: userId });
};

export const emitStopGroupTyping = (userId, groupId) => {
	if (!socket || !socket.connected) return;
	socket.emit('stop_group_typing', { group_id: groupId, user_id: userId });
};

// EXISTING INDIVIDUAL CHAT FUNCTIONS
export const emitTyping = (userId, receiverId) => {
	if (!socket || !socket.connected) return;
	const roomName = generateRoomName(userId, receiverId);
	socket.emit('typing', { conversation_id: roomName, user_id: userId });
};

export const emitStopTyping = (userId, receiverId) => {
	if (!socket || !socket.connected) return;
	const roomName = generateRoomName(userId, receiverId);
	socket.emit('stop_typing', { conversation_id: roomName, user_id: userId });
};

const generateRoomName = (userId1, userId2) => {
	return [userId1, userId2].sort().join('-');
};

export default {
	connectSocket,
	disconnectSocket,
	joinRoom,
	leaveRoom,
	sendMessage,
	emitTyping,
	emitStopTyping,
	// Group functions (for real-time events only)
	joinGroup,
	leaveGroup,
	emitGroupTyping,
	emitStopGroupTyping,
};
