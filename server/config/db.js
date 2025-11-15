const mongoose = require('mongoose');
require('dotenv').config(); // Load the .env file

const connectDB = async () => {
  try {
    // Mongoose is the library we use to talk to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected Successfully! 🚀');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;