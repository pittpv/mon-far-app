import { Metadata } from "next";
import App from "@/components/pages/app";
import { APP_URL } from "@/lib/constants";

const frame = {
  version: "1",
  imageUrl: `${APP_URL}/images/feed.png`,
  button: {
    title: "Vote Now",
    action: {
      type: "launch_frame",
      name: "Happy World Vote",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#facc9b",
    },
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Happy World Vote",
    openGraph: {
      title: "Happy World Vote App for Farcaster",
      description: "Happy World App - just vote",
    },
    other: {
      "fc:miniapp": JSON.stringify(frame),
    },
  };
}

export default function Home() {
  return <App />;
}
