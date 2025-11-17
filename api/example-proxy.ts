// api/example-proxy.ts
// Purpose: Example proxy API route for external services that require secrets
// 
// NOTE: This is a template for Supabase Edge Functions or another backend service.
// Vite (used in this project) does NOT support server-side API routes.
// 
// For server-side proxying, you have two options:
// 1. Use Supabase Edge Functions (recommended for this project)
//    - Create a function in supabase/functions/example-proxy/
//    - Use Deno.serve() handler
//    - Access secrets via Deno.env.get()
// 2. Use a separate backend service (NestJS, Express, etc.)
//
// This file demonstrates the structure/pattern for a proxy API that:
// 1. Keeps API keys server-side (never exposed to frontend)
// 2. Proxies requests to external services
// 3. Returns sanitized responses

// Example: Supabase Edge Function structure
// Place this in: supabase/functions/example-proxy/index.ts
//
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
//
// serve(async (req) => {
//   const EXTERNAL_API_KEY = Deno.env.get('EXTERNAL_API_KEY');
//   
//   if (req.method === 'POST') {
//     try {
//       const body = await req.json();
//       
//       // Validate input (never trust client data)
//       if (!body || typeof body !== 'object') {
//         return new Response(
//           JSON.stringify({ error: 'Invalid request body' }),
//           { status: 400, headers: { 'Content-Type': 'application/json' } }
//         );
//       }
//       
//       // Make request to external API with secret
//       const response = await fetch('https://external-api.com/endpoint', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${EXTERNAL_API_KEY}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ data: body.data }),
//       });
//       
//       if (!response.ok) {
//         return new Response(
//           JSON.stringify({ error: 'External service error', status: response.status }),
//           { status: response.status, headers: { 'Content-Type': 'application/json' } }
//         );
//       }
//       
//       const data = await response.json();
//       const sanitizedData = { result: data.result };
//       
//       return new Response(
//         JSON.stringify(sanitizedData),
//         { status: 200, headers: { 'Content-Type': 'application/json' } }
//       );
//     } catch (error) {
//       console.error('Proxy API error:', error);
//       return new Response(
//         JSON.stringify({ error: 'Internal server error' }),
//         { status: 500, headers: { 'Content-Type': 'application/json' } }
//       );
//     }
//   }
//   
//   return new Response('Method not allowed', { status: 405 });
// });

// Example: Client-side call to Supabase Edge Function
// In your React component:
//
// const response = await supabase.functions.invoke('example-proxy', {
//   body: { data: 'your-data' }
// });

