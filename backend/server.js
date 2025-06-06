const express = require('express');
const bodyParser = require('body-parser'); // Allows for reading of JSON body text.
const cors = require('cors'); // Allows backend API to be accessed from different domains.
const db = require('./db'); // Connects to database and provides easy query functionaility.
const bcrypt = require('bcrypt'); // Allows for password encryption.
const path = require('path');
const pool = db.pool;


const app = express();
app.use(cors());
app.use(bodyParser.json()); // Handles JSON
app.use(bodyParser.urlencoded({ extended: true})); // Handles form submissions

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Login endpoint 
app.post('/api/login', async (req, res) => {
    const { username, password, account_type } = req.body;

    try {
        // Find user in database
        const { rows } = await db.query(
            'SELECT * FROM site_user WHERE username = $1 AND account_type = $2',
            [username, account_type]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = rows[0];

        // Compare hashed password to user input
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials '});
        }

        res.json({
            token: 'dummy-token', // This is to save who is logged in 
            user: {
                id: user.site_user_id,
                type: user.account_type
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
    const { account_name, account_type, username, password, name, email } = req.body;

    try {
        // Start transaction
        await db.query('BEGIN');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into site_user
        const userQuery = `
            INSERT INTO site_user(account_name, account_type, username, password)
            VALUES($1, $2, $3, $4) RETURNING site_user_id`;
        const userValues = [account_name, account_type, username, hashedPassword];
        const { rows: userRows } = await db.query(userQuery, userValues);

        // Insert into customer or organiser based on account_type
        if (account_type === 'Customer') {
            await db.query(
                'INSERT INTO customer(site_user_id, name, email) VALUES($1, $2, $3)',
                [userRows[0].site_user_id, name, email]
            );
        }
		
		if (account_type === 'Organiser') {
            await db.query(
                'INSERT INTO organiser(site_user_id, name, email) VALUES($1, $2, $3)',
                [userRows[0].site_user_id, name, email]
            );
        }

        await db.query('COMMIT');
        res.status(201).json({ success: true });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Organiser Event Creation Endpoint
app.post('/api/createEvent', async (req, res) => {
  const { name, location, date, category, description, ticket_total } = req.body;

  try {
    // Replace this with actual organiser_id from session/auth context when full log-in access is functional
    const organiserId = 2;

    const insertQuery = `
      INSERT INTO event (
        organiser_id, name, location, event_date, category, description, ticket_total, tickets_available
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING event_id
    `;

    const { rows } = await db.query(insertQuery, [
      organiserId,
      name,
      location,
      date,
      category,
      description,
      ticket_total
    ]);

    res.status(201).json({ success: true, event_id: rows[0].event_id });
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ success: false, error: 'Server error while creating event' });
  }
});

// Guest Dashboard load events endpoint
app.get('/api/events', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM event ORDER BY event_date ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Registration and Digi-Tix generation endpoint

app.post('/api/events/:eventId/register', async (req, res) => {
  const eventId = parseInt(req.params.eventId);
  const { userId, ticketType, seat, details } = req.body;

  if (!userId || !ticketType) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check ticket availability
    const eventRes = await client.query('SELECT tickets_available FROM event WHERE event_id = $1 FOR UPDATE', [eventId]);
    if (eventRes.rows.length === 0) {
      throw new Error('Event not found.');
    }

    const available = eventRes.rows[0].tickets_available;
    if (available <= 0) {
      throw new Error('No tickets available.');
    }

    // Insert into registration
    const regRes = await client.query(
      `INSERT INTO registration (user_id, event_id, status, details)
       VALUES ($1, $2, 'Pending', $3)
       RETURNING registration_id`,
      [userId, eventId, details]
    );
    const registrationId = regRes.rows[0].registration_id;

    // Ticket pricing logic
    let price = 0;
    switch (ticketType) {
      case 'Standard':
        price = 0; // or your default standard price
        break;
      case 'VIP':
        price = 50.00; // or dynamic based on event
        break;
      default:
        throw new Error('Invalid ticket type.');
    }

    // Insert ticket
    await client.query(
      `INSERT INTO ticket (event_id, registration_id, ticket_type, seat, details, price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [eventId, registrationId, ticketType, seat || null, details, price]
    );

    // Decrement available tickets
    await client.query(
      `UPDATE event SET tickets_available = tickets_available - 1 WHERE event_id = $1`,
      [eventId]
    );

    await client.query('COMMIT');

    // Simulated payment link (would integrate with Stripe or similar)
    const paymentUrl = `/payment/simulate?registrationId=${registrationId}`; // You can create this route later

    res.json({ success: true, paymentUrl });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Serve payment page
app.get('/payment/simulate', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/payment.html'));
});

//Payment Enpoint
app.post('/api/payment/confirm', async (req, res) => {
  const { registrationId } = req.body;

  if (!registrationId) {
    return res.status(400).json({ error: 'Missing registration ID' });
  }

  try {
    // Update the registration status to "Approved"
    await db.query(
      'UPDATE registration SET status = $1 WHERE registration_id = $2',
      ['Approved', registrationId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Payment failed:', err.message);
    res.status(500).json({ error: 'Payment failed' });
  }
});

// More endpoints here...

// Serve the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/home-page.html'));
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
});