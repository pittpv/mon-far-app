import { NextResponse } from "next/server";
import { APP_URL } from "../../../lib/constants";

export async function GET() {
  const farcasterConfig = {
    accountAssociation: {
      header:
        "eyJmaWQiOjg4ODIzNCwidHlwZSI6ImF1dGgiLCJrZXkiOiIweEFBNTA4REZEZEExNjZFYTM0RkFCNTFiNjI1NUZCM2M3Q2QzQWNkMjcifQ",
      payload:
        "eyJkb21haW4iOiJmYXJjYXN0ZXIuaGFwcHl2b3RlLnh5eiJ9",
      signature:
        "CzsPG8zV02a5c89HfFQ0FlRL3KH2NZZZvqGRlGYtoFZyTvxA4uC7yMISaE7tUeK1rejRIcmCq/KSOQ2k3VYY9Rs=",
    },
    frame: {
      version: "1",
      name: "Happy World Vote",
      iconUrl: `${APP_URL}/images/icon.png`,
      homeUrl: `${APP_URL}`,
      imageUrl: `${APP_URL}/images/feed.png`,
      screenshotUrls: [],
      tags: [
        "vote",
        "mood",
        "monad",
        "base",
        "miniapp",
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
