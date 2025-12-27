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
    description: "Vote on how happy you feel and contribute to making the world a better place through blockchain voting on Monad and Base networks",
    openGraph: {
      title: "Happy World Vote",
      description: "Vote on how happy you feel and contribute to making the world a better place through blockchain voting on Monad and Base networks",
      siteName: "Happy World Vote",
      url: APP_URL,
      images: [
        {
          url: `${APP_URL}/images/feed.png`,
          width: 1200,
          height: 630,
          alt: "Happy World Vote",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Happy World Vote",
      description: "Vote on how happy you feel and contribute to making the world a better place through blockchain voting on Monad and Base networks",
      images: [`${APP_URL}/images/feed.png`],
    },
    other: {
      "fc:miniapp": JSON.stringify(frame),
    },
  };
}

export default function Home() {
  return <App />;
}
