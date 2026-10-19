import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CONNECTION_LOST_MESSAGE, ConnectionBanner } from "@/components/ConnectionBanner";

describe("ConnectionBanner", () => {
  it("says, in Polish, that the connection is lost and it keeps retrying", () => {
    expect(CONNECTION_LOST_MESSAGE).toMatch(/^Brak połączenia, próbuję ponownie/);
    const html = renderToStaticMarkup(<ConnectionBanner show />);
    expect(html).toContain(CONNECTION_LOST_MESSAGE);
    expect(html).toContain('data-testid="connection-banner"');
  });

  it("keeps an empty polite live region when the connection is fine, so the message is announced when it appears", () => {
    for (const variant of ["toast", "inline"] as const) {
      const html = renderToStaticMarkup(<ConnectionBanner show={false} variant={variant} />);
      expect(html).toMatch(/^<span role="status" aria-live="polite"[^>]*><\/span>$/);
    }
  });

  it("hides the spinner from screen readers", () => {
    const html = renderToStaticMarkup(<ConnectionBanner show variant="inline" />);
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*animate-spin/);
  });
});
