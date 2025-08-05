import io from 'socket.io-client';

let socket;

export const connectSocket = (userId) => {
	if (socket && socket.connected) return socket;

	socket = io('http://localhost:8000', {
		autoConnect: true,
		forceNew: false,
		timeout: 20000,
		transports: ['websocket', 'polling'],
		reconnection: true,
		reconnectionAttempts: 5,
		reconnectionDelay: 1000,
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
	});

	socket.on('connect_error', (error) => {
		console.error('Socket connection error:', error);
	});

	socket.on('reconnect', (attemptNumber) => {
		console.log('Socket reconnected after', attemptNumber, 'attempts');
	});

	socket.on('reconnect_error', (error) => {
		console.error('Socket reconnection error:', error);
	});

	socket.on('connect_error', (error) => {
		console.error('Socket connection error:', error);
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
	if (!socket) return;
	console.log('Joining room:', roomName);
	socket.emit('join_room', roomName);
};

export const leaveRoom = (roomName) => {
	if (!socket) return;
	console.log('Leaving room:', roomName);
	socket.emit('leave_room', roomName);
};

export const sendMessage = async (messageData) => {
	if (!socket) return;

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

		return true;
	} catch (error) {
		console.error('Error sending message:', error);
		throw error;
	}
};

export const sendGroupMessage = async (messageData) => {
	if (!socket) return;

	try {
		// Send group message via socket
		socket.emit('send_group_message', {
			message: messageData.text,
			user_id: messageData.senderId,
			group_id: messageData.groupId
		});

		console.log('Group message sent via socket');
		return true;
	} catch (error) {
		console.error('Error sending group message:', error);
		throw error;
	}
};

export const emitTyping = (userId, receiverId) => {
	if (!socket) return;
	const roomName = generateRoomName(userId, receiverId);
	socket.emit('typing', { conversation_id: roomName, user_id: userId });
};

export const emitStopTyping = (userId, receiverId) => {
	if (!socket) return;
	const roomName = generateRoomName(userId, receiverId);
	socket.emit('stop_typing', { conversation_id: roomName, user_id: userId });
};

export const sendFile = async (fileData) => {
	if (!socket) return;

	const roomName = generateRoomName(
		fileData.senderId,
		fileData.receiverId
	);

	try {
		// Check file size limit (10MB)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (fileData.file.size > maxSize) {
			throw new Error('File size too large. Maximum size is 10MB.');
		}

		// Convert file to base64
		const base64Data = await fileToBase64(fileData.file);
		console.log('File converted to base64, size:', base64Data.length);
		
		// Split large files into chunks
		const chunkSize = 64 * 1024; // 64KB chunks
		const chunks = [];
		for (let i = 0; i < base64Data.length; i += chunkSize) {
			chunks.push(base64Data.slice(i, i + chunkSize));
		}

		console.log('File split into', chunks.length, 'chunks');

		// Send file metadata first
		socket.emit('send_file_start', {
			fileName: fileData.file.name,
			fileType: fileData.file.type,
			fileSize: fileData.file.size,
			user_id: fileData.senderId,
			receiver_id: fileData.receiverId,
			conversation_id: roomName,
			message: fileData.message || null,
			isGroup: false,
			totalChunks: chunks.length
		});

		// Send chunks
		chunks.forEach((chunk, index) => {
			socket.emit('send_file_chunk', {
				chunkIndex: index,
				chunkData: chunk,
				user_id: fileData.senderId,
				receiver_id: fileData.receiverId,
				conversation_id: roomName
			});
		});

		console.log('File data sent via socket in chunks');
		return true;
	} catch (error) {
		console.error('Error sending file:', error);
		console.error('Error details:', error.stack);
		throw error;
	}
};

// Helper function to convert file to base64
const fileToBase64 = (file) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			// Remove the data:image/jpeg;base64, part
			const base64 = reader.result.split(',')[1];
			resolve(base64);
		};
		reader.onerror = error => reject(error);
	});
};

export const sendGroupFile = async (fileData) => {
	if (!socket) return;

	try {
		// Check file size limit (10MB)
		const maxSize = 10 * 1024 * 1024; // 10MB
		if (fileData.file.size > maxSize) {
			throw new Error('File size too large. Maximum size is 10MB.');
		}

		// Convert file to base64
		const base64Data = await fileToBase64(fileData.file);
		console.log('Group file converted to base64, size:', base64Data.length);
		
		// Split large files into chunks
		const chunkSize = 64 * 1024; // 64KB chunks
		const chunks = [];
		for (let i = 0; i < base64Data.length; i += chunkSize) {
			chunks.push(base64Data.slice(i, i + chunkSize));
		}

		console.log('Group file split into', chunks.length, 'chunks');

		// Send file metadata first
		socket.emit('send_file_start', {
			fileName: fileData.file.name,
			fileType: fileData.file.type,
			fileSize: fileData.file.size,
			user_id: fileData.senderId,
			group_id: fileData.groupId,
			message: fileData.message || null,
			isGroup: true,
			totalChunks: chunks.length
		});

		// Wait for server to be ready
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('File upload timeout'));
			}, 30000); // 30 second timeout

			socket.once('file_upload_ready', () => {
				clearTimeout(timeout);
				console.log('Server ready for group file upload');
				
				// Send chunks
				chunks.forEach((chunk, index) => {
					socket.emit('send_file_chunk', {
						chunkIndex: index,
						chunkData: chunk,
						user_id: fileData.senderId,
						group_id: fileData.groupId,
						isGroup: true
					});
				});

				console.log('All group file chunks sent');
				resolve(true);
			});

			socket.once('file_upload_error', (error) => {
				clearTimeout(timeout);
				console.error('Group file upload error:', error);
				reject(new Error(error.error || 'Group file upload failed'));
			});
		});
	} catch (error) {
		console.error('Error sending group file:', error);
		throw error;
	}
};

const generateRoomName = (userId1, userId2) => {
	return [userId1, userId2].sort().join('-');
};

const socketService = {
	connectSocket,
	disconnectSocket,
	joinRoom,
	leaveRoom,
	sendMessage,
	sendGroupMessage,
	sendFile,
	sendGroupFile,
	emitTyping,
	emitStopTyping,
};

export default socketService;
