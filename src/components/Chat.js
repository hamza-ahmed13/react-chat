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
	Chip,
	Stack,
	useTheme,
	alpha,
	Checkbox,
	FormControlLabel,
	Tab,
	Tabs,
	AvatarGroup,
} from '@mui/material';
import {
	Send as SendIcon,
	ExitToApp as ExitToAppIcon,
	MoreVert as MoreVertIcon,
	Search as SearchIcon,
	EmojiEmotions as EmojiIcon,
	AttachFile as AttachFileIcon,
	Phone as PhoneIcon,
	VideoCall as VideoCallIcon,
	Info as InfoIcon,
	Check as CheckIcon,
	DoneAll as DoneAllIcon,
	AccessTime as AccessTimeIcon,
	Circle as CircleIcon,
	ArrowBack as ArrowBackIcon,
	Group as GroupIcon,
	Add as AddIcon,
	GroupAdd as GroupAddIcon,
	PersonAdd as PersonAddIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	ExitToApp as LeaveGroupIcon,
	AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';
import {
	connectSocket,
	disconnectSocket,
	sendMessage,
	joinRoom,
	leaveRoom,
	joinGroup,
	leaveGroup,
	emitTyping,
	emitStopTyping,
	emitGroupTyping,
	emitStopGroupTyping,
} from '../services/socket';
import EmojiPicker from 'emoji-picker-react';

const DRAWER_WIDTH = 400;

// WhatsApp color palette
const WHATSAPP_COLORS = {
	primary: '#00a884', // WhatsApp green
	primaryDark: '#008069',
	secondary: '#25d366',
	background: '#0b141a', // Dark background
	surface: '#202c33', // Chat surface
	surfaceVariant: '#2a3942',
	onSurface: '#e9edef',
	onSurfaceVariant: '#8696a0',
	outgoingMessage: '#005c4b', // Outgoing message bubble
	incomingMessage: '#202c33', // Incoming message bubble
	divider: '#8696a026',
	online: '#00d448',
};

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

const formatMessageTime = (timestamp) => {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
};

const truncateMessage = (message, maxLength = 35) => {
	if (!message) return '';
	return message.length > maxLength
		? message.substring(0, maxLength) + '...'
		: message;
};

const MessageStatusIcon = ({ status, isOutgoing, error }) => {
	if (!isOutgoing) return null;

	switch (status) {
		case 'sending':
			return (
				<AccessTimeIcon sx={{ fontSize: 16, color: '#8696a0', ml: 0.5 }} />
			);
		case 'sent':
			return <CheckIcon sx={{ fontSize: 16, color: '#8696a0', ml: 0.5 }} />;
		case 'delivered':
			return <DoneAllIcon sx={{ fontSize: 16, color: '#8696a0', ml: 0.5 }} />;
		case 'read':
			return <DoneAllIcon sx={{ fontSize: 16, color: '#53bdeb', ml: 0.5 }} />;
		case 'failed':
			return (
				<AccessTimeIcon sx={{ fontSize: 16, color: '#f15c6d', ml: 0.5 }} />
			);
		default:
			return (
				<AccessTimeIcon sx={{ fontSize: 16, color: '#8696a0', ml: 0.5 }} />
			);
	}
};

const Chat = () => {
	const [message, setMessage] = useState('');
	const [messages, setMessages] = useState([]);
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const [currentUserProfile, setCurrentUserProfile] = useState(null);
	const [isInitialLoading, setIsInitialLoading] = useState(true);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [selectedChat, setSelectedChat] = useState(null);
	const [users, setUsers] = useState([]);
	const [groups, setGroups] = useState([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [error, setError] = useState(null);
	const [isTyping, setIsTyping] = useState(false);
	const [typingUsers, setTypingUsers] = useState(new Set());
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [anchorEl, setAnchorEl] = useState(null);
	const [unreadMessages, setUnreadMessages] = useState({});

	// Group functionality states
	const [activeTab, setActiveTab] = useState(0); // 0 for chats, 1 for groups
	const [isCreateGroupDialogOpen, setIsCreateGroupDialogOpen] = useState(false);
	const [isGroupInfoDialogOpen, setIsGroupInfoDialogOpen] = useState(false);
	const [isAddMembersDialogOpen, setIsAddMembersDialogOpen] = useState(false);
	const [groupName, setGroupName] = useState('');
	const [groupDescription, setGroupDescription] = useState('');
	const [selectedMembers, setSelectedMembers] = useState([]);
	const [selectedGroup, setSelectedGroup] = useState(null);

	const messagesEndRef = useRef(null);
	const messageInputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const hasFetchedDataRef = useRef(false);
	const navigate = useNavigate();
	const { auth } = useFirebase();

	const filteredUsers = users.filter(
		(user) =>
			user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const filteredGroups = groups.filter(
		(group) =>
			group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			group.description?.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Fetch current user profile
	const fetchCurrentUserProfile = async () => {
		if (!auth.currentUser) return;

		try {
			const response = await fetch(
				`http://localhost:3000/api/users/${auth.currentUser.uid}`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setCurrentUserProfile(data.data);
				console.log('Current user profile:', data.data);
			}
		} catch (error) {
			console.error('Error fetching current user profile:', error);
		}
	};

	useEffect(() => {
		const fetchUsers = async () => {
			if (!auth.currentUser) {
				console.log('No current user found');
				return;
			}

			try {
				setIsInitialLoading(true);
				setError(null);
				console.log('Current user:', auth.currentUser.uid);

				// Try to fetch users with chat history first
				let response = await fetch(
					`http://localhost:3000/api/chat/users/${auth.currentUser.uid}`,
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
					response = await fetch('http://localhost:3000/api/users', {
						headers: {
							'ngrok-skip-browser-warning': 'true',
						},
					});
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
				setIsInitialLoading(false);
			}
		};

		fetchUsers();
		fetchCurrentUserProfile();
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
								timestamp: newMessage.createdAt,
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
					timestamp: newMessage.createdAt,
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
		if (!message.trim() || (!selectedChat && !selectedGroup)) return;

		// Route to appropriate send function
		if (selectedGroup) {
			return handleSendGroupMessage();
		}

		const messageText = message.trim();
		setMessage('');
		setIsSendingMessage(true);

		// Optimistic UI update for individual messages
		const tempId = `temp_${Date.now()}`;
		const optimisticMessage = {
			id: tempId,
			text: messageText,
			senderId: auth.currentUser.uid,
			receiverId: selectedChat.firebase_uid,
			senderName: currentUserProfile
				? `${currentUserProfile.first_name} ${currentUserProfile.last_name}`
				: 'You',
			timestamp: new Date().toISOString(),
			status: 'sending',
			isOptimistic: true,
		};

		setMessages((prev) => [...prev, optimisticMessage]);
		setTimeout(scrollToBottom, 100);

		try {
			// Use the correct POST /api/messages endpoint for individual messages
			const response = await fetch('http://localhost:3000/api/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': 'true',
				},
				body: JSON.stringify({
					message: messageText,
					sender_id: auth.currentUser.uid,
					receiver_id: selectedChat.firebase_uid,
					message_type: 'direct',
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to send message');
			}

			console.log('Message sent successfully');
		} catch (error) {
			console.error('Error sending message:', error);
			// Update message status to failed
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === tempId ? { ...msg, status: 'failed' } : msg
				)
			);
		} finally {
			setIsSendingMessage(false);
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

	// GROUP FUNCTIONALITY FUNCTIONS
	const fetchGroups = async () => {
		if (!auth.currentUser) return;

		try {
			const response = await fetch(
				`http://localhost:3000/api/groups/user/${auth.currentUser.uid}`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				setGroups(data.data || []);
				console.log('User groups:', data.data);

				// Join all group rooms for real-time updates
				const socket = connectSocket(auth.currentUser.uid);
				if (socket) {
					data.data?.forEach((group) => {
						console.log(`Joining group room: ${group.id}`);
						joinGroup(group.id);
					});
				}
			}
		} catch (error) {
			console.error('Error fetching groups:', error);
		}
	};

	const handleCreateGroup = async () => {
		if (!groupName.trim() || selectedMembers.length === 0) {
			setError('Group name and at least one member are required');
			return;
		}

		try {
			setIsSendingMessage(true);
			const memberIds = selectedMembers.map((member) => member.firebase_uid);

			// Use the correct POST /api/groups endpoint
			const response = await fetch('http://localhost:3000/api/groups', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': 'true',
				},
				body: JSON.stringify({
					name: groupName.trim(),
					description: groupDescription.trim(),
					creator_id: auth.currentUser.uid,
					member_ids: [...memberIds, auth.currentUser.uid], // Include creator
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to create group');
			}

			const data = await response.json();
			console.log('Group created:', data);

			// Reset form and close dialog
			setGroupName('');
			setGroupDescription('');
			setSelectedMembers([]);
			setIsCreateGroupDialogOpen(false);

			// Refresh groups
			await fetchGroups();
		} catch (error) {
			console.error('Error creating group:', error);
			setError(error.message || 'Failed to create group');
		} finally {
			setIsSendingMessage(false);
		}
	};

	const handleSelectChat = (chat) => {
		setSelectedChat(chat);
		setSelectedGroup(null);
		setMessages([]);
		setIsLoadingMessages(true);

		// Clear unread messages for this chat
		if (unreadMessages[chat.firebase_uid]) {
			setUnreadMessages((prev) => ({
				...prev,
				[chat.firebase_uid]: 0,
			}));
		}

		// Join the room for this conversation
		const socket = connectSocket(auth.currentUser.uid);
		if (socket) {
			const roomName = generateRoomName(
				auth.currentUser.uid,
				chat.firebase_uid
			);
			joinRoom(roomName);
		}

		// Fetch messages for this chat
		fetchMessages(chat.firebase_uid);
	};

	const fetchMessages = async (userId) => {
		try {
			setIsLoadingMessages(true);
			// Use the correct GET /api/messages/:roomName endpoint for direct messages
			const roomName = generateRoomName(auth.currentUser.uid, userId);
			const response = await fetch(
				`http://localhost:3000/api/messages/${roomName}`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);

			if (response) {
				const data = await response.json();
				const formattedMessages = data.map((msg) => ({
					id: msg.id,
					text: msg.message,
					senderId: msg.sender_id,
					receiverId: msg.receiver_id,
					senderName: msg.sender
						? `${msg.sender.first_name} ${msg.sender.last_name}`
						: 'Unknown',
					timestamp: msg.created_at,
					status: msg.status,
					message_type: msg.message_type,
				}));
				setMessages(formattedMessages);
				setTimeout(scrollToBottom, 100);
			}
		} catch (error) {
			console.error('Error fetching messages:', error);
		} finally {
			setIsLoadingMessages(false);
		}
	};

	const handleSelectGroup = (group) => {
		setSelectedGroup(group);
		setSelectedChat(null);
		setMessages([]);
		setIsLoadingMessages(true);

		// Clear unread messages for this group
		if (unreadMessages[`group_${group.id}`]) {
			setUnreadMessages((prev) => ({
				...prev,
				[`group_${group.id}`]: 0,
			}));
		}

		// Join the group room
		const socket = connectSocket(auth.currentUser.uid);
		if (socket) {
			joinGroup(group.id);
		}

		// Fetch group messages
		fetchGroupMessages(group.id);
	};

	const fetchGroupMessages = async (groupId) => {
		try {
			setIsLoadingMessages(true);
			// Use the correct GET /api/groups/:groupId/messages endpoint
			const response = await fetch(
				`http://localhost:3000/api/groups/${groupId}/messages`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);

			if (response.ok) {
				const data = await response.json();
				const formattedMessages = data.data.map((msg) => ({
					id: msg.id,
					text: msg.message,
					senderId: msg.sender_id,
					senderName: msg.sender
						? `${msg.sender.first_name} ${msg.sender.last_name}`
						: 'Unknown',
					timestamp: msg.created_at,
					status: msg.status,
					isGroup: true,
					groupId: groupId,
				}));
				setMessages(formattedMessages);
				setTimeout(scrollToBottom, 100);
			}
		} catch (error) {
			console.error('Error fetching group messages:', error);
		} finally {
			setIsLoadingMessages(false);
		}
	};

	const handleSendGroupMessage = async () => {
		if (!message.trim() || !selectedGroup) return;

		const messageText = message.trim();
		setMessage('');
		setIsSendingMessage(true);

		// Optimistic UI update
		const tempId = `temp_${Date.now()}`;
		const optimisticMessage = {
			id: tempId,
			text: messageText,
			senderId: auth.currentUser.uid,
			senderName: currentUserProfile
				? `${currentUserProfile.first_name} ${currentUserProfile.last_name}`
				: 'You',
			timestamp: new Date().toISOString(),
			status: 'sending',
			isOptimistic: true,
			isGroup: true,
			groupId: selectedGroup.id,
		};

		setMessages((prev) => [...prev, optimisticMessage]);
		setTimeout(scrollToBottom, 100);

		try {
			// Use the correct POST /api/messages endpoint for group messages
			const response = await fetch('http://localhost:3000/api/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': 'true',
				},
				body: JSON.stringify({
					message: messageText,
					sender_id: auth.currentUser.uid,
					group_id: selectedGroup.id,
					message_type: 'group',
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to send message');
			}

			console.log('Group message sent successfully');
		} catch (error) {
			console.error('Error sending group message:', error);
			// Update message status to failed
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === tempId ? { ...msg, status: 'failed' } : msg
				)
			);
		} finally {
			setIsSendingMessage(false);
		}
	};

	const handleAddMembers = async () => {
		if (!selectedGroup || selectedMembers.length === 0) return;

		try {
			setIsSendingMessage(true);
			const memberIds = selectedMembers.map((member) => member.firebase_uid);

			// Use the correct POST /api/groups/add-member endpoint
			const response = await fetch(
				'http://localhost:3000/api/groups/add-member',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'ngrok-skip-browser-warning': 'true',
					},
					body: JSON.stringify({
						group_id: selectedGroup.id,
						member_ids: memberIds,
						admin_id: auth.currentUser.uid, // For admin verification
					}),
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to add members');
			}

			// Reset selection and close dialog
			setSelectedMembers([]);
			setIsAddMembersDialogOpen(false);

			// Refresh group info
			await fetchGroups();
		} catch (error) {
			console.error('Error adding members:', error);
			setError(error.message || 'Failed to add members');
		} finally {
			setIsSendingMessage(false);
		}
	};

	const handleLeaveGroup = async (groupId) => {
		try {
			// Use the correct POST /api/groups/leave endpoint
			const response = await fetch('http://localhost:3000/api/groups/leave', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': 'true',
				},
				body: JSON.stringify({
					group_id: groupId,
					user_id: auth.currentUser.uid,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to leave group');
			}

			// If we're currently viewing this group, clear selection
			if (selectedGroup?.id === groupId) {
				setSelectedGroup(null);
				setMessages([]);
			}

			// Refresh groups
			await fetchGroups();
		} catch (error) {
			console.error('Error leaving group:', error);
			setError(error.message || 'Failed to leave group');
		}
	};

	const handleJoinGroup = async (groupId) => {
		try {
			// Use the correct POST /api/groups/join endpoint
			const response = await fetch('http://localhost:3000/api/groups/join', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': 'true',
				},
				body: JSON.stringify({
					group_id: groupId,
					user_id: auth.currentUser.uid,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to join group');
			}

			// Refresh groups
			await fetchGroups();
		} catch (error) {
			console.error('Error joining group:', error);
			setError(error.message || 'Failed to join group');
		}
	};

	// Load groups on component mount
	useEffect(() => {
		if (auth.currentUser && !hasFetchedDataRef.current) {
			fetchGroups();
		}
	}, [auth.currentUser]);

	// Socket listeners for group events
	useEffect(() => {
		if (!auth.currentUser) return;

		const socket = connectSocket(auth.currentUser.uid);
		if (!socket) return;

		// Group message listener
		const handleReceiveGroupMessage = (newMessage) => {
			console.log('Received group message:', newMessage);

			// Update messages if we're viewing this group
			if (selectedGroup && newMessage.group_id === selectedGroup.id) {
				const formattedMessage = {
					id: newMessage.id,
					text: newMessage.message,
					senderId: newMessage.sender_id,
					senderName: newMessage.sender
						? `${newMessage.sender.first_name} ${newMessage.sender.last_name}`
						: 'Unknown',
					timestamp: newMessage.created_at,
					status: newMessage.status,
					isGroup: true,
					groupId: newMessage.group_id,
				};

				setMessages((prev) => {
					// Remove optimistic message if exists
					const withoutOptimistic = prev.filter(
						(msg) =>
							!(
								msg.isOptimistic &&
								msg.text === formattedMessage.text &&
								msg.senderId === formattedMessage.senderId
							)
					);
					return [...withoutOptimistic, formattedMessage];
				});

				setTimeout(scrollToBottom, 100);
			} else {
				// Update unread count for other groups
				if (newMessage.sender_id !== auth.currentUser.uid) {
					setUnreadMessages((prev) => ({
						...prev,
						[`group_${newMessage.group_id}`]:
							(prev[`group_${newMessage.group_id}`] || 0) + 1,
					}));
				}
			}

			// Update groups list with latest message
			setGroups((prev) =>
				prev.map((group) =>
					group.id === newMessage.group_id
						? {
								...group,
								lastMessage: {
									text: newMessage.message,
									timestamp: newMessage.created_at,
									senderName: newMessage.sender
										? `${newMessage.sender.first_name} ${newMessage.sender.last_name}`
										: 'Unknown',
									isOutgoing: newMessage.sender_id === auth.currentUser.uid,
								},
						  }
						: group
				)
			);
		};

		// Group created/updated listeners
		const handleGroupCreated = (groupData) => {
			console.log('Group created:', groupData);
			fetchGroups(); // Refresh groups list
		};

		const handleGroupUpdated = (groupData) => {
			console.log('Group updated:', groupData);
			fetchGroups(); // Refresh groups list
		};

		const handleMemberAdded = (data) => {
			console.log('Member added to group:', data);
			fetchGroups(); // Refresh groups list
		};

		const handleMemberRemoved = (data) => {
			console.log('Member removed from group:', data);
			fetchGroups(); // Refresh groups list
		};

		// Set up listeners
		socket.on('receive_group_message', handleReceiveGroupMessage);
		socket.on('group_created', handleGroupCreated);
		socket.on('group_updated', handleGroupUpdated);
		socket.on('member_added', handleMemberAdded);
		socket.on('member_removed', handleMemberRemoved);

		// Cleanup
		return () => {
			socket.off('receive_group_message', handleReceiveGroupMessage);
			socket.off('group_created', handleGroupCreated);
			socket.off('group_updated', handleGroupUpdated);
			socket.off('member_added', handleMemberAdded);
			socket.off('member_removed', handleMemberRemoved);
		};
	}, [auth.currentUser, selectedGroup]);

	return (
		<Box
			sx={{
				display: 'flex',
				height: '100vh',
				bgcolor: WHATSAPP_COLORS.background,
				// Global scrollbar styling for the entire chat component
				'& *::-webkit-scrollbar': {
					width: '6px',
					height: '6px',
				},
				'& *::-webkit-scrollbar-track': {
					background: WHATSAPP_COLORS.surface,
				},
				'& *::-webkit-scrollbar-thumb': {
					background: WHATSAPP_COLORS.surfaceVariant,
					borderRadius: '3px',
					'&:hover': {
						background: '#3e4a56',
					},
				},
				'& *::-webkit-scrollbar-corner': {
					background: WHATSAPP_COLORS.surface,
				},
			}}
		>
			{/* WhatsApp-style Sidebar */}
			<Box
				sx={{
					width: DRAWER_WIDTH,
					borderRight: `1px solid ${WHATSAPP_COLORS.divider}`,
					bgcolor: WHATSAPP_COLORS.surface,
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{/* Sidebar Header */}
				<Box
					sx={{
						p: 2,
						borderBottom: `1px solid ${WHATSAPP_COLORS.divider}`,
						bgcolor: WHATSAPP_COLORS.surface,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						<Avatar
							sx={{
								bgcolor: WHATSAPP_COLORS.primary,
								width: 40,
								height: 40,
								mr: 2,
							}}
						>
							{currentUserProfile
								? `${currentUserProfile.first_name?.[0]?.toUpperCase() || ''}${
										currentUserProfile.last_name?.[0]?.toUpperCase() || ''
								  }`
								: auth.currentUser?.email?.[0]?.toUpperCase() || 'U'}
						</Avatar>
						<Typography
							variant="h6"
							sx={{ color: WHATSAPP_COLORS.onSurface, fontWeight: 500 }}
						>
							Cinnova Chat
						</Typography>
					</Box>
					<IconButton
						onClick={handleUserMenuClick}
						sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
					>
						<MoreVertIcon />
					</IconButton>
				</Box>

				{/* Tabs for Chats and Groups */}
				<Box sx={{ borderBottom: `1px solid ${WHATSAPP_COLORS.divider}` }}>
					<Tabs
						value={activeTab}
						onChange={(e, newValue) => setActiveTab(newValue)}
						sx={{
							'& .MuiTabs-indicator': {
								backgroundColor: WHATSAPP_COLORS.primary,
							},
							'& .MuiTab-root': {
								color: WHATSAPP_COLORS.onSurfaceVariant,
								'&.Mui-selected': {
									color: WHATSAPP_COLORS.primary,
								},
							},
						}}
					>
						<Tab label="Chats" />
						<Tab label="Groups" />
					</Tabs>
				</Box>

				{/* Search Bar */}
				<Box sx={{ p: 2 }}>
					<TextField
						fullWidth
						placeholder={activeTab === 0 ? 'Search chats' : 'Search groups'}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						variant="outlined"
						size="small"
						sx={{
							'& .MuiOutlinedInput-root': {
								bgcolor: WHATSAPP_COLORS.background,
								borderRadius: '8px',
								border: 'none',
								'& fieldset': {
									border: 'none',
								},
								'&:hover fieldset': {
									border: 'none',
								},
								'&.Mui-focused fieldset': {
									border: `1px solid ${WHATSAPP_COLORS.primary}`,
								},
							},
							'& .MuiInputBase-input': {
								color: WHATSAPP_COLORS.onSurface,
								fontSize: '15px',
								'&::placeholder': {
									color: WHATSAPP_COLORS.onSurfaceVariant,
									opacity: 1,
								},
							},
						}}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon
										sx={{
											color: WHATSAPP_COLORS.onSurfaceVariant,
											fontSize: 20,
										}}
									/>
								</InputAdornment>
							),
						}}
					/>
				</Box>

				{/* Create Group Button (only show on Groups tab) */}
				{activeTab === 1 && (
					<Box
						sx={{ p: 2, borderBottom: `1px solid ${WHATSAPP_COLORS.divider}` }}
					>
						<Button
							fullWidth
							startIcon={<GroupAddIcon />}
							onClick={() => setIsCreateGroupDialogOpen(true)}
							sx={{
								bgcolor: WHATSAPP_COLORS.primary,
								color: 'white',
								'&:hover': {
									bgcolor: WHATSAPP_COLORS.primaryDark,
								},
								borderRadius: 2,
								textTransform: 'none',
								py: 1,
							}}
						>
							Create New Group
						</Button>
					</Box>
				)}

				{/* Chats/Groups List */}
				<Box
					sx={{
						flexGrow: 1,
						overflow: 'auto',
						'&::-webkit-scrollbar': {
							width: '6px',
						},
						'&::-webkit-scrollbar-track': {
							background: WHATSAPP_COLORS.surface,
						},
						'&::-webkit-scrollbar-thumb': {
							background: WHATSAPP_COLORS.surfaceVariant,
							borderRadius: '3px',
							'&:hover': {
								background: '#3e4a56',
							},
						},
					}}
				>
					{error && (
						<Alert severity="error" sx={{ mx: 2, my: 1 }}>
							{error}
						</Alert>
					)}
					{isInitialLoading ? (
						<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
							<CircularProgress sx={{ color: WHATSAPP_COLORS.primary }} />
						</Box>
					) : activeTab === 0 ? (
						// Individual Chats Tab
						users.length === 0 ? (
							<Box sx={{ p: 3, textAlign: 'center' }}>
								<Typography sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}>
									No conversations
								</Typography>
							</Box>
						) : (
							<List sx={{ p: 0 }}>
								{filteredUsers.map((user) => (
									<ListItem
										key={user.firebase_uid}
										button
										selected={selectedChat?.firebase_uid === user.firebase_uid}
										onClick={() => setSelectedChat(user)}
										sx={{
											px: 2,
											py: 1.5,
											bgcolor:
												selectedChat?.firebase_uid === user.firebase_uid
													? WHATSAPP_COLORS.surfaceVariant
													: 'transparent',
											'&:hover': {
												bgcolor: WHATSAPP_COLORS.surfaceVariant,
											},
										}}
									>
										<ListItemAvatar>
											<Box sx={{ position: 'relative' }}>
												<Avatar
													sx={{
														bgcolor: WHATSAPP_COLORS.primary,
														width: 50,
														height: 50,
														fontSize: '18px',
														fontWeight: 500,
													}}
												>
													{user.first_name?.[0]?.toUpperCase()}
													{user.last_name?.[0]?.toUpperCase()}
												</Avatar>
											</Box>
										</ListItemAvatar>
										<ListItemText
											primary={
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
														mb: 0.5,
													}}
												>
													<Typography
														sx={{
															color: WHATSAPP_COLORS.onSurface,
															fontWeight: 500,
															fontSize: '17px',
														}}
													>
														{`${user.first_name || ''} ${user.last_name || ''}`}
													</Typography>
													{user.lastMessage && (
														<Typography
															sx={{
																color: WHATSAPP_COLORS.onSurfaceVariant,
																fontSize: '12px',
															}}
														>
															{formatTimestamp(user.lastMessage.timestamp)}
														</Typography>
													)}
												</Box>
											}
											secondary={
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														alignItems: 'center',
													}}
												>
													<Typography
														sx={{
															color: WHATSAPP_COLORS.onSurfaceVariant,
															fontSize: '14px',
															display: 'flex',
															alignItems: 'center',
															gap: 0.5,
														}}
													>
														{user.lastMessage?.isOutgoing && (
															<DoneAllIcon
																sx={{
																	fontSize: 16,
																	color: WHATSAPP_COLORS.onSurfaceVariant,
																}}
															/>
														)}
														{user.lastMessage
															? truncateMessage(user.lastMessage.text)
															: 'Click to start chatting'}
													</Typography>
													{unreadMessages[user.firebase_uid] > 0 &&
														selectedChat?.firebase_uid !==
															user.firebase_uid && (
															<Chip
																label={unreadMessages[user.firebase_uid]}
																size="small"
																sx={{
																	bgcolor: WHATSAPP_COLORS.primary,
																	color: '#fff',
																	height: 20,
																	fontSize: '12px',
																	fontWeight: 600,
																	minWidth: 20,
																}}
															/>
														)}
												</Box>
											}
										/>
									</ListItem>
								))}
							</List>
						)
					) : // Groups Tab
					groups.length === 0 ? (
						<Box sx={{ p: 3, textAlign: 'center' }}>
							<Typography sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}>
								No groups yet
							</Typography>
							<Typography
								sx={{
									color: WHATSAPP_COLORS.onSurfaceVariant,
									fontSize: '14px',
									mt: 1,
								}}
							>
								Create a group to start chatting with multiple people
							</Typography>
						</Box>
					) : (
						<List sx={{ p: 0 }}>
							{filteredGroups.map((group) => (
								<ListItem
									key={group.id}
									button
									selected={selectedGroup?.id === group.id}
									onClick={() => handleSelectGroup(group)}
									sx={{
										px: 2,
										py: 1.5,
										bgcolor:
											selectedGroup?.id === group.id
												? WHATSAPP_COLORS.surfaceVariant
												: 'transparent',
										'&:hover': {
											bgcolor: WHATSAPP_COLORS.surfaceVariant,
										},
									}}
								>
									<ListItemAvatar>
										<Avatar
											sx={{
												bgcolor: WHATSAPP_COLORS.secondary,
												width: 50,
												height: 50,
												fontSize: '18px',
												fontWeight: 500,
											}}
										>
											<GroupIcon />
										</Avatar>
									</ListItemAvatar>
									<ListItemText
										primary={
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													mb: 0.5,
												}}
											>
												<Typography
													sx={{
														color: WHATSAPP_COLORS.onSurface,
														fontWeight: 500,
														fontSize: '16px',
													}}
												>
													{group.name}
												</Typography>
												{group.lastMessage && (
													<Typography
														sx={{
															color: WHATSAPP_COLORS.onSurfaceVariant,
															fontSize: '12px',
														}}
													>
														{formatTimestamp(group.lastMessage.timestamp)}
													</Typography>
												)}
											</Box>
										}
										secondary={
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
												}}
											>
												<Typography
													sx={{
														color: WHATSAPP_COLORS.onSurfaceVariant,
														fontSize: '14px',
													}}
												>
													{group.lastMessage
														? `${
																group.lastMessage.senderName
														  }: ${truncateMessage(group.lastMessage.text)}`
														: group.description || 'No messages yet'}
												</Typography>
												{unreadMessages[`group_${group.id}`] > 0 && (
													<Chip
														label={unreadMessages[`group_${group.id}`]}
														size="small"
														sx={{
															bgcolor: WHATSAPP_COLORS.primary,
															color: 'white',
															height: '20px',
															fontSize: '12px',
															fontWeight: 'bold',
															'& .MuiChip-label': {
																px: 1,
															},
														}}
													/>
												)}
											</Box>
										}
									/>
								</ListItem>
							))}
						</List>
					)}
				</Box>
			</Box>

			{/* Main Chat Area */}
			<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
				{selectedChat || selectedGroup ? (
					<>
						{/* WhatsApp-style Chat Header */}
						<Box
							sx={{
								p: 2,
								borderBottom: `1px solid ${WHATSAPP_COLORS.divider}`,
								bgcolor: WHATSAPP_COLORS.surface,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'center' }}>
								<Avatar
									sx={{
										bgcolor: selectedGroup
											? WHATSAPP_COLORS.secondary
											: WHATSAPP_COLORS.primary,
										width: 40,
										height: 40,
										mr: 2,
									}}
								>
									{selectedGroup ? (
										<GroupIcon />
									) : (
										<>
											{selectedChat.first_name?.[0]?.toUpperCase()}
											{selectedChat.last_name?.[0]?.toUpperCase()}
										</>
									)}
								</Avatar>
								<Box>
									<Typography
										variant="h6"
										sx={{
											color: WHATSAPP_COLORS.onSurface,
											fontWeight: 500,
											fontSize: '16px',
										}}
									>
										{selectedGroup
											? selectedGroup.name
											: `${selectedChat.first_name} ${selectedChat.last_name}`}
									</Typography>
									{selectedGroup && (
										<Typography
											sx={{
												color: WHATSAPP_COLORS.onSurfaceVariant,
												fontSize: '12px',
											}}
										>
											{selectedGroup.members?.length || 0} members
										</Typography>
									)}
									<Typography
										sx={{
											color: WHATSAPP_COLORS.onSurfaceVariant,
											fontSize: '13px',
										}}
									>
										last seen recently
									</Typography>
								</Box>
							</Box>
							<Box>
								{!selectedGroup && (
									<>
										<IconButton
											sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
										>
											<VideoCallIcon />
										</IconButton>
										<IconButton
											sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
										>
											<PhoneIcon />
										</IconButton>
									</>
								)}
								<IconButton
									onClick={() => setIsGroupInfoDialogOpen(true)}
									sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
								>
									<InfoIcon />
								</IconButton>
								<IconButton sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}>
									<MoreVertIcon />
								</IconButton>
							</Box>
						</Box>

						{/* Messages Area with WhatsApp background */}
						<Box
							sx={{
								flexGrow: 1,
								overflow: 'auto',
								p: 2,
								bgcolor: WHATSAPP_COLORS.background,
								backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${WHATSAPP_COLORS.surfaceVariant.slice(
									1
								)}' fill-opacity='0.05'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
								display: 'flex',
								flexDirection: 'column',
								'&::-webkit-scrollbar': {
									width: '6px',
								},
								'&::-webkit-scrollbar-track': {
									background: 'transparent',
								},
								'&::-webkit-scrollbar-thumb': {
									background: WHATSAPP_COLORS.surfaceVariant,
									borderRadius: '3px',
									'&:hover': {
										background: '#3e4a56',
									},
								},
							}}
						>
							<Stack spacing={1}>
								{messages.length === 0 ? (
									<Box
										sx={{
											display: 'flex',
											flexDirection: 'column',
											justifyContent: 'center',
											alignItems: 'center',
											height: '100%',
											gap: 2,
										}}
									>
										<Box
											sx={{
												width: 80,
												height: 80,
												borderRadius: '50%',
												bgcolor: WHATSAPP_COLORS.surface,
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												border: `2px solid ${WHATSAPP_COLORS.surfaceVariant}`,
											}}
										>
											<SendIcon
												sx={{ fontSize: 40, color: WHATSAPP_COLORS.primary }}
											/>
										</Box>
										<Typography
											sx={{
												color: WHATSAPP_COLORS.onSurfaceVariant,
												fontSize: '16px',
												fontWeight: 500,
												textAlign: 'center',
											}}
										>
											No messages here yet...
										</Typography>
										<Typography
											sx={{
												color: WHATSAPP_COLORS.onSurfaceVariant,
												fontSize: '14px',
												textAlign: 'center',
												maxWidth: 250,
												opacity: 0.7,
											}}
										>
											Send a message to start the conversation
											{selectedGroup
												? ` in ${selectedGroup.name}`
												: ` with ${selectedChat.first_name}`}
										</Typography>
									</Box>
								) : (
									messages.map((msg, index) => {
										const isOutgoing = msg.senderId === auth.currentUser.uid;
										const showAvatar =
											index === 0 ||
											messages[index - 1].senderId !== msg.senderId;
										const isLastInGroup =
											index === messages.length - 1 ||
											messages[index + 1].senderId !== msg.senderId;

										return (
											<Box
												key={msg.id || `temp-${msg.timestamp}-${index}`}
												sx={{
													display: 'flex',
													justifyContent: isOutgoing
														? 'flex-end'
														: 'flex-start',
													mb: isLastInGroup ? 1 : 0.2,
												}}
											>
												<Paper
													elevation={1}
													sx={{
														px: 2,
														py: 1,
														maxWidth: '65%',
														bgcolor: isOutgoing
															? WHATSAPP_COLORS.outgoingMessage
															: WHATSAPP_COLORS.incomingMessage,
														color: WHATSAPP_COLORS.onSurface,
														borderRadius: isOutgoing
															? '7.5px 7.5px 7.5px 0px'
															: '7.5px 7.5px 0px 7.5px',
														position: 'relative',
														wordBreak: 'break-word',
														boxShadow: '0 1px 0.5px rgba(0,0,0,.13)',
													}}
												>
													{/* Show sender name for group messages (incoming only) */}
													{selectedGroup && !isOutgoing && showAvatar && (
														<Typography
															sx={{
																fontSize: '12px',
																fontWeight: 500,
																color: WHATSAPP_COLORS.primary,
																mb: 0.5,
															}}
														>
															{msg.senderName}
														</Typography>
													)}
													<Typography
														variant="body1"
														sx={{
															fontSize: '14px',
															lineHeight: 1.4,
															color: WHATSAPP_COLORS.onSurface,
															mb: 0.5,
														}}
													>
														{msg.text}
													</Typography>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'flex-end',
															gap: 0.5,
															minWidth: '60px',
														}}
													>
														<Typography
															variant="caption"
															sx={{
																color: WHATSAPP_COLORS.onSurfaceVariant,
																fontSize: '11px',
															}}
														>
															{formatMessageTime(msg.timestamp)}
														</Typography>
														<MessageStatusIcon
															status={msg.status}
															isOutgoing={isOutgoing}
															error={msg.error}
														/>
													</Box>
												</Paper>
											</Box>
										);
									})
								)}
								<div ref={messagesEndRef} />
							</Stack>
						</Box>

						{/* WhatsApp-style Message Input */}
						<Box
							sx={{
								p: 2,
								borderTop: `1px solid ${WHATSAPP_COLORS.divider}`,
								bgcolor: WHATSAPP_COLORS.surface,
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
								{/* Attachment Button */}
								<IconButton
									sx={{
										color: WHATSAPP_COLORS.onSurfaceVariant,
										'&:hover': {
											bgcolor: WHATSAPP_COLORS.surfaceVariant,
										},
									}}
								>
									<AttachFileIcon />
								</IconButton>

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
												width={320}
												height={400}
												theme="dark"
											/>
										</Box>
									)}
									<TextField
										fullWidth
										value={message}
										onChange={handleMessageChange}
										placeholder="Type a message"
										variant="outlined"
										multiline
										maxRows={4}
										inputRef={messageInputRef}
										onKeyPress={(e) => {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												handleSendMessage();
											}
										}}
										sx={{
											'& .MuiOutlinedInput-root': {
												bgcolor: WHATSAPP_COLORS.background,
												borderRadius: '21px',
												border: 'none',
												minHeight: '42px',
												'& fieldset': {
													border: 'none',
												},
												'&:hover fieldset': {
													border: 'none',
												},
												'&.Mui-focused fieldset': {
													border: 'none',
												},
												'&.Mui-focused': {
													bgcolor: WHATSAPP_COLORS.background,
												},
											},
											'& .MuiInputBase-input': {
												color: WHATSAPP_COLORS.onSurface,
												fontSize: '15px',
												bgcolor: 'transparent',
												'&::placeholder': {
													color: WHATSAPP_COLORS.onSurfaceVariant,
													opacity: 1,
												},
												'&:-webkit-autofill': {
													WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.background} inset`,
													WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
												},
											},
										}}
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<IconButton
														onClick={() => setShowEmojiPicker(!showEmojiPicker)}
														size="small"
														sx={{
															color: WHATSAPP_COLORS.onSurfaceVariant,
															'&:hover': {
																color: WHATSAPP_COLORS.primary,
															},
														}}
													>
														<EmojiIcon />
													</IconButton>
												</InputAdornment>
											),
											endAdornment: message.trim() ? (
												<InputAdornment position="end">
													<IconButton
														onClick={handleSendMessage}
														sx={{
															color: WHATSAPP_COLORS.primary,
															'&:hover': {
																bgcolor: alpha(WHATSAPP_COLORS.primary, 0.1),
															},
														}}
													>
														<SendIcon />
													</IconButton>
												</InputAdornment>
											) : null,
										}}
									/>
								</Box>
							</Box>
						</Box>
					</>
				) : (
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
							alignItems: 'center',
							height: '100%',
							bgcolor: WHATSAPP_COLORS.background,
							backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${WHATSAPP_COLORS.surfaceVariant.slice(
								1
							)}' fill-opacity='0.05'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
						}}
					>
						<Box
							sx={{
								width: 320,
								height: 320,
								borderRadius: '50%',
								bgcolor: WHATSAPP_COLORS.surface,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								mb: 3,
								border: `3px solid ${WHATSAPP_COLORS.surfaceVariant}`,
							}}
						>
							<SendIcon
								sx={{ fontSize: 120, color: WHATSAPP_COLORS.primary }}
							/>
						</Box>
						<Typography
							variant="h4"
							sx={{ color: WHATSAPP_COLORS.onSurface, fontWeight: 300, mb: 1 }}
						>
							Cinnova Chat
						</Typography>
						<Typography
							sx={{
								color: WHATSAPP_COLORS.onSurfaceVariant,
								textAlign: 'center',
								maxWidth: 400,
								lineHeight: 1.5,
							}}
						>
							Send and receive messages without keeping your phone online.
							<br />
							Use Cinnova Chat on up to 4 linked devices and 1 phone at the same
							time.
						</Typography>
					</Box>
				)}
			</Box>

			{/* User Menu */}
			<Menu
				anchorEl={anchorEl}
				open={Boolean(anchorEl)}
				onClose={handleUserMenuClose}
				PaperProps={{
					sx: {
						bgcolor: WHATSAPP_COLORS.surface,
						color: WHATSAPP_COLORS.onSurface,
						border: `1px solid ${WHATSAPP_COLORS.divider}`,
					},
				}}
			>
				<MenuItem
					onClick={() => {
						handleUserMenuClose();
						setIsLogoutDialogOpen(true);
					}}
					sx={{ '&:hover': { bgcolor: WHATSAPP_COLORS.surfaceVariant } }}
				>
					<ExitToAppIcon sx={{ mr: 1 }} />
					Log out
				</MenuItem>
			</Menu>

			{/* Logout Dialog */}
			<Dialog
				open={isLogoutDialogOpen}
				onClose={() => setIsLogoutDialogOpen(false)}
				PaperProps={{
					sx: {
						bgcolor: WHATSAPP_COLORS.surface,
						color: WHATSAPP_COLORS.onSurface,
						border: `1px solid ${WHATSAPP_COLORS.divider}`,
					},
				}}
			>
				<DialogTitle sx={{ color: WHATSAPP_COLORS.onSurface }}>
					Log out of Cinnova Chat?
				</DialogTitle>
				<DialogContent>
					<Typography sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}>
						You'll need to scan the QR code again to log back in.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setIsLogoutDialogOpen(false)}
						sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
					>
						Cancel
					</Button>
					<Button
						onClick={handleLogout}
						variant="contained"
						sx={{
							bgcolor: WHATSAPP_COLORS.primary,
							'&:hover': { bgcolor: WHATSAPP_COLORS.primaryDark },
						}}
						startIcon={<ExitToAppIcon />}
					>
						Log out
					</Button>
				</DialogActions>
			</Dialog>

			{/* Create Group Dialog */}
			<Dialog
				open={isCreateGroupDialogOpen}
				onClose={() => setIsCreateGroupDialogOpen(false)}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: {
						bgcolor: WHATSAPP_COLORS.surface,
						color: WHATSAPP_COLORS.onSurface,
						border: `1px solid ${WHATSAPP_COLORS.divider}`,
					},
				}}
			>
				<DialogTitle sx={{ color: WHATSAPP_COLORS.onSurface }}>
					Create New Group
				</DialogTitle>
				<DialogContent>
					<Stack spacing={3}>
						<TextField
							fullWidth
							label="Group Name"
							value={groupName}
							onChange={(e) => setGroupName(e.target.value)}
							variant="outlined"
							sx={{
								'& .MuiOutlinedInput-root': {
									bgcolor: WHATSAPP_COLORS.background,
									borderRadius: '8px',
									'& fieldset': {
										borderColor: WHATSAPP_COLORS.divider,
									},
									'&:hover fieldset': {
										borderColor: WHATSAPP_COLORS.primary,
									},
									'&.Mui-focused fieldset': {
										borderColor: WHATSAPP_COLORS.primary,
									},
								},
								'& .MuiInputLabel-root': {
									color: WHATSAPP_COLORS.onSurfaceVariant,
									'&.Mui-focused': {
										color: WHATSAPP_COLORS.primary,
									},
								},
								'& .MuiInputBase-input': {
									color: WHATSAPP_COLORS.onSurface,
								},
							}}
						/>

						<TextField
							fullWidth
							label="Group Description (Optional)"
							value={groupDescription}
							onChange={(e) => setGroupDescription(e.target.value)}
							variant="outlined"
							multiline
							rows={2}
							sx={{
								'& .MuiOutlinedInput-root': {
									bgcolor: WHATSAPP_COLORS.background,
									borderRadius: '8px',
									'& fieldset': {
										borderColor: WHATSAPP_COLORS.divider,
									},
									'&:hover fieldset': {
										borderColor: WHATSAPP_COLORS.primary,
									},
									'&.Mui-focused fieldset': {
										borderColor: WHATSAPP_COLORS.primary,
									},
								},
								'& .MuiInputLabel-root': {
									color: WHATSAPP_COLORS.onSurfaceVariant,
									'&.Mui-focused': {
										color: WHATSAPP_COLORS.primary,
									},
								},
								'& .MuiInputBase-input': {
									color: WHATSAPP_COLORS.onSurface,
								},
							}}
						/>

						<Box>
							<Typography
								sx={{
									color: WHATSAPP_COLORS.onSurface,
									fontWeight: 500,
									mb: 2,
								}}
							>
								Select Members
							</Typography>
							<Box
								sx={{
									maxHeight: 300,
									overflow: 'auto',
									border: `1px solid ${WHATSAPP_COLORS.divider}`,
									borderRadius: 2,
									bgcolor: WHATSAPP_COLORS.background,
								}}
							>
								{users.map((user) => (
									<FormControlLabel
										key={user.firebase_uid}
										control={
											<Checkbox
												checked={selectedMembers.some(
													(member) => member.firebase_uid === user.firebase_uid
												)}
												onChange={(e) => {
													if (e.target.checked) {
														setSelectedMembers((prev) => [...prev, user]);
													} else {
														setSelectedMembers((prev) =>
															prev.filter(
																(member) =>
																	member.firebase_uid !== user.firebase_uid
															)
														);
													}
												}}
												sx={{
													color: WHATSAPP_COLORS.onSurfaceVariant,
													'&.Mui-checked': {
														color: WHATSAPP_COLORS.primary,
													},
												}}
											/>
										}
										label={
											<Box
												sx={{ display: 'flex', alignItems: 'center', py: 1 }}
											>
												<Avatar
													sx={{
														bgcolor: WHATSAPP_COLORS.primary,
														width: 32,
														height: 32,
														mr: 2,
														fontSize: '14px',
													}}
												>
													{user.first_name?.[0]?.toUpperCase()}
													{user.last_name?.[0]?.toUpperCase()}
												</Avatar>
												<Typography sx={{ color: WHATSAPP_COLORS.onSurface }}>
													{user.first_name} {user.last_name}
												</Typography>
											</Box>
										}
										sx={{ width: '100%', mx: 0, px: 2 }}
									/>
								))}
							</Box>
						</Box>

						{selectedMembers.length > 0 && (
							<Box>
								<Typography
									sx={{
										color: WHATSAPP_COLORS.onSurface,
										fontWeight: 500,
										mb: 1,
									}}
								>
									Selected Members ({selectedMembers.length})
								</Typography>
								<AvatarGroup max={6}>
									{selectedMembers.map((member) => (
										<Avatar
											key={member.firebase_uid}
											sx={{
												bgcolor: WHATSAPP_COLORS.primary,
												width: 32,
												height: 32,
												fontSize: '12px',
											}}
										>
											{member.first_name?.[0]?.toUpperCase()}
											{member.last_name?.[0]?.toUpperCase()}
										</Avatar>
									))}
								</AvatarGroup>
							</Box>
						)}
					</Stack>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => {
							setIsCreateGroupDialogOpen(false);
							setGroupName('');
							setGroupDescription('');
							setSelectedMembers([]);
						}}
						sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreateGroup}
						variant="contained"
						disabled={
							!groupName.trim() ||
							selectedMembers.length === 0 ||
							isSendingMessage
						}
						sx={{
							bgcolor: WHATSAPP_COLORS.primary,
							'&:hover': { bgcolor: WHATSAPP_COLORS.primaryDark },
							'&:disabled': {
								bgcolor: WHATSAPP_COLORS.surfaceVariant,
								color: WHATSAPP_COLORS.onSurfaceVariant,
							},
						}}
						startIcon={
							isSendingMessage ? (
								<CircularProgress size={16} />
							) : (
								<GroupAddIcon />
							)
						}
					>
						{isSendingMessage ? 'Creating...' : 'Create Group'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Group Info Dialog */}
			<Dialog
				open={isGroupInfoDialogOpen}
				onClose={() => setIsGroupInfoDialogOpen(false)}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: {
						bgcolor: WHATSAPP_COLORS.surface,
						color: WHATSAPP_COLORS.onSurface,
						border: `1px solid ${WHATSAPP_COLORS.divider}`,
					},
				}}
			>
				<DialogTitle sx={{ color: WHATSAPP_COLORS.onSurface }}>
					Group Info
				</DialogTitle>
				<DialogContent>
					{selectedGroup && (
						<Stack spacing={3}>
							<Box sx={{ display: 'flex', alignItems: 'center' }}>
								<Avatar
									sx={{
										bgcolor: WHATSAPP_COLORS.secondary,
										width: 60,
										height: 60,
										mr: 2,
									}}
								>
									<GroupIcon sx={{ fontSize: 30 }} />
								</Avatar>
								<Box>
									<Typography
										variant="h6"
										sx={{ color: WHATSAPP_COLORS.onSurface, fontWeight: 500 }}
									>
										{selectedGroup.name}
									</Typography>
									<Typography sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}>
										{selectedGroup.members?.length || 0} members
									</Typography>
								</Box>
							</Box>

							{selectedGroup.description && (
								<Box>
									<Typography
										sx={{
											color: WHATSAPP_COLORS.onSurface,
											fontWeight: 500,
											mb: 1,
										}}
									>
										Description
									</Typography>
									<Typography sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}>
										{selectedGroup.description}
									</Typography>
								</Box>
							)}

							<Box>
								<Typography
									sx={{
										color: WHATSAPP_COLORS.onSurface,
										fontWeight: 500,
										mb: 1,
									}}
								>
									Members
								</Typography>
								<List sx={{ maxHeight: 200, overflow: 'auto' }}>
									{selectedGroup.members?.map((member) => (
										<ListItem key={member.firebase_uid} sx={{ px: 0 }}>
											<ListItemAvatar>
												<Avatar
													sx={{
														bgcolor: WHATSAPP_COLORS.primary,
														width: 40,
														height: 40,
													}}
												>
													{member.first_name?.[0]?.toUpperCase()}
													{member.last_name?.[0]?.toUpperCase()}
												</Avatar>
											</ListItemAvatar>
											<ListItemText
												primary={
													<Typography sx={{ color: WHATSAPP_COLORS.onSurface }}>
														{member.first_name} {member.last_name}
													</Typography>
												}
												secondary={
													<Typography
														sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
													>
														{member.firebase_uid === selectedGroup.creator_id
															? 'Admin'
															: 'Member'}
													</Typography>
												}
											/>
										</ListItem>
									))}
								</List>
							</Box>
						</Stack>
					)}
				</DialogContent>
				<DialogActions>
					<Button
						onClick={() => setIsAddMembersDialogOpen(true)}
						sx={{ color: WHATSAPP_COLORS.primary }}
						startIcon={<PersonAddIcon />}
					>
						Add Members
					</Button>
					<Button
						onClick={() => handleLeaveGroup(selectedGroup?.id)}
						sx={{ color: WHATSAPP_COLORS.error }}
						startIcon={<LeaveGroupIcon />}
					>
						Leave Group
					</Button>
					<Button
						onClick={() => setIsGroupInfoDialogOpen(false)}
						sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
					>
						Close
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default Chat;
