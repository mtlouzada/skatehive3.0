"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Center,
  Flex,
  Icon,
  Image,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import type { Discussion } from "@hiveio/dhive";
import {
  FaHeart,
  FaRegHeart,
  FaRegComment,
  FaVideo,
  FaPlay,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { FiShare } from "react-icons/fi";
import useVideoPosts from "@/hooks/useVideoPosts";
import useHiveVote from "@/hooks/useHiveVote";
import { parsePayout } from "@/lib/utils/postUtils";
import {
  computePostMeta,
  extractVideoInfo,
  isDirectVideo,
} from "@/lib/videos/detect";

const APP_BASE = "https://skatehive.app";

// ─── Single full-screen item ──────────────────────────────
const VideoFeedItem = React.memo(function VideoFeedItem({
  post,
  index,
  isActive,
  muted,
  liked,
  voteCount,
  isVoting,
  onActive,
  onVote,
  onComment,
  onAuthor,
  onShare,
  onToggleMute,
}: {
  post: Discussion;
  index: number;
  isActive: boolean;
  muted: boolean;
  liked: boolean;
  voteCount: number;
  isVoting: boolean;
  onActive: (index: number) => void;
  onVote: (post: Discussion) => void;
  onComment: (post: Discussion) => void;
  onAuthor: (post: Discussion) => void;
  onShare: (post: Discussion) => void;
  onToggleMute: () => void;
}) {
  const info = useMemo(() => extractVideoInfo(post.body), [post.body]);
  const meta = useMemo(() => computePostMeta(post), [post]);
  const direct = isDirectVideo(info);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false); // iframe tap-to-play
  const payout = parsePayout(post.pending_payout_value);

  // Report visibility so the parent can mark the active (playing) item.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          onActive(index);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [index, onActive]);

  // Autoplay the active direct video; pause/reset the rest.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !direct) return;
    if (isActive) {
      v.play().catch(() => {});
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {}
      setActivated(false);
    }
  }, [isActive, direct]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  return (
    <Box
      ref={containerRef}
      position="relative"
      h="100%"
      w="100%"
      bg="black"
      overflow="hidden"
      sx={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {/* Media */}
      {direct ? (
        <Box
          as="video"
          ref={videoRef as any}
          src={info.embedUrl!}
          poster={meta.thumbnail}
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onClick={onToggleMute}
          position="absolute"
          inset={0}
          w="100%"
          h="100%"
          objectFit="cover"
        />
      ) : activated && isActive && info.embedUrl ? (
        <Box
          as="iframe"
          src={info.embedUrl}
          position="absolute"
          inset={0}
          w="100%"
          h="100%"
          border="0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <>
          <Image
            src={meta.thumbnail}
            alt={post.title || ""}
            position="absolute"
            inset={0}
            w="100%"
            h="100%"
            objectFit="cover"
            fallbackSrc="/ogimage.png"
          />
          {/* Tap-to-play for non-direct (YouTube/3Speak/Odysee) embeds */}
          <Center
            position="absolute"
            inset={0}
            onClick={() => setActivated(true)}
            cursor="pointer"
          >
            <Center
              w="64px"
              h="64px"
              borderRadius="full"
              bg="blackAlpha.600"
              border="2px solid"
              borderColor="whiteAlpha.800"
            >
              <Icon as={FaPlay} boxSize={6} color="white" ml="4px" />
            </Center>
          </Center>
        </>
      )}

      {/* Gradient scrims for legibility */}
      <Box
        position="absolute"
        inset={0}
        pointerEvents="none"
        bgGradient="linear(to-b, blackAlpha.500 0%, transparent 20%, transparent 55%, blackAlpha.700 100%)"
      />

      {/* Top: author */}
      <Flex
        position="absolute"
        top="calc(12px + env(safe-area-inset-top))"
        left={3}
        right={3}
        align="center"
        gap={2}
        zIndex={2}
        onClick={() => onAuthor(post)}
        cursor="pointer"
      >
        <Image
          src={`https://images.hive.blog/u/${meta.cleanAuthor}/avatar/small`}
          alt={meta.cleanAuthor}
          w="36px"
          h="36px"
          borderRadius="full"
          border="2px solid"
          borderColor="primary"
          fallbackSrc="/ogimage.png"
        />
        <Text
          color="white"
          fontWeight="700"
          fontSize="sm"
          textShadow="0 1px 3px rgba(0,0,0,0.8)"
        >
          @{meta.cleanAuthor}
        </Text>
      </Flex>

      {/* Bottom-left: title */}
      {post.title ? (
        <Box
          position="absolute"
          bottom="120px"
          left={3}
          right="88px"
          zIndex={2}
        >
          <Text
            color="white"
            fontSize="sm"
            fontWeight="600"
            noOfLines={2}
            textShadow="0 1px 3px rgba(0,0,0,0.8)"
          >
            {post.title}
          </Text>
        </Box>
      ) : null}

      {/* Right action rail */}
      <VStack
        position="absolute"
        right={3}
        bottom="150px"
        spacing={5}
        zIndex={2}
      >
        <RailButton
          icon={liked ? FaHeart : FaRegHeart}
          color={liked ? "primary" : "white"}
          label={voteCount > 0 ? String(voteCount) : undefined}
          loading={isVoting}
          onClick={() => onVote(post)}
        />
        <RailButton
          icon={FaRegComment}
          color="white"
          label={post.children > 0 ? String(post.children) : undefined}
          onClick={() => onComment(post)}
        />
        <RailButton icon={FiShare} color="white" onClick={() => onShare(post)} />
        {payout > 0 && (
          <VStack spacing={0}>
            <Text
              color="primary"
              fontWeight="800"
              fontSize="md"
              textShadow="0 1px 3px rgba(0,0,0,0.9)"
            >
              ${payout.toFixed(2)}
            </Text>
          </VStack>
        )}
        {direct && (
          <RailButton
            icon={muted ? FaVolumeMute : FaVolumeUp}
            color="white"
            small
            onClick={onToggleMute}
          />
        )}
      </VStack>
    </Box>
  );
});

