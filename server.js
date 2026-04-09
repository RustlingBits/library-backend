require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB Connection with Persistent Configuration
mongoose.connect(MONGO_URI, {
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4
})
    .then(() => console.log("✅ Successfully connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log("✅ Mongoose connected to MongoDB");
});

mongoose.connection.on('error', (err) => {
    console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on('disconnected', () => {
    console.warn("⚠️ Mongoose disconnected from MongoDB");
});

process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log("✅ Mongoose connection closed");
    process.exit(0);
});

// Middleware
// Allow requests from your specific Netlify link
app.use(cors({
    origin: 'https://uemdigital-library.netlify.app' 
}));
app.use(express.json()); // This lets the server read JSON data sent by your library app

// Base Route (Testing if the server works)
app.get('/', (req, res) => {
    res.send('UEM Library Server is Running!');
});

// Health Check Route
app.get('/api/health', (req, res) => {
    const mongooseConnected = mongoose.connection.readyState === 1;
    res.json({
        server: 'running',
        database: mongooseConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
        mongooseState: mongoose.connection.readyState
    });
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// ==========================================
// 1. DEFINE THE BOOK SCHEMA (Data Structure)
// ==========================================
const bookSchema = new mongoose.Schema({
    id: String,
    t: String,     // Title
    a: String,     // Author
    g: String,     // Genre
    c: Number,     // Copies available
    tot: Number,   // Total copies
    e: String,     // Emoji
    cf: String,    // Color From (for the gradient)
    ct: String     // Color To (for the gradient)
});

const Book = mongoose.model('Book', bookSchema);

// ==========================================
// 1.5 DEFINE THE USER SCHEMA
// ==========================================
const userSchema = new mongoose.Schema({
    id: String,
    name: String,
    role: String,
    pass: String, // In a real app we would encrypt this, but let's keep it simple for now!
    email: String,
    phone: String,
    address: String,
    college: String,
    major: String,
    year: String,
    studentId: String,
    emailVerified: Boolean,
    verifiedEmail: String,
    otp: String,
    otpExpiry: Date,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// BORROWING RECORDS SCHEMA
// ==========================================
const recordSchema = new mongoose.Schema({
    id: String,                    // Unique record ID
    uid: String,                   // User ID
    bk: String,                    // Book ID
    borrowed: { type: Date, default: Date.now },
    due: Date,
    returned: Date,
    renewalCount: { type: Number, default: 0 },
    fine: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Record = mongoose.model('Record', recordSchema);

// ==========================================
// 2. API ROUTES (The Bridges to your Frontend)
// ==========================================

// Route to GET all books from the database
app.get('/api/books', async (req, res) => {
    try {
        const books = await Book.find();
        res.json(books);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Route to GET a single book by ID
app.get('/api/books/:id', async (req, res) => {
    try {
        const book = await Book.findOne({ id: req.params.id });
        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.json(book);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Route to ADD a new book to the database
app.post('/api/books', async (req, res) => {
    try {
        const newBook = new Book(req.body);
        const savedBook = await newBook.save();
        res.status(201).json(savedBook); // 201 means "Created successfully"
    } catch (err) {
        res.status(400).json({ message: "Failed to add book", error: err.message });
    }
});

// Route to UPDATE a book
app.put('/api/books/:id', async (req, res) => {
    try {
        const updatedBook = await Book.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true }
        );
        if (!updatedBook) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.json(updatedBook);
    } catch (err) {
        res.status(400).json({ message: "Failed to update book", error: err.message });
    }
});

// Route to ADD MULTIPLE books at once (CSV Upload)
app.post('/api/books/bulk', async (req, res) => {
    try {
        // req.body will be an array of book objects sent from the CSV
        const savedBooks = await Book.insertMany(req.body);
        res.status(201).json(savedBooks);
    } catch (err) {
        res.status(400).json({ message: "Failed to upload CSV", error: err.message });
    }
});

// Route to DELETE a book from the database
app.delete('/api/books/:id', async (req, res) => {
    try {
        // req.params.id gets the ID from the URL (e.g., /api/books/b1)
        // We use deleteOne to match your custom 'id' field (like 'b1', 'b2')
        const deletedBook = await Book.findOneAndDelete({ id: req.params.id });
        
        if (!deletedBook) {
            return res.status(404).json({ message: "Book not found" });
        }
        res.json({ message: "Book deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to GET all users from the database
app.get('/api/users', async (req, res) => {
    try {
        // Find all users and send them back
        const allUsers = await User.find();
        res.json(allUsers);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});
// Route to ADD a new user
app.post('/api/users', async (req, res) => {
    try {
        // First check if a user with this ID already exists
        const existingUser = await User.findOne({ id: req.body.id });
        if (existingUser) {
            return res.status(400).json({ message: "User ID already exists!" });
        }
        
        const newUser = new User(req.body);
        const savedUser = await newUser.save();
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(400).json({ message: "Failed to add user", error: err.message });
    }
});

// Route to DELETE a user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const deletedUser = await User.findOneAndDelete({ id: req.params.id });
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to UPDATE user profile (email, phone, address, etc.)
app.put('/api/users/:id', async (req, res) => {
    try {
        const updatedUser = await User.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true } // Return the updated document
        );
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.json(updatedUser);
    } catch (err) {
        res.status(400).json({ message: "Failed to update user", error: err.message });
    }
});

// ==========================================
// 3. BORROWING RECORDS ROUTES
// ==========================================

// Route to GET all borrowing records
app.get('/api/records', async (req, res) => {
    try {
        const records = await Record.find();
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Route to GET records for a specific user
app.get('/api/records/user/:userId', async (req, res) => {
    try {
        const userRecords = await Record.find({ uid: req.params.userId });
        res.json(userRecords);
    } catch (err) {
        res.status(500).json({ message: "Server Error", error: err.message });
    }
});

// Route to CREATE a new borrowing record
app.post('/api/records', async (req, res) => {
    try {
        // Generate unique ID
        const recordCount = await Record.countDocuments();
        const newRecord = new Record({
            id: `r${recordCount + 1}`,
            uid: req.body.uid,
            bk: req.body.bk,
            borrowed: new Date(),
            due: req.body.due || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days default
            renewalCount: 0,
            fine: 0
        });
        
        const savedRecord = await newRecord.save();
        
        // Update book copies count
        const book = await Book.findOne({ id: req.body.bk });
        if (book) {
            book.c = Math.max(0, book.c - 1);
            await book.save();
        }
        
        res.status(201).json(savedRecord);
    } catch (err) {
        res.status(400).json({ message: "Failed to create record", error: err.message });
    }
});

// Route to UPDATE a borrowing record (for returns and renewals)
app.put('/api/records/:id', async (req, res) => {
    try {
        const updatedRecord = await Record.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true }
        );
        
        if (!updatedRecord) {
            return res.status(404).json({ message: "Record not found" });
        }
        
        // If book was returned, increase copies count
        if (req.body.returned && req.body.returned !== updatedRecord.returned) {
            const book = await Book.findOne({ id: updatedRecord.bk });
            if (book) {
                book.c += 1;
                await book.save();
            }
        }
        
        res.json(updatedRecord);
    } catch (err) {
        res.status(400).json({ message: "Failed to update record", error: err.message });
    }
});

// Route to DELETE a borrowing record
app.delete('/api/records/:id', async (req, res) => {
    try {
        const deletedRecord = await Record.findOneAndDelete({ id: req.params.id });
        if (!deletedRecord) {
            return res.status(404).json({ message: "Record not found" });
        }
        res.json({ message: "Record deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Temporary Route to seed initial data
app.get('/api/seed', async (req, res) => {
    const DEFAULT_BOOKS = [
        {id:'b1',t:'The Midnight Library',a:'Matt Haig',g:'Fiction',c:3,e:'🌌',cf:'#1e3a5f',ct:'#4a90d9'},
        {id:'b2',t:'Atomic Habits',a:'James Clear',g:'Self-Help',c:2,e:'⚡',cf:'#1a4731',ct:'#2ecc71'},
        {id:'b3',t:'Dune',a:'Frank Herbert',g:'Sci-Fi',c:4,e:'🏜️',cf:'#5c3a1e',ct:'#c9852c'},
        {id:'b4',t:'The Name of the Wind',a:'Patrick Rothfuss',g:'Fantasy',c:2,e:'🌬️',cf:'#2d1b4e',ct:'#8e44ad'},
        {id:'b5',t:'Sapiens',a:'Yuval Noah Harari',g:'History',c:3,e:'🧬',cf:'#1a3a4a',ct:'#16a085'},
        {id:'b6',t:'The Great Gatsby',a:'F. Scott Fitzgerald',g:'Classic',c:5,e:'✨',cf:'#3d2700',ct:'#f39c12'}
    ];
    
    const DEFAULT_USERS = [
        {id:'u1', name:'Alice Johnson', role:'student', pass:'pass123', email:'alice@uem.edu.in'},
        {id:'u3', name:'Dr. Sarah Chen', role:'admin', pass:'pass123'}
    ];

    const DEFAULT_RECORDS = [
        {id:'r1', uid:'u1', bk:'b1', borrowed: new Date(Date.now() - 10*24*60*60*1000), due: new Date(Date.now() + 50*24*60*60*1000), returned: null, renewalCount: 0, fine: 0},
        {id:'r2', uid:'u1', bk:'b3', borrowed: new Date(Date.now() - 30*24*60*60*1000), due: new Date(Date.now() - 5*24*60*60*1000), returned: null, renewalCount: 1, fine: 50}
    ];

    try {
        // Clear old data
        await Book.deleteMany({}); 
        await User.deleteMany({});
        await Record.deleteMany({});
        
        // Insert new data
        await Book.insertMany(DEFAULT_BOOKS);
        await User.insertMany(DEFAULT_USERS);
        await Record.insertMany(DEFAULT_RECORDS);
        
        res.json({ message: "Books, Users, and Borrowing Records seeded successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route to handle User Login
app.post('/api/login', async (req, res) => {
    const { id, password, isAdminLogin } = req.body;
    
    // SPY 1: What did the frontend send?
    console.log(`\n--- LOGIN ATTEMPT ---`);
    console.log(`Trying to log in with ID: '${id}' and Pass: '${password}'`);

    try {
        const user = await User.findOne({ id: new RegExp('^' + id + '$', 'i') });
        
        // SPY 2: Did we find the user in MongoDB?
        console.log(`User found in database:`, user);

        if (!user) {
            console.log(`❌ REJECTED: User ID not found in database.`);
            return res.status(401).json({ message: "Invalid ID" });
        } 
        
        if (user.pass !== password) {
            console.log(`❌ REJECTED: Passwords do not match! DB expects: '${user.pass}'`);
            return res.status(401).json({ message: "Invalid Password" });
        }

        if (isAdminLogin && user.role !== 'admin' && user.role !== 'teacher') {
            console.log(`❌ REJECTED: User is not an admin.`);
            return res.status(403).json({ message: "Unauthorized: Admin access required." });
        }

        console.log(`✅ SUCCESS: User logged in!`);
        const safeUser = { id: user.id, name: user.name, role: user.role, email: user.email, emailVerified: user.emailVerified };
        res.status(200).json(safeUser);
        
    } catch (err) {
        res.status(500).json({ message: "Server error during login" });
    }
});

// Route to send OTP for email verification
app.post('/api/email/send-otp', async (req, res) => {
    const { userId, newEmail } = req.body;
    
    try {
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60000); // Valid for 10 minutes
        
        // Save OTP to user (in production, send via email)
        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();
        
        // In production: send OTP via email service
        console.log(`📧 OTP sent to ${newEmail}: ${otp}`);
        
        res.status(200).json({ message: "OTP sent successfully", otp: otp }); // Return OTP for demo
    } catch (err) {
        res.status(500).json({ message: "Error sending OTP", error: err.message });
    }
});

// Route to verify OTP and confirm email
app.post('/api/email/verify-otp', async (req, res) => {
    const { userId, otp, newEmail } = req.body;
    
    try {
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Check if OTP is correct and not expired
        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        
        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ message: "OTP has expired" });
        }
        
        // Mark email as verified
        user.email = newEmail;
        user.verifiedEmail = newEmail;
        user.emailVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();
        
        res.status(200).json({ message: "Email verified successfully", user: user });
    } catch (err) {
        res.status(500).json({ message: "Error verifying OTP", error: err.message });
    }
});
