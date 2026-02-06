// Simple script to test MongoDB connection
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/gpp-fcit';

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection URI:', MONGODB_URI);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');

    // Test a simple operation
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

    await mongoose.connection.close();
    console.log('Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
