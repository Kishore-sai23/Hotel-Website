const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path'); 
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// --- CONFIGURATION CONSTANTS ---
const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY_12345'; 

// Multiple Admin Users Array (Updated with requested names/passwords)
const ADMIN_USERS = [
    { username: 'anji', password: 'Ssk@123', name: 'Anji' }, 
    { username: 'akhil', password: 'Ssk@123', name: 'Akhil' }      
];

// --- TEMPORARY IN-MEMORY DATABASE ---
const requests = [];

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (token == null) return res.status(401).send({ message: 'Authentication token required.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send({ message: 'Invalid or expired token.' });
        req.user = user; // user now contains { username: '...', name: '...' }
        next();
    });
};


// --- EMAIL TRANSPORTER CONFIG (Unchanged) ---
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
     user: 'sai23200412@gmail.com',
      pass: 'tfmy wicb ravj fxyj'


    }
});

// Helper function to send email (simplified)
const sendMail = (mailOptions, res) => {
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            if (res) {
                 return res.status(500).send({ message: 'Error sending email. Check server logs and email credentials.', error: error.message });
            }
            return;
        }
        
        console.log('Email sent: ' + info.response);
        if (res) {
            res.send({ message: 'Email sent successfully!' });
        }
    });
};

// ===========================================
// AUTH ENDPOINTS (Updated for new users)
// ===========================================

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Find the user in the array
    const user = ADMIN_USERS.find(u => u.username === username && u.password === password);

    if (user) {
        // Generate JWT token with the user's name
        const token = jwt.sign({ username: user.username, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ 
            token: token,
            name: user.name // Return the name to display on the portal
        });
    } else {
        return res.status(401).send({ message: 'Invalid username or password.' });
    }
});

app.post('/api/logout', (req, res) => {
    res.send({ message: 'Logged out successfully (Token deletion recommended).' });
});

// ===========================================
// ADMIN PORTAL API ENDPOINTS
// ===========================================

app.get('/admin-portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Retrieves ALL stored requests (Protected)
app.get('/api/requests', authenticateToken, (req, res) => {
    // Sorting logic remains the same (Pending first, then by date descending)
    const sortedRequests = requests.sort((a, b) => {
        const statusPriority = { 'Pending': 3, 'Replied': 2, 'Confirmed': 1, 'Denied': 1, 'Resolved': 1 };
        if (statusPriority[a.status] !== statusPriority[b.status]) {
            return statusPriority[b.status] - statusPriority[a.status];
        }
        return new Date(b.date) - new Date(a.date);
    });
    res.json(sortedRequests);
});

// Handles sending a reply/confirmation email from the portal (Protected)
app.post('/api/reply', authenticateToken, (req, res) => {
    const { id, customerEmail, replyMessage, newStatus } = req.body;
    
    if (!id || !customerEmail || !replyMessage || !newStatus) {
        return res.status(400).send({ message: 'Missing reply data.' });
    }

    const requestIndex = requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
        return res.status(404).send({ message: 'Request not found.' });
    }

    // Capture the name of the staff member performing the action
    const staffName = req.user.name;

    // Update status and history
    const oldStatus = requests[requestIndex].status;
    requests[requestIndex].status = newStatus;
    requests[requestIndex].history = requests[requestIndex].history || [];
    
    // Log the specific staff member's action
    requests[requestIndex].history.push({ 
        action: `Status changed from ${oldStatus} to ${newStatus}.`, 
        by: staffName, 
        date: new Date().toISOString() 
    });
    
    // Store the staff member who last confirmed/denied the booking
    if (newStatus === 'Confirmed' || newStatus === 'Denied') {
        requests[requestIndex].confirmedBy = staffName;
    }

    // Check if the customer email is a placeholder
    if (customerEmail.includes('N/A')) {
         return res.status(400).send({ message: 'Cannot send reply: Customer email is missing (N/A).' });
    }

    // --- Email sent to Customer (Reply/Confirmation) ---
    const mailOptionsToCustomer = {
        from: `"Sri Sai Krishna Hotel Staff" <${transporter.options.auth.user}>`,
        to: customerEmail, 
        subject: newStatus === 'Confirmed' ? `✅ Your Booking is Confirmed!` : `Re: Your Inquiry`,
        html: `
            <h3>${newStatus === 'Confirmed' ? 'Booking Confirmed' : 'Staff Reply'}</h3>
            <p>Dear Customer,</p>
            <p>${replyMessage}</p>
            <p>Thank you,<br>Sri Sai Krishna Hotel Management</p>
        `,
    };

    // Send the final confirmation email to the customer
    transporter.sendMail(mailOptionsToCustomer, (error, info) => {
        if (error) {
            console.error('Reply email error:', error);
            requests[requestIndex].status = oldStatus; // Revert status change if email fails
            delete requests[requestIndex].confirmedBy; // Remove confirmedBy flag
            return res.status(500).send({ message: 'Error sending reply email.' });
        }
        
        console.log(`Reply/Confirmation sent to ${customerEmail}. New status: ${newStatus}`);
        res.send({ message: 'Reply sent and status updated!', request: requests[requestIndex] });
    });
});


// ===========================================
// CLIENT FORM ENDPOINTS (Data Storage - Unchanged)
// ===========================================

app.post('/book-room', (req, res) => {
    const { 
        name, email, mobile, roomType, checkin, checkout, totalCost, baseRate, gstRate 
    } = req.body;
    
    if (!name || !email || !mobile || !roomType || !checkin || !checkout || !totalCost) {
         return res.status(400).send({ message: 'Missing required booking or contact details.' });
    }
    
    const newBooking = {
        id: crypto.randomBytes(4).toString('hex'), 
        type: 'Booking',
        roomType,
        checkin,
        checkout,
        totalCost: parseFloat(totalCost).toFixed(2),
        baseRate: parseFloat(baseRate).toFixed(2),
        gstRate: parseFloat(gstRate).toFixed(2),
        contactName: name,
        contactEmail: email,
        contactMobile: mobile,
        date: new Date().toISOString(),
        status: 'Pending'
    };
    
    requests.push(newBooking);

    res.send({ message: 'Request submitted for review!' });
});


app.post('/send-email', (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).send({ message: 'Missing required fields.' });
    }

    const newInquiry = {
        id: crypto.randomBytes(4).toString('hex'),
        type: 'Inquiry',
        contactName: name,
        contactEmail: email,
        message,
        date: new Date().toISOString(),
        status: 'Pending'
    };

    requests.push(newInquiry);

    res.send({ message: 'Inquiry received!' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Website available at: http://localhost:${port}/index.html`);
    console.log(`STAFF PORTAL available at: http://localhost:${port}/admin-portal`);
});