function RailButton({
  icon,
  color,
  label,
  loading,
  small,
  onClick,
}: {
  icon: any;
  color: string;
  label?: string;
  loading?: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <VStack
      as="button"
      spacing={1}
      onClick={onClick}
      aria-label={label ? undefined : "action"}
      _active={{ transform: "scale(0.88)" }}
      transition="transform 0.12s ease"
    >
      {loading ? (
        <Spinner size="sm" color="primary" />
      ) : (
        <Icon
          as={icon}
          boxSize={small ? 6 : 7}
          color={color}
          filter="drop-shadow(0 1px 3px rgba(0,0,0,0.8))"
        />
      )}
      {label && (
        <Text color="white" fontSize="xs" fontWeight="600" textShadow="0 1px 3px rgba(0,0,0,0.8)">
          {label}
        </Text>
      )}
    </VStack>
  );
}

// ─── Feed ─────────────────────────────────────────────────
export default function MobileVideoFeed() {
  const { posts, isLoading, isLoadingMore, hasMore, loadMore } = useVideoPosts();
  const { vote, effectiveUser, canVote } = useHiveVote();
  const toast = useToast();
  const router = useRouter();

  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likedStates, setLikedStates] = useState<Record<string, boolean>>({});
  const [voteCountStates, setVoteCountStates] = useState<Record<string, number>>({});
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({});
  const votingLockRef = useRef<Record<string, boolean>>({});

  const keyOf = (p: Discussion) => `${p.author}/${p.permlink}`;

  // Seed liked/count state as posts arrive (preserving any optimistic values).
  useEffect(() => {
    if (posts.length === 0) return;
    setLikedStates((prev) => {
      const next = { ...prev };
      posts.forEach((p) => {
        const key = keyOf(p);
        if (!(key in next)) {
          next[key] = !!(
            effectiveUser &&
            p.active_votes?.some(
              (v) => v.voter === effectiveUser && v.percent > 0,
            )
          );
        }
      });
      return next;
    });
    setVoteCountStates((prev) => {
      const next = { ...prev };
      posts.forEach((p) => {
        const key = keyOf(p);
        if (!(key in next)) next[key] = p.active_votes?.length || 0;
      });
      return next;
    });
  }, [posts, effectiveUser]);

  // Prefetch more when the active item nears the end.
  useEffect(() => {
    if (activeIndex >= posts.length - 3 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [activeIndex, posts.length, hasMore, isLoadingMore, loadMore]);

  const handleActive = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleVote = useCallback(
    async (post: Discussion) => {
      const key = keyOf(post);
      if (!canVote) {
        toast({ title: "Please login first", status: "warning", duration: 2500 });
        return;
      }
      if (votingLockRef.current[key]) return;
      votingLockRef.current[key] = true;

      const wasLiked = likedStates[key];
      const prevCount = voteCountStates[key] ?? (post.active_votes?.length || 0);

      setVotingStates((p) => ({ ...p, [key]: true }));
      setLikedStates((p) => ({ ...p, [key]: !wasLiked }));
      setVoteCountStates((p) => ({
        ...p,
        [key]: wasLiked ? Math.max(prevCount - 1, 0) : prevCount + 1,
      }));

      try {
        await vote(post.author, post.permlink, wasLiked ? 0 : 10000);
        toast({
          title: wasLiked ? "Vote removed" : "Voted!",
          status: "success",
          duration: 1800,
        });
      } catch (error) {
        setLikedStates((p) => ({ ...p, [key]: wasLiked }));
        setVoteCountStates((p) => ({ ...p, [key]: prevCount }));
        toast({
          title: error instanceof Error ? error.message : "Failed to vote",
          status: "error",
          duration: 3000,
        });
      } finally {
        votingLockRef.current[key] = false;
        setVotingStates((p) => ({ ...p, [key]: false }));
      }
    },
    [canVote, likedStates, voteCountStates, vote, toast],
  );

  const handleComment = useCallback(
    (post: Discussion) => {
      const author = post.author.startsWith("@")
        ? post.author.slice(1)
        : post.author;
      router.push(`/post/${author}/${post.permlink}`);
    },
    [router],
  );

  // Tapping the author header opens their profile (mirrors the native app,
  // where only the comment button opens the conversation/post).
  const handleAuthor = useCallback(
    (post: Discussion) => {
      const author = post.author.startsWith("@")
        ? post.author.slice(1)
        : post.author;
      router.push(`/user/${author}`);
    },
    [router],
  );

  const handleShare = useCallback(async (post: Discussion) => {
    const author = post.author.startsWith("@")
      ? post.author.slice(1)
      : post.author;
    const url = `${APP_BASE}/post/${author}/${post.permlink}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: post.title || "Skatehive video",
          url,
        });
      } else if (navigator?.clipboard) {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", status: "success", duration: 1800 });
      }
    } catch {
      /* user cancelled share */
    }
  }, [toast]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  if (isLoading) {
    return (
      <Center h="100%" bg="black">
        <Spinner size="lg" color="primary" />
      </Center>
    );
  }

  if (posts.length === 0) {
    return (
      <Center h="100%" bg="black">
        <VStack spacing={3}>
          <Icon as={FaVideo} boxSize={10} color="gray.600" />
          <Text color="gray.400" fontSize="sm">
            no skate videos found yet
          </Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box
      h="100%"
      w="100%"
      overflowY="scroll"
      bg="black"
      sx={{
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {posts.map((post, i) => {
        const key = keyOf(post);
        return (
          <VideoFeedItem
            key={key}
            post={post}
            index={i}
            isActive={i === activeIndex}
            muted={muted}
            liked={!!likedStates[key]}
            voteCount={voteCountStates[key] ?? (post.active_votes?.length || 0)}
            isVoting={!!votingStates[key]}
            onActive={handleActive}
            onVote={handleVote}
            onComment={handleComment}
            onAuthor={handleAuthor}
            onShare={handleShare}
            onToggleMute={toggleMute}
          />
        );
      })}
      {isLoadingMore && (
        <Center py={6} bg="black">
          <Spinner size="md" color="primary" />
        </Center>
      )}
    </Box>
  );
}
