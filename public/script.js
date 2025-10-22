// Carousel functionality
let slides = document.querySelectorAll('.carousel .slide');
let currentIndex = 0;

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.remove('active');
        if (i === index) slide.classList.add('active');
    });
}

// Automatic carousel with fade
setInterval(() => {
    currentIndex++;
    if (currentIndex >= slides.length) currentIndex = 0;
    showSlide(currentIndex);
}, 4000); // 4 seconds per slide


// --- BOOKING FORM HANDLER (Step 1 - REDIRECT) ---

// Get modal elements
const modal = document.getElementById('booking-message-modal');
const closeBtn = document.querySelector('.close-btn');

// Function to display the modal 
function showModal(title, text) {
    const modalTitle = modal.querySelector('h3');
    const modalText = modal.querySelector('#modal-text');
    
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    
    modal.style.display = 'flex';
}

// Function to hide the modal
function hideModal() {
    modal.style.display = 'none';
}

// Close button functionality
if (closeBtn) closeBtn.addEventListener('click', hideModal);

// Close modal if user clicks outside of it
if (modal) {
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            hideModal();
        }
    });
}

// Booking form submission logic - Gathers data and redirects
document.getElementById('booking-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const roomType = document.getElementById('room-type').value;
    const checkin = document.getElementById('checkin').value;
    const checkout = document.getElementById('checkout').value;
    
    // Simple date validation
    if (new Date(checkin) >= new Date(checkout)) {
        showModal('Invalid Dates', 'Check-out date must be after Check-in date.');
        return;
    }
    if (new Date(checkin) < new Date()) {
        showModal('Invalid Dates', 'Check-in date cannot be in the past.');
        return;
    }

    // Redirect to the booking details page with parameters
    const params = new URLSearchParams({
        room: roomType,
        checkin: checkin,
        checkout: checkout
    });

    window.location.href = `booking_details.html?${params.toString()}`;
});

// Contact form handling (Unchanged, remains separate)
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contact-form');
    
    if (contactForm) {
        // Contact form logic remains handled by the script tag in contact.html
    }
});