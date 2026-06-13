require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');

const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.io
const io = new Server(server, {
    cors: { origin: "*" } // In production, replace with your client URL
});

const PORT = process.env.PORT || 5000;

// 1. Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON payloads

// 2. MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🚀 Connected to MongoDB successfully.'))
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });

// Helper Function: Generate JSON Web Token
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' } // Token lasts 1 day
    );
};

// 3. Auth Routes

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Please provide both username and password' });
        }

        // Check if user already exists
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'Username is already taken' });
        }

        // Create new user (password is automatically hashed in the model pre-save hook)
        const newUser = new User({ username, password });
        await newUser.save();

        // Generate token for instant login after registration
        const token = generateToken(newUser);

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: newUser._id, username: newUser.username }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error during registration', error: error.message });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Please provide both username and password' });
        }

        // Find user by username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Validate password using instance method
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Generate JWT
        const token = generateToken(user);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user._id, username: user.username }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }
});


// --- SOCKET.IO LOGIC ---

// 1. Socket Authentication Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error: No token provided"));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Authentication error: Invalid token"));
        socket.user = decoded; // Attach user info (id, username) to the socket
        next();
    });
});

// 2. Real-time Events
io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.user.username}`);

    socket.on('join_room', async (roomId) => {
        socket.join(roomId);
        console.log(`🏠 ${socket.user.username} joined room: ${roomId}`);

        // Fetch last 50 messages for this room from MongoDB
        const history = await Message.find({ room: roomId })
            .sort({ createdAt: -1 })
            .limit(50);
        
        socket.emit('message_history', history.reverse());
    });

    socket.on('send_message', async (data) => {
        const { room, content } = data;

        // Persist message to database
        const newMessage = new Message({
            room,
            content,
            sender: socket.user.id,
            senderName: socket.user.username
        });
        await newMessage.save();

        // Broadcast to everyone in the room (including sender)
        io.to(room).emit('receive_message', newMessage);
    });

    socket.on('typing', (data) => {
        // Broadcast "User is typing..." to everyone in the room except the sender
        socket.to(data.room).emit('user_typing', { 
            username: socket.user.username, 
            isTyping: data.isTyping 
        });
    });

    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.user.username}`);
    });
});

// Use server.listen instead of app.listen!
server.listen(PORT, () => {
    console.log(`🚀 Server + Sockets running on http://localhost:${PORT}`);
});