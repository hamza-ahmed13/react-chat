import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Checkbox,
    Chip,
    CircularProgress,
    Alert,
    Divider
} from '@mui/material';
import { 
    Group as GroupIcon, 
    Close as CloseIcon 
} from '@mui/icons-material';
import { useFirebase } from '../contexts/FirebaseContext';

// Cinnova Dark Theme Colors
const WHATSAPP_COLORS = {
    primary: '#00a884',
    primaryDark: '#008069',
    secondary: '#25d366',
    background: '#0b141a',
    surface: '#202c33',
    surfaceVariant: '#2a3942',
    onSurface: '#e9edef',
    onSurfaceVariant: '#8696a0',
    divider: '#8696a026',
    error: '#f15c6d',
    inputBackground: '#2a3942',
};

const GroupCreation = ({ open, onClose, onGroupCreated }) => {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fetchingUsers, setFetchingUsers] = useState(false);
    const { auth } = useFirebase();

    // Fetch available users when dialog opens
    useEffect(() => {
        if (open && auth.currentUser) {
            fetchUsers();
        }
    }, [open, auth.currentUser]);

    const fetchUsers = async () => {
        try {
            setFetchingUsers(true);
            const response = await fetch(`http://localhost:8000/api/chat/users/${auth.currentUser.uid}`);
            const data = await response.json();
            
            
            if (data.status && Array.isArray(data.data)) {
                setAvailableUsers(data.data);
            } else if (Array.isArray(data)) {
                // Fallback for direct array response
                setAvailableUsers(data);
            } else {
                console.error('Invalid users data:', data);
                setError('Failed to load users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError(`Failed to load users: ${error.message}`);
        } finally {
            setFetchingUsers(false);
        }
    };

    const handleUserToggle = (user) => {
        setSelectedUsers(prev => {
            const isSelected = prev.some(u => u.firebase_uid === user.firebase_uid);
            if (isSelected) {
                return prev.filter(u => u.firebase_uid !== user.firebase_uid);
            } else {
                return [...prev, user];
            }
        });
    };

    const handleRemoveUser = (userId) => {
        setSelectedUsers(prev => prev.filter(u => u.firebase_uid !== userId));
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            setError('Group name is required');
            return;
        }

        if (selectedUsers.length === 0) {
            setError('Please select at least one member');
            return;
        }

        try {
            setLoading(true);
            setError('');

            const memberIds = [auth.currentUser.uid, ...selectedUsers.map(u => u.firebase_uid)];

            const response = await fetch('http://localhost:8000/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: groupName.trim(),
                    description: groupDescription.trim() || null,
                    creator_id: auth.currentUser.uid,
                    memberIds: memberIds
                }),
            });

            const data = await response.json();

            if (response.ok && data.status) {
                onGroupCreated(data.data);
                handleClose();
            } else {
                setError(data.message || 'Failed to create group');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            setError('Failed to create group. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setGroupName('');
        setGroupDescription('');
        setSelectedUsers([]);
        setError('');
        onClose();
    };

    const getInitials = (firstName, lastName) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    bgcolor: WHATSAPP_COLORS.surface,
                    color: WHATSAPP_COLORS.onSurface,
                    borderRadius: 2,
                    border: `1px solid ${WHATSAPP_COLORS.divider}`,
                }
            }}
        >
            <DialogTitle sx={{ 
                color: WHATSAPP_COLORS.onSurface,
                borderBottom: `1px solid ${WHATSAPP_COLORS.divider}`,
                pb: 2
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon sx={{ color: WHATSAPP_COLORS.primary }} />
                    <Typography variant="h6" component="span">
                        Create New Group
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
                {error && (
                    <Alert 
                        severity="error" 
                        sx={{ 
                            mb: 2,
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

                {/* Group Name */}
                <TextField
                    fullWidth
                    label="Group Name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
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
                        },
                        '& .MuiInputBase-input': {
                            color: WHATSAPP_COLORS.onSurface,
                        },
                        '& .MuiInputLabel-root': {
                            color: WHATSAPP_COLORS.onSurfaceVariant,
                            '&.Mui-focused': {
                                color: WHATSAPP_COLORS.primary,
                            },
                        },
                    }}
                />

                {/* Group Description */}
                <TextField
                    fullWidth
                    label="Description (Optional)"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    margin="normal"
                    multiline
                    rows={2}
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
                        },
                        '& .MuiInputBase-input': {
                            color: WHATSAPP_COLORS.onSurface,
                        },
                        '& .MuiInputLabel-root': {
                            color: WHATSAPP_COLORS.onSurfaceVariant,
                            '&.Mui-focused': {
                                color: WHATSAPP_COLORS.primary,
                            },
                        },
                    }}
                />

                {/* Selected Users */}
                {selectedUsers.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: WHATSAPP_COLORS.onSurfaceVariant }}>
                            Selected Members ({selectedUsers.length})
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {selectedUsers.map((user) => (
                                <Chip
                                    key={user.firebase_uid}
                                    label={`${user.first_name} ${user.last_name}`}
                                    onDelete={() => handleRemoveUser(user.firebase_uid)}
                                    deleteIcon={<CloseIcon />}
                                    sx={{
                                        bgcolor: WHATSAPP_COLORS.primary,
                                        color: 'white',
                                        '& .MuiChip-deleteIcon': {
                                            color: 'white',
                                            '&:hover': {
                                                color: WHATSAPP_COLORS.onSurfaceVariant,
                                            },
                                        },
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                <Divider sx={{ my: 2, borderColor: WHATSAPP_COLORS.divider }} />

                {/* User Selection */}
                <Typography variant="subtitle2" sx={{ mb: 1, color: WHATSAPP_COLORS.onSurfaceVariant }}>
                    Select Members
                </Typography>

                {fetchingUsers ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} sx={{ color: WHATSAPP_COLORS.primary }} />
                    </Box>
                ) : (
                    <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {availableUsers.map((user) => {
                            const isSelected = selectedUsers.some(u => u.firebase_uid === user.firebase_uid);
                            return (
                                <ListItem key={user.firebase_uid} disablePadding>
                                    <ListItemButton
                                        onClick={() => handleUserToggle(user)}
                                        sx={{
                                            borderRadius: 1,
                                            mb: 0.5,
                                            '&:hover': {
                                                bgcolor: WHATSAPP_COLORS.surfaceVariant,
                                            },
                                        }}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            sx={{
                                                color: WHATSAPP_COLORS.onSurfaceVariant,
                                                '&.Mui-checked': {
                                                    color: WHATSAPP_COLORS.primary,
                                                },
                                            }}
                                        />
                                        <ListItemAvatar>
                                            <Avatar
                                                sx={{
                                                    bgcolor: WHATSAPP_COLORS.primary,
                                                    color: 'white',
                                                    width: 40,
                                                    height: 40,
                                                }}
                                            >
                                                {getInitials(user.first_name, user.last_name)}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={`${user.first_name} ${user.last_name}`}
                                            secondary={user.email}
                                            primaryTypographyProps={{
                                                color: WHATSAPP_COLORS.onSurface,
                                                fontWeight: 500,
                                            }}
                                            secondaryTypographyProps={{
                                                color: WHATSAPP_COLORS.onSurfaceVariant,
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </DialogContent>

            <DialogActions sx={{ 
                p: 3, 
                pt: 2,
                borderTop: `1px solid ${WHATSAPP_COLORS.divider}`,
                gap: 1
            }}>
                <Button
                    onClick={handleClose}
                    sx={{
                        color: WHATSAPP_COLORS.onSurfaceVariant,
                        '&:hover': {
                            bgcolor: `${WHATSAPP_COLORS.onSurfaceVariant}10`,
                        },
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleCreateGroup}
                    variant="contained"
                    disabled={loading || !groupName.trim() || selectedUsers.length === 0}
                    sx={{
                        bgcolor: WHATSAPP_COLORS.primary,
                        color: 'white',
                        minWidth: 120,
                        '&:hover': {
                            bgcolor: WHATSAPP_COLORS.primaryDark,
                        },
                        '&:disabled': {
                            bgcolor: WHATSAPP_COLORS.surfaceVariant,
                            color: WHATSAPP_COLORS.onSurfaceVariant,
                        },
                    }}
                >
                    {loading ? (
                        <CircularProgress size={20} sx={{ color: 'white' }} />
                    ) : (
                        'Create Group'
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default GroupCreation; 