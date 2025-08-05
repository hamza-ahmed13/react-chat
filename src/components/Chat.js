import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
	Box,
	Container,
	Paper,
	TextField,
	Button,
	Typography,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	CircularProgress,
	Drawer,
	List,
	ListItem,
	ListItemButton,
	ListItemText,
	ListItemAvatar,
	Avatar,
	Divider,
	Badge,
	InputAdornment,
	Alert,
	Snackbar,
} from '@mui/material';
import {
	Send as SendIcon,
	ExitToApp as ExitToAppIcon,

	Search as SearchIcon,
	EmojiEmotions as EmojiIcon,
	AttachFile as AttachFileIcon,
	Call as CallIcon,
	VideoCall as VideoCallIcon,
	DoneAll as DoneAllIcon,
	Description as DocumentIcon,
	Mic as MicIcon,
	PhotoCamera as PhotoCameraIcon,
	Image as ImageIcon,
	Folder as FolderIcon,
	Close as CloseIcon,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';
import {
	connectSocket,
	sendMessage,
	sendFile,
	joinRoom,
	leaveRoom,
} from '../services/socket';
import EmojiPicker from 'emoji-picker-react';

const DRAWER_WIDTH = 300;

const formatTimestamp = (timestamp) => {
	const date = new Date(timestamp);
	const now = new Date();
	const diff = now - date;
	const oneDay = 24 * 60 * 60 * 1000;

	if (diff < oneDay) {
		// Today - show time
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} else if (diff < 2 * oneDay) {
		// Yesterday
		return 'Yesterday';
	} else {
		// Show date
		return date.toLocaleDateString();
	}
};

const truncateMessage = (message, maxLength = 30) => {
	if (!message) return '';
	return message.length > maxLength
		? message.substring(0, maxLength) + '...'
		: message;
};

const Chat = () => {
	const [message, setMessage] = useState('');
	const [messages, setMessages] = useState([]);
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [selectedChat, setSelectedChat] = useState(null);
	const [users, setUsers] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [error, setError] = useState(null);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	const [unreadMessages, setUnreadMessages] = useState({});
	const [isUploading, setIsUploading] = useState(false);
	const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
	const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
	const [previewFile, setPreviewFile] = useState(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [mediaRecorder, setMediaRecorder] = useState(null);
	const [recordingTime, setRecordingTime] = useState(0);

	const messagesEndRef = useRef(null);
	const messageInputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const attachmentMenuRef = useRef(null);
	const recordingTimerRef = useRef(null);
	const navigate = useNavigate();
	const { auth } = useFirebase();

	const filteredUsers = users.filter(
		(user) =>
			user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
	);



	useEffect(() => {
		const fetchUsers = async () => {
			if (!auth.currentUser) {
				console.log('No current user found');
				return;
			}

			try {
				setIsLoading(true);
				setError(null);
				console.log('Current user:', auth.currentUser.uid);

				// Try to fetch users with chat history first
				let response = await fetch(
					`http://localhost:8000/api/chat/users/${auth.currentUser.uid}`,
					{
						headers: {
							'ngrok-skip-browser-warning': 'true',
						},
					}
				);
				let data = await response.json();
				console.log('Chat users response:', data);

				if (!response.ok) {
					throw new Error(data.message || 'Failed to fetch users');
				}

				let processedUsers = [];

				// Check if we have the new format (with user and latestMessage properties)
				if (
					data.data &&
					Array.isArray(data.data) &&
					data.data.length > 0 &&
					data.data[0].user
				) {
					console.log('Processing new format response');
					processedUsers = data.data.map((item) => ({
						firebase_uid: item.user.firebase_uid,
						first_name: item.user.first_name,
						last_name: item.user.last_name,
						email: item.user.email,
						lastMessage: item.latestMessage
							? {
									text: item.latestMessage.message,
									timestamp: item.latestMessage.created_at,
									isOutgoing:
										item.latestMessage.sender_id === auth.currentUser.uid,
							  }
							: null,
					}));
				}
				// Check if we have users with lastMessage already in the expected format
				else if (
					data.data &&
					Array.isArray(data.data) &&
					data.data.length > 0
				) {
					console.log('Processing standard format response');
					processedUsers = data.data;
				}
				// If no users found with chat history, fetch all users
				else {
					console.log(
						'No users with chat history found, fetching all users...'
					);
					response = await fetch(
						'http://localhost:8000/api/users',
						{
							headers: {
								'ngrok-skip-browser-warning': 'true',
							},
						}
					);
					data = await response.json();
					console.log('All users response:', data);

					if (!response.ok) {
						throw new Error(data.message || 'Failed to fetch users');
					}

					// Transform users data to match chat users format
					processedUsers = data.data
						.filter((user) => user.firebase_uid !== auth.currentUser.uid)
						.map((user) => ({
							...user,
							lastMessage: null,
						}));
				}

				console.log('Processed users:', processedUsers);
				setUsers(processedUsers);

				// Join all potential chat rooms so we can receive messages in real-time
				const socket = connectSocket(auth.currentUser.uid);
				if (socket) {
					processedUsers.forEach((user) => {
						const roomName = generateRoomName(
							auth.currentUser.uid,
							user.firebase_uid
						);
						console.log(
							`Joining room for user ${user.first_name}: ${roomName}`
						);
						socket.emit('join_room', roomName);
					});
				} else {
					console.warn('Socket not available for joining rooms');
				}
			} catch (error) {
				console.error('Error fetching users:', error);
				setError(error.message);
			} finally {
				setIsLoading(false);
			}
		};

		fetchUsers();
	}, [auth.currentUser]);

	// Set up socket listener for new messages - separate useEffect with selectedChat dependency
	useEffect(() => {
		if (!auth.currentUser) return;

		const socket = connectSocket(auth.currentUser.uid);
		if (!socket) {
			console.error('Failed to get socket connection');
			return;
		}

		console.log(
			'Setting up socket listener with selectedChat:',
			selectedChat?.first_name || 'none'
		);
		console.log('Socket connected:', socket.connected);

		// Test socket connection
		socket.on('connect', () => {
			console.log('Socket connected in Chat component');
		});

		socket.on('disconnect', () => {
			console.log('Socket disconnected in Chat component');
		});

		const handleReceiveMessage = (newMessage) => {
			console.log('Received new message:', newMessage);
			console.log('Message type:', newMessage.message_type);
			console.log('Has attachment:', !!newMessage.attachment_url);
			console.log('Attachment URL:', newMessage.attachment_url);
			console.log(
				'Current selectedChat:',
				selectedChat?.firebase_uid || 'none'
			);

			// Ensure we're in the room for this conversation
			const otherUserId =
				newMessage.sender_id === auth.currentUser.uid
					? newMessage.receiver_id
					: newMessage.sender_id;
			const roomName = generateRoomName(auth.currentUser.uid, otherUserId);

			// Join the room if we're not already in it (for new conversations)
			if (socket && socket.connected) {
				socket.emit('join_room', roomName);
			}

			// Update users list with latest message
			setUsers((prevUsers) => {
				const updatedUsers = prevUsers.map((user) => {
					if (
						user.firebase_uid === newMessage.sender_id ||
						user.firebase_uid === newMessage.receiver_id
					) {
						let displayText = newMessage.text || newMessage.message;
						if (newMessage.attachment_url && !displayText) {
							switch (newMessage.message_type) {
								case 'image':
									displayText = '📷 Image';
									break;
								case 'video':
									displayText = '🎥 Video';
									break;
								case 'audio':
									displayText = '🎵 Audio';
									break;
								case 'document':
								case 'file':
									displayText = `📄 ${newMessage.attachment_name}`;
									break;
								default:
									displayText = '📎 Attachment';
							}
						}

						return {
							...user,
							lastMessage: {
								text: displayText,
								timestamp: newMessage.timestamp || newMessage.created_at,
								isOutgoing: newMessage.sender_id === auth.currentUser.uid,
							},
						};
					}
					return user;
				});

				// If the sender is not in our users list, we might need to fetch updated users
				const senderExists = updatedUsers.some(
					(user) => user.firebase_uid === newMessage.sender_id
				);
				const receiverExists = updatedUsers.some(
					(user) => user.firebase_uid === newMessage.receiver_id
				);

				if (!senderExists || !receiverExists) {
					console.log(
						'New user detected in message, might need to refresh user list'
					);
				}

				return updatedUsers;
			});

			// Update messages array if the message belongs to the current chat
			const isMessageForCurrentChat = selectedChat && (
				(newMessage.sender_id === auth.currentUser.uid && newMessage.receiver_id === selectedChat.firebase_uid) ||
				(newMessage.sender_id === selectedChat.firebase_uid && newMessage.receiver_id === auth.currentUser.uid) ||
				(newMessage.senderId === auth.currentUser.uid && newMessage.receiverId === selectedChat.firebase_uid) ||
				(newMessage.senderId === selectedChat.firebase_uid && newMessage.receiverId === auth.currentUser.uid)
			);

			if (isMessageForCurrentChat) {
				console.log(
					'✅ Message belongs to current chat, updating messages array'
				);
				console.log('Selected chat UID:', selectedChat.firebase_uid);
				console.log('Message sender:', newMessage.sender_id);
				console.log('Message receiver:', newMessage.receiver_id);

				const formattedMessage = {
					id: newMessage.id,
					text: newMessage.text || newMessage.message,
					senderId: newMessage.senderId || newMessage.sender_id,
					receiverId: newMessage.receiverId || newMessage.receiver_id,
					senderName: newMessage.senderName || (newMessage.sender
						? `${newMessage.sender.first_name} ${newMessage.sender.last_name}`
						: 'Unknown'),
					timestamp: newMessage.timestamp || newMessage.created_at,
					status: newMessage.status,
					message_type: newMessage.message_type,
					attachment_url: newMessage.attachment_url,
					attachment_type: newMessage.attachment_type,
					attachment_name: newMessage.attachment_name,
					attachment_size: newMessage.attachment_size,
				};

				console.log('Formatted message:', formattedMessage);
				console.log('Message has attachment_url:', !!formattedMessage.attachment_url);

				// Check for duplicate messages (prevent double-adding real messages)
				setMessages((prevMessages) => {
					console.log('Previous messages count:', prevMessages.length);

					// Check if this exact message already exists (by ID)
					const existingMessage = prevMessages.find(
						(msg) => msg.id && msg.id === formattedMessage.id
					);

					if (existingMessage) {
						console.log(
							'❌ Duplicate message detected (same ID), not adding:',
							formattedMessage.id
						);
						return prevMessages;
					}

					console.log(
						'✅ Adding new message to current chat:',
						formattedMessage
					);
					const newMessages = [...prevMessages, formattedMessage];
					console.log('New messages count:', newMessages.length);
					console.log('Message added with attachment_url:', formattedMessage.attachment_url);
					
					// Force re-render by updating messages state
					setTimeout(() => {
						console.log('Force updating messages state for attachment rendering');
					}, 100);
					
					return newMessages;
				});

				// Scroll to bottom after adding new message
				setTimeout(scrollToBottom, 100);
			} else {
				console.log(
					'❌ Message does not belong to current chat or no chat selected'
				);
				console.log('Selected chat UID:', selectedChat?.firebase_uid || 'none');
				console.log('Message sender:', newMessage.sender_id);
				console.log('Message receiver:', newMessage.receiver_id);

				// Increment unread count for chats not currently selected
				if (newMessage.sender_id !== auth.currentUser.uid) {
					console.log(
						'📬 Incrementing unread count for sender:',
						newMessage.sender_id
					);
					setUnreadMessages((prev) => {
						const newCount = (prev[newMessage.sender_id] || 0) + 1;
						console.log(
							'📬 New unread count for',
							newMessage.sender_id,
							':',
							newCount
						);
						return {
							...prev,
							[newMessage.sender_id]: newCount,
						};
					});
				}
			}
		};

		// Set up the event listener
		socket.on('receive_message', handleReceiveMessage);

		// Handle file upload errors
		socket.on('file_upload_error', (error) => {
			console.error('File upload error:', error);
			setSnackbar({ open: true, message: `File upload failed: ${error.error}`, severity: 'error' });
			setIsUploading(false);
		});

		// Handle file upload ready
		socket.on('file_upload_ready', (data) => {
			console.log('File upload ready:', data);
		});

		// Cleanup function
		return () => {
			socket.off('receive_message', handleReceiveMessage);
			socket.off('file_upload_error');
			socket.off('file_upload_ready');
			socket.off('connect');
			socket.off('disconnect');
		};
	}, [auth.currentUser, selectedChat]); // Include selectedChat as dependency

	// Scroll to bottom whenever messages change
	useEffect(() => {
		if (messages.length > 0) {
			setTimeout(scrollToBottom, 100);
		}
	}, [messages]);

	// Click outside handler for attachment menu
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
				setShowAttachmentMenu(false);
			}
		};

		if (showAttachmentMenu) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showAttachmentMenu]);

	// Cleanup recording on component unmount
	useEffect(() => {
		return () => {
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
			}
			if (mediaRecorder && isRecording) {
				mediaRecorder.stream.getTracks().forEach(track => track.stop());
			}
		};
	}, [mediaRecorder, isRecording]);

	const fetchMessages = React.useCallback(async () => {
		if (!selectedChat) return;

		try {
			const roomName = generateRoomName(
				auth.currentUser.uid,
				selectedChat.firebase_uid
			);
			const response = await fetch(
				`http://localhost:8000/api/messages/${roomName}`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);
			if (!response.ok) throw new Error('Failed to fetch messages');
			const data = await response.json();
			setMessages(data);
			scrollToBottom();
		} catch (error) {
			console.error('Error fetching messages:', error);
		}
	}, [selectedChat, auth.currentUser]);

	useEffect(() => {
		if (selectedChat) {
			console.log(
				'Selected chat changed to:',
				selectedChat.first_name,
				selectedChat.firebase_uid
			);
			fetchMessages();
			const roomName = generateRoomName(
				auth.currentUser.uid,
				selectedChat.firebase_uid
			);
			console.log('Joining room for selected chat:', roomName);
			joinRoom(roomName);

			// Clear unread messages for selected chat
			console.log(
				'🧹 Clearing unread messages for selected chat:',
				selectedChat.firebase_uid
			);
			setUnreadMessages((prev) => {
				console.log(
					'🧹 Previous unread count:',
					prev[selectedChat.firebase_uid] || 0
				);
				return {
					...prev,
					[selectedChat.firebase_uid]: 0,
				};
			});

			// Return cleanup function
			return () => {
				console.log('Leaving room for chat:', selectedChat.first_name);
				leaveRoom(roomName);
			};
		} else {
			console.log('No chat selected');
		}
	}, [selectedChat, auth.currentUser, fetchMessages]);



	const generateRoomName = (userId1, userId2) => {
		return [userId1, userId2].sort().join('-');
	};

	const handleMessageChange = (e) => {
		setMessage(e.target.value);
		handleTyping();
	};

	const handleTyping = () => {
		if (!selectedChat) return;

		const socket = connectSocket(auth.currentUser.uid);
		socket.emit('typing', {
			conversation_id: generateRoomName(
				auth.currentUser.uid,
				selectedChat.firebase_uid
			),
			user_id: auth.currentUser.uid,
		});

		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		typingTimeoutRef.current = setTimeout(() => {
			socket.emit('stop_typing', {
				conversation_id: generateRoomName(
					auth.currentUser.uid,
					selectedChat.firebase_uid
				),
				user_id: auth.currentUser.uid,
			});
		}, 1000);
	};

	const handleSendMessage = async () => {
		if (!message.trim() || !selectedChat) return;

		const messageData = {
			text: message.trim(),
			senderId: auth.currentUser.uid,
			receiverId: selectedChat.firebase_uid,
		};

		// Clear the input immediately
		setMessage('');
		messageInputRef.current?.focus();

		try {
			await sendMessage(messageData);
			console.log('Message sent successfully via socket');
			// The message will appear via the receive_message socket event
			// Scroll to bottom after sending
			setTimeout(scrollToBottom, 100);
		} catch (error) {
			console.error('Error sending message:', error);
			// Could show an error toast here
		}
	};

	const handleEmojiClick = (emojiData) => {
		setMessage((prev) => prev + emojiData.emoji);
		setShowEmojiPicker(false);
		messageInputRef.current?.focus();
	};

	const handleFileSelect = (event) => {
		const file = event.target.files[0];
		if (file) {
			if (file.type.startsWith('image/')) {
				setPreviewFile(file);
				setPreviewOpen(true);
			} else {
				handleSendFile(file);
			}
		}
		// Reset the input
		event.target.value = '';
		setShowAttachmentMenu(false);
	};

	const handleAttachmentMenuClick = () => {
		setShowAttachmentMenu(!showAttachmentMenu);
	};

	const handleImageSelect = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = (e) => {
			const file = e.target.files[0];
			if (file) {
				setPreviewFile(file);
				setPreviewOpen(true);
			}
		};
		input.click();
		setShowAttachmentMenu(false);
	};

	const handleDocumentSelect = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
		input.onchange = handleFileSelect;
		input.click();
		setShowAttachmentMenu(false);
	};

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const recorder = new MediaRecorder(stream);
			const chunks = [];

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunks.push(e.data);
				}
			};

			recorder.onstop = () => {
				const blob = new Blob(chunks, { type: 'audio/webm' });
				const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
				handleSendFile(file);
				
				// Stop all tracks
				stream.getTracks().forEach(track => track.stop());
			};

			setMediaRecorder(recorder);
			setIsRecording(true);
			setRecordingTime(0);
			recorder.start();

			// Start timer
			recordingTimerRef.current = setInterval(() => {
				setRecordingTime(prev => prev + 1);
			}, 1000);

		} catch (error) {
			console.error('Error starting recording:', error);
			setSnackbar({ open: true, message: 'Could not access microphone', severity: 'error' });
		}
	};

	const stopRecording = () => {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			setIsRecording(false);
			setRecordingTime(0);
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
			}
		}
	};

	const cancelRecording = () => {
		if (mediaRecorder && isRecording) {
			mediaRecorder.stream.getTracks().forEach(track => track.stop());
			setIsRecording(false);
			setRecordingTime(0);
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
			}
		}
	};

	const handleCameraSelect = () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.capture = 'environment';
		input.onchange = (e) => {
			const file = e.target.files[0];
			if (file) {
				setPreviewFile(file);
				setPreviewOpen(true);
			}
		};
		input.click();
		setShowAttachmentMenu(false);
	};

	const handleSendFile = async (file) => {
		if (!file || !selectedChat || !auth.currentUser) return;

		setIsUploading(true);
		setSnackbar({ open: true, message: `Uploading ${file.name}...`, severity: 'info' });
		
		try {
			// Send file via socket
			await sendFile({
				file: file,
				senderId: auth.currentUser.uid,
				receiverId: selectedChat.firebase_uid,
				message: message.trim() || null
			});
			
			console.log('File sent successfully via socket');
			setSnackbar({ open: true, message: 'File sent successfully!', severity: 'success' });
			
			// Clear the message input if it was included
			if (message.trim()) {
				setMessage('');
			}
			
		} catch (error) {
			console.error('Error sending file:', error);
			setSnackbar({ open: true, message: 'Failed to send file. Please try again.', severity: 'error' });
		} finally {
			setIsUploading(false);
		}
	};

	const renderMessageContent = (msg) => {
		const hasAttachment = msg.attachment_url && msg.attachment_type;
		const hasText = msg.text && msg.text.trim();
		const isOwnMessage = msg.senderId === auth.currentUser?.uid;
		
		console.log('Rendering message:', {
			id: msg.id,
			hasAttachment,
			attachment_url: msg.attachment_url,
			message_type: msg.message_type,
			hasText
		});

		return (
			<>
				{hasAttachment && (
					<Box sx={{ mb: hasText ? 0.5 : 0 }}>
						{msg.message_type === 'image' && (
							<Box
								sx={{
									position: 'relative',
									borderRadius: '8px',
									overflow: 'hidden',
									maxWidth: 280,
									cursor: 'pointer',
									'&:hover': {
										'& .image-overlay': {
											opacity: 1,
										},
									},
								}}
								onClick={() => window.open(`http://localhost:8000${msg.attachment_url}`, '_blank')}
							>
								<Box
									component="img"
									src={`http://localhost:8000${msg.attachment_url}`}
									alt={msg.attachment_name}
									sx={{
										width: '100%',
										height: 'auto',
										display: 'block',
									}}
								/>
								<Box
									className="image-overlay"
									sx={{
										position: 'absolute',
										top: 0,
										left: 0,
										right: 0,
										bottom: 0,
										backgroundColor: 'rgba(0,0,0,0.3)',
										opacity: 0,
										transition: 'opacity 0.2s',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<Typography sx={{ color: 'white', fontSize: '0.8rem' }}>
										Click to view
									</Typography>
								</Box>
							</Box>
						)}
						{msg.message_type === 'video' && (
							<Box
								sx={{
									borderRadius: '8px',
									overflow: 'hidden',
									maxWidth: 280,
									backgroundColor: '#000',
								}}
							>
								<Box
									component="video"
									src={`http://localhost:8000${msg.attachment_url}`}
									controls
									sx={{
										width: '100%',
										height: 'auto',
										display: 'block',
									}}
								/>
							</Box>
						)}
						{msg.message_type === 'audio' && (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									p: 1.5,
									backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
									borderRadius: '8px',
									minWidth: 200,
								}}
							>
								<MicIcon sx={{ color: isOwnMessage ? 'rgba(255,255,255,0.8)' : '#667781' }} />
								<Box
									component="audio"
									src={`http://localhost:8000${msg.attachment_url}`}
									controls
									sx={{
										flexGrow: 1,
										height: 32,
										'& audio': {
											width: '100%',
										},
									}}
								/>
							</Box>
						)}
						{(msg.message_type === 'document' || msg.message_type === 'file') && (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
									p: 1.5,
									backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : '#f0f2f5',
									borderRadius: '8px',
									cursor: 'pointer',
									minWidth: 200,
									maxWidth: 280,
									border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.2)' : '#e9edef'}`,
									'&:hover': {
										backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : '#e9edef',
									},
								}}
								onClick={() => window.open(`http://localhost:8000${msg.attachment_url}`, '_blank')}
							>
								<Box
									sx={{
										backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : '#008069',
										borderRadius: '50%',
										p: 1,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<DocumentIcon sx={{ 
										color: isOwnMessage ? 'white' : 'white', 
										fontSize: '1.2rem' 
									}} />
								</Box>
								<Box sx={{ flexGrow: 1, minWidth: 0 }}>
									<Typography
										variant="body2"
										sx={{
											fontWeight: 'medium',
											color: isOwnMessage ? 'rgba(255,255,255,0.9)' : '#111b21',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
											fontSize: '0.9rem',
										}}
									>
										{msg.attachment_name}
									</Typography>
									<Typography 
										variant="caption" 
										sx={{ 
											color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#667781',
											fontSize: '0.75rem',
										}}
									>
										{msg.attachment_size ? `${(msg.attachment_size / 1024 / 1024).toFixed(1)} MB` : 'Document'}
									</Typography>
								</Box>
							</Box>
						)}
					</Box>
				)}
				{hasText && (
					<Typography 
						variant="body2" 
						sx={{ 
							color: 'inherit',
							lineHeight: 1.4,
							wordBreak: 'break-word',
							fontSize: '0.9rem',
							mt: hasAttachment ? 0.5 : 0,
						}}
					>
						{msg.text}
					</Typography>
				)}
			</>
		);
	};



	const handleLogout = async () => {
		try {
			await signOut(auth);
			navigate('/');
		} catch (error) {
			console.error('Error signing out:', error);
		}
	};

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	return (
		<Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#f0f2f5' }}>
			{/* WhatsApp Sidebar */}
			<Drawer
				variant="permanent"
				sx={{
					width: DRAWER_WIDTH,
					flexShrink: 0,
					'& .MuiDrawer-paper': {
						width: DRAWER_WIDTH,
						boxSizing: 'border-box',
						backgroundColor: '#fff',
						borderRight: '1px solid #e9edef',
					},
				}}
			>
				{/* WhatsApp Header */}
				<Box sx={{ 
					backgroundColor: '#008069', 
					color: 'white',
					p: 2,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between'
				}}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
						{auth.currentUser && (
							<Avatar sx={{ 
								bgcolor: '#25d366',
								width: 35,
								height: 35,
								fontSize: '0.9rem',
								fontWeight: 'bold'
							}}>
								{users.find(u => u.firebase_uid === auth.currentUser.uid)?.first_name?.[0]?.toUpperCase() || 
								 auth.currentUser.displayName?.[0]?.toUpperCase() || 
								 auth.currentUser.email?.[0]?.toUpperCase() || 'U'}
								{users.find(u => u.firebase_uid === auth.currentUser.uid)?.last_name?.[0]?.toUpperCase() || ''}
							</Avatar>
						)}
						<Typography variant="h6" sx={{ fontWeight: 'bold' }}>
							Chats
						</Typography>
					</Box>
					<Box sx={{ display: 'flex', gap: 1 }}>
						<IconButton color="inherit" size="small">
							<CallIcon />
						</IconButton>
						<IconButton color="inherit" size="small">
							<VideoCallIcon />
						</IconButton>
						<IconButton 
							color="inherit" 
							size="small"
							onClick={() => setIsLogoutDialogOpen(true)}
							title="Logout"
						>
							<ExitToAppIcon />
						</IconButton>
					</Box>
				</Box>

				{/* Search Bar */}
				<Box sx={{ p: 2, backgroundColor: '#fff' }}>
					<TextField
						fullWidth
						placeholder="Search or start new chat"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						variant="outlined"
						size="small"
						sx={{ 
							'& .MuiOutlinedInput-root': {
								borderRadius: 3,
								backgroundColor: '#f0f2f5',
								'&:hover': {
									backgroundColor: '#e9edef',
								},
								'&.Mui-focused': {
									backgroundColor: '#fff',
									'& .MuiOutlinedInput-notchedOutline': {
										borderColor: '#008069',
									},
								},
								'& .MuiOutlinedInput-notchedOutline': {
									borderColor: 'transparent',
								},
							},
							'& .MuiInputBase-input': {
								fontSize: '0.9rem',
							},
						}}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon sx={{ 
										color: '#667781',
										fontSize: '1.1rem',
									}} />
								</InputAdornment>
							),
						}}
					/>
				</Box>

				{/* Chat List */}
				<Box sx={{ overflow: 'auto', flexGrow: 1 }}>
					{error && (
						<Alert severity="error" sx={{ mx: 2, mb: 2 }}>
							{error}
						</Alert>
					)}
					{isLoading ? (
						<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
							<CircularProgress />
						</Box>
					) : users.length === 0 ? (
						<Box sx={{ p: 2, textAlign: 'center' }}>
							<Typography color="textSecondary">No chats available</Typography>
						</Box>
					) : (
						<List sx={{ p: 0 }}>
							{filteredUsers.map((user) => (
								<React.Fragment key={user.firebase_uid}>
									<ListItem disablePadding>
										<ListItemButton
											selected={selectedChat?.firebase_uid === user.firebase_uid}
											onClick={() => setSelectedChat(user)}
											sx={{
												backgroundColor:
													selectedChat?.firebase_uid === user.firebase_uid
														? '#f0f2f5'
														: 'inherit',
												'&:hover': {
													backgroundColor: '#f5f6f6',
												},
												py: 1.5,
												px: 2,
											}}
										>
										<ListItemAvatar>
											<Avatar sx={{ 
												bgcolor: '#008069',
												width: 49,
												height: 49,
												fontSize: '1.1rem',
												fontWeight: 'bold'
											}}>
												{user.first_name?.[0]?.toUpperCase()}
												{user.last_name?.[0]?.toUpperCase()}
											</Avatar>
										</ListItemAvatar>
										<ListItemText
											primaryTypographyProps={{ component: 'div' }}
											secondaryTypographyProps={{ component: 'div' }}
											primary={
												<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
													<Typography
														sx={{
															fontWeight: unreadMessages[user.firebase_uid] > 0 ? 'bold' : 'normal',
															fontSize: '0.95rem',
															color: '#111b21',
														}}
													>
														{`${user.first_name || ''} ${user.last_name || ''}`}
													</Typography>
													{user.lastMessage && (
														<Typography
															variant="caption"
															sx={{
																color: '#667781',
																fontSize: '0.75rem',
															}}
														>
															{formatTimestamp(user.lastMessage.timestamp)}
														</Typography>
													)}
												</Box>
											}
											secondary={
												<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
													<Typography
														component="span"
														variant="body2"
														sx={{
															color: unreadMessages[user.firebase_uid] > 0 ? '#111b21' : '#667781',
															fontWeight: unreadMessages[user.firebase_uid] > 0 ? 'bold' : 'normal',
															fontSize: '0.85rem',
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															whiteSpace: 'nowrap',
															maxWidth: '180px',
														}}
													>
														{user.lastMessage
															? truncateMessage(user.lastMessage.text, 25)
															: 'No messages yet'}
													</Typography>
													{unreadMessages[user.firebase_uid] > 0 && (
														<Badge
															badgeContent={unreadMessages[user.firebase_uid]}
															sx={{
																'& .MuiBadge-badge': {
																	backgroundColor: '#25d366',
																	color: 'white',
																	fontSize: '0.7rem',
																	fontWeight: 'bold',
																	minWidth: 18,
																	height: 18,
																},
															}}
														>
															<Box />
														</Badge>
													)}
												</Box>
											}
										/>
										</ListItemButton>
									</ListItem>
									<Divider sx={{ ml: 7, mr: 1 }} />
								</React.Fragment>
							))}
						</List>
					)}
				</Box>
			</Drawer>



			{/* WhatsApp Main Chat Area */}
			<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>

				{selectedChat ? (
					<>
						{/* WhatsApp Chat Header */}
						<Paper
							elevation={1}
							sx={{
								backgroundColor: '#f0f2f5',
								borderBottom: '1px solid #e9edef',
								display: 'flex',
								alignItems: 'center',
								p: 1,
								gap: 1,
							}}
						>
							<Avatar sx={{ 
								bgcolor: '#008069',
								width: 40,
								height: 40,
								fontSize: '1rem',
								fontWeight: 'bold'
							}}>
								{selectedChat.first_name?.[0]?.toUpperCase()}
								{selectedChat.last_name?.[0]?.toUpperCase()}
							</Avatar>
							<Box sx={{ flexGrow: 1 }}>
								<Typography variant="subtitle1" sx={{ 
									fontWeight: '500',
									color: '#111b21',
									fontSize: '1rem'
								}}>
									{selectedChat.first_name} {selectedChat.last_name}
								</Typography>
								<Typography variant="caption" sx={{ 
									color: '#667781',
									fontSize: '0.8rem'
								}}>
									online
								</Typography>
							</Box>
							<Box sx={{ display: 'flex', gap: 1 }}>
								<IconButton size="small" sx={{ color: '#54656f' }}>
									<CallIcon />
								</IconButton>
								<IconButton size="small" sx={{ color: '#54656f' }}>
									<VideoCallIcon />
								</IconButton>

							</Box>
						</Paper>

						{/* WhatsApp Messages Area */}
						<Box
							sx={{
								flexGrow: 1,
								overflow: 'auto',
								backgroundImage: 'url("data:image/svg+xml,%3csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect width=\'100%25\' height=\'100%25\' fill=\'none\' stroke=\'%23e9edef\' stroke-width=\'1\' stroke-dasharray=\'6%2c 14\' stroke-dashoffset=\'0\' stroke-linecap=\'square\'/%3e%3c/svg%3e")',
								backgroundColor: '#efeae2',
								p: 1,
							}}
						>
							<Container maxWidth={false} sx={{ p: 0 }}>
								{messages.map((msg, index) => (
									<Box
										key={msg.id || `temp-${msg.timestamp}-${index}`}
										sx={{
											display: 'flex',
											justifyContent: msg.senderId === auth.currentUser.uid ? 'flex-end' : 'flex-start',
											mb: 1,
											px: 2,
										}}
									>
										<Box
											sx={{
												maxWidth: '65%',
												backgroundColor: msg.senderId === auth.currentUser.uid ? '#d9fdd3' : '#ffffff',
												borderRadius: '7.5px',
												p: 1.5,
												position: 'relative',
												boxShadow: '0 1px 0.5px rgba(0,0,0,.13)',
												'&::before': msg.senderId === auth.currentUser.uid ? {
													content: '""',
													position: 'absolute',
													top: 0,
													right: -8,
													width: 0,
													height: 0,
													borderLeft: '8px solid #d9fdd3',
													borderTop: '8px solid transparent',
													borderBottom: '8px solid transparent',
												} : {
													content: '""',
													position: 'absolute',
													top: 0,
													left: -8,
													width: 0,
													height: 0,
													borderRight: '8px solid #ffffff',
													borderTop: '8px solid transparent',
													borderBottom: '8px solid transparent',
												}
											}}
										>
											{renderMessageContent(msg)}
											<Box sx={{ 
												display: 'flex', 
												justifyContent: 'flex-end', 
												alignItems: 'center',
												gap: 0.5,
												mt: 0.5 
											}}>
												<Typography
													variant="caption"
													sx={{
														color: '#667781',
														fontSize: '0.6875rem',
													}}
												>
													{new Date(msg.timestamp).toLocaleTimeString([], { 
														hour: '2-digit', 
														minute: '2-digit',
														hour12: false 
													})}
												</Typography>
												{msg.senderId === auth.currentUser.uid && (
													<DoneAllIcon sx={{ 
														fontSize: '1rem', 
														color: '#53bdeb',
													}} />
												)}
											</Box>
										</Box>
									</Box>
								))}
								<div ref={messagesEndRef} />
							</Container>
						</Box>

						{/* WhatsApp Input Area */}
						<Paper
							component="form"
							onSubmit={(e) => {
								e.preventDefault();
								handleSendMessage();
							}}
							sx={{
								backgroundColor: '#f0f2f5',
								borderTop: '1px solid #e9edef',
								p: 1,
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
								<IconButton 
									size="small" 
									sx={{ color: '#54656f', mb: 0.5 }}
									onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								>
									<EmojiIcon />
								</IconButton>
								<Box sx={{ position: 'relative' }} ref={attachmentMenuRef}>
									<IconButton 
										size="small" 
										sx={{ color: '#54656f', mb: 0.5 }}
										onClick={handleAttachmentMenuClick}
										disabled={isUploading}
									>
										<AttachFileIcon />
									</IconButton>
									
									{/* WhatsApp-style Attachment Menu */}
									{showAttachmentMenu && (
										<Box
											sx={{
												position: 'absolute',
												bottom: '100%',
												left: 0,
												mb: 1,
												backgroundColor: '#ffffff',
												borderRadius: '8px',
												boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
												p: 1,
												minWidth: 200,
												zIndex: 1000,
											}}
										>
											<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														p: 1,
														borderRadius: '4px',
														cursor: 'pointer',
														'&:hover': { backgroundColor: '#f5f5f5' },
													}}
													onClick={handleImageSelect}
												>
													<ImageIcon sx={{ color: '#7c3aed', mr: 2 }} />
													<Typography variant="body2">Photos & Videos</Typography>
												</Box>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														p: 1,
														borderRadius: '4px',
														cursor: 'pointer',
														'&:hover': { backgroundColor: '#f5f5f5' },
													}}
													onClick={handleCameraSelect}
												>
													<PhotoCameraIcon sx={{ color: '#ef4444', mr: 2 }} />
													<Typography variant="body2">Camera</Typography>
												</Box>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														p: 1,
														borderRadius: '4px',
														cursor: 'pointer',
														'&:hover': { backgroundColor: '#f5f5f5' },
													}}
													onClick={handleDocumentSelect}
												>
													<FolderIcon sx={{ color: '#3b82f6', mr: 2 }} />
													<Typography variant="body2">Document</Typography>
												</Box>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														p: 1,
														borderRadius: '4px',
														cursor: 'pointer',
														'&:hover': { backgroundColor: '#f5f5f5' },
													}}
													onClick={() => {
														startRecording();
														setShowAttachmentMenu(false);
													}}
												>
													<MicIcon sx={{ color: '#ff6b35', mr: 2 }} />
													<Typography variant="body2">Audio</Typography>
												</Box>
											</Box>
										</Box>
									)}
								</Box>
								<Box sx={{ position: 'relative', flexGrow: 1 }}>
									{showEmojiPicker && (
										<Box
											sx={{
												position: 'absolute',
												bottom: '100%',
												left: 0,
												zIndex: 1000,
											}}
										>
											<EmojiPicker
												onEmojiClick={handleEmojiClick}
												width={300}
												height={400}
											/>
										</Box>
									)}
									{isRecording ? (
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												backgroundColor: '#fff3cd',
												borderRadius: '24px',
												px: 2,
												py: 1,
												border: '1px solid #ffeaa7',
											}}
										>
											<MicIcon sx={{ color: '#e74c3c', mr: 1, fontSize: '1.2rem' }} />
											<Typography variant="body2" sx={{ flexGrow: 1, color: '#856404' }}>
												Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
											</Typography>
											<IconButton size="small" onClick={cancelRecording} sx={{ color: '#dc3545', mr: 1 }}>
												<CloseIcon fontSize="small" />
											</IconButton>
											<IconButton size="small" onClick={stopRecording} sx={{ color: '#28a745' }}>
												<SendIcon fontSize="small" />
											</IconButton>
										</Box>
									) : (
										<TextField
											fullWidth
											value={message}
											onChange={handleMessageChange}
											placeholder="Type a message"
											variant="outlined"
											size="small"
											inputRef={messageInputRef}
											multiline
											maxRows={4}
											sx={{
												'& .MuiOutlinedInput-root': {
													borderRadius: '24px',
													backgroundColor: '#ffffff',
													fontSize: '0.9rem',
													'& fieldset': {
														borderColor: 'transparent',
													},
													'&:hover fieldset': {
														borderColor: 'transparent',
													},
													'&.Mui-focused fieldset': {
														borderColor: 'transparent',
													},
												},
												'& .MuiInputBase-input': {
													py: 1.25,
													px: 2,
												},
											}}
											onKeyPress={(e) => {
												if (e.key === 'Enter' && !e.shiftKey) {
													e.preventDefault();
													handleSendMessage(e);
												}
											}}
										/>
									)}
								</Box>
								{!isRecording && (
									message.trim() ? (
										<IconButton
											type="submit"
											disabled={isUploading}
											sx={{
												backgroundColor: '#008069',
												color: 'white',
												width: 40,
												height: 40,
												mb: 0.5,
												'&:hover': {
													backgroundColor: '#006a56',
												},
												'&:disabled': {
													backgroundColor: '#54656f',
													color: 'rgba(255,255,255,0.5)',
												},
											}}
											onClick={handleSendMessage}
										>
											{isUploading ? (
												<CircularProgress size={20} sx={{ color: 'white' }} />
											) : (
												<SendIcon />
											)}
										</IconButton>
									) : (
										<IconButton
											onClick={startRecording}
											sx={{
												backgroundColor: '#54656f',
												color: 'white',
												width: 40,
												height: 40,
												mb: 0.5,
												'&:hover': {
													backgroundColor: '#008069',
												},
											}}
										>
											<MicIcon />
										</IconButton>
									)
								)}
							</Box>
						</Paper>
					</>
				) : (
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
							alignItems: 'center',
							height: '100%',
							backgroundColor: '#f0f2f5',
							backgroundImage: 'url("data:image/svg+xml,%3csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect width=\'100%25\' height=\'100%25\' fill=\'none\' stroke=\'%23e9edef\' stroke-width=\'1\' stroke-dasharray=\'6%2c 14\' stroke-dashoffset=\'0\' stroke-linecap=\'square\'/%3e%3c/svg%3e")',
							p: 4,
						}}
					>
						<Box sx={{ 
							backgroundColor: '#008069',
							borderRadius: '50%',
							width: 80,
							height: 80,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							mb: 3,
						}}>
							<Typography variant="h3" sx={{ color: 'white', fontWeight: 'bold' }}>
								💬
							</Typography>
						</Box>
						<Typography variant="h5" sx={{ 
							color: '#41525d',
							fontWeight: '300',
							mb: 1,
							textAlign: 'center'
						}}>
							Chat App
						</Typography>
						<Typography variant="body1" sx={{ 
							color: '#667781',
							textAlign: 'center',
							maxWidth: 400,
							lineHeight: 1.5
						}}>
							
						</Typography>
					</Box>
				)}
			</Box>

			<Dialog
				open={isLogoutDialogOpen}
				onClose={() => setIsLogoutDialogOpen(false)}
			>
				<DialogTitle>Confirm Logout</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to logout? You will need to sign in again to
						continue chatting.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setIsLogoutDialogOpen(false)}>Cancel</Button>
					<Button
						onClick={handleLogout}
						color="primary"
						variant="contained"
						startIcon={<ExitToAppIcon />}
					>
						Logout
					</Button>
				</DialogActions>
			</Dialog>

			{/* Upload Status Snackbar */}
			<Snackbar
				open={snackbar.open}
				autoHideDuration={4000}
				onClose={() => setSnackbar({ ...snackbar, open: false })}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				<Alert 
					onClose={() => setSnackbar({ ...snackbar, open: false })} 
					severity={snackbar.severity}
					sx={{ width: '100%' }}
				>
					{snackbar.message}
				</Alert>
			</Snackbar>

			{/* Image Preview Dialog */}
			<Dialog
				open={previewOpen}
				onClose={() => setPreviewOpen(false)}
				maxWidth="md"
				fullWidth
				sx={{
					'& .MuiDialog-paper': {
						backgroundColor: '#1f2937',
						color: 'white',
					},
				}}
			>
				<DialogTitle sx={{ 
					display: 'flex', 
					justifyContent: 'space-between', 
					alignItems: 'center',
					backgroundColor: '#111827',
					color: 'white',
				}}>
					Send Image
					<IconButton 
						onClick={() => setPreviewOpen(false)}
						sx={{ color: 'white' }}
					>
						<CloseIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent sx={{ p: 0, backgroundColor: '#1f2937' }}>
					{previewFile && (
						<Box sx={{ 
							display: 'flex', 
							flexDirection: 'column',
							alignItems: 'center',
							p: 2,
						}}>
							<Box
								component="img"
								src={URL.createObjectURL(previewFile)}
								alt="Preview"
								sx={{
									maxWidth: '100%',
									maxHeight: '60vh',
									borderRadius: '8px',
									mb: 2,
								}}
							/>
							<TextField
								fullWidth
								placeholder="Add a caption..."
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								variant="outlined"
								multiline
								maxRows={3}
								sx={{
									'& .MuiOutlinedInput-root': {
										backgroundColor: 'rgba(255,255,255,0.1)',
										color: 'white',
										'& fieldset': {
											borderColor: 'rgba(255,255,255,0.3)',
										},
										'&:hover fieldset': {
											borderColor: 'rgba(255,255,255,0.5)',
										},
										'&.Mui-focused fieldset': {
											borderColor: '#25d366',
										},
									},
									'& .MuiInputBase-input': {
										color: 'white',
										'&::placeholder': {
											color: 'rgba(255,255,255,0.7)',
										},
									},
								}}
							/>
						</Box>
					)}
				</DialogContent>
				<DialogActions sx={{ 
					backgroundColor: '#111827',
					p: 2,
					gap: 1,
				}}>
					<Button 
						onClick={() => {
							setPreviewOpen(false);
							setPreviewFile(null);
							setMessage('');
						}}
						sx={{ color: 'rgba(255,255,255,0.7)' }}
					>
						Cancel
					</Button>
					<Button
						onClick={() => {
							handleSendFile(previewFile);
							setPreviewOpen(false);
							setPreviewFile(null);
						}}
						variant="contained"
						disabled={isUploading}
						sx={{
							backgroundColor: '#25d366',
							'&:hover': {
								backgroundColor: '#128c7e',
							},
						}}
						startIcon={isUploading ? <CircularProgress size={16} /> : <SendIcon />}
					>
						{isUploading ? 'Sending...' : 'Send'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default Chat;
