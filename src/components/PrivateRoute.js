import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Box, CircularProgress } from '@mui/material';
import { useFirebase } from '../contexts/FirebaseContext';

const PrivateRoute = ({ children }) => {
	const { auth } = useFirebase();
	const [user, loading] = useAuthState(auth);

	if (loading) {
		return (
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
	}

	if (!user) {
		return <Navigate to="/" />;
	}

	return children;
};

export default PrivateRoute;
