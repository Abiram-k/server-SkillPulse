const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    token: {
        type: String
    },
    role: {
        type: String,
        default: "User"
    }
}, { timestamps: true });

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistSchema);
module.exports = BlacklistedToken