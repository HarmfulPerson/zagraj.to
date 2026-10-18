import { describe, expect, it } from "vitest";

import { APP_NAME } from "@/lib/app";

describe("app constants", () => {
  it("exposes the app name", () => {
    expect(APP_NAME).toBe("ZagrajTo");
  });
});
