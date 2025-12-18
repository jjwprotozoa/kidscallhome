/**
 * ============================================================================
 * KIDS CALL HOME - Pusher Authentication Endpoint
 * ============================================================================
 * 
 * Purpose: Handle Pusher authentication for private channels
 * Technology: Vercel Serverless Functions + Pusher
 * 
 * This endpoint is required for Pusher private channels and client events
 * 
 * Last Updated: 2024-09-09
 * ============================================================================
 */

const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { socket_id, channel_name } = req.body;

    if (!socket_id || !channel_name) {
      return res.status(400).json({ error: 'Missing socket_id or channel_name' });
    }

    // For now, we'll allow all family channels without authentication
    // In a production app, you would validate the user's access to the family
    if (!channel_name.startsWith('family-')) {
      return res.status(403).json({ error: 'Access denied to channel' });
    }

    // Generate auth response for the channel
    const authResponse = pusher.authenticate(socket_id, channel_name);

    res.status(200).json(authResponse);

  } catch (error) {
    console.error('Pusher auth error:', error);
    res.status(500).json({ 
      error: error.message || 'Authentication failed' 
    });
  }
}




