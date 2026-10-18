import { renderQrSvg } from "@/lib/qr";

type Props = { value: string; label: string; className?: string; testId?: string };

/** Server-rendered SVG QR code that scales to the width of its container. */
export async function QrCode({ value, label, className = "", testId }: Props) {
  const svg = await renderQrSvg(value);
  return (
    <div
      role="img"
      aria-label={label}
      data-testid={testId}
      data-qr-value={value}
      className={`[&>svg]:block [&>svg]:h-auto [&>svg]:w-full ${className}`}
      // The markup comes from the qrcode library, never from user input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
