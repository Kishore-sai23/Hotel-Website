document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginScreen = document.getElementById('login-screen');
    const portalView = document.getElementById('portal-view');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const staffUsernameDisplay = document.getElementById('staff-username');
    
    const requestList = document.getElementById('request-list');
    const replyPanel = document.getElementById('reply-panel');
    const replyForm = document.getElementById('reply-form');
    const noSelection = document.getElementById('no-selection');
    const bookingDetailsView = document.getElementById('booking-details-view');

    let currentRequests = [];

    // --- AUTH FUNCTIONS ---
    function getToken() {
        return localStorage.getItem('ssk_auth_token');
    }
    
    function getCurrentUserName() {
        return localStorage.getItem('ssk_username');
    }

    function checkAuth() {
        const token = getToken();
        if (token) {
            loginScreen.style.display = 'none';
            portalView.style.display = 'block';
            staffUsernameDisplay.textContent = getCurrentUserName() || 'Staff'; 
            fetchRequests();
        } else {
            loginScreen.style.display = 'flex';
            portalView.style.display = 'none';
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        loginError.style.display = 'none';

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('ssk_auth_token', data.token);
                localStorage.setItem('ssk_username', data.name); 
                checkAuth(); // Switch to portal view
            } else {
                const error = await response.json();
                loginError.textContent = error.message;
                loginError.style.display = 'block';
            }
        } catch (error) {
            loginError.textContent = 'Could not connect to the server.';
            loginError.style.display = 'block';
            console.error('Login error:', error);
        }
    }

    function handleLogout() {
        localStorage.removeItem('ssk_auth_token');
        localStorage.removeItem('ssk_username');
        checkAuth(); // Switch back to login view
    }

    // --- UTILITY FUNCTIONS ---
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    function getStatusTag(status) {
        return `<span class="status-tag ${status}">${status}</span>`;
    }

    function formatCurrency(amount) {
        const numericAmount = parseFloat(amount);
        return `₹${numericAmount.toFixed(2)}`;
    }

    // --- FETCH DATA (REQUIRES AUTH TOKEN) ---
    async function fetchRequests() {
        const token = getToken();
        if (!token) {
            checkAuth(); 
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/requests', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                currentRequests = await response.json();
                renderRequests();
            } else if (response.status === 401 || response.status === 403) {
                alert('Session expired. Please log in again.');
                handleLogout();
            } else {
                throw new Error('Failed to fetch data.');
            }
        } catch (error) {
            requestList.innerHTML = '<p style="color: red;">Error loading requests. Ensure Node.js server is running.</p>';
            console.error('Error fetching requests:', error);
        }
    }

    // --- RENDER UI ---
    function renderRequests() {
        requestList.innerHTML = '';
        if (currentRequests.length === 0) {
            requestList.innerHTML = '<p>No requests found in the system.</p>';
            return;
        }

        currentRequests.forEach(request => {
            const item = document.createElement('div');
            item.className = 'request-item';
            item.dataset.id = request.id;
            
            const mainDetail = request.type === 'Booking' 
                ? `🏨 ${request.roomType} (${formatCurrency(request.totalCost || 0)})`
                : `✉️ Inquiry (${request.contactName})`;
            
            // Show who confirmed the booking in the list view
            const staffNote = (request.status === 'Confirmed' || request.status === 'Denied') && request.confirmedBy 
                ? `<span style="font-size:0.8em; color:#004aad;"> (by ${request.confirmedBy})</span>` 
                : '';
                
            item.innerHTML = `
                <h4>
                    ${mainDetail}
                    ${getStatusTag(request.status)}
                </h4>
                <p><strong>Contact:</strong> ${request.contactName} | ${request.contactEmail || 'N/A'} ${staffNote}</p>
                <p><strong>Submitted:</strong> ${formatDate(request.date)}</p>
            `;
            item.addEventListener('click', () => selectRequest(request));
            requestList.appendChild(item);
        });
    }

    // --- HANDLE SELECTION ---
    function selectRequest(request) {
        // Clear previous selections
        document.querySelectorAll('.request-item').forEach(item => item.classList.remove('selected'));
        // Select the current item
        document.querySelector(`.request-item[data-id="${request.id}"]`).classList.add('selected');

        // Populate the reply panel
        document.getElementById('reply-id').value = request.id;
        document.getElementById('reply-customer-email').value = request.contactEmail;
        document.getElementById('reply-email-display').value = request.contactEmail;
        document.getElementById('reply-type').textContent = request.type;
        
        const sendBtn = replyForm.querySelector('.send-btn');
        const replyStatusDropdown = document.getElementById('reply-status');

        // --- Core Logic: Restricting Confirmed/Denied Bookings ---
        const isFinalStatus = request.status === 'Confirmed' || request.status === 'Denied' || request.status === 'Resolved';
        
        if (isFinalStatus) {
            sendBtn.disabled = true;
            sendBtn.textContent = `Status: ${request.status} (Action Finalized)`;
            replyStatusDropdown.disabled = true;
            alert(`This request is already ${request.status} by ${request.confirmedBy || 'Staff'}. No further actions can be taken.`);
        } else {
            sendBtn.disabled = !request.contactEmail.includes('N/A') ? false : true; // Disable if email is missing
            sendBtn.textContent = 'Send & Update Status';
            replyStatusDropdown.disabled = false;
        }


        // Determine if email can be sent
        const canSendEmail = !request.contactEmail.includes('N/A');
        
        document.getElementById('reply-email-display').value = canSendEmail 
            ? request.contactEmail 
            : 'CONTACT MISSING! Cannot send email.';
        document.getElementById('reply-email-display').style.backgroundColor = canSendEmail ? '#fefefe' : '#fdd';
        
        
        // --- Display Booking Details ---
        if (request.type === 'Booking') {
            const total = formatCurrency(request.totalCost);
            const subtotal = (request.totalCost / (1 + parseFloat(request.gstRate))).toFixed(2);
            const gst = formatCurrency(request.totalCost - subtotal);
            
            bookingDetailsView.innerHTML = `
                <h4>Booking Details (ID: ${request.id})</h4>
                <p><strong>Customer:</strong> ${request.contactName}</p>
                <p><strong>Mobile:</strong> ${request.contactMobile}</p>
                <p><strong>Dates:</strong> ${request.checkin} to ${request.checkout}</p>
                <p><strong>Room:</strong> ${request.roomType} (${formatCurrency(request.baseRate)}/night)</p>
                <p><strong>Subtotal:</strong> ${formatCurrency(subtotal)}</p>
                <p><strong>GST (${(request.gstRate * 100).toFixed(0)}%):</strong> ${gst}</p>
                <h4 style="color: #1e5edc; margin-top: 10px;">TOTAL: ${total}</h4>
            `;
            bookingDetailsView.style.display = 'block';

            // Set default reply message for bookings
            let defaultBookingMessage = `We have confirmed availability for your ${request.roomType} room request. The total payable amount is ${total}. Please reply to this email or call us to finalize payment and secure your booking.`;
            document.getElementById('reply-message').value = defaultBookingMessage;

        } else {
            // Display Inquiry Details
            bookingDetailsView.innerHTML = `
                <h4>Inquiry Details (ID: ${request.id})</h4>
                <p><strong>From:</strong> ${request.contactName}</p>
                <p><strong>Message:</strong> ${request.message}</p>
            `;
            bookingDetailsView.style.display = 'block';
             document.getElementById('reply-message').value = "Thank you for contacting us. We received your inquiry and are happy to help you with your query.";
        }


        document.getElementById('reply-status').value = request.status === 'Pending' ? 'Replied' : request.status;

        noSelection.style.display = 'none';
        replyPanel.style.display = 'block';
    }

    // --- HANDLE REPLY SUBMISSION (REQUIRES AUTH TOKEN) ---
    replyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = getToken();
        if (!token) { return handleLogout(); }

        const id = document.getElementById('reply-id').value;
        const customerEmail = document.getElementById('reply-customer-email').value;
        const replyMessage = document.getElementById('reply-message').value;
        const newStatus = document.getElementById('reply-status').value;

        if (!customerEmail || customerEmail.includes('N/A')) {
            alert('Cannot send reply: Customer email is missing (N/A). Update status to "Resolved" instead of sending a reply if the issue is closed.');
            return;
        }
        
        const sendBtn = replyForm.querySelector('.send-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        try {
            const response = await fetch('http://localhost:3000/api/reply', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, customerEmail, replyMessage, newStatus })
            });

            if (response.ok) {
                alert(`Reply sent to ${customerEmail} and status set to ${newStatus}.`);
                fetchRequests(); // Reload data
                replyPanel.style.display = 'none'; 
                noSelection.style.display = 'block';
                bookingDetailsView.style.display = 'none';
            } else if (response.status === 401 || response.status === 403) {
                alert('Session expired. Please log in again.');
                handleLogout();
            } else {
                const errorData = await response.json();
                alert('Error sending reply: ' + (errorData.message || response.statusText) + '. Check server logs.');
            }
        } catch (error) {
            alert('Server error: Could not connect to send reply.');
            console.error('Reply submission error:', error);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send & Update Status';
        }
    });

    // --- EVENT LISTENERS ---
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Initial check
    checkAuth();
    // Refresh data every 30 seconds after authentication
    setInterval(() => {
        if (getToken()) {
            fetchRequests();
        }
    }, 30000); 
});