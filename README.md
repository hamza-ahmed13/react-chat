# React Chat Application

A modern real-time chat application built with React, Firebase Authentication, and Socket.IO.

## Features

- User Authentication with Firebase
- Real-time messaging with Socket.IO
- Material-UI components for modern UI
- Private messaging
- Online/Offline status
- Typing indicators
- Message history
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase project credentials

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hamza-ahmed13/react-chat.git
cd react-chat
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Firebase configuration:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

4. Start the development server:
```bash
npm start
```

## Project Structure

```
src/
├── components/          # React components
│   ├── Chat.js         # Main chat interface
│   ├── Login.js        # Authentication component
│   └── PrivateRoute.js # Route protection
├── contexts/           # React contexts
│   ├── FirebaseContext.js  # Firebase auth context
│   └── SocketContext.js    # Socket.IO context
├── services/           # External services
│   └── socket.js       # Socket.IO configuration
├── App.js             # Main application component
└── index.js           # Application entry point
```

## Components

### Chat Component
- Real-time messaging interface
- User list with online status
- Message history
- Typing indicators
- Message input with send functionality

### Login Component
- User registration
- User login
- Form validation
- Error handling

### PrivateRoute Component
- Route protection based on authentication
- Redirect to login for unauthenticated users

## Context Providers

### FirebaseContext
- Firebase authentication state
- User management
- Authentication methods

### SocketContext
- Socket.IO connection management
- Real-time event handling
- Connection state management

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App

## Environment Variables

Required environment variables:
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
