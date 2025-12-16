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
    // Correct endpoint: /credentials/generate-ice-servers
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${TURN_KEY_ID}/credentials/generate-ice-servers`,
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
    
    // Cloudflare returns: { iceServers: [{ urls: [...], username: "...", credential: "..." }] }
    // Return directly - the response format is already WebRTC-compatible
    return res.status(200).json(data);
  } catch (error) {
    console.error('Failed to generate TURN credentials:', error);
    return res.status(500).json({ 
      error: 'Failed to generate credentials',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

