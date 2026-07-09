"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Discussion } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { filterAutoComments } from "@/lib/utils/postUtils";
import { hasVideoContent } from "@/lib/videos/detect";

const COMMUNITY_TAG = "hive-173115";
const POSTS_PER_PAGE = 20;
const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 8;

// Loads community posts that contain video, paginated via the Hive bridge.
// Shared building block for the mobile vertical feed (the desktop cinema
// view keeps its own inline loader for now).
export default function useVideoPosts() {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<{ author?: string; permlink?: string }>({});
  const loadingRef = useRef(false);

  const loadPosts = useCallback(async (initial = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (initial) setIsLoading(true);
    else setIsLoadingMore(true);
    try {
      const collected: Discussion[] = [];
      let { author: cursorAuthor, permlink: cursorPermlink } = initial
        ? {}
        : cursorRef.current;
      for (
        let attempt = 0;
        attempt < MAX_ATTEMPTS && collected.length < POSTS_PER_PAGE;
        attempt++
      ) {
        const result = await HiveClient.call("bridge", "get_ranked_posts", {
          sort: "created",
          tag: COMMUNITY_TAG,
          limit: BATCH_SIZE,
          start_author: cursorAuthor,
          start_permlink: cursorPermlink,
        });
        if (!result || result.length === 0) {
          setHasMore(false);
          break;
        }
        const fresh = (cursorAuthor ? result.slice(1) : result) as Discussion[];
        if (fresh.length === 0) {
          setHasMore(false);
          break;
        }
        const cleaned = filterAutoComments(fresh) as Discussion[];
        collected.push(
          ...cleaned.filter((p: Discussion) => hasVideoContent(p.body)),
        );
        const last = result[result.length - 1];
        cursorAuthor = last.author;
        cursorPermlink = last.permlink;
        if (result.length < BATCH_SIZE) {
          setHasMore(false);
          break;
        }
      }
      if (collected.length > 0) {
        const toAdd = collected.slice(0, POSTS_PER_PAGE);
        setPosts((prev) => {
          const next = initial ? toAdd : [...prev, ...toAdd];
          const seen = new Set<string>();
          return next.filter((p) => {
            const key = `${p.author}/${p.permlink}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        const lastAdded = toAdd[toAdd.length - 1];
        cursorRef.current = {
          author: lastAdded.author,
          permlink: lastAdded.permlink,
        };
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading video posts:", error);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPosts(true);
  }, [loadPosts]);

  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore) loadPosts(false);
  }, [hasMore, loadPosts]);

  return { posts, isLoading, isLoadingMore, hasMore, loadMore };
}
