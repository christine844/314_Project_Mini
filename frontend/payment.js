const urlParams = new URLSearchParams(window.location.search);
const registrationId = urlParams.get('registrationId');
document.getElementById('registration-id-display').textContent = registrationId;

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const response = await fetch('/api/payment/confirm', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ registrationId })
    });

    const result = await response.json();

    const msgDiv = document.getElementById('message');
      if (result.success) {
        msgDiv.textContent = 'Payment successful! Redirecting to your digital ticket...';
        setTimeout(() => {
          window.location.href = `/ticket/${registrationId}`;
        }, 2000);
      } else {
        msgDiv.textContent = result.error || 'Payment failed.';
      }
    });