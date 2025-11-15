require('dotenv').config(); // Load .env variables *first*
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db'); // Our database connection function

// Connect to MongoDB
connectDB();

const app = express(); // Initialize our Express app

// --- Middlewares ---
// Enable CORS (Cross-Origin Resource Sharing)
// This allows your React frontend (on port 3000) to talk to this backend (on port 5000)
app.use(cors()); 

// Enable Express to parse JSON bodies in requests
// This is how we'll get data from the 'SubmitRequirement' form
app.use(express.json()); 

// --- Simple Test Route ---
// Go to http://localhost:5000 in your browser to check if it's working
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Smart City Requirements API!' });
});

// We will add our 'auth' and 'requirements' routes here in the next step


// --- Start the Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`📡 Server is live and listening on port ${PORT}`);
});