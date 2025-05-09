import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
      header:
        "eyJmaWQiOjg4ODIzNCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweEM4MTM3MDM5QkNCYzQ0OUQ2NDJFRDA4ZDFmNEI0MDJCNTc2QTY1MjUifQ",
      payload:
        "eyJkb21haW4iOiJtb24tZmFyLWFwcC52ZXJjZWwuYXBwIn0",
      signature:
        "MHg3ZDdhNjk1MDNjN2NkMzE3NzZmMjRhOGM4ZjYyMzQ1MTAwMGRjNGQzZTQzY2Y4NjBlNzI5MWUyMzRjOWM0NDU2NTM1ZjJhNzdjYmY0NjZhYzFlZWVjYjdiODNmNjkyOWYxYTFlNDI5ZTQ3ZTUxYzA5ZGE0NTljZjEyNTBkNTMwNzFj",
    },
    frame: {
      version: "1",
      name: "Monad Farcaster Happy Vote",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: [
        "farcaster",
        "miniapp",
        "vote",
        "mood",
        "monad",
      ],
      primaryCategory: "social",
      buttonTitle: "Vote Now",
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#facc9b",
      webhookUrl: `${APP_URL}/api/webhook`,
    },
  };

  return NextResponse.json(farcasterConfig);
}
