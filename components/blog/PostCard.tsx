import {
  Box,
  Image,
  Text,
  Avatar,
  Flex,
  Icon,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  Link,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Discussion } from "@hiveio/dhive";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/swiper-bundle.css";
import { FaComment } from "react-icons/fa";
import { LuArrowUpRight } from "react-icons/lu";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { useAioha } from "@aioha/react-ui";
import { useRouter } from "next/navigation";
import { getPayoutValue } from "@/lib/hive/client-functions";
import {
  extractYoutubeLinks,
  LinkWithDomain,
  extractImageUrls,
} from "@/lib/utils/extractImageUrls"; // Import YouTube extraction function
import useHivePower from "@/hooks/useHivePower";
import VoteListPopover from "./VoteListModal";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";



interface PostCardProps {
  post: Discussion;
  listView?: boolean;
  hideAuthorInfo?: boolean;
}

export default function PostCard({
  post,
  listView = false,
  hideAuthorInfo = false,
}: PostCardProps) {
  const { title, author, body, json_metadata, created } = post;
  const postDate = getPostDate(created);

  // Use useMemo to parse JSON only when json_metadata changes
  const metadata = useMemo(() => {
    try {
      return JSON.parse(json_metadata);
    } catch (e) {
      console.error("Error parsing JSON metadata", e);
      return {};
    }
  }, [json_metadata]);

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [youtubeLinks, setYoutubeLinks] = useState<LinkWithDomain[]>([]);
  const [sliderValue, setSliderValue] = useState(100);
  const [showSlider, setShowSlider] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const { aioha, user } = useAioha();
  const {
    hivePower,
    isLoading: isHivePowerLoading,
    error: hivePowerError,
    estimateVoteValue,
  } = useHivePower(user);
  const [activeVotes, setActiveVotes] = useState(post.active_votes || []);
  const [payoutValue, setPayoutValue] = useState(
    parseFloat(getPayoutValue(post))
  );
  const [voted, setVoted] = useState(
    post.active_votes?.some(
      (item) => item.voter.toLowerCase() === user?.toLowerCase()
    )
  );
  const router = useRouter();
  const default_thumbnail =
    "https://images.hive.blog/u/" + author + "/avatar/large";
  const [visibleImages, setVisibleImages] = useState<number>(3);
  const {
    isOpen: isPayoutOpen,
    onOpen: openPayout,
    onClose: closePayout,
    onToggle: togglePayout,
  } = useDisclosure();
  const [showMatrix, setShowMatrix] = useState(false);

  // Calculate days remaining for pending payout
  const createdDate = new Date(post.created);
  const now = new Date();
  const timeDifferenceInMs = now.getTime() - createdDate.getTime();
  const timeDifferenceInDays = timeDifferenceInMs / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, 7 - Math.floor(timeDifferenceInDays));
  const isPending = timeDifferenceInDays < 7;
  // Calculate payout timestamp (creation + 7 days)
  const payoutDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  useEffect(() => {
    let images: string[] = [];
    if (metadata.image) {
      images = Array.isArray(metadata.image)
        ? metadata.image
        : [metadata.image];
    }
    // Extract additional images from markdown content
    const markdownImages = extractImageUrls(body);
    images = images.concat(markdownImages);

    // Filter out failed images only
    const validImages = images.filter(img => {
      if (failedImages.has(img)) return false;
      return true;
    });

    if (validImages.length > 0) {
      setImageUrls(validImages);
    } else {
      const ytLinks = extractYoutubeLinks(body);
      if (ytLinks.length > 0) {
        setYoutubeLinks(ytLinks);
        setImageUrls([]);
      } else {
        setImageUrls([default_thumbnail]);
      }
    }
  }, [body, metadata, default_thumbnail, post, failedImages]);

  function handleHeartClick() {
    setShowSlider(!showSlider);
  }

  async function handleVote() {
    const vote = await aioha.vote(
      post.author,
      post.permlink,
      sliderValue * 100
    );
    if (vote.success) {
      setVoted(true);
      setActiveVotes([...activeVotes, { voter: user }]);
      // Estimate the value and optimistically update payout
      if (estimateVoteValue) {
        try {
          const estimatedValue = await estimateVoteValue(sliderValue);
          setPayoutValue((prev) => prev + estimatedValue);
        } catch (e) {
          // fallback: do not update payout
        }
      }
    }
    handleHeartClick();
  }

  // **Function to load more slides**
  function handleSlideChange(swiper: any) {
    // Check if user is reaching the end of currently visible images
    if (
      swiper.activeIndex === visibleImages - 1 &&
      visibleImages < imageUrls.length
    ) {
      setVisibleImages((prev) => Math.min(prev + 3, imageUrls.length)); // Load 3 more slides
    }
  }

  // Modified to only stop propagation
  function stopPropagation(e: React.MouseEvent) {
    e.stopPropagation();
  }



  // Enhanced function to handle image load errors with fallback
  function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
    const img = e.currentTarget;
    const originalSrc = img.src;
    
    // Track failed images to avoid retrying them
    setFailedImages(prev => new Set(prev).add(originalSrc));
    
    // If this is not already the fallback image, try to set it
    if (img.src !== default_thumbnail) {
      img.src = default_thumbnail;
      img.onerror = null; // Prevent infinite loop
    }
    
    // Prevent the error from bubbling up
    e.preventDefault();
    e.stopPropagation();
    
    // Return false to prevent the default error handling
    return false;
  }

  // Extract summary for listView: remove image markdown, allow up to 3 lines, no char limit
  let summarySource = body;
  if (listView) {
    summarySource = summarySource.replace(/!\[[^\]]*\]\([^\)]*\)/g, ""); // Remove ![alt](url)
    summarySource = summarySource.replace(/!\[\]\([^\)]*\)/g, ""); // Remove ![](url)
    // Remove markdown links [text](url)
    summarySource = summarySource.replace(/\[[^\]]*\]\([^\)]*\)/g, "");
    // Remove raw URLs (http/https/ftp)
    summarySource = summarySource.replace(
      /https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/g,
      ""
    );
    // Remove HTML tags
    summarySource = summarySource.replace(/<[^>]+>/g, "");
  }
  // For listView, do not slice to a char limit; let noOfLines handle truncation
  const summary = summarySource
    .replace(/[#*_`>\[\]()!\-]/g, "")
    .replace(/\n+/g, " ");

  // Deduplicate votes by voter (keep the last occurrence)
  const uniqueVotesMap = new Map();
  activeVotes.forEach((vote) => {
    uniqueVotesMap.set(vote.voter, vote);
  });
  const uniqueVotes = Array.from(uniqueVotesMap.values());

  // Helper to convert Asset or string to string
  function assetToString(val: string | { toString: () => string }): string {
    return typeof val === "string" ? val : val.toString();
  }
  // Helper to parse payout strings like "1.234 HBD"
  function parsePayout(
    val: string | { toString: () => string } | undefined
  ): number {
    if (!val) return 0;
    const str = assetToString(val);
    return parseFloat(str.replace(" HBD", "").replace(",", ""));
  }
  const authorPayout = parsePayout(post.total_payout_value);
  const curatorPayout = parsePayout(post.curator_payout_value);
  // const payoutTooltip = `Author: $${authorPayout.toFixed(
  //   3
  // )}\nCurators: $${curatorPayout.toFixed(3)}`;

  if (listView) {
    return (
      <Box
        overflow="hidden"
        height="200px"
        display="flex"
        flexDirection="row"
        bg="background"
        border={"1px solid"}
        borderColor="muted"
      >
        {/* Thumbnail */}
        <Box
          w="160px"
          h="100%"
          flexShrink={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="muted"
        >
          {imageUrls.length > 0 ? (
            <Image
              src={imageUrls[0]}
              alt={title}
              borderRadius="base"
              objectFit="cover"
              w="100%"
              h="100%"
              loading="lazy"
              onError={handleImageError}
            />
          ) : (
            <Image
              src={default_thumbnail}
              alt="default thumbnail"
              borderRadius="base"
              objectFit="cover"
              w="100%"
              h="100%"
              loading="lazy"
              onError={handleImageError}
            />
          )}
        </Box>
        {/* Content */}
        <Flex direction="column" flex={1} p={4} minW={0}>
          <Box flex={1} overflow="hidden">
            <Link
              href={`/post/${author}/${post.permlink}`}
              _hover={{ textDecoration: "underline" }}
            >
              <Text
                fontWeight="bold"
                fontSize={listView ? "sm" : "sm"}
                mb={1}
                isTruncated={false}
                whiteSpace="normal"
                wordBreak="break-word"
                noOfLines={2}
              >
                {title}
              </Text>
            </Link>
            <Text fontSize="xs" color="gray.500" mb={2} textAlign="right">
              {postDate}
            </Text>
            <Text
              fontSize="sm"
              color="gray.400"
              mb={2}
              noOfLines={3}
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {summary}
            </Text>
          </Box>
          {/* Horizontal buttons at bottom right - always visible */}
          <Flex
            alignItems="center"
            justifyContent="flex-end"
            gap={4}
            mt={2}
            flexShrink={0}
          >
            <Flex alignItems="center">
              <Icon
                as={LuArrowUpRight}
                onClick={handleHeartClick}
                cursor="pointer"
                color={voted ? "success" : "accent"}
                boxSize={5}
                bg={!voted ? "muted" : undefined}
                borderRadius="full"
                _hover={!voted ? { bg: "primary" } : undefined}
              />
              <VoteListPopover
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    ml={1}
                    p={1}
                    _hover={{ textDecoration: "underline" }}
                  >
                    {uniqueVotes.length}
                  </Button>
                }
                votes={activeVotes}
                post={post}
              />
            </Flex>
            <Popover
              placement="top"
              isOpen={isPayoutOpen}
              onClose={closePayout}
              closeOnBlur={true}
            >
              <PopoverTrigger>
                <span
                  style={{ cursor: "pointer" }}
                  onMouseDown={openPayout}
                  onMouseUp={closePayout}
                >
                  <Text fontWeight="bold" fontSize="xl">
                    ${payoutValue.toFixed(2)}
                  </Text>
                </span>
              </PopoverTrigger>
              <PopoverContent
                w="auto"
                bg="gray.800"
                color="white"
                borderRadius="md"
                boxShadow="lg"
                p={2}
              >
                <PopoverArrow />
                <PopoverBody>
                  {isPending ? (
                    <div>
                      <div>
                        <b>Pending</b>
                      </div>
                      <div>
                        {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}{" "}
                        until payout
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        Author: <b>${authorPayout.toFixed(3)}</b>
                      </div>
                      <div>
                        Curators: <b>${curatorPayout.toFixed(3)}</b>
                      </div>
                    </>
                  )}
                </PopoverBody>
              </PopoverContent>
            </Popover>
            <Flex alignItems="center">
              <Icon as={FaComment} boxSize={4} />
              <Text ml={1} fontSize="sm">
                {post.children}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Box>
    );
  }

  const postCardPulseGradient =
    "linear-gradient(90deg, var(--chakra-colors-primary, #38ff8e) 0%, var(--chakra-colors-accent, #00e676) 100%)";
  const postCardBoxShadowAccent =
    "0 0 0 0 var(--chakra-colors-accent, rgba(72, 255, 128, 0.7))";
  const postCardBoxShadowAccent10 =
    "0 0 0 10px var(--chakra-colors-accent, rgba(72, 255, 128, 0))";

  return (
    <>
      <style jsx global>{`
        .custom-swiper {
          --swiper-navigation-color: var(--chakra-colors-primary);
          --swiper-pagination-color: var(--chakra-colors-primary);
        }

        .custom-swiper .swiper-button-next,
        .custom-swiper .swiper-button-prev {
          transition: transform 0.18s cubic-bezier(0.4, 0.2, 0.2, 1);
        }
        .custom-swiper .swiper-button-next:active,
        .custom-swiper .swiper-button-prev:active {
          transform: scale(1.18);
        }

        .custom-swiper .swiper-button-next::after,
        .custom-swiper .swiper-button-prev::after {
          font-size: 20px;
        }

        .custom-swiper .swiper-pagination-bullet {
          width: 6px;
          height: 6px;
          border-radius: 0; /* Make the dots squared */
        }

        .subtle-pulse {
          animation: subtle-pulse 2s infinite;
        }
        @keyframes subtle-pulse {
          0% {
            box-shadow: 0 0 0 0 var(--chakra-colors-accent);
          }
          70% {
            box-shadow: 0 0 0 4px rgba(72, 255, 128, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(72, 255, 128, 0);
          }
        }
      `}</style>
      <Box
        position="relative"
        borderBottom="1px solid"
        borderColor="muted"
        overflow="hidden"
        height="100%"
        cursor="default"
      >
        {/* MatrixOverlay covers the whole card, only when showMatrix is true */}
        {showMatrix && (
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            zIndex={1}
            pointerEvents="none"
          >
            <MatrixOverlay />
          </Box>
        )}
        <Box
          py={4}
          px={4}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          height="100%"
          position="relative"
          zIndex={2}
        >
          {/* Only show author info if not hidden */}
          {!hideAuthorInfo && (
            <Box mb={4}>
              <Flex
                alignItems="center"
                minWidth={0}
                justifyContent="space-between"
              >
                <Link
                  href={`/@${author}`}
                  display="flex"
                  alignItems="center"
                  _hover={{ textDecoration: "underline" }}
                >
                  <Avatar
                    size="sm"
                    name={author}
                    src={`https://images.hive.blog/u/${author}/avatar/sm`}
                  />
                  <Text
                    fontWeight="bold"
                    fontSize="3xl"
                    ml={2}
                    color="primary"
                    _hover={{ color: "accent" }}
                    isTruncated
                  >
                    {author}
                  </Text>
                </Link>
                <Text
                  fontSize="xs"
                  color="gray.500"
                  ml={2}
                  minWidth="40px"
                  textAlign="right"
                >
                  {postDate}
                </Text>
              </Flex>
            </Box>
          )}

          {/* Content Box with Green Border */}
          <Box
            border="2px solid"
            borderColor="muted"
            borderRadius="none"
            overflow="hidden"
            bg="background"
          >
            {/* Image Section */}
            <Box
              flex="1"
              display="flex"
              alignItems="flex-end"
              justifyContent="center"
              zIndex={2}
            >
              {imageUrls.length > 0 ? (
                <Swiper
                  spaceBetween={10}
                  slidesPerView={1}
                  pagination={{ clickable: true }}
                  navigation={true}
                  modules={[Navigation, Pagination]}
                  onSlideChange={handleSlideChange}
                  className="custom-swiper"
                  onSwiper={(swiper) => {
                    setTimeout(() => {
                      if (!swiper.el) return;
                      const next = swiper.el.querySelector(
                        ".swiper-button-next"
                      );
                      const prev = swiper.el.querySelector(
                        ".swiper-button-prev"
                      );
                      if (next)
                        next.addEventListener("click", (e) =>
                          e.stopPropagation()
                        );
                      if (prev)
                        prev.addEventListener("click", (e) =>
                          e.stopPropagation()
                        );
                    }, 0);
                  }}
                >
                  {imageUrls.slice(0, visibleImages).map((url, index) => (
                    <SwiperSlide key={index}>
                      <Box h="200px" w="100%" sx={{ userSelect: "none" }}>
                        <Image
                          src={url}
                          alt={title}
                          objectFit="cover"
                          w="100%"
                          h="100%"
                          loading="lazy"
                          onError={handleImageError}
                        />
                      </Box>
                    </SwiperSlide>
                  ))}
                </Swiper>
              ) : youtubeLinks.length > 0 ? (
                <Swiper
                  spaceBetween={10}
                  slidesPerView={1}
                  pagination={{ clickable: true }}
                  navigation={true}
                  modules={[Navigation, Pagination]}
                  className="custom-swiper"
                  onSwiper={(swiper) => {
                    setTimeout(() => {
                      if (!swiper.el) return;
                      const next = swiper.el.querySelector(
                        ".swiper-button-next"
                      );
                      const prev = swiper.el.querySelector(
                        ".swiper-button-prev"
                      );
                      if (next)
                        next.addEventListener("click", (e) =>
                          e.stopPropagation()
                        );
                      if (prev)
                        prev.addEventListener("click", (e) =>
                          e.stopPropagation()
                        );
                    }, 0);
                  }}
                >
                  {youtubeLinks.map((link, index) => (
                    <SwiperSlide key={index}>
                      <Box h="200px" w="100%">
                        <iframe
                          src={link.url}
                          title={`YouTube video from ${link.domain}`}
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      </Box>
                    </SwiperSlide>
                  ))}
                </Swiper>
              ) : (
                <Box h="200px" w="100%">
                  <Image
                    src={default_thumbnail}
                    alt="default thumbnail"
                    objectFit="cover"
                    w="100%"
                    h="100%"
                    loading="lazy"
                    onError={handleImageError}
                  />
                </Box>
              )}
            </Box>

            {/* Title Section with border separator */}
            <Link
              href={`/post/${author}/${post.permlink}`}
              _hover={{ textDecoration: "none" }}
              style={{ display: "block" }}
            >
              <Box
                borderTop="1px solid"
                borderColor="primary"
                p={3}
                textAlign="center"
                cursor="pointer"
                bg="background"
                transition="color 0.2s"
                _hover={{
                  "& .post-title-text": { color: "accent" },
                }}
                onMouseEnter={() => setShowMatrix(true)}
                onMouseLeave={() => setShowMatrix(false)}
                position="relative"
                zIndex={3}
              >
                <Text
                  className="post-title-text"
                  fontWeight="bold"
                  fontSize={"16px"}
                  isTruncated={false}
                  whiteSpace="normal"
                  wordBreak="break-word"
                  noOfLines={2}
                  color="primary"
                  transition="color 0.2s"
                >
                  {title}
                </Text>
              </Box>
            </Link>
          </Box>
          <Box mt="auto">
            {showSlider ? (
              <Flex mt={4} alignItems="center" onClick={stopPropagation}>
                <Box width="100%" mr={4}>
                  <Slider
                    aria-label="slider-ex-1"
                    defaultValue={0}
                    min={0}
                    max={100}
                    value={sliderValue}
                    onChange={(val) => setSliderValue(val)}
                  >
                    <SliderTrack
                      bg="gray.700"
                      height="8px"
                      boxShadow="0 0 10px rgba(255, 255, 0, 0.8)"
                    >
                      <SliderFilledTrack bgGradient="linear(to-r, success, warning, error)" />
                    </SliderTrack>
                    <SliderThumb
                      boxSize="30px"
                      bg="transparent"
                      boxShadow={"none"}
                      _focus={{ boxShadow: "none" }}
                      zIndex={1}
                    >
                      <Image
                        src="/images/spitfire.png"
                        alt="thumb"
                        w="100%"
                        h="auto"
                        mr={2}
                        mb={1}
                      />
                    </SliderThumb>
                  </Slider>
                </Box>
                <Button
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVote();
                  }}
                  pl={5}
                  pr={5}
                  cursor="pointer"
                  bgGradient="linear(to-r, primary, accent)"
                  color="background"
                  _hover={{ bg: "accent" }}
                  fontWeight="bold"
                  className="subtle-pulse"
                >
                  Vote {sliderValue} %
                </Button>
                <Button
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHeartClick();
                  }}
                  ml={1}
                  cursor="pointer"
                  bg="muted"
                  color="primary"
                  _hover={{ bg: "muted", opacity: 0.8 }}
                >
                  X
                </Button>
              </Flex>
            ) : (
              <Flex
                mt={4}
                justifyContent="center"
                alignItems="center"
                onClick={stopPropagation}
                gap={6}
              >
                <Flex alignItems="center">
                  <Box
                    as="span"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor="pointer"
                    p={1}
                    onClick={(
                      e: React.MouseEvent<HTMLSpanElement, MouseEvent>
                    ) => {
                      e.stopPropagation();
                      handleHeartClick();
                    }}
                    _hover={{ bg: "accent", borderRadius: "full" }}
                    transition="background 0.2s, border-radius 0.2s"
                  >
                    <LuArrowUpRight
                      size={24}
                      color={voted ? "var(--chakra-colors-success)" : "var(--chakra-colors-accent)"}
                      style={{ opacity: 1 }}
                    />
                  </Box>
                  <VoteListPopover
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        ml={1}
                        p={1}
                        _hover={{ textDecoration: "underline" }}
                      >
                        {uniqueVotes.length}
                      </Button>
                    }
                    votes={activeVotes}
                    post={post}
                  />
                </Flex>

                <Flex alignItems="center">
                  <Icon as={FaComment} />
                  <Text ml={2} fontSize="sm">
                    {post.children}
                  </Text>
                </Flex>
                <Popover
                  placement="top"
                  isOpen={isPayoutOpen}
                  onClose={closePayout}
                  closeOnBlur={true}
                >
                  <PopoverTrigger>
                    <span
                      style={{ cursor: "pointer" }}
                      onMouseDown={openPayout}
                      onMouseUp={closePayout}
                    >
                      <Text fontWeight="bold" fontSize="xl">
                        ${payoutValue.toFixed(2)}
                      </Text>
                    </span>
                  </PopoverTrigger>
                  <PopoverContent
                    w="auto"
                    bg="gray.800"
                    color="white"
                    borderRadius="md"
                    boxShadow="lg"
                    p={2}
                  >
                    <PopoverArrow />
                    <PopoverBody>
                      {isPending ? (
                        <div>
                          <div>
                            <b>Pending</b>
                          </div>
                          <div>
                            {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}{" "}
                            until payout
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            Author: <b>${authorPayout.toFixed(3)}</b>
                          </div>
                          <div>
                            Curators: <b>${curatorPayout.toFixed(3)}</b>
                          </div>
                        </>
                      )}
                    </PopoverBody>
                  </PopoverContent>
                </Popover>
              </Flex>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
