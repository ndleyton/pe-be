import { config } from "@/app/config/env";

export const resolveApiAssetUrl = (url: string): string => {
  if (!url) {
    return url;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const base = /^https?:\/\//i.test(config.apiBaseUrl)
    ? config.apiBaseUrl
    : window.location.origin;

  return new URL(url, base).toString();
};
