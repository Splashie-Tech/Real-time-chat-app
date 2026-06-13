const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    room: {
        type: String,
        required: true,
        index: true // Faster lookups when fetching room history
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: String,
    content: {
        type: String,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);