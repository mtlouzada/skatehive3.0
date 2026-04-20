"use client";

import React, { useState } from "react";
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  VStack,
  Badge,
  Flex,
  usePrefersReducedMotion,
} from "@chakra-ui/react";
import Link from "next/link";
import dynamic from "next/dynamic";

const Cartridge3D = dynamic(() => import("@/components/games/Cartridge3D"), {
  ssr: false,
  loading: () => (
    <Flex w="100%" h="100%" bg="background" align="center" justify="center">
      <Text fontSize="5xl">🛹</Text>
    </Flex>
  ),
});

interface GameCartridge {
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  developer: string;
  tags: string[];
  isNew?: boolean;
}

const GAMES: GameCartridge[] = [
  {
    slug: "quest-for-stoken",
    title: "Quest for Stoken",
    description:
      "The OG SkateHive browser skate game. Ride through levels, dodge hazards, and collect STOKEN.",
    thumbnail: "/images/qfs-ogimage.png",
    url: "/games/quest-for-stoken",
    developer: "webgnar",
    tags: ["platformer", "arcade", "classic"],
  },
  {
    slug: "lougnar",
    title: "Lougnar",
    description:
      "A fast, one-button skate action game by webgnar built with Excalibur.js.",
    thumbnail: "/images/lougnar-thumb.jpg",
    url: "/games/lougnar",
    developer: "webgnar",
    tags: ["action", "new"],
    isNew: true,
  },
];

/* ─── Fixed-height card ─── */
const CARD_H = { base: "380px", md: "420px" };
const CANVAS_H = { base: "260px", md: "300px" };

function GameCard({ game }: { game: GameCartridge }) {
  const reduceMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={game.url} style={{ textDecoration: "none" }}>
      <Box
        bg="transparent"
        borderRadius="xl"
        overflow="hidden"
        border="none"
        h={CARD_H}
        transition="all 0.3s ease"
        cursor="pointer"
        position="relative"
        display="flex"
        flexDirection="column"
        _hover={{
          transform: "translateY(-6px)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        role="group"
      >
        {/* 3D Cartridge area */}
        <Box
          position="relative"
          h={CANVAS_H}
          bg="background"
          flexShrink={0}
        >
          {reduceMotion ? (
            <Flex w="100%" h="100%" bg="background" align="center" justify="center">
              <Text fontSize="5xl">🎮</Text>
            </Flex>
          ) : (
            <Cartridge3D imageUrl={game.thumbnail} hovered={hovered} />
          )}

          {game.isNew && (
            <Badge
              position="absolute"
              top={2}
              right={2}
              bg="primary"
              color="background"
              fontSize="xs"
              fontWeight="bold"
              px={2}
              py={1}
              borderRadius="md"
              zIndex={2}
            >
              NEW
            </Badge>
          )}
        </Box>

        {/* Info (fixed layout) */}
        <VStack p={3} align="start" spacing={1} flex={1} justify="center">
          <Heading
            as="h3"
            fontSize={{ base: "md", md: "lg" }}
            color="primary"
            fontWeight="bold"
            noOfLines={1}
          >
            {game.title}
          </Heading>
          <Text color="gray.400" fontSize="xs" noOfLines={2} minH="2.4em">
            {game.description}
          </Text>
          <Flex gap={1} flexWrap="wrap" align="center" mt={1}>
            <Text color="gray.500" fontSize="2xs">
              by @{game.developer}
            </Text>
            {game.tags.map((tag) => (
              <Badge
                key={tag}
                bg="whiteAlpha.100"
                color="gray.400"
                fontSize="2xs"
                px={1.5}
                borderRadius="sm"
              >
                {tag}
              </Badge>
            ))}
          </Flex>
        </VStack>


      </Box>
    </Link>
  );
}

export default function GamesGallery() {
  return (
    <Box minH="100vh" p={{ base: 4, md: 8 }}>
      {/* Header */}
      <VStack spacing={2} mb={8} textAlign="center">
        <Heading
          as="h1"
          className="fretqwik-title"
          fontSize={{ base: "3xl", md: "5xl" }}
          color="primary"
          letterSpacing="wider"
        >
          🎮 free skate games
        </Heading>
        <Text color="gray.400" fontSize={{ base: "sm", md: "md" }} maxW="680px">
          Play free skateboarding games online from the SkateHive community. Pick a cartridge and jump straight into the session, no download required.
        </Text>
      </VStack>

      {/* Games Grid */}
      <SimpleGrid
        columns={{ base: 1, sm: 2, lg: 3 }}
        spacing={6}
        maxW="900px"
        mx="auto"
      >
        {GAMES.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </SimpleGrid>

      {/* SEO Content */}
      <Box
        maxW="800px"
        mx="auto"
        mt={12}
        p={6}
        bg="whiteAlpha.50"
        borderRadius="lg"
        fontSize="sm"
        color="gray.400"
        lineHeight="1.7"
      >
        <Heading as="h2" fontSize="lg" color="primary" mb={3}>
          Play free skateboarding games online
        </Heading>
        <Text mb={3}>
          SkateHive brings together free browser skate games made by skaters, for skaters. If you are looking for skateboarding games online, you can start playing instantly here without installs, accounts, or app-store downloads.
        </Text>
        <Text mb={3}>
          <strong>Quest for Stoken</strong> is the original SkateHive game, built for players who like arcade-style platformers with a skate flavor. Guide your skater through levels, avoid obstacles, and collect STOKEN as you push for a better run.
        </Text>
        <Text mb={3}>
          <strong>Lougnar</strong> is a newer, faster one-button experience that leans into quick reactions and replayability. It gives the page a broader search fit for players looking for browser skate games, indie skateboarding games, or quick skate games to play at work or on mobile.
        </Text>
        <Text>
          Both titles are free to play, run in the browser with HTML5 tech, and load fast on desktop and mobile. That makes SkateHive Games a strong destination for anyone searching for free skateboarding games online without the friction of a download.
        </Text>
      </Box>

      {/* Bottom CTA */}
      <Box textAlign="center" mt={8}>
        <Text color="gray.500" fontSize="sm">
          Want to build a skate game?{" "}
          <Text as="span" color="primary" fontWeight="bold">
            Hit us up on Discord
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
