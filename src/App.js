import React, { Suspense } from 'react';
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import Login from './components/Login';
import Chat from './components/Chat';
import PrivateRoute from './components/PrivateRoute';
import { Box, CircularProgress } from '@mui/material';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { SocketProvider } from './contexts/SocketContext';

const LoadingScreen = () => (
	<Box
		sx={{
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			minHeight: '100vh',
		}}
	>
		<CircularProgress />
	</Box>
);

const AppRoutes = () => {
	const { auth } = useFirebase();
	const [user, loading, error] = useAuthState(auth);

	if (loading) {
		return <LoadingScreen />;
	}

	if (error) {
		console.error('Firebase Auth Error:', error);
		return (
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					minHeight: '100vh',
					color: 'error.main',
				}}
			>
				An error occurred while initializing the app. Please try again later.
			</Box>
		);
	}

	return (
		<Router>
			<Routes>
				<Route path="/" element={user ? <Navigate to="/chat" /> : <Login />} />
				<Route
					path="/chat"
					element={
						<PrivateRoute>
							<Chat />
						</PrivateRoute>
					}
				/>
			</Routes>
		</Router>
	);
};

function App() {
	return (
		<Suspense fallback={<LoadingScreen />}>
			<FirebaseProvider>
				<SocketProvider>
					<AppRoutes />
				</SocketProvider>
			</FirebaseProvider>
		</Suspense>
	);
}

export default App;
