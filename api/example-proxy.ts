// api/example-proxy.ts
// Purpose: Example proxy API route for external services that require secrets
// 
// This file demonstrates how to create a serverless function that:
// 1. Keeps API keys server-side (never exposed to frontend)
// 2. Proxies requests to external services
// 3. Returns sanitized responses
//
// To use this:
// 1. Copy this file to your Vercel project's api/ directory
// 2. Add your API key to Vercel Environment Variables
// 3. Call /api/example-proxy from your frontend

import type { APIRoute } from 'astro';

// This runs server-side only - secrets are safe here
const EXTERNAL_API_KEY = import.meta.env.EXTERNAL_API_KEY; // Set in Vercel env vars

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get data from frontend request
    const body = await request.json();
    
    // Validate input (never trust client data)
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Make request to external API with secret
    // The API key is never exposed to the frontend
    const response = await fetch('https://external-api.com/endpoint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXTERNAL_API_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Key': EXTERNAL_API_KEY, // If API uses different header
      },
      body: JSON.stringify({
        // Only send public data from frontend
        data: body.data,
        // Never forward sensitive data from frontend
      }),
    });
    
    if (!response.ok) {
      // Sanitize error before returning
      const errorText = await response.text();
      console.error('External API error:', {
        status: response.status,
        statusText: response.statusText,
        // Don't log full error - might contain sensitive info
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'External service error',
          status: response.status 
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const data = await response.json();
    
    // Sanitize response before sending to frontend
    // Remove any sensitive fields that shouldn't be exposed
    const sanitizedData = {
      // Only return safe, public data
      result: data.result,
      // Don't return: apiKey, token, secret, etc.
    };
    
    return new Response(
      JSON.stringify(sanitizedData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    // Log error server-side (safe to log here)
    console.error('Proxy API error:', error);
    
    // Return generic error to frontend (don't expose internal details)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Example GET endpoint
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const queryParam = url.searchParams.get('param');
  
  // Make external API call with secret
  const response = await fetch(`https://external-api.com/endpoint?param=${queryParam}`, {
    headers: {
      'Authorization': `Bearer ${EXTERNAL_API_KEY}`,
    },
  });
  
  const data = await response.json();
  
  return new Response(
    JSON.stringify(data),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

