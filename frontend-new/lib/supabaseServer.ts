import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export const supabaseServer = async () => {
  // Next.js 16 made the request cookie store asynchronous. The Supabase
  // helper still expects a synchronous cookie accessor, so resolve it once
  // at the route boundary and return that store to the helper.
  const cookieStore = await cookies();
  return createRouteHandlerClient({
    // auth-helpers-nextjs currently types this callback as the Next 16
    // async API, but reads its result synchronously. The resolved store is
    // therefore deliberately exposed as the legacy synchronous shape.
    cookies: (() => cookieStore) as unknown as typeof cookies,
  });
};
