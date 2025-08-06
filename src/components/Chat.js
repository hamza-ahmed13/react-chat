import React, { useState, useEffect, useRef, useCallback } from 'react';
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
	Fade,
	Slide,
	Grow,
} from '@mui/material';
import {
	Send as SendIcon,
	ExitToApp as ExitToAppIcon,
	Search as SearchIcon,
	EmojiEmotions as EmojiIcon,
	AttachFile as AttachFileIcon,
	DoneAll as DoneAllIcon,
	Description as DocumentIcon,
	Mic as MicIcon,
	Image as ImageIcon,
	Folder as FolderIcon,
	Close as CloseIcon,
	KeyboardArrowDown as ArrowDownIcon,
	Group as GroupIcon,
	Add as AddIcon,
	Info as InfoIcon,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';
import GroupCreation from './GroupCreation';
import {
	connectSocket,
	sendMessage,
	sendGroupMessage,
	sendFile,
	sendGroupFile,
	joinRoom,
	leaveRoom,
} from '../services/socket';
import EmojiPicker from 'emoji-picker-react';

const DRAWER_WIDTH = 340; // Increased for better proportions

// Professional animation styles
const slideInFromLeft = {
	'@keyframes slideInFromLeft': {
		from: { transform: 'translateX(-100%)', opacity: 0 },
		to: { transform: 'translateX(0)', opacity: 1 }
	},
	animation: 'slideInFromLeft 0.3s ease-out'
};

const fadeIn = {
	'@keyframes fadeIn': {
		from: { opacity: 0 },
		to: { opacity: 1 }
	},
	animation: 'fadeIn 0.3s ease-out'
};

const messageSlideIn = {
	'@keyframes messageSlideIn': {
		from: { transform: 'translateY(20px)', opacity: 0 },
		to: { transform: 'translateY(0)', opacity: 1 }
	},
	animation: 'messageSlideIn 0.2s ease-out'
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
	const [groups, setGroups] = useState([]);
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
	const [showCamera, setShowCamera] = useState(false);
	const [cameraStream, setCameraStream] = useState(null);
	const [showScrollToBottom, setShowScrollToBottom] = useState(false);
	const [showGroupCreation, setShowGroupCreation] = useState(false);
	const [showGroupInfo, setShowGroupInfo] = useState(false);
	const [groupMembers, setGroupMembers] = useState([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [showAddMember, setShowAddMember] = useState(false);
	const [availableUsers, setAvailableUsers] = useState([]);
	const [selectedNewMembers, setSelectedNewMembers] = useState([]);

	const messagesEndRef = useRef(null);
	const messagesContainerRef = useRef(null);
	const messageInputRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const attachmentMenuRef = useRef(null);
	const recordingTimerRef = useRef(null);
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const navigate = useNavigate();
	const { auth } = useFirebase();

	const filteredUsers = users
		.filter(
			(user) =>
				user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
		)
		.sort((a, b) => {
			// Sort by most recent message timestamp
			const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
			const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
			return bTime - aTime; // Most recent first
		});

	const filteredGroups = groups
		.filter(group =>
			group.name?.toLowerCase().includes(searchQuery.toLowerCase())
		)
		.sort((a, b) => {
			// Sort by most recent message timestamp
			const aTime = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
			const bTime = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
			return bTime - aTime; // Most recent first
		});

	const fetchUsers = useCallback(async () => {
			if (!auth.currentUser) {
				console.log('No current user found');
				return;
			}

			try {
				setIsLoading(true);
				setError(null);
				// console.log('Current user:', auth.currentUser.uid);

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
				// console.log('Chat users response:', data);

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
					// console.log('Processing new format response');
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
					// console.log('Processing standard format response');
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
					// console.log('All users response:', data);

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

				// console.log('Processed users:', processedUsers);
				setUsers(processedUsers);

				// Join all potential chat rooms so we can receive messages in real-time
				const socket = connectSocket(auth.currentUser.uid);
				if (socket) {
					processedUsers.forEach((user) => {
						const roomName = generateRoomName(
							auth.currentUser.uid,
							user.firebase_uid
						);
						// console.log(
						// 	`Joining room for user ${user.first_name}: ${roomName}`
						// );
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
		}, [auth.currentUser]);

	const fetchGroups = useCallback(async () => {
		if (!auth.currentUser) {
			console.log('No current user found for groups');
			return;
		}

		try {
			// console.log('Fetching groups for user:', auth.currentUser.uid);
			const response = await fetch(
				`http://localhost:8000/api/groups/user/${auth.currentUser.uid}`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);
			const data = await response.json();
			// console.log('Groups response:', data);

			if (response.ok && data.status && Array.isArray(data.data)) {
				setGroups(data.data);
				// console.log('Groups loaded:', data.data.length);
			} else {
				console.error('Failed to fetch groups:', data.message);
				setGroups([]);
			}
		} catch (error) {
			console.error('Error fetching groups:', error);
			setGroups([]);
		}
	}, [auth.currentUser]);

	const fetchGroupMembers = useCallback(async (groupId) => {
		if (!groupId) return;

		try {
			setLoadingMembers(true);
			// console.log('Fetching members for group:', groupId);
			
			const response = await fetch(`http://localhost:8000/api/groups/${groupId}`, {
				headers: {
					'ngrok-skip-browser-warning': 'true',
				},
			});
			
			const data = await response.json();
			// console.log('Group details response:', data);

			if (response.ok && data.status && data.data) {
				setGroupMembers(data.data.members || []);
				// console.log('Group members loaded:', data.data.members?.length || 0);
			} else {
				console.error('Failed to fetch group members:', data.message);
				setGroupMembers([]);
			}
		} catch (error) {
			console.error('Error fetching group members:', error);
			setGroupMembers([]);
		} finally {
			setLoadingMembers(false);
		}
	}, []);

	const handleRemoveMember = async (memberUserId) => {
		if (!selectedChat?.id || !memberUserId || !auth.currentUser) return;

		try {
			console.log('Removing member:', memberUserId, 'from group:', selectedChat.id);
			
			const response = await fetch(
				`http://localhost:8000/api/groups/${selectedChat.id}/members/${memberUserId}`,
				{
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json',
						'ngrok-skip-browser-warning': 'true',
					},
					body: JSON.stringify({
						requesterId: auth.currentUser.uid
					})
				}
			);

			const data = await response.json();
			// console.log('Remove member response:', data);

			if (response.ok && data.status) {
				setSnackbar({
					open: true,
					message: 'Member removed successfully',
					severity: 'success'
				});
				// Refresh the members list
				fetchGroupMembers(selectedChat.id);
				// Refresh groups list to update member count
				fetchGroups();
			} else {
				setSnackbar({
					open: true,
					message: data.message || 'Failed to remove member',
					severity: 'error'
				});
			}
		} catch (error) {
			console.error('Error removing member:', error);
			setSnackbar({
				open: true,
				message: 'Failed to remove member',
				severity: 'error'
			});
		}
	};

	const handleAddMember = async () => {
		setShowAddMember(true);
		await fetchAvailableUsers();
	};

	const fetchAvailableUsers = async () => {
		if (!auth.currentUser || !selectedChat?.id) return;

		try {
			// console.log('Fetching available users for group:', selectedChat.id);
			
			// Get all users
			const response = await fetch(
				`http://localhost:8000/api/chat/users/${auth.currentUser.uid}`,
				{
					headers: {
						'ngrok-skip-browser-warning': 'true',
					},
				}
			);

			const data = await response.json();
			// console.log('All users response:', data);

			if (response.ok && data.status && Array.isArray(data.data)) {
				// Filter out users who are already members
				const currentMemberIds = groupMembers.map(member => member.user.firebase_uid);
				const availableUsersFiltered = data.data.filter(user => 
					!currentMemberIds.includes(user.firebase_uid)
				);
				
				setAvailableUsers(availableUsersFiltered);
				// console.log('Available users to add:', availableUsersFiltered.length);
			} else {
				console.error('Failed to fetch users:', data.message);
				setAvailableUsers([]);
			}
		} catch (error) {
			console.error('Error fetching available users:', error);
			setAvailableUsers([]);
		}
	};

	const handleAddSelectedMembers = async () => {
		if (!selectedChat?.id || selectedNewMembers.length === 0 || !auth.currentUser) return;

		try {
			// console.log('Adding members:', selectedNewMembers, 'to group:', selectedChat.id);
			
			let successCount = 0;
			let errors = [];

			// Add members one by one
			for (const userId of selectedNewMembers) {
				try {
					const response = await fetch(
						`http://localhost:8000/api/groups/${selectedChat.id}/members`,
						{
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'ngrok-skip-browser-warning': 'true',
							},
							body: JSON.stringify({
								userId: userId,
								requesterId: auth.currentUser.uid
							})
						}
					);

					const data = await response.json();
					// console.log(`Add member ${userId} response:`, data);

					if (response.ok && data.status) {
						successCount++;
					} else {
						errors.push(data.message || `Failed to add user ${userId}`);
					}
				} catch (error) {
					console.error(`Error adding member ${userId}:`, error);
					errors.push(`Failed to add user ${userId}`);
				}
			}

			// Show appropriate message
			if (successCount === selectedNewMembers.length) {
				setSnackbar({
					open: true,
					message: `${successCount} member(s) added successfully`,
					severity: 'success'
				});
			} else if (successCount > 0) {
				setSnackbar({
					open: true,
					message: `${successCount} member(s) added, ${errors.length} failed`,
					severity: 'warning'
				});
			} else {
				setSnackbar({
					open: true,
					message: errors[0] || 'Failed to add members',
					severity: 'error'
				});
			}
			
			// Close dialog and reset state
			setShowAddMember(false);
			setSelectedNewMembers([]);
			
			// Refresh the members list and groups
			fetchGroupMembers(selectedChat.id);
			fetchGroups();

		} catch (error) {
			console.error('Error adding members:', error);
			setSnackbar({
				open: true,
				message: 'Failed to add members',
				severity: 'error'
			});
		}
	};

	useEffect(() => {
		fetchUsers();
		fetchGroups();
	}, [fetchUsers, fetchGroups]);

	// Set up socket listener for new messages - separate useEffect with selectedChat dependency
	useEffect(() => {
		if (!auth.currentUser) return;

		const socket = connectSocket(auth.currentUser.uid);
		if (!socket) {
			console.error('Failed to get socket connection');
			return;
		}

		// console.log(
		// 	'Setting up socket listener with selectedChat:',
		// 	selectedChat?.first_name || 'none'
		// );
		// console.log('Socket connected:', socket.connected);

		// Test socket connection
		socket.on('connect', () => {
			console.log('Socket connected in Chat component');
		});

		socket.on('disconnect', () => {
			console.log('Socket disconnected in Chat component');
		});

		const handleReceiveMessage = (newMessage) => {
			// console.log('Received new message:', newMessage);
			// console.log('Message type:', newMessage.message_type);
			// console.log('Has attachment:', !!newMessage.attachment_url);
			// console.log('Attachment URL:', newMessage.attachment_url);
			// console.log(
			// 	'Current selectedChat:',
			// 	selectedChat?.firebase_uid || 'none'
			// );

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
				// console.log(
				// 	'✅ Message belongs to current chat, updating messages array'
				// );
				// console.log('Selected chat UID:', selectedChat.firebase_uid);
				// console.log('Message sender:', newMessage.sender_id);
				// console.log('Message receiver:', newMessage.receiver_id);

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

				// console.log('Formatted message:', formattedMessage);
				// console.log('Message has attachment_url:', !!formattedMessage.attachment_url);

				// Check for duplicate messages (prevent double-adding real messages)
				setMessages((prevMessages) => {
					// console.log('Previous messages count:', prevMessages.length);

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

					// console.log(
					// 	'✅ Adding new message to current chat:',
					// 	formattedMessage
					// );
					const newMessages = [...prevMessages, formattedMessage];
					// console.log('New messages count:', newMessages.length);
					// console.log('Message added with attachment_url:', formattedMessage.attachment_url);
					
					// Force re-render by updating messages state
					setTimeout(() => {
						console.log('Force updating messages state for attachment rendering');
					}, 100);
					
					return newMessages;
				});

				// Scroll to bottom after adding new message
				setTimeout(scrollToBottom, 100);
			} else {
				// console.log(
				// 	'❌ Message does not belong to current chat or no chat selected'
				// );
				// console.log('Selected chat UID:', selectedChat?.firebase_uid || 'none');
				// console.log('Message sender:', newMessage.sender_id);
				// console.log('Message receiver:', newMessage.receiver_id);

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

		// Handle group messages
		socket.on('receive_group_message', (newMessage) => {
			// console.log('🔵 Received group message:', newMessage);
			// console.log('🔵 Message has attachment_url:', !!newMessage.attachment_url);
			// console.log('🔵 Message type:', newMessage.message_type);
			// console.log('🔵 Current selectedChat:', selectedChat);
			// console.log('🔵 selectedChat.id:', selectedChat?.id, 'newMessage.group_id:', newMessage.group_id);
			
			// Check if this message is for the current group chat
			const isMessageForCurrentChat = selectedChat?.isGroup && 
				selectedChat.id === newMessage.group_id;

			// console.log('🔵 isMessageForCurrentChat:', isMessageForCurrentChat);

			if (isMessageForCurrentChat) {
				setMessages(prevMessages => {
					// Check if message already exists
					const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
					if (messageExists) {
						console.log('Group message already exists, updating status');
						return prevMessages.map(msg => 
							msg.id === newMessage.id ? { ...msg, ...newMessage } : msg
						);
					}
					
					// Add new message
					const transformedMessage = {
						id: newMessage.id,
						text: newMessage.text || newMessage.message,
						senderId: newMessage.senderId || newMessage.sender_id,
						groupId: newMessage.group_id,
						senderName: newMessage.senderName || (newMessage.sender ? 
							`${newMessage.sender.first_name} ${newMessage.sender.last_name}` : 
							'Unknown'),
						timestamp: newMessage.timestamp || newMessage.created_at,
						status: newMessage.status,
						message_type: newMessage.message_type,
						attachment_url: newMessage.attachment_url,
						attachment_type: newMessage.attachment_type,
						attachment_name: newMessage.attachment_name,
						attachment_size: newMessage.attachment_size,
						chat_type: 'group'
					};
					
					// console.log('🔵 Adding new group message to state:', transformedMessage);
					// console.log('🔵 Transformed message has attachment_url:', !!transformedMessage.attachment_url);
					return [...prevMessages, transformedMessage];
				});
				
				// Scroll to bottom after receiving message
				setTimeout(scrollToBottom, 100);
			}
			
			// Update groups list to reflect latest message
			fetchGroups();
		});

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
			let response;
			
			if (selectedChat.isGroup) {
				// Fetch group messages
				const groupId = selectedChat.id;
				response = await fetch(
					`http://localhost:8000/api/groups/${groupId}/messages/${auth.currentUser.uid}`,
					{
						headers: {
							'ngrok-skip-browser-warning': 'true',
						},
					}
				);
			} else {
				// Fetch individual messages
				const roomName = generateRoomName(
					auth.currentUser.uid,
					selectedChat.firebase_uid
				);
				response = await fetch(
					`http://localhost:8000/api/messages/${roomName}`,
					{
						headers: {
							'ngrok-skip-browser-warning': 'true',
						},
					}
				);
			}
			
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
				// console.log(
				// 	'🧹 Previous unread count:',
				// 	prev[selectedChat.firebase_uid] || 0
				// );
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

		// Store the message before clearing
		const messageText = message.trim();
		
		// Clear the input immediately
		setMessage('');
		messageInputRef.current?.focus();

		try {
			if (selectedChat.isGroup) {
				// Send group message
				const messageData = {
					text: messageText,
					senderId: auth.currentUser.uid,
					groupId: selectedChat.id,
				};
				await sendGroupMessage(messageData);
				console.log('Group message sent successfully via socket');
			} else {
				// Send individual message
				const messageData = {
					text: messageText,
					senderId: auth.currentUser.uid,
					receiverId: selectedChat.firebase_uid,
				};
				await sendMessage(messageData);
				console.log('Message sent successfully via socket');
			}
			
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
			let isCancelled = false;

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					chunks.push(e.data);
				}
			};

			recorder.onstop = () => {
				// Stop all tracks
				stream.getTracks().forEach(track => track.stop());
				
				// Clear timer
				if (recordingTimerRef.current) {
					clearInterval(recordingTimerRef.current);
					recordingTimerRef.current = null;
				}

				// Only send file if not cancelled
				if (!isCancelled && chunks.length > 0) {
					const blob = new Blob(chunks, { type: 'audio/webm' });
					const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
					handleSendFile(file);
				}
			};

			// Store reference to cancel function
			recorder.cancel = () => {
				isCancelled = true;
			};

			setMediaRecorder(recorder);
			setIsRecording(true);
			setRecordingTime(0);
			
			// Start recording
			recorder.start();

			// Start timer
			recordingTimerRef.current = setInterval(() => {
				setRecordingTime(prev => {
					const newTime = prev + 1;
					console.log('Recording time:', newTime);
					return newTime;
				});
			}, 1000);

			console.log('Recording started, timer initialized');

		} catch (error) {
			console.error('Error starting recording:', error);
			setSnackbar({ open: true, message: 'Could not access microphone', severity: 'error' });
		}
	};

	const stopRecording = () => {
		console.log('Stopping recording...');
		if (mediaRecorder && isRecording) {
			mediaRecorder.stop();
			setIsRecording(false);
			setRecordingTime(0);
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
				recordingTimerRef.current = null;
			}
			console.log('Recording stopped');
		}
	};

	const cancelRecording = () => {
		console.log('Cancelling recording...');
		if (mediaRecorder && isRecording) {
			// Mark as cancelled before stopping
			if (mediaRecorder.cancel) {
				mediaRecorder.cancel();
			}
			
			// Stop the recorder
			mediaRecorder.stop();
			setIsRecording(false);
			setRecordingTime(0);
			if (recordingTimerRef.current) {
				clearInterval(recordingTimerRef.current);
				recordingTimerRef.current = null;
			}
			console.log('Recording cancelled');
		}
	};

	const handleCameraSelect = async () => {
		setShowAttachmentMenu(false);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ 
				video: { facingMode: 'environment' } 
			});
			setCameraStream(stream);
			setShowCamera(true);
		} catch (error) {
			console.error('Error accessing camera:', error);
			setSnackbar({ open: true, message: 'Could not access camera', severity: 'error' });
		}
	};

	const capturePhoto = () => {
		if (videoRef.current && canvasRef.current) {
			const canvas = canvasRef.current;
			const video = videoRef.current;
			
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			
			const ctx = canvas.getContext('2d');
			ctx.drawImage(video, 0, 0);
			
			canvas.toBlob((blob) => {
				const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
				setPreviewFile(file);
				setPreviewOpen(true);
				closeCameraModal();
			}, 'image/jpeg', 0.8);
		}
	};

	const closeCameraModal = () => {
		if (cameraStream) {
			cameraStream.getTracks().forEach(track => track.stop());
			setCameraStream(null);
		}
		setShowCamera(false);
	};

	const handleSendFile = async (file) => {
		if (!file || !selectedChat || !auth.currentUser) return;

		setIsUploading(true);
		setSnackbar({ open: true, message: `Uploading ${file.name}...`, severity: 'info' });
		
		try {
			if (selectedChat.isGroup) {
				// Send group file
				await sendGroupFile({
					file: file,
					senderId: auth.currentUser.uid,
					groupId: selectedChat.id,
					message: message.trim() || null
				});
				console.log('Group file sent successfully via socket');
			} else {
				// Send individual file
				await sendFile({
					file: file,
					senderId: auth.currentUser.uid,
					receiverId: selectedChat.firebase_uid,
					message: message.trim() || null
				});
				console.log('File sent successfully via socket');
			}
			
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
								<MicIcon sx={{ color: '#25d366' }} />
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
									backgroundColor: isOwnMessage ? '#dcf8c6' : '#ffffff',
									borderRadius: '8px',
									cursor: 'pointer',
									minWidth: 200,
									maxWidth: 280,
									border: `1px solid ${isOwnMessage ? '#c1f0a8' : '#e9edef'}`,
									'&:hover': {
										backgroundColor: isOwnMessage ? '#d1f2bd' : '#f5f5f5',
									},
								}}
								onClick={() => window.open(`http://localhost:8000${msg.attachment_url}`, '_blank')}
							>
								<Box
									sx={{
										backgroundColor: '#008069',
										borderRadius: '50%',
										p: 1,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<DocumentIcon sx={{ 
										color: 'white', 
										fontSize: '1.2rem' 
									}} />
								</Box>
								<Box sx={{ flexGrow: 1, minWidth: 0 }}>
									<Typography
										variant="body2"
										sx={{
											fontWeight: 'medium',
											color: '#111b21',
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
											color: '#667781',
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
		messagesEndRef.current?.scrollIntoView({ 
			behavior: 'smooth',
			block: 'end',
			inline: 'nearest'
		});
	};

	const handleGroupCreated = (newGroup) => {
		console.log('New group created:', newGroup);
		setSnackbar({ 
			open: true, 
			message: `Group "${newGroup.name}" created successfully!`, 
			severity: 'success' 
		});
		// Refresh groups list and select the new group
		fetchGroups();
		// Set the new group as selected chat
		setSelectedChat({
			...newGroup,
			isGroup: true,
			firebase_uid: `group-${newGroup.id}` // Create a unique identifier for groups
		});
	};

	return (
		<Box sx={{ 
			display: 'flex', 
			height: '100vh', 
			backgroundColor: '#0b141a',
			fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif',
			overflow: 'hidden',
			...fadeIn
		}}>
			{/* Professional Cinnova Sidebar */}
			<Drawer
				variant="permanent"
				sx={{
					width: DRAWER_WIDTH,
					flexShrink: 0,
					'& .MuiDrawer-paper': {
						width: DRAWER_WIDTH,
						boxSizing: 'border-box',
						backgroundColor: '#202c33',
						borderRight: '1px solid rgba(134, 150, 160, 0.15)',
						color: '#e9edef',
						boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
						...slideInFromLeft
					},
				}}
			>
				{/* Professional Cinnova Header */}
				<Box sx={{ 
					backgroundColor: '#2a3942', 
					color: '#e9edef',
					p: 3,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					borderBottom: '1px solid rgba(59, 74, 84, 0.5)',
					boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
					position: 'relative',
					'&::after': {
						content: '""',
						position: 'absolute',
						bottom: 0,
						left: 0,
						right: 0,
						height: '1px',
						background: 'linear-gradient(90deg, transparent, rgba(0,168,132,0.3), transparent)'
					}
				}}>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
						{auth.currentUser && (
							<Avatar sx={{ 
								bgcolor: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
								width: 45,
								height: 45,
								fontSize: '1.1rem',
								fontWeight: 600,
								border: '3px solid rgba(0,168,132,0.3)',
								boxShadow: '0 4px 12px rgba(0,168,132,0.25)',
								transition: 'all 0.3s ease',
								cursor: 'pointer',
								'&:hover': {
									transform: 'scale(1.05)',
									boxShadow: '0 6px 20px rgba(0,168,132,0.4)'
								}
							}}>
								{users.find(u => u.firebase_uid === auth.currentUser.uid)?.first_name?.[0]?.toUpperCase() || 
								 auth.currentUser.displayName?.[0]?.toUpperCase() || 
								 auth.currentUser.email?.[0]?.toUpperCase() || 'U'}
								{users.find(u => u.firebase_uid === auth.currentUser.uid)?.last_name?.[0]?.toUpperCase() || ''}
							</Avatar>
						)}
						<Box>
							<Typography variant="h6" sx={{ 
								fontWeight: 600, 
								color: '#e9edef',
								fontSize: '1.3rem',
								letterSpacing: '0.5px'
							}}>
								Cinnova
							</Typography>
							<Typography variant="caption" sx={{ 
								color: '#8696a0',
								fontSize: '0.75rem',
								fontWeight: 400
							}}>
								Chat
							</Typography>
						</Box>
					</Box>
					<Box sx={{ display: 'flex', gap: 0.5 }}>
						<IconButton 
							sx={{ 
								color: '#aebac1',
								'&:hover': { 
									backgroundColor: 'rgba(255,255,255,0.1)',
									color: '#e9edef'
								}
							}} 
							size="small"
							onClick={() => setIsLogoutDialogOpen(true)}
							title="Logout"
						>
							<ExitToAppIcon />
						</IconButton>
					</Box>
				</Box>

				{/* Professional Search Bar */}
				<Box sx={{ p: 2.5, backgroundColor: '#202c33' }}>
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
								backgroundColor: '#2a3942',
								color: '#e9edef',
								transition: 'all 0.3s ease',
								boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
								'&:hover': {
									backgroundColor: '#3b4a54',
									boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
									transform: 'translateY(-1px)',
								},
								'&.Mui-focused': {
									backgroundColor: '#3b4a54',
									boxShadow: '0 0 0 2px rgba(0,168,132,0.2)',
									'& .MuiOutlinedInput-notchedOutline': {
										borderColor: '#00a884',
									},
								},
								'& .MuiOutlinedInput-notchedOutline': {
									borderColor: 'transparent',
								},
							},
							'& .MuiInputBase-input': {
								fontSize: '0.95rem',
								color: '#e9edef',
								padding: '12px 16px',
								'&::placeholder': {
									color: '#8696a0',
									opacity: 1,
									fontWeight: 400,
								},
							},
						}}
						InputProps={{
							startAdornment: (
								<InputAdornment position="start">
									<SearchIcon sx={{ 
										color: '#8696a0',
										fontSize: '1.1rem',
									}} />
								</InputAdornment>
							),
						}}
					/>
				</Box>

				{/* Modern Cinnova Chat List */}
				<Box sx={{ overflow: 'auto', flexGrow: 1, backgroundColor: '#202c33' }}>
					{error && (
						<Alert severity="error" sx={{ mx: 2, mb: 2, backgroundColor: '#2a3942', color: '#e9edef' }}>
							{error}
						</Alert>
					)}
					{isLoading ? (
						<Box sx={{ p: 2 }}>
							{[...Array(6)].map((_, index) => (
								<Box key={index} sx={{ 
									display: 'flex', 
									alignItems: 'center', 
									p: 2.5, 
									gap: 2,
									mb: 1,
									borderRadius: '0 12px 12px 0',
									margin: '2px 8px 2px 0',
								}}>
									<Box sx={{
										width: 52,
										height: 52,
										borderRadius: '50%',
										background: 'linear-gradient(90deg, #2a3942 0%, #3b4a54 50%, #2a3942 100%)',
										backgroundSize: '200% 100%',
										animation: 'shimmer 1.5s infinite',
										'@keyframes shimmer': {
											'0%': { backgroundPosition: '200% 0' },
											'100%': { backgroundPosition: '-200% 0' }
										}
									}} />
									<Box sx={{ flexGrow: 1 }}>
										<Box sx={{
											height: 16,
											borderRadius: 1,
											background: 'linear-gradient(90deg, #2a3942 0%, #3b4a54 50%, #2a3942 100%)',
											backgroundSize: '200% 100%',
											animation: 'shimmer 1.5s infinite',
											mb: 1,
											width: `${60 + Math.random() * 40}%`,
											'@keyframes shimmer': {
												'0%': { backgroundPosition: '200% 0' },
												'100%': { backgroundPosition: '-200% 0' }
											}
										}} />
										<Box sx={{
											height: 12,
											borderRadius: 1,
											background: 'linear-gradient(90deg, #2a3942 0%, #3b4a54 50%, #2a3942 100%)',
											backgroundSize: '200% 100%',
											animation: 'shimmer 1.5s infinite',
											width: `${40 + Math.random() * 30}%`,
											'@keyframes shimmer': {
												'0%': { backgroundPosition: '200% 0' },
												'100%': { backgroundPosition: '-200% 0' }
											}
										}} />
									</Box>
								</Box>
							))}
						</Box>
					) : users.length === 0 ? (
						<Box sx={{ p: 2, textAlign: 'center' }}>
							<Typography sx={{ color: '#8696a0' }}>No chats available</Typography>
					</Box>
				) : (
						<List sx={{ p: 0 }}>
							{/* Create New Group Button */}
							<ListItem disablePadding>
								<ListItemButton
									onClick={() => setShowGroupCreation(true)}
									sx={{
										backgroundColor: 'rgba(0, 168, 132, 0.1)',
										'&:hover': {
											backgroundColor: 'rgba(0, 168, 132, 0.2)',
											transform: 'translateX(4px)',
										},
										py: 2.5,
										px: 3,
										borderLeft: '4px solid #00a884',
										borderRadius: '0 12px 12px 0',
										margin: '2px 8px 8px 0',
										transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
										position: 'relative',
										boxShadow: '0 2px 8px rgba(0,168,132,0.15)',
									}}
								>
									<ListItemAvatar>
										<Avatar sx={{ 
											background: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
											width: 52,
											height: 52,
											fontSize: '1.5rem',
											fontWeight: 600,
											color: '#ffffff',
											border: '2px solid rgba(0,168,132,0.2)',
											boxShadow: '0 3px 10px rgba(0,168,132,0.2)',
											transition: 'all 0.3s ease',
											'&:hover': {
												transform: 'scale(1.05)',
												boxShadow: '0 5px 15px rgba(0,168,132,0.3)'
											}
										}}>
											<GroupIcon />
										</Avatar>
									</ListItemAvatar>
									<ListItemText
										primaryTypographyProps={{ component: 'div' }}
										secondaryTypographyProps={{ component: 'div' }}
										primary={
											<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
												<Typography
													sx={{
														fontWeight: 600,
														fontSize: '1rem',
														color: '#e9edef',
													}}
												>
													Create New Group
												</Typography>
												<AddIcon sx={{ color: '#00a884', fontSize: '1.2rem' }} />
											</Box>
										}
										secondary={
											<Typography
												sx={{
													fontSize: '0.85rem',
													color: '#8696a0',
													mt: 0.5,
												}}
											>
												Create a group chat with multiple users
											</Typography>
										}
									/>
								</ListItemButton>
							</ListItem>
							
							{/* Divider */}
							<Divider sx={{ 
								borderColor: 'rgba(134, 150, 160, 0.15)', 
								mx: 2, 
								my: 1 
							}} />
							
							{/* Groups */}
							{filteredGroups.map((group) => (
								<React.Fragment key={`group-${group.id}`}>
									<ListItem disablePadding>
										<ListItemButton
											selected={selectedChat?.firebase_uid === `group-${group.id}`}
											onClick={() => setSelectedChat({
												...group,
												isGroup: true,
												firebase_uid: `group-${group.id}`
											})}
											sx={{
												backgroundColor:
													selectedChat?.firebase_uid === `group-${group.id}`
														? 'rgba(42, 57, 66, 0.8)'
														: 'transparent',
												'&:hover': {
													backgroundColor: 'rgba(42, 57, 66, 0.6)',
													transform: 'translateX(4px)',
												},
												py: 2.5,
												px: 3,
												borderLeft: selectedChat?.firebase_uid === `group-${group.id}` 
													? '4px solid #00a884' 
													: '4px solid transparent',
												borderRadius: '0 12px 12px 0',
												margin: '2px 8px 2px 0',
												transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
												position: 'relative',
												'&::before': selectedChat?.firebase_uid === `group-${group.id}` ? {
													content: '""',
													position: 'absolute',
													left: 0,
													top: 0,
													bottom: 0,
													width: '4px',
													background: 'linear-gradient(180deg, #00a884 0%, #008c7a 100%)',
													borderRadius: '0 2px 2px 0'
												} : {},
												boxShadow: selectedChat?.firebase_uid === `group-${group.id}` 
													? '0 2px 8px rgba(0,168,132,0.15)' 
													: 'none',
											}}
										>
											<ListItemAvatar>
												<Avatar sx={{ 
													background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
													width: 52,
													height: 52,
													fontSize: '1.3rem',
													fontWeight: 600,
													color: '#ffffff',
													border: '2px solid rgba(37,211,102,0.2)',
													boxShadow: '0 3px 10px rgba(37,211,102,0.2)',
													transition: 'all 0.3s ease',
													'&:hover': {
														transform: 'scale(1.05)',
														boxShadow: '0 5px 15px rgba(37,211,102,0.3)'
													}
												}}>
													<GroupIcon />
												</Avatar>
											</ListItemAvatar>
											<ListItemText
												primaryTypographyProps={{ component: 'div' }}
												secondaryTypographyProps={{ component: 'div' }}
												primary={
													<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
														<Typography
															sx={{
																fontWeight: 600,
																fontSize: '1rem',
																color: '#e9edef',
															}}
														>
															{group.name}
														</Typography>
														{group.lastMessage && (
															<Typography
																sx={{
																	fontSize: '0.75rem',
																	color: '#8696a0',
																}}
															>
																{new Date(group.lastMessage.timestamp).toLocaleTimeString([], {
																	hour: '2-digit',
																	minute: '2-digit',
																})}
															</Typography>
														)}
													</Box>
												}
												secondary={
													<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
														<Typography
															sx={{
																fontSize: '0.85rem',
																color: '#8696a0',
																overflow: 'hidden',
																textOverflow: 'ellipsis',
																whiteSpace: 'nowrap',
																maxWidth: '180px',
															}}
														>
															{group.lastMessage ? (
																group.lastMessage.text || 
																(group.lastMessage.attachment_type ? 
																	`📎 ${group.lastMessage.attachment_type}` : 
																	'No messages yet')
															) : (
																`${group.memberCount || 0} members`
															)}
														</Typography>
													</Box>
												}
											/>
										</ListItemButton>
								</ListItem>
							</React.Fragment>
						))}
							
							{/* Individual Users */}
							{filteredUsers.map((user) => (
								<React.Fragment key={user.firebase_uid}>
									<ListItem disablePadding>
										<ListItemButton
											selected={selectedChat?.firebase_uid === user.firebase_uid}
											onClick={() => setSelectedChat(user)}
											sx={{
												backgroundColor:
													selectedChat?.firebase_uid === user.firebase_uid
														? 'rgba(42, 57, 66, 0.8)'
														: 'transparent',
												'&:hover': {
													backgroundColor: 'rgba(42, 57, 66, 0.6)',
													transform: 'translateX(4px)',
												},
												py: 2.5,
												px: 3,
												borderLeft: selectedChat?.firebase_uid === user.firebase_uid 
													? '4px solid #00a884' 
													: '4px solid transparent',
												borderRadius: '0 12px 12px 0',
												margin: '2px 8px 2px 0',
												transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
												position: 'relative',
												'&::before': selectedChat?.firebase_uid === user.firebase_uid ? {
													content: '""',
													position: 'absolute',
													left: 0,
													top: 0,
													bottom: 0,
													width: '4px',
													background: 'linear-gradient(180deg, #00a884 0%, #008c7a 100%)',
													borderRadius: '0 2px 2px 0'
												} : {},
												boxShadow: selectedChat?.firebase_uid === user.firebase_uid 
													? '0 2px 8px rgba(0,168,132,0.15)' 
													: 'none',
											}}
										>
										<ListItemAvatar>
											<Avatar sx={{ 
												background: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
												width: 52,
												height: 52,
												fontSize: '1.3rem',
												fontWeight: 600,
												color: '#ffffff',
												border: '2px solid rgba(0,168,132,0.2)',
												boxShadow: '0 3px 10px rgba(0,168,132,0.2)',
												transition: 'all 0.3s ease',
												'&:hover': {
													transform: 'scale(1.05)',
													boxShadow: '0 5px 15px rgba(0,168,132,0.3)'
												}
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
															fontWeight: unreadMessages[user.firebase_uid] > 0 ? 600 : 400,
															fontSize: '1rem',
															color: '#e9edef',
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
			{/* Modern Cinnova Chat Area */}
			<Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#0b141a' }}>

				{selectedChat ? (
					<>
						{/* Modern Cinnova Chat Header */}
						<Paper
							elevation={0}
							sx={{
								backgroundColor: '#202c33',
								borderBottom: '1px solid #3b4a54',
								display: 'flex',
								alignItems: 'center',
								p: 2,
								gap: 2,
							}}
						>
							<Avatar sx={{ 
								bgcolor: selectedChat.isGroup ? '#25d366' : '#00a884',
								width: 45,
								height: 45,
								fontSize: '1.1rem',
								fontWeight: 600,
								color: '#ffffff'
							}}>
								{selectedChat.isGroup ? (
									<GroupIcon />
								) : (
									<>
										{selectedChat.first_name?.[0]?.toUpperCase()}
										{selectedChat.last_name?.[0]?.toUpperCase()}
									</>
								)}
							</Avatar>
							<Box sx={{ flexGrow: 1 }}>
								<Typography variant="subtitle1" sx={{ 
									fontWeight: 500,
									color: '#e9edef',
									fontSize: '1.1rem'
								}}>
									{selectedChat.isGroup ? selectedChat.name : `${selectedChat.first_name} ${selectedChat.last_name}`}
								</Typography>
								<Typography variant="caption" sx={{ 
									color: '#8696a0',
									fontSize: '0.85rem'
								}}>
									{selectedChat.isGroup ? `${selectedChat.memberCount || 0} members` : 'online'}
								</Typography>
							</Box>
							
							{/* Group Info Button */}
							{selectedChat.isGroup && (
								<IconButton
									onClick={() => {
										setShowGroupInfo(true);
										fetchGroupMembers(selectedChat.id);
									}}
									sx={{
										color: '#8696a0',
										'&:hover': {
											color: '#e9edef',
											backgroundColor: 'rgba(255,255,255,0.1)'
										}
									}}
								>
									<InfoIcon />
								</IconButton>
							)}

						</Paper>

						{/* Modern Cinnova Messages Area */}
						<Box
							ref={messagesContainerRef}
							sx={{
								flexGrow: 1,
								overflow: 'auto',
								backgroundImage: 'url("data:image/svg+xml,%3csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect width=\'100%25\' height=\'100%25\' fill=\'none\' stroke=\'%23182229\' stroke-width=\'1\' stroke-dasharray=\'6%2c 14\' stroke-dashoffset=\'0\' stroke-linecap=\'square\'/%3e%3c/svg%3e")',
								backgroundColor: '#0b141a',
								p: 1,
								position: 'relative',
								scrollBehavior: 'smooth',
							}}
							onScroll={(e) => {
								const { scrollTop, scrollHeight, clientHeight } = e.target;
								const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
								setShowScrollToBottom(!isNearBottom);
							}}
						>
							<Container maxWidth={false} sx={{ p: 0 }}>
								{messages.map((msg, index) => (
									<Grow
										in={true}
										timeout={300}
										key={msg.id || `temp-${msg.timestamp}-${index}`}
									>
									<Box
										sx={{
											display: 'flex',
												justifyContent: msg.senderId === auth.currentUser.uid ? 'flex-end' : 'flex-start',
												mb: 1.5,
												px: 3,
												...messageSlideIn
										}}
									>
										<Box
											sx={{
												maxWidth: '70%',
												background: msg.senderId === auth.currentUser.uid 
													? 'linear-gradient(135deg, #005c4b 0%, #004a3d 100%)' 
													: 'linear-gradient(135deg, #202c33 0%, #1a252b 100%)',
												borderRadius: msg.senderId === auth.currentUser.uid ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
												p: 2,
												position: 'relative',
												boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.2)',
												color: '#e9edef',
												backdropFilter: 'blur(10px)',
												border: '1px solid rgba(255,255,255,0.1)',
												transition: 'all 0.2s ease',
												'&:hover': {
													transform: 'translateY(-1px)',
													boxShadow: '0 4px 12px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.15)'
												},
												'&::before': msg.senderId === auth.currentUser.uid ? {
													content: '""',
													position: 'absolute',
													bottom: 0,
													right: -6,
													width: 0,
													height: 0,
													borderLeft: '8px solid #005c4b',
													borderTop: '8px solid transparent',
													borderBottom: '8px solid transparent',
													filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
												} : {
													content: '""',
													position: 'absolute',
													bottom: 0,
													left: -6,
													width: 0,
													height: 0,
													borderRight: '8px solid #202c33',
													borderTop: '8px solid transparent',
													borderBottom: '8px solid transparent',
													filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
												}
											}}
										>
											{/* Show sender name for group messages (except own messages) */}
											{selectedChat?.isGroup && msg.senderId !== auth.currentUser.uid && (
											<Typography
													variant="caption"
													sx={{
														color: '#00a884',
														fontSize: '0.75rem',
														fontWeight: 600,
														mb: 0.5,
														display: 'block',
													}}
											>
													{msg.senderName || 'Unknown'}
											</Typography>
											)}
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
									</Grow>
								))}
								<div ref={messagesEndRef} />
							</Container>
							
							{/* Scroll to Bottom Button */}
							<Fade in={showScrollToBottom}>
								<IconButton
									onClick={scrollToBottom}
									sx={{
										position: 'absolute',
										bottom: 20,
										right: 20,
										background: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
										color: 'white',
										width: 48,
										height: 48,
										boxShadow: '0 4px 12px rgba(0,168,132,0.3)',
										transition: 'all 0.3s ease',
										'&:hover': {
											background: 'linear-gradient(135deg, #008c7a 0%, #00756a 100%)',
											transform: 'scale(1.1)',
											boxShadow: '0 6px 20px rgba(0,168,132,0.4)',
										},
										'&:active': {
											transform: 'scale(0.95)',
										},
									}}
								>
									<ArrowDownIcon />
								</IconButton>
							</Fade>
						</Box>

						{/* Professional Cinnova Input Area */}
						<Paper
							component="form"
							onSubmit={(e) => {
								e.preventDefault();
								handleSendMessage();
							}}
							elevation={0}
							sx={{
								backgroundColor: '#202c33',
								borderTop: '1px solid rgba(59, 74, 84, 0.5)',
								p: 2.5,
								boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
								position: 'relative',
								'&::before': {
									content: '""',
									position: 'absolute',
									top: 0,
									left: 0,
									right: 0,
									height: '1px',
									background: 'linear-gradient(90deg, transparent, rgba(0,168,132,0.2), transparent)'
								}
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
								<IconButton 
									size="small" 
									sx={{ 
										color: '#8696a0', 
										mb: 0.5,
										'&:hover': { 
											backgroundColor: 'rgba(255,255,255,0.1)',
											color: '#e9edef'
										}
									}}
									onClick={() => setShowEmojiPicker(!showEmojiPicker)}
								>
									<EmojiIcon />
								</IconButton>
								<Box sx={{ position: 'relative' }} ref={attachmentMenuRef}>
									<IconButton 
										size="small" 
										sx={{ 
											color: '#8696a0', 
											mb: 0.5,
											'&:hover': { 
												backgroundColor: 'rgba(255,255,255,0.1)',
												color: '#e9edef'
											}
										}}
										onClick={handleAttachmentMenuClick}
										disabled={isUploading}
						>
										<AttachFileIcon />
									</IconButton>
									
									{/* Cinnova-style Attachment Menu */}
									{showAttachmentMenu && (
										<Box
											sx={{
												position: 'absolute',
												bottom: '100%',
												left: 0,
												mb: 1,
												backgroundColor: '#2a3942',
												borderRadius: '8px',
												boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
												p: 1,
												minWidth: 200,
												zIndex: 1000,
												border: '1px solid #3b4a54',
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
														'&:hover': { backgroundColor: '#3b4a54' },
													}}
													onClick={handleImageSelect}
												>
													<ImageIcon sx={{ color: '#7c3aed', mr: 2 }} />
													<Typography variant="body2" sx={{ color: '#e9edef' }}>Photos & Videos</Typography>
												</Box>

												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														p: 1,
														borderRadius: '4px',
														cursor: 'pointer',
														'&:hover': { backgroundColor: '#3b4a54' },
													}}
													onClick={handleDocumentSelect}
												>
													<FolderIcon sx={{ color: '#3b82f6', mr: 2 }} />
													<Typography variant="body2" sx={{ color: '#e9edef' }}>Document</Typography>
												</Box>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														p: 1,
														borderRadius: '4px',
														cursor: 'pointer',
														'&:hover': { backgroundColor: '#3b4a54' },
													}}
													onClick={() => {
														startRecording();
														setShowAttachmentMenu(false);
													}}
												>
													<MicIcon sx={{ color: '#25d366', mr: 2 }} />
													<Typography variant="body2" sx={{ color: '#e9edef' }}>Audio</Typography>
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
												backgroundColor: '#2a3942',
												borderRadius: '24px',
												px: 2,
												py: 1,
												border: '1px solid #3b4a54',
											}}
										>
											<MicIcon sx={{ color: '#25d366', mr: 1, fontSize: '1.2rem' }} />
											<Typography variant="body2" sx={{ flexGrow: 1, color: '#e9edef' }}>
												Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
											</Typography>
											<IconButton size="small" onClick={cancelRecording} sx={{ color: '#f87171', mr: 1 }}>
												<CloseIcon fontSize="small" />
											</IconButton>
											<IconButton size="small" onClick={stopRecording} sx={{ color: '#25d366' }}>
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
													backgroundColor: '#2a3942',
													fontSize: '0.9rem',
													color: '#e9edef',
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
													color: '#e9edef',
													'&::placeholder': {
														color: '#8696a0',
														opacity: 1,
													},
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
												background: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
												color: 'white',
												width: 48,
												height: 48,
												mb: 0.5,
												boxShadow: '0 4px 12px rgba(0,168,132,0.3)',
												transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
												'&:hover': {
													background: 'linear-gradient(135deg, #008c7a 0%, #00756a 100%)',
													transform: 'scale(1.05) translateY(-2px)',
													boxShadow: '0 6px 20px rgba(0,168,132,0.4)',
												},
												'&:active': {
													transform: 'scale(0.95)',
												},
												'&:disabled': {
													background: 'linear-gradient(135deg, #3b4a54 0%, #2a3942 100%)',
													color: 'rgba(255,255,255,0.3)',
													boxShadow: 'none',
													transform: 'none',
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
												background: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
												color: 'white',
												width: 48,
												height: 48,
												mb: 0.5,
												boxShadow: '0 4px 12px rgba(0,168,132,0.3)',
												transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
												'&:hover': {
													background: 'linear-gradient(135deg, #008c7a 0%, #00756a 100%)',
													transform: 'scale(1.05) translateY(-2px)',
													boxShadow: '0 6px 20px rgba(0,168,132,0.4)',
												},
												'&:active': {
													transform: 'scale(0.95)',
												},
											}}
										>
											<MicIcon sx={{ color: 'white' }} />
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
							backgroundColor: '#0b141a',
							backgroundImage: 'url("data:image/svg+xml,%3csvg width=\'100%25\' height=\'100%25\' xmlns=\'http://www.w3.org/2000/svg\'%3e%3crect width=\'100%25\' height=\'100%25\' fill=\'none\' stroke=\'%23182229\' stroke-width=\'1\' stroke-dasharray=\'6%2c 14\' stroke-dashoffset=\'0\' stroke-linecap=\'square\'/%3e%3c/svg%3e")',
							p: 4,
						}}
					>
						<Box sx={{ 
							background: 'linear-gradient(135deg, #00a884 0%, #008c7a 100%)',
							borderRadius: '50%',
							width: 120,
							height: 120,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							mb: 5,
							boxShadow: '0 8px 32px rgba(0,168,132,0.4), 0 4px 16px rgba(0,168,132,0.2)',
							border: '4px solid rgba(0,168,132,0.2)',
							position: 'relative',
							'&::before': {
								content: '""',
								position: 'absolute',
								inset: -2,
								borderRadius: '50%',
								padding: '2px',
								background: 'linear-gradient(135deg, #00a884, #008c7a, #00a884)',
								mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
								maskComposite: 'exclude',
							}
						}}>
							<Typography variant="h1" sx={{ 
								color: 'white', 
								fontWeight: 600,
								fontSize: '3rem',
								filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
							}}>
								💬
							</Typography>
						</Box>
						<Typography variant="h4" sx={{ 
							color: '#e9edef',
							fontWeight: 400,
							mb: 2,
							textAlign: 'center'
						}}>
							Cinnova Chat
						</Typography>
						<Typography variant="body1" sx={{ 
							color: '#8696a0',
							textAlign: 'center',
							maxWidth: 450,
							lineHeight: 1.6,
							fontSize: '0.95rem'
						}}>
							Connect with your team and clients seamlessly. Experience real-time messaging with modern features and professional design.
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

			{/* Group Creation Dialog */}
			<GroupCreation
				open={showGroupCreation}
				onClose={() => setShowGroupCreation(false)}
				onGroupCreated={handleGroupCreated}
			/>

			{/* Group Info Dialog */}
			<Dialog
				open={showGroupInfo}
				onClose={() => setShowGroupInfo(false)}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: {
						backgroundColor: '#202c33',
						color: '#e9edef',
						border: '1px solid #3b4a54',
					}
				}}
			>
				<DialogTitle sx={{ 
					color: '#e9edef',
					borderBottom: '1px solid #3b4a54',
					display: 'flex',
					alignItems: 'center',
					gap: 2
				}}>
					<Avatar sx={{ 
						bgcolor: '#25d366',
						width: 50,
						height: 50,
					}}>
						<GroupIcon />
					</Avatar>
					<Box>
						<Typography variant="h6" sx={{ color: '#e9edef' }}>
							{selectedChat?.name}
						</Typography>
						<Typography variant="caption" sx={{ color: '#8696a0' }}>
							Group • {selectedChat?.memberCount || 0} members
						</Typography>
					</Box>
				</DialogTitle>
				<DialogContent sx={{ p: 0 }}>
					{/* Group Description */}
					{selectedChat?.description && (
						<Box sx={{ p: 3, borderBottom: '1px solid #3b4a54' }}>
							<Typography variant="body2" sx={{ color: '#8696a0', mb: 1 }}>
								Description
							</Typography>
							<Typography variant="body1" sx={{ color: '#e9edef' }}>
								{selectedChat.description}
							</Typography>
						</Box>
					)}

					{/* Group Members */}
					<Box sx={{ p: 3 }}>
						<Typography variant="body2" sx={{ color: '#8696a0', mb: 2 }}>
							{selectedChat?.memberCount || 0} members
						</Typography>
						
						{/* Add Member Button */}
						<ListItem 
							button 
							onClick={handleAddMember}
							sx={{
								borderRadius: 2,
								mb: 1,
								'&:hover': {
									backgroundColor: 'rgba(255,255,255,0.1)'
								}
							}}
						>
							<ListItemAvatar>
								<Avatar sx={{ bgcolor: '#00a884' }}>
									<AddIcon />
								</Avatar>
							</ListItemAvatar>
							<ListItemText 
								primary="Add member" 
								primaryTypographyProps={{ color: '#e9edef' }}
							/>
						</ListItem>

						{/* Members List */}
						{loadingMembers ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
								<CircularProgress size={24} sx={{ color: '#00a884' }} />
							</Box>
						) : (
							<List sx={{ p: 0 }}>
								{groupMembers.map((member) => (
									<ListItem 
										key={member.user.firebase_uid}
										sx={{
											borderRadius: 2,
											mb: 0.5,
											'&:hover': {
												backgroundColor: 'rgba(255,255,255,0.05)'
											}
										}}
									>
										<ListItemAvatar>
											<Avatar sx={{ 
												bgcolor: '#00a884',
												width: 40,
												height: 40,
												fontSize: '0.9rem'
											}}>
												{member.user.first_name?.[0]?.toUpperCase()}
												{member.user.last_name?.[0]?.toUpperCase()}
											</Avatar>
										</ListItemAvatar>
										<ListItemText 
											primary={`${member.user.first_name} ${member.user.last_name}`}
											secondary={member.role === 'admin' ? 'Group Admin' : 'Member'}
											primaryTypographyProps={{ 
												color: '#e9edef',
												fontSize: '0.95rem'
											}}
											secondaryTypographyProps={{ 
												color: member.role === 'admin' ? '#00a884' : '#8696a0',
												fontSize: '0.8rem'
											}}
										/>
										{/* Remove Member Button (only for admins and not for self) */}
										{selectedChat?.creator_id === auth.currentUser?.uid && 
										 member.user.firebase_uid !== auth.currentUser?.uid && (
											<IconButton
												size="small"
												onClick={() => handleRemoveMember(member.user.firebase_uid)}
												sx={{
													color: '#f44336',
													'&:hover': {
														backgroundColor: 'rgba(244, 67, 54, 0.1)'
													}
												}}
											>
												<CloseIcon fontSize="small" />
											</IconButton>
										)}
									</ListItem>
								))}
							</List>
						)}
					</Box>
				</DialogContent>
				<DialogActions sx={{ borderTop: '1px solid #3b4a54', p: 2 }}>
					<Button 
						onClick={() => setShowGroupInfo(false)}
						sx={{ color: '#8696a0' }}
					>
						Close
					</Button>
				</DialogActions>
			</Dialog>

			{/* Add Member Dialog */}
			<Dialog
				open={showAddMember}
				onClose={() => {
					setShowAddMember(false);
					setSelectedNewMembers([]);
				}}
				maxWidth="sm"
				fullWidth
				PaperProps={{
					sx: {
						backgroundColor: '#202c33',
						color: '#e9edef',
						border: '1px solid #3b4a54',
					}
				}}
			>
				<DialogTitle sx={{ 
					color: '#e9edef',
					borderBottom: '1px solid #3b4a54',
				}}>
					Add Members to {selectedChat?.name}
				</DialogTitle>
				<DialogContent sx={{ p: 3 }}>
					<Typography variant="body2" sx={{ color: '#8696a0', mb: 2 }}>
						Select users to add to the group:
					</Typography>
					
					{/* Available Users List */}
					<List sx={{ maxHeight: 300, overflow: 'auto' }}>
						{availableUsers.map((user) => (
							<ListItem 
								key={user.firebase_uid}
								sx={{
									borderRadius: 2,
									mb: 0.5,
									'&:hover': {
										backgroundColor: 'rgba(255,255,255,0.05)'
									}
								}}
							>
								<ListItemAvatar>
									<Avatar sx={{ 
										bgcolor: '#00a884',
										width: 40,
										height: 40,
										fontSize: '0.9rem'
									}}>
										{user.first_name?.[0]?.toUpperCase()}
										{user.last_name?.[0]?.toUpperCase()}
									</Avatar>
								</ListItemAvatar>
								<ListItemText 
									primary={`${user.first_name} ${user.last_name}`}
									secondary={user.email}
									primaryTypographyProps={{ 
										color: '#e9edef',
										fontSize: '0.95rem'
									}}
									secondaryTypographyProps={{ 
										color: '#8696a0',
										fontSize: '0.8rem'
									}}
								/>
								<IconButton
									onClick={() => {
										if (selectedNewMembers.includes(user.firebase_uid)) {
											setSelectedNewMembers(prev => 
												prev.filter(id => id !== user.firebase_uid)
											);
										} else {
											setSelectedNewMembers(prev => [...prev, user.firebase_uid]);
										}
									}}
									sx={{
										color: selectedNewMembers.includes(user.firebase_uid) 
											? '#00a884' : '#8696a0',
										'&:hover': {
											backgroundColor: 'rgba(0,168,132,0.1)'
										}
									}}
								>
									{selectedNewMembers.includes(user.firebase_uid) ? 
										<CloseIcon /> : <AddIcon />
									}
								</IconButton>
							</ListItem>
						))}
					</List>

					{availableUsers.length === 0 && (
						<Typography variant="body2" sx={{ color: '#8696a0', textAlign: 'center', p: 2 }}>
							No users available to add
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ borderTop: '1px solid #3b4a54', p: 2 }}>
					<Button 
						onClick={() => {
							setShowAddMember(false);
							setSelectedNewMembers([]);
						}}
						sx={{ color: '#8696a0' }}
					>
						Cancel
					</Button>
					<Button 
						onClick={handleAddSelectedMembers}
						disabled={selectedNewMembers.length === 0}
						sx={{ 
							color: '#00a884',
							'&:disabled': {
								color: '#8696a0'
							}
						}}
					>
						Add {selectedNewMembers.length} Member{selectedNewMembers.length !== 1 ? 's' : ''}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default Chat;
