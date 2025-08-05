import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import {
	Container,
	Paper,
	TextField,
	Button,
	Typography,
	Box,
	Alert,
	CircularProgress,
	IconButton,
	InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';

// WhatsApp Dark Theme Colors (matching Chat.js)
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
	error: '#f15c6d',
	// Additional dark theme colors
	messageHover: '#2a3942',
	inputBackground: '#2a3942',
	headerBackground: '#202c33',
	sidebarBackground: '#111b21',
	chatBackground: '#0b141a',
	messageBorder: '#ffffff12',
};

const Login = () => {
	const [formData, setFormData] = useState({
		email: '',
		password: '',
		confirmPassword: '',
		firstName: '',
		lastName: '',
		phone: '',
	});
	const [isSignUp, setIsSignUp] = useState(false);
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const navigate = useNavigate();
	const { auth, db } = useFirebase();

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const validateForm = () => {
		if (isSignUp) {
			if (!formData.firstName.trim()) return 'First name is required';
			if (!formData.lastName.trim()) return 'Last name is required';
			if (!formData.phone.trim()) return 'Phone number is required';
			if (formData.password !== formData.confirmPassword)
				return 'Passwords do not match';
			if (formData.password.length < 6)
				return 'Password must be at least 6 characters';
			if (!/^\d{10}$/.test(formData.phone.trim()))
				return 'Please enter a valid 10-digit phone number';
		}
		if (!formData.email.trim()) return 'Email is required';
		if (!formData.password.trim()) return 'Password is required';
		if (!/\S+@\S+\.\S+/.test(formData.email))
			return 'Please enter a valid email';
		return null;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const validationError = validateForm();
		if (validationError) {
			setError(validationError);
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			if (isSignUp) {
				// Backend signup first (keeping the working approach)
				const response = await fetch('http://localhost:8000/api/users/signup', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						first_name: formData.firstName,
						last_name: formData.lastName,
						email: formData.email,
						phone: formData.phone,
						password: formData.password,
					}),
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.message || 'Signup failed');
				}

				// Sign in with Firebase using the credentials
				await signInWithEmailAndPassword(auth, formData.email, formData.password);
				
				// Create user document in Firestore
				await setDoc(doc(db, 'users', data.data.id), {
					email: formData.email,
					firstName: formData.firstName,
					lastName: formData.lastName,
					phone: formData.phone,
					createdAt: new Date().toISOString(),
				});

				navigate('/chat');
			} else {
				// Sign in existing user
				await signInWithEmailAndPassword(
					auth,
					formData.email,
					formData.password
				);
				navigate('/chat');
			}
		} catch (error) {
			console.error('Authentication error:', error);
			setError(error.message || 'An error occurred. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const toggleMode = () => {
		setIsSignUp(!isSignUp);
		setError('');
		setFormData({
			email: '',
			password: '',
			confirmPassword: '',
			firstName: '',
			lastName: '',
			phone: '',
		});
	};

	return (
		<Box
			sx={{
				minHeight: '100vh',
				bgcolor: WHATSAPP_COLORS.background,
				backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill-opacity='0.02'%3E%3Cpath d='M50 50c0-27.614 22.386-50 50-50s50 22.386 50 50-22.386 50-50 50-50-22.386-50-50zm25 0c0-13.807 11.193-25 25-25s25 11.193 25 25-11.193 25-25 25-25-11.193-25-25z' fill='%23ffffff'/%3E%3C/g%3E%3C/svg%3E")`,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				p: 2,
			}}
		>
			<Container maxWidth="sm">
				<Paper
					elevation={8}
					sx={{
						p: 4,
						bgcolor: WHATSAPP_COLORS.surface,
						borderRadius: 3,
						border: `1px solid ${WHATSAPP_COLORS.divider}`,
						boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
					}}
				>
					{/* Header */}
					<Box sx={{ textAlign: 'center', mb: 4 }}>
						<Box
							sx={{
								width: 80,
								height: 80,
								borderRadius: '50%',
								bgcolor: WHATSAPP_COLORS.primary,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								mx: 'auto',
								mb: 2,
								border: `3px solid ${WHATSAPP_COLORS.primary}30`,
							}}
						>
							<Typography
								variant="h3"
								sx={{ color: 'white', fontWeight: 'bold' }}
							>
								💬
							</Typography>
						</Box>
						<Typography
							variant="h4"
							sx={{
								color: WHATSAPP_COLORS.onSurface,
								fontWeight: 300,
								mb: 1,
							}}
						>
							Welcome to Cinnova Chat
						</Typography>
						<Typography
							sx={{
								color: WHATSAPP_COLORS.onSurfaceVariant,
								fontSize: '16px',
							}}
						>
							{isSignUp ? 'Create your account' : 'Sign in to continue'}
						</Typography>
					</Box>

					{error && (
						<Alert
							severity="error"
							sx={{
								mb: 3,
								bgcolor: `${WHATSAPP_COLORS.error}15`,
								color: WHATSAPP_COLORS.error,
								border: `1px solid ${WHATSAPP_COLORS.error}30`,
								'& .MuiAlert-icon': {
									color: WHATSAPP_COLORS.error,
								},
							}}
						>
							{error}
						</Alert>
					)}

					<Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
						{isSignUp && (
							<>
								<TextField
									fullWidth
									label="First Name"
									name="firstName"
									value={formData.firstName}
									onChange={handleChange}
									margin="normal"
									required
									sx={{
										'& .MuiOutlinedInput-root': {
											bgcolor: WHATSAPP_COLORS.inputBackground,
											borderRadius: '8px',
											'& fieldset': {
												borderColor: WHATSAPP_COLORS.divider,
											},
											'&:hover fieldset': {
												borderColor: WHATSAPP_COLORS.onSurfaceVariant,
											},
											'&.Mui-focused fieldset': {
												borderColor: WHATSAPP_COLORS.primary,
											},
											'&:-webkit-autofill': {
												bgcolor: 'transparent !important',
											},
										},
										'& .MuiInputBase-input': {
											color: WHATSAPP_COLORS.onSurface,
											'&:-webkit-autofill': {
												WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.inputBackground} inset`,
												WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
											},
										},
										'& .MuiInputLabel-root': {
											color: WHATSAPP_COLORS.onSurfaceVariant,
											'&.Mui-focused': {
												color: WHATSAPP_COLORS.primary,
											},
										},
									}}
								/>
								<TextField
									fullWidth
									label="Last Name"
									name="lastName"
									value={formData.lastName}
									onChange={handleChange}
									margin="normal"
									required
									sx={{
										'& .MuiOutlinedInput-root': {
											bgcolor: WHATSAPP_COLORS.inputBackground,
											borderRadius: '8px',
											'& fieldset': {
												borderColor: WHATSAPP_COLORS.divider,
											},
											'&:hover fieldset': {
												borderColor: WHATSAPP_COLORS.onSurfaceVariant,
											},
											'&.Mui-focused fieldset': {
												borderColor: WHATSAPP_COLORS.primary,
											},
											'&:-webkit-autofill': {
												bgcolor: 'transparent !important',
											},
										},
										'& .MuiInputBase-input': {
											color: WHATSAPP_COLORS.onSurface,
											'&:-webkit-autofill': {
												WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.inputBackground} inset`,
												WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
											},
										},
										'& .MuiInputLabel-root': {
											color: WHATSAPP_COLORS.onSurfaceVariant,
											'&.Mui-focused': {
												color: WHATSAPP_COLORS.primary,
											},
										},
									}}
								/>
								<TextField
									fullWidth
									label="Phone Number"
									name="phone"
									value={formData.phone}
									onChange={handleChange}
									margin="normal"
									required
									type="tel"
									placeholder="1234567890"
									sx={{
										'& .MuiOutlinedInput-root': {
											bgcolor: WHATSAPP_COLORS.inputBackground,
											borderRadius: '8px',
											'& fieldset': {
												borderColor: WHATSAPP_COLORS.divider,
											},
											'&:hover fieldset': {
												borderColor: WHATSAPP_COLORS.onSurfaceVariant,
											},
											'&.Mui-focused fieldset': {
												borderColor: WHATSAPP_COLORS.primary,
											},
											'&:-webkit-autofill': {
												bgcolor: 'transparent !important',
											},
										},
										'& .MuiInputBase-input': {
											color: WHATSAPP_COLORS.onSurface,
											'&:-webkit-autofill': {
												WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.inputBackground} inset`,
												WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
											},
										},
										'& .MuiInputLabel-root': {
											color: WHATSAPP_COLORS.onSurfaceVariant,
											'&.Mui-focused': {
												color: WHATSAPP_COLORS.primary,
											},
										},
									}}
								/>
							</>
						)}

						<TextField
							fullWidth
							label="Email"
							name="email"
							type="email"
							value={formData.email}
							onChange={handleChange}
							margin="normal"
							required
							sx={{
								'& .MuiOutlinedInput-root': {
									bgcolor: WHATSAPP_COLORS.inputBackground,
									borderRadius: '8px',
									'& fieldset': {
										borderColor: WHATSAPP_COLORS.divider,
									},
									'&:hover fieldset': {
										borderColor: WHATSAPP_COLORS.onSurfaceVariant,
									},
									'&.Mui-focused fieldset': {
										borderColor: WHATSAPP_COLORS.primary,
									},
									'&:-webkit-autofill': {
										bgcolor: 'transparent !important',
									},
								},
								'& .MuiInputBase-input': {
									color: WHATSAPP_COLORS.onSurface,
									'&:-webkit-autofill': {
										WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.inputBackground} inset`,
										WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
									},
								},
								'& .MuiInputLabel-root': {
									color: WHATSAPP_COLORS.onSurfaceVariant,
									'&.Mui-focused': {
										color: WHATSAPP_COLORS.primary,
									},
								},
							}}
						/>

						<TextField
							fullWidth
							label="Password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							value={formData.password}
							onChange={handleChange}
							margin="normal"
							required
							sx={{
								'& .MuiOutlinedInput-root': {
									bgcolor: WHATSAPP_COLORS.inputBackground,
									borderRadius: '8px',
									'& fieldset': {
										borderColor: WHATSAPP_COLORS.divider,
									},
									'&:hover fieldset': {
										borderColor: WHATSAPP_COLORS.onSurfaceVariant,
									},
									'&.Mui-focused fieldset': {
										borderColor: WHATSAPP_COLORS.primary,
									},
									'&:-webkit-autofill': {
										bgcolor: 'transparent !important',
									},
								},
								'& .MuiInputBase-input': {
									color: WHATSAPP_COLORS.onSurface,
									'&:-webkit-autofill': {
										WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.inputBackground} inset`,
										WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
									},
								},
								'& .MuiInputLabel-root': {
									color: WHATSAPP_COLORS.onSurfaceVariant,
									'&.Mui-focused': {
										color: WHATSAPP_COLORS.primary,
									},
								},
							}}
							InputProps={{
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											onClick={() => setShowPassword(!showPassword)}
											edge="end"
											sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
										>
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								),
							}}
						/>

						{isSignUp && (
							<TextField
								fullWidth
								label="Confirm Password"
								name="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								value={formData.confirmPassword}
								onChange={handleChange}
								margin="normal"
								required
								sx={{
									'& .MuiOutlinedInput-root': {
										bgcolor: WHATSAPP_COLORS.inputBackground,
										borderRadius: '8px',
										'& fieldset': {
											borderColor: WHATSAPP_COLORS.divider,
										},
										'&:hover fieldset': {
											borderColor: WHATSAPP_COLORS.onSurfaceVariant,
										},
										'&.Mui-focused fieldset': {
											borderColor: WHATSAPP_COLORS.primary,
										},
										'&:-webkit-autofill': {
											bgcolor: 'transparent !important',
										},
									},
									'& .MuiInputBase-input': {
										color: WHATSAPP_COLORS.onSurface,
										'&:-webkit-autofill': {
											WebkitBoxShadow: `0 0 0 1000px ${WHATSAPP_COLORS.inputBackground} inset`,
											WebkitTextFillColor: WHATSAPP_COLORS.onSurface,
										},
									},
									'& .MuiInputLabel-root': {
										color: WHATSAPP_COLORS.onSurfaceVariant,
										'&.Mui-focused': {
											color: WHATSAPP_COLORS.primary,
										},
									},
								}}
								InputProps={{
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												onClick={() =>
													setShowConfirmPassword(!showConfirmPassword)
												}
												edge="end"
												sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
											>
												{showConfirmPassword ? (
													<VisibilityOff />
												) : (
													<Visibility />
												)}
											</IconButton>
										</InputAdornment>
									),
								}}
							/>
						)}

						<Button
							type="submit"
							fullWidth
							variant="contained"
							disabled={isLoading}
							sx={{
								mt: 3,
								mb: 2,
								height: 48,
								borderRadius: '8px',
								bgcolor: WHATSAPP_COLORS.primary,
								fontSize: '16px',
								fontWeight: 600,
								textTransform: 'none',
								'&:hover': {
									bgcolor: WHATSAPP_COLORS.primaryDark,
								},
								'&:disabled': {
									bgcolor: WHATSAPP_COLORS.surfaceVariant,
									color: WHATSAPP_COLORS.onSurfaceVariant,
								},
							}}
						>
							{isLoading ? (
								<CircularProgress size={24} sx={{ color: 'white' }} />
							) : isSignUp ? (
								'Create Account'
							) : (
								'Sign In'
							)}
						</Button>

						<Box sx={{ textAlign: 'center' }}>
							<Button
								onClick={toggleMode}
								sx={{
									color: WHATSAPP_COLORS.primary,
									textTransform: 'none',
									fontSize: '14px',
									'&:hover': {
										bgcolor: `${WHATSAPP_COLORS.primary}10`,
									},
								}}
							>
								{isSignUp
									? 'Already have an account? Sign In'
									: "Don't have an account? Sign Up"}
							</Button>
						</Box>
					</Box>
				</Paper>
			</Container>
		</Box>
	);
};

export default Login;
