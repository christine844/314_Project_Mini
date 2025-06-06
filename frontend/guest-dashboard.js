// Displays all events currently in the database, ordered by date.

document.addEventListener('DOMContentLoaded', () => {
  const eventList = document.getElementById('event-list');

  fetch('/api/events')
    .then(res => res.json())
    .then(events => {
      eventList.innerHTML = ''; // Clear any previous content

      events.forEach(event => {
        const card = document.createElement('div');
        card.className = 'event-card';

        card.innerHTML = `
          <img src="https://via.placeholder.com/150" alt="Event Image">
          <div>
            <h3>${event.name}</h3>
            <p><strong>Location:</strong> ${event.location}</p>
            <p><strong>Date:</strong> ${new Date(event.event_date).toLocaleString()}</p>
            <p><strong>Type:</strong> ${event.category}</p>
            <p>${event.description || ''}</p>
            <button onclick="openRegistrationModal(${event.event_id})">Register</button>
          </div>
        `;

        eventList.appendChild(card);
      });
    })
    .catch(err => {
      console.error('Error fetching events:', err);
      eventList.innerHTML = `<p>Error loading events. Please try again later.</p>`;
    });
});

// For the event registration modal

// Open modal with selected eventId
function openRegistrationModal(eventId) {
  document.getElementById('register-modal').classList.remove('hidden');
  document.getElementById('event-id').value = eventId;
}

// Close modal
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('register-modal').classList.add('hidden');
});

// Handle registration form submit
document.getElementById('registration-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const eventId = document.getElementById('event-id').value;
  const ticketType = document.getElementById('ticket-type').value;
  const seat = document.getElementById('seat').value;
  const details = document.getElementById('details').value;

  try {
    const userId = 2;
    
    // localStorage.getItem('userId'); // RE-INSTATE THIS WHEN ALL FINISHED

    const response = await fetch(`/api/events/${eventId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        ticketType,
        seat,
        details
      })
    });

    const result = await response.json();

    if (response.ok) {
      alert('Registration successful! Redirecting to payment...');
      window.location.href = result.paymentUrl; // e.g., /pay/ticket/91
    } else {
      alert(result.error || 'Registration failed');
    }

  } catch (err) {
    console.error(err);
    alert('An error occurred during registration.');
  }
});