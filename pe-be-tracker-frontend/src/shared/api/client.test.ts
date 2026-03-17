import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";

import { applyDefaultRequestHeaders } from "@/shared/api/client";

describe("applyDefaultRequestHeaders", () => {
  it("removes JSON content type for FormData uploads", () => {
    const request = {
      data: new FormData(),
      headers: new AxiosHeaders({
        "Content-Type": "application/json",
      }),
    } as InternalAxiosRequestConfig;

    const result = applyDefaultRequestHeaders(request);

    expect(result.headers.has("Content-Type")).toBe(false);
  });

  it("defaults non-FormData requests to application/json", () => {
    const request = {
      data: { message: "hello" },
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig;

    const result = applyDefaultRequestHeaders(request);

    expect(result.headers.get("Content-Type")).toBe("application/json");
  });

  it("preserves explicit content type for non-FormData requests", () => {
    const request = {
      data: { message: "hello" },
      headers: new AxiosHeaders({
        "Content-Type": "text/plain",
      }),
    } as InternalAxiosRequestConfig;

    const result = applyDefaultRequestHeaders(request);

    expect(result.headers.get("Content-Type")).toBe("text/plain");
  });
});
