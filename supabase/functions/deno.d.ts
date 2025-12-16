// Deno type definitions for Supabase Edge Functions
// This file provides type definitions for Deno runtime used in Supabase Edge Functions

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Allow URL imports for Deno modules
declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string, options?: any): any;
}

declare module "https://esm.sh/stripe@14.21.0?target=deno" {
  const stripe: any;
  export default stripe;
}

