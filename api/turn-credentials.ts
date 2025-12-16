// api/turn-credentials.ts
// Purpose: Generate temporary TURN credentials from Cloudflare RTC API
// This endpoint keeps TURN server credentials server-side and generates temporary credentials per request

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get Cloudflare TURN credentials from environment variables
  const TURN_KEY_ID = process.env.TURN_KEY_ID;
  const TURN_KEY_API_TOKEN = process.env.TURN_KEY_API_TOKEN;

  if (!TURN_KEY_ID || !TURN_KEY_API_TOKEN) {
    console.error('Missing TURN credentials in environment variables');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'TURN server credentials not configured'
    });
  }

  try {
    // Generate temporary TURN credentials from Cloudflare API
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TURN_KEY_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ttl: 86400 // 24 hours
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Cloudflare API error: ${response.status}`, errorText);
      throw new Error(`Cloudflare API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Return in format compatible with WebRTC
    // Cloudflare returns: { iceServers: { urls: [...], username: "...", credential: "..." } }
    return res.status(200).json({
      iceServers: {
        urls: [
          'stun:stun.cloudflare.com:3478',
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turn:turn.cloudflare.com:3478?transport=tcp',
          'turns:turn.cloudflare.com:5349?transport=tcp'
        ],
        username: data.iceServers.username,
        credential: data.iceServers.credential
      }
    });
  } catch (error) {
    console.error('Failed to generate TURN credentials:', error);
    return res.status(500).json({ 
      error: 'Failed to generate credentials',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

