export type OnboardingCookingTime = "under_10" | "10_15" | "15_30";
type Session = { access_token: string; user: { id: string } };
type BrowserAuth = {
  getSession(): PromiseLike<{ data: { session: Session | null }; error: unknown }>;
  getUser(token: string): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
};

export class OnboardingSessionChangedError extends Error {
  constructor() { super("Your sign-in changed. Please sign in again before saving these preferences."); }
}

/** Browser sessions live in local storage, so cookie-only route requests are insufficient. */
export async function saveOnboardingPreferences(
  auth: BrowserAuth,
  expectedUserId: string,
  cookingTime: OnboardingCookingTime,
  preferences: Record<string, unknown>,
  send: typeof fetch = fetch,
): Promise<Response> {
  const initial = await auth.getSession();
  const session = initial.data.session;
  if (initial.error || !session?.access_token || session.user.id !== expectedUserId) throw new OnboardingSessionChangedError();
  const verified = await auth.getUser(session.access_token);
  if (verified.error || verified.data.user?.id !== expectedUserId) throw new OnboardingSessionChangedError();
  const unchanged = async () => {
    const current = await auth.getSession();
    return !current.error && current.data.session?.access_token === session.access_token && current.data.session.user.id === expectedUserId;
  };
  if (!await unchanged()) throw new OnboardingSessionChangedError();
  const limits: Record<OnboardingCookingTime, number> = { under_10: 10, "10_15": 15, "15_30": 30 };
  const response = await send("/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...preferences, maxPrepMinutes: limits[cookingTime] }),
  });
  // A response for the previous account must not complete this account's onboarding.
  if (!await unchanged()) throw new OnboardingSessionChangedError();
  return response;
}
