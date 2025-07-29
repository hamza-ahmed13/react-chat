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
} from '@mui/material';
import { useFirebase } from '../contexts/FirebaseContext';

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
				await signInWithEmailAndPassword(auth, formData.email, formData.password);
				
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
				await signInWithEmailAndPassword(auth, formData.email, formData.password);
			}
			navigate('/chat');
		} catch (err) {
			console.error('Auth error:', err);
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Container component="main" maxWidth="xs">
			<Box
				sx={{
					marginTop: 8,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
				}}
			>
				<Paper
					elevation={3}
					sx={{
						padding: 4,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						width: '100%',
					}}
				>
					<Typography component="h1" variant="h5">
						{isSignUp ? 'Create Account' : 'Welcome Back'}
					</Typography>

					{error && (
						<Alert severity="error" sx={{ mt: 2, width: '100%' }}>
							{error}
						</Alert>
					)}

					<Box
						component="form"
						onSubmit={handleSubmit}
						sx={{ mt: 3, width: '100%' }}
					>
						{isSignUp && (
							<>
							<TextField
										required
										margin="normal"
										fullWidth
										label="First Name"
										name="firstName"
										value={formData.firstName}
										onChange={handleChange}
										disabled={isLoading}
									/>
								
									<TextField
										required
										fullWidth
										margin="normal"
										label="Last Name"
										name="lastName"
										value={formData.lastName}
										onChange={handleChange}
										disabled={isLoading}
									/>
								
									<TextField
										required
										margin="normal"
										fullWidth
										label="Phone Number"
										name="phone"
										value={formData.phone}
										onChange={handleChange}
										disabled={isLoading}
										placeholder="1234567890"
									/></>
									
								
						)}
						<TextField
							margin="normal"
							required
							fullWidth
							label="Email Address"
							name="email"
							type="email"
							value={formData.email}
							onChange={handleChange}
							autoComplete="email"
							autoFocus
							disabled={isLoading}
						/>
						<TextField
							margin="normal"
							required
							fullWidth
							label="Password"
							name="password"
							type="password"
							value={formData.password}
							onChange={handleChange}
							autoComplete="new-password"
							disabled={isLoading}
						/>
						{isSignUp && (
							<TextField
								margin="normal"
								required
								fullWidth
								label="Confirm Password"
								name="confirmPassword"
								type="password"
								value={formData.confirmPassword}
								onChange={handleChange}
								autoComplete="new-password"
								disabled={isLoading}
							/>
						)}
						<Button
							type="submit"
							fullWidth
							variant="contained"
							sx={{
								mt: 3,
								mb: 2,
								height: 48,
								position: 'relative',
							}}
							disabled={isLoading}
						>
							{isLoading ? (
								<CircularProgress
									size={24}
									sx={{
										position: 'absolute',
										top: '50%',
										left: '50%',
										marginTop: '-12px',
										marginLeft: '-12px',
									}}
								/>
							) : isSignUp ? (
								'Sign Up'
							) : (
								'Sign In'
							)}
						</Button>
						<Button
							fullWidth
							variant="text"
							onClick={() => {
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
							}}
							disabled={isLoading}
						>
							{isSignUp
								? 'Already have an account? Sign In'
								: "Don't have an account? Sign Up"}
						</Button>
					</Box>
				</Paper>
			</Box>
		</Container>
	);
};

export default Login;
