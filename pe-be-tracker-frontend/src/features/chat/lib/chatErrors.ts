export const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "detail" in error.response.data
  ) {
    const { detail } = error.response.data;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "msg" in item &&
            typeof item.msg === "string"
          ) {
            return item.msg;
          }
          return null;
        })
        .find((value): value is string => Boolean(value));

      if (message) {
        return message;
      }
    }
  }

  return fallback;
};
