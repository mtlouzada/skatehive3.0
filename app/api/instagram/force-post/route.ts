import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isInstagramConfigured } from "@/lib/instagram/graph";
import { buildInstagramCaption } from "@/lib/instagram/caption";
import { resolveIgHandleForCaption } from "@/lib/instagram/resolveIgHandle";
import { isServerSideAdmin, logSecurityAttempt } from "@/lib/server/adminUtils";
import {
  resolveSessionUserId,
  verifyHivePostingSignature,
} from "@/lib/instagram/requesterAuth";
import {
  enqueueCrossPost,
  findActiveQueueItem,
  type InstagramQueuePayload,
} from "@/lib/crosspost/queue";
import { notifyCrossPostQueued } from "@/lib/notifications/appNotifications";

/**
 * POST /api/instagram/force-post
 *
 * Moderator submission for Instagram cross-posting. Unlike /api/instagram/post
 * (where the requester IS the author and must clear the HP gate + per-user
 * cap), this route lets an allowlisted SkateHive admin put ANY snap in front of
 * the curation team — used to surface good content from authors who don't yet
 * meet the self-serve criteria.
 *
 * It used to publish straight to Meta, which made it a second door onto the
 * shared @skatehive account: a snap sent this way never appeared in the
 * portal's queue and no curator ever saw it. Everything that reaches that
 * account now goes through the same review, so this route enqueues like any
 * other request. The name is kept because the override it grants is real —
 * it skips the author gates, not the review.
 *
 * The authenticated requester is the MODERATOR; `hive_author`/`hive_permlink`
 * are the TARGET snap. The queue row is filed under the AUTHOR (so the outcome
 * notification reaches them, not the moderator) with the moderator recorded in
 * `requested_by_handle` and `payload.forced_by`.
 *
 * Body:
 *   - hive_author / hive_permlink : the target snap (required)
 *   - title? / body              : caption source
 *   - tags?                      : extra hashtags
 *   - image_url? / video_url?    : publicly hosted media (≥1 required)
 *   - media_items?               : ordered carousel items (2+ → CAROUSEL)
 *   - permalink_url              : skatehive.app URL (required)
 *   - requester?, hive_signature?, hive_public_key?, signed_at? : Keychain
 *       moderator auth (only needed when there's no userbase session cookie)
 *   - preview?: boolean          : if true, skip dedupe/DB and just return the
 *       rendered caption + media for client-side preview UI. Cookie auth still
 *       required, but no Hive signature is requested (the moderator only signs
 *       at confirm time, so a leaked signature can't be replayed after the
 *       5-min window).
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const MAX_SIG_AGE_MS = 5 * 60 * 1000;

/** Exact message a Keychain moderator must sign — bound to moderator + target
 *  so a leaked signature can't be replayed for a different snap or by someone
 *  else. */
function buildForceAuthMessage(args: {
  moderator: string;
  hiveAuthor: string;
  hivePermlink: string;
  issuedAt: string;
}): string {
  return [
    "Skatehive: FORCE cross-post snap to @skatehive on Instagram.",
    `Moderator: @${args.moderator}`,
    `Target: @${args.hiveAuthor}/${args.hivePermlink}`,
    `Issued at: ${args.issuedAt}`,
  ].join("\n");
}

async function linkedHiveHandle(userId: string): Promise<string | null> {
  const { data } = await supabase!
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "hive")
    .limit(1);
  return (data?.[0]?.handle as string | undefined) ?? null;
}

