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
	AppBar,
	Toolbar,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	CircularProgress,
	Drawer,
	List,
	ListItem,
	ListItemText,
	ListItemAvatar,
	Avatar,
	Divider,
	Badge,
	Tooltip,
	Menu,
	MenuItem,
	InputAdornment,
	Alert,
} from '@mui/material';
import {
	Send as SendIcon,
	ExitToApp as ExitToAppIcon,
	Person as PersonIcon,
	MoreVert as MoreVertIcon,
	Search as SearchIcon,
	EmojiEmotions as EmojiIcon,
	AttachFile as AttachFileIcon,
	Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';
import {
	connectSocket,
	disconnectSocket,
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
	const [isTyping, setIsTyping] = useState(false);
	const [typingUsers, setTypingUsers] = useState(new Set());
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [anchorEl, setAnchorEl] = useState(null);
	const [unreadMessages, setUnreadMessages] = useState({});

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
					`https://cinnova-chat-api.deliveredoncloud.com/api/chat/users/${auth.currentUser.uid}`,
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
						'https://cinnova-chat-api.deliveredoncloud.com/api/users',
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
	}, [selectedChat, auth.currentUser]);

	const fetchMessages = async () => {
		if (!selectedChat) return;

		try {
			const roomName = generateRoomName(
				auth.currentUser.uid,
				selectedChat.firebase_uid
			);
			const response = await fetch(
				`https://cinnova-chat-api.deliveredoncloud.com/api/messages/${roomName}`,
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
	};

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
		<Box sx={{ display: 'flex', height: '100vh' }}>
			{/* Sidebar */}
			<Drawer
				variant="permanent"
				sx={{
					width: DRAWER_WIDTH,
					flexShrink: 0,
					'& .MuiDrawer-paper': {
						width: DRAWER_WIDTH,
						boxSizing: 'border-box',
					},
				}}
			>
				<Toolbar />
				<Box sx={{ overflow: 'auto' }}>
					<TextField
						fullWidth
						placeholder="Search users..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						sx={{ p: 2 }}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon />
								</InputAdornment>
							),
						}}
					/>
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
							<Typography color="textSecondary">No users found</Typography>
						</Box>
					) : (
						<List>
							{filteredUsers.map((user) => (
								<React.Fragment key={user.firebase_uid}>
									<ListItem
										button
										selected={selectedChat?.firebase_uid === user.firebase_uid}
										onClick={() => setSelectedChat(user)}
										sx={{
											backgroundColor:
												unreadMessages[user.firebase_uid] > 0 &&
												selectedChat?.firebase_uid !== user.firebase_uid
													? 'rgba(25, 118, 210, 0.08)'
													: 'inherit',
											'&:hover': {
												backgroundColor:
													unreadMessages[user.firebase_uid] > 0 &&
													selectedChat?.firebase_uid !== user.firebase_uid
														? 'rgba(25, 118, 210, 0.12)'
														: 'rgba(0, 0, 0, 0.04)',
											},
										}}
									>
										<ListItemAvatar>
											<Avatar>
												{user.first_name?.[0]}
												{user.last_name?.[0]}
											</Avatar>
										</ListItemAvatar>
										<ListItemText
											primary={
												<Typography
													sx={{
														fontWeight:
															unreadMessages[user.firebase_uid] > 0 &&
															selectedChat?.firebase_uid !== user.firebase_uid
																? 'bold'
																: 'normal',
													}}
												>
													{`${user.first_name || ''} ${user.last_name || ''}`}
												</Typography>
											}
											secondary={
												<Box
													component="span"
													sx={{ display: 'flex', flexDirection: 'column' }}
												>
													<Typography
														component="span"
														variant="body2"
														color="text.primary"
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 0.5,
															color: user.lastMessage?.isOutgoing
																? 'text.secondary'
																: 'inherit',
														}}
													>
														{user.lastMessage?.isOutgoing && (
															<SendIcon sx={{ fontSize: 12 }} />
														)}
														{user.lastMessage
															? truncateMessage(user.lastMessage.text)
															: 'No messages yet'}
													</Typography>
													{user.lastMessage && (
														<Typography
															component="span"
															variant="caption"
															color="text.secondary"
														>
															{formatTimestamp(user.lastMessage.timestamp)}
														</Typography>
													)}
												</Box>
											}
										/>
										{unreadMessages[user.firebase_uid] > 0 &&
											selectedChat?.firebase_uid !== user.firebase_uid && (
												<Badge
													badgeContent={unreadMessages[user.firebase_uid]}
													color="error"
													sx={{
														'& .MuiBadge-badge': {
															right: -6,
															top: 8,
															minWidth: 20,
															height: 20,
															fontSize: '0.75rem',
															fontWeight: 'bold',
														},
													}}
												>
													<Box
														sx={{
															width: 8,
															height: 8,
															borderRadius: '50%',
															backgroundColor: 'error.main',
														}}
													/>
												</Badge>
											)}
									</ListItem>
									<Divider variant="inset" component="li" />
								</React.Fragment>
							))}
						</List>
					)}
				</Box>
			</Drawer>

			{/* Main Chat Area */}
			<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
				<AppBar
					position="fixed"
					sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
				>
					<Toolbar>
						<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
							{selectedChat
								? `Chat with ${selectedChat.first_name} ${selectedChat.last_name}`
								: 'Select a chat'}
						</Typography>
						<IconButton color="inherit" onClick={handleUserMenuClick}>
							<MoreVertIcon />
						</IconButton>
						<Menu
							anchorEl={anchorEl}
							open={Boolean(anchorEl)}
							onClose={handleUserMenuClose}
						>
							<MenuItem
								onClick={() => {
									handleUserMenuClose();
									setIsLogoutDialogOpen(true);
								}}
							>
								<ExitToAppIcon sx={{ mr: 1 }} />
								Logout
							</MenuItem>
						</Menu>
					</Toolbar>
				</AppBar>
				<Toolbar />

				{selectedChat ? (
					<>
						<Box
							sx={{
								flexGrow: 1,
								overflow: 'auto',
								p: 2,
								backgroundColor: '#f5f5f5',
							}}
						>
							<Container maxWidth="md">
								{messages.map((msg, index) => (
									<Box
										key={msg.id || `temp-${msg.timestamp}-${index}`}
										sx={{
											display: 'flex',
											justifyContent:
												msg.senderId === auth.currentUser.uid
													? 'flex-end'
													: 'flex-start',
											mb: 2,
										}}
									>
										{msg.senderId !== auth.currentUser.uid && (
											<Avatar sx={{ mr: 1 }}>
												<PersonIcon />
											</Avatar>
										)}
										<Paper
											elevation={2}
											sx={{
												p: 2,
												maxWidth: '70%',
												backgroundColor:
													msg.senderId === auth.currentUser.uid
														? '#1976d2'
														: '#fff',
												color:
													msg.senderId === auth.currentUser.uid
														? '#fff'
														: '#000',
												borderRadius: 2,
											}}
										>
											<Typography variant="body1">{msg.text}</Typography>
											<Typography
												variant="caption"
												sx={{
													display: 'block',
													mt: 0.5,
													color:
														msg.senderId === auth.currentUser.uid
															? 'rgba(255, 255, 255, 0.7)'
															: 'rgba(0, 0, 0, 0.6)',
												}}
											>
												{new Date(msg.timestamp).toLocaleTimeString()}
											</Typography>
										</Paper>
										{msg.senderId === auth.currentUser.uid && (
											<Avatar sx={{ ml: 1 }}>
												<PersonIcon />
											</Avatar>
										)}
									</Box>
								))}
								<div ref={messagesEndRef} />
							</Container>
						</Box>

						<Paper
							component="form"
							onSubmit={(e) => {
								e.preventDefault();
								handleSendMessage();
							}}
							sx={{
								p: 2,
								borderTop: '1px solid #e0e0e0',
							}}
						>
							<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
								<Tooltip title="Add emoji">
									<IconButton
										onClick={() => setShowEmojiPicker(!showEmojiPicker)}
										size="small"
									>
										<EmojiIcon />
									</IconButton>
								</Tooltip>
								<Box sx={{ position: 'relative', flexGrow: 1 }}>
									{showEmojiPicker && (
										<Box
											sx={{
												position: 'absolute',
												bottom: '100%',
												left: 0,
												zIndex: 1,
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
										placeholder="Type a message..."
										variant="outlined"
										size="small"
										inputRef={messageInputRef}
										multiline
										maxRows={4}
										onKeyPress={(e) => {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												handleSendMessage(e);
											}
										}}
									/>
								</Box>
								<Button
									type="submit"
									variant="contained"
									endIcon={<SendIcon />}
									disabled={!message.trim()}
								>
									Send
								</Button>
							</Box>
						</Paper>
					</>
				) : (
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							height: '100%',
							bgcolor: '#f5f5f5',
						}}
					>
						<Typography variant="h6" color="textSecondary">
							Select a chat to start messaging
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
		</Box>
	);
};

export default Chat;
