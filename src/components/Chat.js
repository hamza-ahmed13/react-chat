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
} from '@mui/material';
import {
	Send as SendIcon,
	ExitToApp as ExitToAppIcon,
	Person as PersonIcon,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';
import {
	connectSocket,
	disconnectSocket,
	sendMessage,
	joinRoom,
	leaveRoom,
} from '../services/socket';

const DRAWER_WIDTH = 300;

const Chat = () => {
	const [message, setMessage] = useState('');
	const [messages, setMessages] = useState([]);
	const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [selectedChat, setSelectedChat] = useState(null);
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const messagesEndRef = useRef(null);
	const navigate = useNavigate();
	const { auth } = useFirebase();

	// Fetch users
	useEffect(() => {
		const fetchUsers = async () => {
			if (!auth.currentUser) return;

			try {
				setLoading(true);
				const response = await fetch('/api/users');
				if (!response.ok) {
					throw new Error('Failed to fetch users');
				}
				const usersList = await response.json();

				const chatsWithUsers = usersList
					.filter((user) => user.id !== auth.currentUser.uid)
					.map((user) => ({
						id: user.id,
						name: user.name,
						lastMessage: 'No messages yet',
						unreadCount: 0,
					}));

				setUsers(chatsWithUsers);
			} catch (error) {
				console.error('Error fetching users:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchUsers();
	}, [auth.currentUser]);

	// Connect socket and join room when chat is selected
	useEffect(() => {
		if (!selectedChat || !auth.currentUser) return;

		// Connect socket
		const socket = connectSocket(auth.currentUser.uid);

		// Join room using your exact logic
		joinRoom(auth.currentUser.uid, selectedChat.id);

		// Listen for new messages
		socket.on('receive_message', (newMessage) => {
			setMessages((prev) => [...prev, newMessage]);
			scrollToBottom();
		});

		// Fetch previous messages for this room
		const roomName = `${[auth.currentUser.uid, selectedChat.id]
			.sort()
			.join('-')}`;
		fetch(`/api/messages/${roomName}`)
			.then((response) => response.json())
			.then((data) => {
				setMessages(data);
				scrollToBottom();
			})
			.catch((error) => console.error('Error fetching messages:', error));

		return () => {
			// Leave room and disconnect when changing chat or unmounting
			leaveRoom();
			disconnectSocket();
		};
	}, [selectedChat, auth.currentUser]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	const handleLogoutClick = () => {
		setIsLogoutDialogOpen(true);
	};

	const handleLogoutConfirm = async () => {
		setIsLoggingOut(true);
		try {
			disconnectSocket();
			await signOut(auth);
			navigate('/');
		} catch (error) {
			console.error('Error signing out:', error);
		} finally {
			setIsLoggingOut(false);
			setIsLogoutDialogOpen(false);
		}
	};

	const handleLogoutCancel = () => {
		setIsLogoutDialogOpen(false);
	};

	const handleChatSelect = (chat) => {
		setSelectedChat(chat);
		setMessages([]); // Clear previous messages
	};

	const handleSendMessage = (e) => {
		e.preventDefault();
		if (!message.trim() || !selectedChat) return;

		const newMessage = {
			text: message.trim(),
			senderId: auth.currentUser.uid,
			receiverId: selectedChat.id,
			senderName: auth.currentUser.email?.split('@')[0],
			timestamp: new Date().toISOString(),
		};

		sendMessage(newMessage);
		setMessage('');
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
				{loading ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
						<CircularProgress />
					</Box>
				) : (
					<List sx={{ width: '100%', bgcolor: 'background.paper' }}>
						{users.map((user) => (
							<React.Fragment key={user.id}>
								<ListItem
									button
									selected={selectedChat?.id === user.id}
									onClick={() => handleChatSelect(user)}
								>
									<ListItemAvatar>
										<Avatar>
											<PersonIcon />
										</Avatar>
									</ListItemAvatar>
									<ListItemText
										primary={user.name}
										secondary={user.lastMessage}
									/>
									{user.unreadCount > 0 && (
										<Badge badgeContent={user.unreadCount} color="primary" />
									)}
								</ListItem>
								<Divider variant="inset" component="li" />
							</React.Fragment>
						))}
					</List>
				)}
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
								? `Chat with ${selectedChat.name}`
								: 'Select a chat'}
						</Typography>
						<Button
							color="inherit"
							onClick={handleLogoutClick}
							startIcon={<ExitToAppIcon />}
							disabled={isLoggingOut}
						>
							{isLoggingOut ? 'Logging out...' : 'Logout'}
						</Button>
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
										key={msg.timestamp || index}
										sx={{
											display: 'flex',
											justifyContent:
												msg.senderId === auth.currentUser.uid
													? 'flex-end'
													: 'flex-start',
											mb: 2,
										}}
									>
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
											}}
										>
											<Typography
												variant="subtitle2"
												sx={{ fontWeight: 'bold' }}
											>
												{msg.senderName}
											</Typography>
											<Typography variant="body1">{msg.text}</Typography>
										</Paper>
									</Box>
								))}
								<div ref={messagesEndRef} />
							</Container>
						</Box>

						<Paper
							component="form"
							onSubmit={handleSendMessage}
							sx={{
								p: 2,
								borderTop: '1px solid #e0e0e0',
							}}
						>
							<Box sx={{ display: 'flex', gap: 1 }}>
								<TextField
									fullWidth
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									placeholder="Type a message..."
									variant="outlined"
									size="small"
								/>
								<Button
									type="submit"
									variant="contained"
									endIcon={<SendIcon />}
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
				onClose={handleLogoutCancel}
				aria-labelledby="logout-dialog-title"
			>
				<DialogTitle id="logout-dialog-title">Confirm Logout</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to logout? You will need to sign in again to
						continue chatting.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleLogoutCancel} disabled={isLoggingOut}>
						Cancel
					</Button>
					<Button
						onClick={handleLogoutConfirm}
						color="primary"
						variant="contained"
						disabled={isLoggingOut}
						startIcon={isLoggingOut ? <CircularProgress size={20} /> : null}
					>
						{isLoggingOut ? 'Logging out...' : 'Logout'}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default Chat;