async function userIdForHiveHandle(handle: string): Promise<string | null> {
  const { data } = await supabase!
    .from("userbase_identities")
    .select("user_id")
    .eq("type", "hive")
    .eq("handle", handle)
    .limit(1);
  return (data?.[0]?.user_id as string | undefined) ?? null;
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }
  if (!isInstagramConfigured()) {
    return NextResponse.json(
      { error: "Instagram cross-posting is not configured on the server." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hiveAuthor = typeof body?.hive_author === "string" ? body.hive_author.trim() : "";
  const hivePermlink = typeof body?.hive_permlink === "string" ? body.hive_permlink.trim() : "";
  const isPreview = body?.preview === true;

  // --- Resolve + authorize the MODERATOR (the requester), independent of the
  // snap's author. Prefer the userbase session cookie; fall back to a fresh
  // Hive posting-key signature for Keychain-only moderators.
  //
  // Preview path: signature auth isn't required (the signed force-post
  // message is bound to issued_at + 5-min replay window — we only want it
  // at confirm time, not when the preview modal opens). For Keychain-only
  // moderators in preview mode we accept just the `requester` handle and
  // re-verify allowlist below. ---
  let moderatorHandle: string | null = null;
  let moderatorUserId: string | null = null;

  const sessionUserId = await resolveSessionUserId(request, supabase);
  if (sessionUserId) {
    moderatorUserId = sessionUserId;
    moderatorHandle = await linkedHiveHandle(sessionUserId);
  } else if (isPreview) {
    const requester = typeof body?.requester === "string" ? body.requester.trim() : "";
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    moderatorHandle = requester;
    moderatorUserId = await userIdForHiveHandle(requester);
  } else {
    const requester = typeof body?.requester === "string" ? body.requester.trim() : "";
    const sig = typeof body?.hive_signature === "string" ? body.hive_signature : "";
    const pubKey = typeof body?.hive_public_key === "string" ? body.hive_public_key : "";
    const issuedAt = typeof body?.signed_at === "string" ? body.signed_at : "";

    if (!requester || !sig || !pubKey || !issuedAt || !hiveAuthor || !hivePermlink) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const issuedTs = Date.parse(issuedAt);
    if (!Number.isFinite(issuedTs) || Math.abs(Date.now() - issuedTs) > MAX_SIG_AGE_MS) {
      return NextResponse.json({ error: "Signature too old; re-sign and retry." }, { status: 401 });
    }

    const message = buildForceAuthMessage({ moderator: requester, hiveAuthor, hivePermlink, issuedAt });
    const verify = await verifyHivePostingSignature({
      message,
      signature: sig,
      publicKey: pubKey,
      hiveAccount: requester,
    });
    if (!verify.ok) {
      return NextResponse.json({ error: verify.error }, { status: verify.status });
    }
    moderatorHandle = requester;
    moderatorUserId = await userIdForHiveHandle(requester); // may be null (Keychain-only)
  }

  // --- Allowlist gate (server-authoritative — the menu visibility is cosmetic). ---
  if (!moderatorHandle || !isServerSideAdmin(moderatorHandle)) {
    logSecurityAttempt(moderatorHandle ?? undefined, "instagram force-post", request, false);
    return NextResponse.json(
      { error: "Access Denied: moderator privileges required." },
      { status: 403 }
    );
  }
  logSecurityAttempt(moderatorHandle, "instagram force-post", request, true);

  // --- Validate the target content. ---
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const markdown = typeof body?.body === "string" ? body.body : "";
  const permalinkUrl = typeof body?.permalink_url === "string" ? body.permalink_url.trim() : "";
  const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
  const videoUrl = typeof body?.video_url === "string" ? body.video_url.trim() : "";
  const tags: string[] = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string")
    : [];

  // Optional carousel: an ordered list of {type, url}. 2+ items → CAROUSEL.
  const mediaItems: { type: "image" | "video"; url: string }[] = Array.isArray(body?.media_items)
    ? body.media_items
        .filter(
          (it: any) =>
            it && typeof it.url === "string" && (it.type === "image" || it.type === "video")
        )
        .map((it: any) => ({ type: it.type as "image" | "video", url: it.url.trim() }))
        .slice(0, 10)
    : [];
  const isCarousel = mediaItems.length >= 2;

  if (!hiveAuthor || !hivePermlink || !permalinkUrl) {
    return NextResponse.json(
      { error: "Missing required fields (hive_author, hive_permlink, permalink_url)." },
      { status: 400 }
    );
  }
  if (!imageUrl && !videoUrl && !isCarousel) {
    return NextResponse.json(
      { error: "Force cross-post requires an image_url, video_url, or media_items." },
      { status: 400 }
    );
  }
  for (const url of [imageUrl, videoUrl, ...mediaItems.map((m) => m.url)].filter(Boolean)) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ error: `Unsupported media URL: ${url}` }, { status: 400 });
    }
  }

  // --- Already live on Instagram → nothing to review. Preview requests skip
  // this so they still reach the preview branch, which surfaces the state as a
  // non-blocking warning instead. ---
  const { data: existingRows } = await supabase
    .from("userbase_instagram_posts")
    .select("id, status, ig_media_id, ig_permalink")
    .eq("hive_author", hiveAuthor)
    .eq("hive_permlink", hivePermlink)
    .eq("status", "published")
    .limit(1);
  const existing = existingRows?.[0];
  if (!isPreview && existing) {
    return NextResponse.json(
      {
        success: true,
        deduped: true,
        ig_media_id: existing.ig_media_id,
        ig_permalink: existing.ig_permalink,
      },
      { status: 200 }
    );
  }

  // --- Caption credits the ORIGINAL author (not the moderator). ---
  // A user-edited override from the review dialog wins; otherwise build the
  // default server-side. Preview requests never send an override, so the
  // dialog always pre-fills with the freshly built default.
  const authorUserId = await userIdForHiveHandle(hiveAuthor);
  const igHandle = await resolveIgHandleForCaption({ hiveAuthor, userId: authorUserId, supabase });
  const captionOverride = typeof body?.caption === "string" ? body.caption.trim() : "";
  const caption = captionOverride
    ? captionOverride.slice(0, 2200)
    : buildInstagramCaption({
        title,
        body: markdown,
        hiveAuthor,
        permalinkUrl,
        extraTags: tags,
        igHandle,
      });

  const mediaType: "IMAGE" | "REELS" | "CAROUSEL" = isCarousel
    ? "CAROUSEL"
    : videoUrl
    ? "REELS"
    : "IMAGE";

  // --- Preview path: return everything the client needs to render the
  // dialog (caption text built server-side so the user sees EXACTLY what
  // Meta will receive, plus the resolved IG handle and media URLs). No
  // Meta calls, no row inserts, no dedupe. ---
  if (isPreview) {
    // Surface a non-blocking "already published" warning so the preview
    // can show "this snap is already on @skatehive". We don't 200 here
    // because the moderator may want to see what the second attempt's
    // caption would look like.
    const { data: dedupeRows } = await supabase
      .from("userbase_instagram_posts")
      .select("status, ig_permalink")
      .eq("hive_author", hiveAuthor)
      .eq("hive_permlink", hivePermlink)
      .limit(1);
    const dedupe = dedupeRows?.[0]
      ? {
          status: dedupeRows[0].status as string,
          ig_permalink: (dedupeRows[0].ig_permalink as string | null) ?? null,
        }
      : null;

    // An item already waiting on a curator — the dialog turns this into
    // "already with the curation team" and disables the button, instead of
    // letting the moderator file a duplicate that the index would reject.
    const queued = await findActiveQueueItem({
      supabase,
      target: "instagram",
      hiveAuthor,
      hivePermlink,
    });

    return NextResponse.json({
      success: true,
      preview: true,
      caption,
      image_url: imageUrl || null,
      video_url: videoUrl || null,
      media_type: mediaType,
      media_count: isCarousel ? mediaItems.length : undefined,
      ig_handle: igHandle ?? null,
      default_collaborators: igHandle ? [igHandle] : [],
      target_account: "@skatehive",
      moderator: moderatorHandle,
      // Confirming files this for the curation team; it does not publish.
      review_required: true,
      queue: queued
        ? { id: queued.id, status: queued.status, created_at: queued.created_at }
        : null,
      dedupe,
    });
  }

  // Invite the original author (mapped skater) as an IG collaborator so the
  // cross-post also lands on their own feed once published.
  const collaborators: string[] = Array.isArray(body?.collaborators)
    ? body.collaborators.filter((c: unknown): c is string => typeof c === "string")
    : igHandle
    ? [igHandle]
    : [];

  // File it for review, exactly like a self-serve request. The payload is the
  // finished publish input; the portal posts this without re-deriving anything.
  const payload: InstagramQueuePayload = {
    caption,
    collaborators,
    image_url: imageUrl || null,
    video_url: videoUrl || null,
    ...(isCarousel ? { media_items: mediaItems } : {}),
    ig_media_type: mediaType,
    permalink_url: permalinkUrl,
    title,
    tags,
    // Distinguishes this from the author's own request, both for the curator
    // and for anyone reading the row later.
    ...(moderatorHandle ? { forced_by: moderatorHandle } : {}),
  };

  // The row is filed under the AUTHOR, not the moderator: user_id is who gets
  // the outcome notification, and "your cross-post is live" belongs to the
  // person whose clip it is. The moderator is kept in requested_by_handle and
  // payload.forced_by. Falls back to the moderator when the author has no
  // userbase account — better an audit trail with no notification than a row
  // with no owner at all.
  const authorUserIdForRow = authorUserId ?? moderatorUserId;

  const enqueued = await enqueueCrossPost({
    supabase,
    target: "instagram",
    userId: authorUserIdForRow,
    requestedByHandle: moderatorHandle,
    hiveAuthor,
    hivePermlink,
    payload,
  });

  if (!enqueued.ok) {
    return NextResponse.json({ error: enqueued.error }, { status: enqueued.status });
  }

  if (enqueued.duplicate) {
    return NextResponse.json({
      success: true,
      queued: true,
      already_queued: true,
      queue_id: enqueued.id,
      status: enqueued.duplicate.status,
      forced_by: moderatorHandle,
    });
  }

  // Tell the author their clip is up for review. Only when they actually have
  // an account — notifying the moderator about their own action would be noise.
  if (authorUserId) {
    await notifyCrossPostQueued({
      supabase,
      userId: authorUserId,
      queueId: enqueued.id,
      target: "instagram",
      hivePermlink,
      permalinkUrl,
    });
  }

  return NextResponse.json({
    success: true,
    queued: true,
    queue_id: enqueued.id,
    status: "pending_review",
    forced_by: moderatorHandle,
  });
}
