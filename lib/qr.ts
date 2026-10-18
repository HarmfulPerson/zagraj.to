import QRCode from "qrcode";

/**
 * Renders `text` as a standalone SVG QR code (server side). The SVG scales to its container
 * (no fixed width/height) and is generated entirely by the library, so it is safe to inline.
 */
export async function renderQrSvg(text: string): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
  return svg.replace(/\s(width|height)="[^"]*"/g, "");
}
