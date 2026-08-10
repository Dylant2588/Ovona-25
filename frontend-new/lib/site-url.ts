const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getSiteUrl = () => {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL;

  if (configured) {
    const withProtocol = configured.startsWith("http")
      ? configured
      : `https://${configured}`;
    return withoutTrailingSlash(withProtocol);
  }

  if (typeof window !== "undefined") {
    return withoutTrailingSlash(window.location.origin);
  }

  return "http://localhost:3000";
};
