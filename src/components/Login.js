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
	Grid,
	Avatar,
	Fade,
	InputAdornment,
	IconButton,
	Divider,
} from '@mui/material';
import {
	Chat as ChatIcon,
	Email as EmailIcon,
	Lock as LockIcon,
	Person as PersonIcon,
	Phone as PhoneIcon,
	Visibility,
	VisibilityOff,
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';

// WhatsApp color palette (same as Chat component)
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
		if (!formData.password) return 'Password is required';
		return null;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');

		const validationError = validateForm();
		if (validationError) {
			setError(validationError);
			return;
		}

		setIsLoading(true);

		try {
			if (isSignUp) {
				// Backend signup
				const response = await fetch('http://localhost:3000/api/users/signup', {
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

				// Sign in with Firebase using the token from backend
				await signInWithEmailAndPassword(
					auth,
					formData.email,
					formData.password
				);

				// Create user document in Firestore
				await setDoc(doc(db, 'users', data.data.id), {
					email: formData.email,
					firstName: formData.firstName,
					lastName: formData.lastName,
					phone: formData.phone,
					createdAt: new Date().toISOString(),
				});
			} else {
				// Frontend login
				await signInWithEmailAndPassword(
					auth,
					formData.email,
					formData.password
				);
			}
			navigate('/chat');
		} catch (err) {
			console.error('Auth error:', err);
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	const toggleMode = () => {
		if (!isLoading) {
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
		}
	};

	const inputFieldStyle = {
		mb: 2,
		'& .MuiOutlinedInput-root': {
			bgcolor: WHATSAPP_COLORS.background,
			borderRadius: '8px',
			border: 'none',
			'& fieldset': {
				borderColor: WHATSAPP_COLORS.divider,
			},
			'&:hover fieldset': {
				borderColor: WHATSAPP_COLORS.primary,
			},
			'&.Mui-focused fieldset': {
				borderColor: WHATSAPP_COLORS.primary,
				borderWidth: '2px',
			},
			'&.Mui-focused': {
				bgcolor: WHATSAPP_COLORS.background,
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
	};

	return (
		<Box
			sx={{
				minHeight: '100vh',
				bgcolor: WHATSAPP_COLORS.background,
				backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${WHATSAPP_COLORS.surfaceVariant.slice(
					1
				)}' fill-opacity='0.03'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				p: 2,
			}}
		>
			<Container component="main" maxWidth="sm">
				<Fade in timeout={800}>
					<Paper
						elevation={8}
						sx={{
							p: 4,
							bgcolor: WHATSAPP_COLORS.surface,
							border: `1px solid ${WHATSAPP_COLORS.divider}`,
							borderRadius: 3,
							backdropFilter: 'blur(10px)',
							boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
						}}
					>
						{/* WhatsApp Branding */}
						<Box sx={{ textAlign: 'center', mb: 4 }}>
							<Avatar
								sx={{
									width: 80,
									height: 80,
									bgcolor: WHATSAPP_COLORS.primary,
									mx: 'auto',
									mb: 2,
									boxShadow: `0 4px 20px ${WHATSAPP_COLORS.primary}40`,
								}}
							>
								<ChatIcon sx={{ fontSize: 45 }} />
							</Avatar>
							<Typography
								variant="h4"
								sx={{
									color: WHATSAPP_COLORS.onSurface,
									fontWeight: 400,
									mb: 1,
									fontSize: '28px',
								}}
							>
								Cinnova Chat
							</Typography>
							<Typography
								variant="h6"
								sx={{
									color: WHATSAPP_COLORS.onSurfaceVariant,
									fontWeight: 300,
									mb: 1,
									fontSize: '16px',
								}}
							>
								{isSignUp ? 'Create your account' : 'Sign in to your account'}
							</Typography>
							<Typography
								sx={{
									color: WHATSAPP_COLORS.onSurfaceVariant,
									fontSize: '14px',
									opacity: 0.8,
								}}
							>
								{isSignUp
									? 'Join millions of users worldwide'
									: 'Connect with friends and family'}
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
									borderRadius: 2,
									'& .MuiAlert-icon': {
										color: WHATSAPP_COLORS.error,
									},
								}}
							>
								{error}
							</Alert>
						)}

						<Box component="form" onSubmit={handleSubmit}>
							{isSignUp && (
								<>
									<TextField
										required
										fullWidth
										label="First Name"
										name="firstName"
										value={formData.firstName}
										onChange={handleChange}
										disabled={isLoading}
										sx={inputFieldStyle}
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<PersonIcon
														sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
													/>
												</InputAdornment>
											),
										}}
									/>

									<TextField
										required
										fullWidth
										label="Last Name"
										name="lastName"
										value={formData.lastName}
										onChange={handleChange}
										disabled={isLoading}
										sx={inputFieldStyle}
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<PersonIcon
														sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
													/>
												</InputAdornment>
											),
										}}
									/>

									<TextField
										required
										fullWidth
										label="Phone Number"
										name="phone"
										value={formData.phone}
										onChange={handleChange}
										disabled={isLoading}
										placeholder="1234567890"
										sx={inputFieldStyle}
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<PhoneIcon
														sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
													/>
												</InputAdornment>
											),
										}}
									/>
								</>
							)}

							<TextField
								required
								fullWidth
								label="Email Address"
								name="email"
								type="email"
								value={formData.email}
								onChange={handleChange}
								autoComplete="email"
								disabled={isLoading}
								sx={inputFieldStyle}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<EmailIcon
												sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
											/>
										</InputAdornment>
									),
								}}
							/>

							<TextField
								required
								fullWidth
								label="Password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								value={formData.password}
								onChange={handleChange}
								autoComplete="new-password"
								disabled={isLoading}
								sx={inputFieldStyle}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<LockIcon
												sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
											/>
										</InputAdornment>
									),
									endAdornment: (
										<InputAdornment position="end">
											<IconButton
												aria-label="toggle password visibility"
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
									required
									fullWidth
									label="Confirm Password"
									name="confirmPassword"
									type={showConfirmPassword ? 'text' : 'password'}
									value={formData.confirmPassword}
									onChange={handleChange}
									autoComplete="new-password"
									disabled={isLoading}
									sx={{ ...inputFieldStyle, mb: 3 }}
									InputProps={{
										startAdornment: (
											<InputAdornment position="start">
												<LockIcon
													sx={{ color: WHATSAPP_COLORS.onSurfaceVariant }}
												/>
											</InputAdornment>
										),
										endAdornment: (
											<InputAdornment position="end">
												<IconButton
													aria-label="toggle confirm password visibility"
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
									height: 56,
									borderRadius: 2,
									bgcolor: WHATSAPP_COLORS.primary,
									fontSize: '16px',
									fontWeight: 500,
									textTransform: 'none',
									boxShadow: `0 4px 20px ${WHATSAPP_COLORS.primary}40`,
									'&:hover': {
										bgcolor: WHATSAPP_COLORS.primaryDark,
										boxShadow: `0 6px 25px ${WHATSAPP_COLORS.primary}50`,
									},
									'&:disabled': {
										bgcolor: WHATSAPP_COLORS.surfaceVariant,
										color: WHATSAPP_COLORS.onSurfaceVariant,
									},
									mb: 2,
								}}
							>
								{isLoading ? (
									<CircularProgress
										size={24}
										sx={{ color: WHATSAPP_COLORS.onSurface }}
									/>
								) : isSignUp ? (
									'Create Account'
								) : (
									'Sign In'
								)}
							</Button>

							<Divider
								sx={{
									my: 3,
									borderColor: WHATSAPP_COLORS.divider,
									'&::before, &::after': {
										borderColor: WHATSAPP_COLORS.divider,
									},
								}}
							>
								<Typography
									sx={{
										color: WHATSAPP_COLORS.onSurfaceVariant,
										fontSize: '14px',
									}}
								>
									or
								</Typography>
							</Divider>

							<Button
								fullWidth
								variant="text"
								onClick={toggleMode}
								disabled={isLoading}
								sx={{
									color: WHATSAPP_COLORS.primary,
									fontSize: '15px',
									fontWeight: 500,
									textTransform: 'none',
									py: 1.5,
									borderRadius: 2,
									'&:hover': {
										bgcolor: `${WHATSAPP_COLORS.primary}10`,
									},
									'&:disabled': {
										color: WHATSAPP_COLORS.onSurfaceVariant,
									},
								}}
							>
								{isSignUp
									? 'Already have an account? Sign In'
									: "Don't have an account? Sign Up"}
							</Button>
						</Box>

						{/* Footer */}
						<Box
							sx={{
								textAlign: 'center',
								mt: 4,
								pt: 3,
								borderTop: `1px solid ${WHATSAPP_COLORS.divider}`,
							}}
						>
							<Typography
								sx={{
									color: WHATSAPP_COLORS.onSurfaceVariant,
									fontSize: '13px',
									opacity: 0.8,
								}}
							>
								By signing up, you agree to our Terms of Service and Privacy
								Policy
							</Typography>
						</Box>
					</Paper>
				</Fade>
			</Container>
		</Box>
	);
};

export default Login;
