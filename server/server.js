require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
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

// 4. Start Server
app.listen(PORT, () => {
    console.log(`📡 Auth Server running on http://localhost:${PORT}`);
});