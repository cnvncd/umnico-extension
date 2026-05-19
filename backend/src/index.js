import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { body, param, query, validationResult } from 'express-validator';
import pool from './db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Simple session storage (in production use Redis or database)
const sessions = new Map();

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('chrome-extension://')) return origin.startsWith('chrome-extension://');
      return origin === allowed || origin.startsWith(allowed);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
const sessionMiddleware = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.query.session;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    if (session.expires > Date.now()) {
      req.session = session;
      return next();
    } else {
      sessions.delete(sessionId);
    }
  }
  req.session = null;
  next();
};

app.use(sessionMiddleware);

// Admin authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Serve login page
app.get('/admin/login', (req, res) => {
  res.sendFile(join(__dirname, '../public/login.html'));
});

// Login endpoint
app.post('/api/admin/login', async (req, res) => {
  console.log('Login request received:', req.body);
  
  const { password } = req.body;
  
  if (!password) {
    console.log('No password provided');
    return res.status(400).json({ error: 'Password is required' });
  }
  
  console.log('Comparing passwords:', { provided: password, expected: ADMIN_PASSWORD });
  
  if (password === ADMIN_PASSWORD) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = {
      authenticated: true,
      expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    sessions.set(sessionId, session);
    
    console.log('Login successful, sessionId:', sessionId);
    res.json({ success: true, sessionId });
  } else {
    console.log('Invalid password');
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Logout endpoint
app.post('/api/admin/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ success: true });
});

// Serve static files for admin panel
app.use('/admin', express.static(join(__dirname, '../public')));

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============================================
// BROWSER EXTENSION API
// ============================================

// GET /api/browser-extension/:leadId
app.get('/api/browser-extension/:leadId', 
  param('leadId').notEmpty().trim(),
  query('sa_id').optional().trim(),
  handleValidationErrors,
  async (req, res) => {
    const { leadId } = req.params;
    const { sa_id } = req.query;
    
    try {
      // Find or create lead by umnico_id
      let leadResult = await pool.query(
        'SELECT id, umnico_id, telegram_fullname, sa_id, created_at FROM leads WHERE umnico_id = $1',
        [leadId]
      );
      
      let lead;
      
      if (leadResult.rows.length === 0) {
        // Create new lead if sa_id is provided
        if (sa_id) {
          const insertResult = await pool.query(
            'INSERT INTO leads (umnico_id, sa_id) VALUES ($1, $2) RETURNING *',
            [leadId, sa_id]
          );
          lead = insertResult.rows[0];
        } else {
          // No lead and no sa_id provided
          return res.json({
            info: null,
            postback_data: [],
            referral_links_data: []
          });
        }
      } else {
        lead = leadResult.rows[0];
        
        // Update sa_id if provided and different
        if (sa_id && lead.sa_id !== sa_id) {
          await pool.query(
            'UPDATE leads SET sa_id = $1 WHERE id = $2',
            [sa_id, lead.id]
          );
          lead.sa_id = sa_id;
        }
      }
      
      // Get postbacks for this lead
      const postbacksResult = await pool.query(
        'SELECT status, created_at, offer, sub_id, payout FROM postbacks WHERE lead_id = $1 ORDER BY created_at DESC',
        [lead.id]
      );
      
      const postback_data = postbacksResult.rows.map(pb => ({
        status: pb.status,
        created_at: pb.created_at,
        info: pb.offer ? `${pb.offer}${pb.payout ? ` | $${pb.payout}` : ''}` : null
      }));
      
      // Get referral links for this lead's integration
      let referral_links_data = [];
      if (lead.sa_id) {
        const linksResult = await pool.query(
          `SELECT rl.url, rl.label 
           FROM referral_links rl
           JOIN integrations i ON rl.integration_id = i.id
           WHERE i.sa_id = $1
           ORDER BY rl.sort_order, rl.id`,
          [lead.sa_id]
        );
        
        referral_links_data = linksResult.rows.map(link => ({
          link: link.url,
          description: link.label
        }));
      }
      
      res.json({
        info: {
          umnico_id: lead.umnico_id,
          telegram_fullname: lead.telegram_fullname,
          created_at: lead.created_at
        },
        postback_data,
        referral_links_data
      });
      
    } catch (error) {
      console.error('Error fetching lead data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Helper function to handle postback logic
async function handlePostback(req, res, status) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Postback ${status} received - Full query:`, req.query);
  
  const { external_id, sub_id_30, offer, sub_id, payout } = req.query;
  
  // Try to get leadId from external_id or sub_id_30
  const leadId = external_id || sub_id_30;
  
  // Validate required fields
  if (!leadId || leadId.trim() === '') {
    console.log(`[${timestamp}] ERROR: leadId is empty or missing (checked external_id and sub_id_30)`);
    return res.status(400).json({ error: 'external_id or sub_id_30 is required and cannot be empty' });
  }
  
  console.log(`[${timestamp}] Postback validated:`, { leadId, status, offer, sub_id, payout });
  
  try {
    // Find lead by umnico_id
    const leadResult = await pool.query(
      'SELECT id FROM leads WHERE umnico_id = $1',
      [leadId]
    );
    
    if (leadResult.rows.length === 0) {
      console.log(`[${timestamp}] Lead not found: ${leadId}`);
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const dbLeadId = leadResult.rows[0].id;
    
    // Insert postback
    await pool.query(
      'INSERT INTO postbacks (lead_id, status, offer, sub_id, payout) VALUES ($1, $2, $3, $4, $5)',
      [dbLeadId, status, offer || null, sub_id || null, payout ? parseFloat(payout) : null]
    );
    
    console.log(`[${timestamp}] Postback saved for lead ${leadId}`);
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error(`[${timestamp}] Error saving postback:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/postback - Receive postbacks from Keitaro (legacy with status parameter)
app.get('/api/postback',
  async (req, res) => {
    const { status } = req.query;
    
    if (!status || status.trim() === '') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ERROR: status is empty or missing`);
      return res.status(400).json({ error: 'status is required and cannot be empty' });
    }
    
    await handlePostback(req, res, status);
  }
);

// GET /api/postback/lead - Registration postback
app.get('/api/postback/lead', async (req, res) => {
  await handlePostback(req, res, 'lead');
});

// GET /api/postback/sale - First deposit postback
app.get('/api/postback/sale', async (req, res) => {
  await handlePostback(req, res, 'sale');
});

// GET /api/postback/resale - Repeat deposit postback
app.get('/api/postback/resale', async (req, res) => {
  await handlePostback(req, res, 'resale');
});

// POST /api/leads - Create or update lead
app.post('/api/leads',
  body('umnico_id').notEmpty().trim(),
  body('telegram_fullname').optional().trim(),
  body('sa_id').optional().trim(),
  handleValidationErrors,
  async (req, res) => {
    const { umnico_id, telegram_fullname, sa_id } = req.body;
    
    try {
      const result = await pool.query(
        `INSERT INTO leads (umnico_id, telegram_fullname, sa_id) 
         VALUES ($1, $2, $3)
         ON CONFLICT (umnico_id) 
         DO UPDATE SET 
           telegram_fullname = COALESCE($2, leads.telegram_fullname),
           sa_id = COALESCE($3, leads.sa_id)
         RETURNING *`,
        [umnico_id, telegram_fullname || null, sa_id || null]
      );
      
      res.status(201).json(result.rows[0]);
      
    } catch (error) {
      console.error('Error creating/updating lead:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ============================================
// ADMIN API
// ============================================

// GET /api/admin/integrations - List all integrations with link count
app.get('/api/admin/integrations', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.sa_id, i.name, i.created_at,
              COUNT(rl.id) as links_count
       FROM integrations i
       LEFT JOIN referral_links rl ON i.id = rl.integration_id
       GROUP BY i.id
       ORDER BY i.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/integrations - Create integration
app.post('/api/admin/integrations',
  requireAuth,
  body('name').notEmpty().trim(),
  body('sa_id').notEmpty().trim(),
  handleValidationErrors,
  async (req, res) => {
    const { name, sa_id } = req.body;
    
    try {
      const result = await pool.query(
        'INSERT INTO integrations (name, sa_id) VALUES ($1, $2) RETURNING *',
        [name, sa_id]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Integration with this sa_id already exists' });
      }
      console.error('Error creating integration:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/admin/integrations/:id - Delete integration
app.delete('/api/admin/integrations/:id',
  requireAuth,
  param('id').isInt(),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(
        'DELETE FROM integrations WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting integration:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/admin/integrations/:id/links - Get links for integration
app.get('/api/admin/integrations/:id/links',
  requireAuth,
  param('id').isInt(),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(
        'SELECT * FROM referral_links WHERE integration_id = $1 ORDER BY sort_order, id',
        [id]
      );
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching links:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/admin/integrations/:id/links - Add link to integration
app.post('/api/admin/integrations/:id/links',
  requireAuth,
  param('id').isInt(),
  body('label').notEmpty().trim(),
  body('url').notEmpty().trim().isURL({ require_protocol: true }),
  body('sort_order').optional().isInt(),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    const { label, url, sort_order } = req.body;
    
    try {
      // Check if integration exists
      const integrationCheck = await pool.query(
        'SELECT id FROM integrations WHERE id = $1',
        [id]
      );
      
      if (integrationCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }
      
      const result = await pool.query(
        'INSERT INTO referral_links (integration_id, label, url, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, label, url, sort_order || 0]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating link:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/admin/links/:id - Update link
app.put('/api/admin/links/:id',
  requireAuth,
  param('id').isInt(),
  body('label').optional().trim(),
  body('url').optional().trim().isURL({ require_protocol: true }),
  body('sort_order').optional().isInt(),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    const { label, url, sort_order } = req.body;
    
    try {
      const updates = [];
      const values = [];
      let paramCount = 1;
      
      if (label !== undefined) {
        updates.push(`label = $${paramCount++}`);
        values.push(label);
      }
      if (url !== undefined) {
        updates.push(`url = $${paramCount++}`);
        values.push(url);
      }
      if (sort_order !== undefined) {
        updates.push(`sort_order = $${paramCount++}`);
        values.push(sort_order);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      values.push(id);
      const result = await pool.query(
        `UPDATE referral_links SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Link not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating link:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/admin/links/:id - Delete link
app.delete('/api/admin/links/:id',
  requireAuth,
  param('id').isInt(),
  handleValidationErrors,
  async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await pool.query(
        'DELETE FROM referral_links WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Link not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting link:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, error: 'Database connection failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
