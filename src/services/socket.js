import io from 'socket.io-client';

let socket;

export const connectSocket = (userId) => {
  if (socket && socket.connected) return socket;

  socket = io('http://localhost:3000', {
    autoConnect: true,
    forceNew: true,
    timeout: 10000,
    transports: ['polling', 'websocket']
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    // Set user ID after connection
    socket.emit('set_user_id', userId);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
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
  
  const roomName = generateRoomName(messageData.senderId, messageData.receiverId);
  
  try {
    // Send message to backend via REST API only
    // The backend will handle the socket emission
    const response = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: messageData.text,
        user_id: messageData.senderId,
        receiver_id: messageData.receiverId,
        conversation_id: roomName,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return true;
  } catch (error) {
    console.error('Error sending message:', error);
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
};
