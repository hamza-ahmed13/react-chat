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
	Menu,
	MenuItem,
	InputAdornment,
	Alert,
	Snackbar,
} from '@mui/material';
import {
	Send as SendIcon,
	ExitToApp as ExitToAppIcon,
	MoreVert as MoreVertIcon,
	Search as SearchIcon,
	EmojiEmotions as EmojiIcon,
	AttachFile as AttachFileIcon,
	Call as CallIcon,
	VideoCall as VideoCallIcon,
	DoneAll as DoneAllIcon,
	Description as DocumentIcon,
	Mic as MicIcon,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';
import {
	connectSocket,
	sendMessage,
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
	const [anchorEl, setAnchorEl] = useState(null);
	const [unreadMessages, setUnreadMessages] = useState({});
	const [isUploading, setIsUploading] = useState(false);
	const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

	const messagesEndRef = useRef(null);
	const messageInputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
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
						return {
							...user,
							lastMessage: {
								text: newMessage.message,
								timestamp: newMessage.created_at,
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
			if (
				selectedChat &&
				(newMessage.sender_id === selectedChat.firebase_uid ||
					newMessage.receiver_id === selectedChat.firebase_uid)
			) {
				console.log(
					'✅ Message belongs to current chat, updating messages array'
				);
				console.log('Selected chat UID:', selectedChat.firebase_uid);
				console.log('Message sender:', newMessage.sender_id);
				console.log('Message receiver:', newMessage.receiver_id);

				const formattedMessage = {
					id: newMessage.id,
					text: newMessage.message,
					senderId: newMessage.sender_id,
					receiverId: newMessage.receiver_id,
					senderName: newMessage.sender
						? `${newMessage.sender.first_name} ${newMessage.sender.last_name}`
						: 'Unknown',
					timestamp: newMessage.created_at,
					status: newMessage.status,
					message_type: newMessage.message_type,
				};

				console.log('Formatted message:', formattedMessage);

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

		// Cleanup function
		return () => {
			socket.off('receive_message', handleReceiveMessage);
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
			handleSendFile(file);
		}
		// Reset the input
		event.target.value = '';
	};

	const handleSendFile = async (file) => {
		if (!file || !selectedChat || !auth.currentUser) return;

		setIsUploading(true);
		setSnackbar({ open: true, message: `Uploading ${file.name}...`, severity: 'info' });
		
		try {
			const formData = new FormData();
			formData.append('attachment', file);
			formData.append('sender_id', auth.currentUser.uid);
			formData.append('receiver_id', selectedChat.firebase_uid);
			formData.append('conversation_id', generateRoomName(auth.currentUser.uid, selectedChat.firebase_uid));
			
			if (message.trim()) {
				formData.append('message', message.trim());
			}

			const response = await fetch('http://localhost:8000/api/messages/upload', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				throw new Error('Failed to upload file');
			}

			const result = await response.json();
			console.log('File uploaded successfully:', result);
			
			setSnackbar({ open: true, message: 'File sent successfully!', severity: 'success' });
			
			// Clear the message input if it was included
			if (message.trim()) {
				setMessage('');
			}
			
		} catch (error) {
			console.error('Error uploading file:', error);
			setSnackbar({ open: true, message: 'Failed to send file. Please try again.', severity: 'error' });
		} finally {
			setIsUploading(false);
		}
	};

	const renderMessageContent = (msg) => {
		const hasAttachment = msg.attachment_url && msg.attachment_type;
		const hasText = msg.text && msg.text.trim();

		return (
			<>
				{hasAttachment && (
					<Box sx={{ mb: hasText ? 1 : 0 }}>
						{msg.message_type === 'image' && (
							<Box
								component="img"
								src={`http://localhost:8000${msg.attachment_url}`}
								alt={msg.attachment_name}
								sx={{
									maxWidth: '100%',
									maxHeight: 300,
									borderRadius: 1,
									cursor: 'pointer',
								}}
								onClick={() => window.open(`http://localhost:8000${msg.attachment_url}`, '_blank')}
							/>
						)}
						{msg.message_type === 'video' && (
							<Box
								component="video"
								src={`http://localhost:8000${msg.attachment_url}`}
								controls
								sx={{
									maxWidth: '100%',
									maxHeight: 300,
									borderRadius: 1,
								}}
							/>
						)}
						{msg.message_type === 'audio' && (
							<Box
								component="audio"
								src={`http://localhost:8000${msg.attachment_url}`}
								controls
								sx={{
									width: '100%',
									maxWidth: 300,
								}}
							/>
						)}
						{(msg.message_type === 'document' || msg.message_type === 'file') && (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									p: 1,
									backgroundColor: 'rgba(0,0,0,0.05)',
									borderRadius: 1,
																	cursor: 'pointer',
							}}
							onClick={() => window.open(`http://localhost:8000${msg.attachment_url}`, '_blank')}
						>
							<DocumentIcon sx={{ color: '#667781', fontSize: '1.5rem' }} />
								<Box sx={{ flexGrow: 1, minWidth: 0 }}>
									<Typography
										variant="body2"
										sx={{
											fontWeight: 'medium',
											color: '#111b21',
											overflow: 'hidden',
											textOverflow: 'ellipsis',
											whiteSpace: 'nowrap',
										}}
									>
										{msg.attachment_name}
									</Typography>
									<Typography variant="caption" sx={{ color: '#667781' }}>
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
							color: '#111b21',
							fontSize: '0.875rem',
							lineHeight: 1.4,
							wordBreak: 'break-word',
						}}
					>
						{msg.text}
					</Typography>
				)}
			</>
		);
	};

	const handleUserMenuClick = (event) => {
		setAnchorEl(event.currentTarget);
	};

	const handleUserMenuClose = () => {
		setAnchorEl(null);
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
					<Typography variant="h6" sx={{ fontWeight: 'bold' }}>
						Chats
					</Typography>
					<Box sx={{ display: 'flex', gap: 1 }}>
						<IconButton color="inherit" size="small">
							<CallIcon />
						</IconButton>
						<IconButton color="inherit" size="small">
							<VideoCallIcon />
						</IconButton>
						<IconButton color="inherit" size="small">
							<MoreVertIcon />
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
								<IconButton 
									size="small" 
									sx={{ color: '#54656f' }}
									onClick={handleUserMenuClick}
								>
									<MoreVertIcon />
								</IconButton>
								<Menu
									anchorEl={anchorEl}
									open={Boolean(anchorEl)}
									onClose={handleUserMenuClose}
								>
									<MenuItem onClick={() => {
										handleUserMenuClose();
										setIsLogoutDialogOpen(true);
									}}>
										<ExitToAppIcon sx={{ mr: 1 }} />
										Logout
									</MenuItem>
								</Menu>
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
								<Box sx={{ position: 'relative' }}>
									<input
										type="file"
										id="file-input"
										style={{ display: 'none' }}
										onChange={handleFileSelect}
										accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
									/>
									<IconButton 
										size="small" 
										sx={{ color: '#54656f', mb: 0.5 }}
										onClick={() => document.getElementById('file-input').click()}
										disabled={isUploading}
									>
										<AttachFileIcon />
									</IconButton>
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
								</Box>
								<IconButton
									type="submit"
									disabled={!message.trim() || isUploading}
									sx={{
										backgroundColor: (message.trim() && !isUploading) ? '#008069' : '#54656f',
										color: 'white',
										width: 40,
										height: 40,
										mb: 0.5,
										'&:hover': {
											backgroundColor: (message.trim() && !isUploading) ? '#006a56' : '#54656f',
										},
										'&:disabled': {
											backgroundColor: '#54656f',
											color: 'rgba(255,255,255,0.5)',
										},
									}}
								>
									{isUploading ? (
										<CircularProgress size={20} sx={{ color: 'white' }} />
									) : message.trim() ? (
										<SendIcon />
									) : (
										<MicIcon />
									)}
								</IconButton>
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
		</Box>
	);
};

export default Chat;
