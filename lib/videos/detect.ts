import type { Discussion } from "@hiveio/dhive";
import type { IconType } from "react-icons";
import {
  FaYoutube,
  FaVideo,
} from "react-icons/fa";
import { SiIpfs, SiOdysee } from "react-icons/si";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";

// Shared video detection/extraction for the /videos experiences (desktop
// cinema view + mobile vertical feed). Kept framework-agnostic so both
// entry points stay in sync.

export type VideoPlatform = "youtube" | "3speak" | "ipfs" | "odysee" | "other";

export interface VideoInfo {
  platform: VideoPlatform;
  embedUrl: string | null;
}

export interface PlatformConfig {
  label: string;
  color: string;
  icon: IconType;
}

export interface PostMeta {
  platform: VideoPlatform;
  thumbnail: string;
  cleanAuthor: string;
}

const VIDEO_PATTERNS: {
  platform: VideoPlatform;
  test: RegExp;
  extract?: RegExp;
}[] = [
  {
    platform: "youtube",
    test: /(?:youtu\.be|youtube(?:-nocookie)?\.com)/i,
    extract:
      /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^\s"'<>]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  },
  {
    platform: "3speak",
    test: /3speak\.tv/i,
    extract: /3speak\.tv\/watch\?v=([a-zA-Z0-9._-]+\/[a-zA-Z0-9_-]+)/,
  },
  {
    platform: "odysee",
    test: /odysee\.com/i,
    extract: /https?:\/\/odysee\.com\/([^\s"'<>]+)/,
  },
  {
    platform: "ipfs",
    test: /<iframe[^>]*src=["'][^"']*ipfs/i,
    extract: /<iframe[^>]*src=["'](https?:\/\/[^"']*ipfs[^"']*)/i,
  },
  {
    platform: "ipfs",
    test: /https?:\/\/[^\s"'<>]+\.(mp4|webm|mov|avi)(\?[^\s"'<>]*)?/i,
    extract: /(https?:\/\/[^\s"'<>]+\.(mp4|webm|mov)(\?[^\s"'<>]*)?)/i,
  },
  {
    platform: "other",
    test: /<iframe[^>]*src=["']https?:\/\/(www\.)?(youtube|3speak|odysee|rumble)/i,
  },
  { platform: "other", test: /<video[\s>]/i },
];

export function detectPlatform(body: string): VideoPlatform {
  if (!body) return "other";
  for (const p of VIDEO_PATTERNS) {
    if (p.test.test(body)) return p.platform;
  }
  return "other";
}

export function hasVideoContent(body: string): boolean {
  return !!body && VIDEO_PATTERNS.some((p) => p.test.test(body));
}

export function extractVideoInfo(body: string): VideoInfo {
  if (!body) return { platform: "other", embedUrl: null };
  for (const pattern of VIDEO_PATTERNS) {
    if (!pattern.extract || !pattern.test.test(body)) continue;
    const match = body.match(pattern.extract);
    if (!match) continue;
    switch (pattern.platform) {
      case "youtube":
        return {
          platform: "youtube",
          embedUrl: `https://www.youtube.com/embed/${match[1]}?autoplay=1`,
        };
      case "3speak":
        return {
          platform: "3speak",
          embedUrl: `https://play.3speak.tv/watch?v=${match[1]}&mode=iframe&layout=desktop`,
        };
      case "odysee": {
        const url = `https://odysee.com/${match[1]}`;
        return {
          platform: "odysee",
          embedUrl: url.includes("/$/embed/")
            ? url
            : url.replace("odysee.com/", "odysee.com/$/embed/"),
        };
      }
      case "ipfs":
        return { platform: "ipfs", embedUrl: match[1] || match[0] };
    }
  }
  return { platform: "other", embedUrl: null };
}

export function getYouTubeThumbnail(body: string): string | null {
  const match = body.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^\s"'<>]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export function computePostMeta(post: Discussion): PostMeta {
  const platform = detectPlatform(post.body);
  const ytThumb =
    platform === "youtube" ? getYouTubeThumbnail(post.body) : null;
  const images = extractImageUrls(post.body);
  return {
    platform,
    thumbnail: ytThumb || images[0] || "/ogimage.png",
    cleanAuthor: post.author.startsWith("@")
      ? post.author.slice(1)
      : post.author,
  };
}

/** True when the video can be played inline with a native <video> element. */
export function isDirectVideo(info: VideoInfo): boolean {
  return (
    !!info.embedUrl &&
    (info.platform === "ipfs" || /\.(mp4|webm|mov)(\?|$)/i.test(info.embedUrl))
  );
}

export const PLATFORM_CONFIG: Record<VideoPlatform, PlatformConfig> = {
  youtube: { label: "YouTube", color: "red.500", icon: FaYoutube },
  "3speak": { label: "3Speak", color: "purple.400", icon: FaVideo },
  odysee: { label: "Odysee", color: "pink.400", icon: SiOdysee },
  ipfs: { label: "IPFS", color: "cyan.400", icon: SiIpfs },
  other: { label: "Video", color: "primary", icon: FaVideo },
};
