"use client";

import { useEffect } from "react";

/** Error boundaries log the error for the browser console (in production only a digest reaches the client). */
export function useLogError(error: unknown) {
  useEffect(() => {
    console.error(error);
  }, [error]);
}

export type ErrorBoundaryProps = { error: unknown; retry: () => void };
