const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // We use this to hash passwords

const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please provide your full name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true, // No two users can have the same email
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false, // This will hide the password from default queries
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// This is a "pre-save hook"
// Before saving a new user, it automatically hashes their password
// This is a unique and secure design!
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  
  // "salt" makes the hash stronger
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', UserSchema);