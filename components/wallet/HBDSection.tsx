import {
  Box,
  Text,
  HStack,
  VStack,
  Tooltip,
  Icon,
  Image,
  Button,
  IconButton,
  Badge,
} from "@chakra-ui/react";
import {
  FaPaperPlane,
  FaArrowDown,
  FaArrowUp,
  FaQuestionCircle,
} from "react-icons/fa";
import { useState, useCallback, useMemo, memo } from "react";
import { CustomHiveIcon } from "./CustomHiveIcon";
import { useTheme } from "@/app/themeProvider";
import useIsMobile from "@/hooks/useIsMobile";

interface HBDSectionProps {
  hbdBalance: string;
  hbdSavingsBalance: string;
  hbdPrice: number | null;
  estimatedClaimableInterest: number;
  daysUntilClaim: number;
  lastInterestPayment?: string;
  onModalOpen: (
    title: string,
    description?: string,
    showMemoField?: boolean,
    showUsernameField?: boolean
  ) => void;
  onClaimInterest: () => void;
  isWalletView?: boolean;
  isBankView?: boolean;
}

function daysAgo(dateString: string) {
  const last = new Date(dateString);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

const HBDSection = memo(function HBDSection({
  hbdBalance,
  hbdSavingsBalance,
  hbdPrice,
  estimatedClaimableInterest,
  daysUntilClaim,
  lastInterestPayment,
  onModalOpen,
  onClaimInterest,
  isWalletView = false,
  isBankView = false,
}: HBDSectionProps) {
  const { theme } = useTheme();
  const [showInfo, setShowInfo] = useState(false);
  const isMobile = useIsMobile();

  // Memoized calculations
  const liquidUsdValue = useMemo(() => {
    if (hbdBalance === "N/A" || !hbdPrice || parseFloat(hbdBalance) <= 0) {
      return null;
    }
    return (parseFloat(hbdBalance) * hbdPrice).toFixed(2);
  }, [hbdBalance, hbdPrice]);

  const savingsUsdValue = useMemo(() => {
    if (
      hbdSavingsBalance === "N/A" ||
      !hbdPrice ||
      parseFloat(hbdSavingsBalance) <= 0
    ) {
      return null;
    }
    return (parseFloat(hbdSavingsBalance) * hbdPrice).toFixed(2);
  }, [hbdSavingsBalance, hbdPrice]);

  const lastPaymentDays = useMemo(() => {
    return lastInterestPayment ? daysAgo(lastInterestPayment) : 0;
  }, [lastInterestPayment]);

  // Memoized event handlers
  const handleInfoToggle = useCallback(() => {
    setShowInfo((prev) => !prev);
  }, []);

  const handleSendHBD = useCallback(() => {
    onModalOpen("Send HBD", "Send HBD to another account", true, true);
  }, [onModalOpen]);

  const handleHBDToSavings = useCallback(() => {
    onModalOpen("HBD Savings", "Convert HBD to Savings (15% APR)");
  }, [onModalOpen]);

  const handleAddToSavings = useCallback(() => {
    onModalOpen("HBD Savings", "Add HBD to Savings (Earn 15% APR)");
  }, [onModalOpen]);

  const handleWithdrawFromSavings = useCallback(() => {
    onModalOpen(
      "Withdraw HBD Savings",
      "HBD savings balance is subject to a 3-day unstake (withdraw) waiting period.",
      false,
      false
    );
  }, [onModalOpen]);

  const handleWithdrawFromSavingsAlt = useCallback(() => {
    onModalOpen(
      "Withdraw HBD Savings",
      "HBD savings balance is subject to a 3-day unstake (withdraw) waiting period.",
      true,
      false
    );
  }, [onModalOpen]);

  const handleSendToSavings = useCallback(() => {
    onModalOpen("HBD Savings", "Send HBD to Savings");
  }, [onModalOpen]);

  // Wallet view: Only show liquid HBD
  if (isWalletView) {
    return (
      <Box
        p={4}
        bg="transparent"
        borderRadius="md"
        border="1px solid"
        borderColor="gray.200"
      >
        <HStack justify="space-between" align="center">
          <HStack spacing={3}>
            <CustomHiveIcon color="lime" />
            <Box>
              <HStack spacing={2} align="center">
                <Text fontSize="lg" fontWeight="bold" color="primary">
                  HBD
                </Text>
                <IconButton
                  aria-label="Info about HBD"
                  icon={<FaQuestionCircle />}
                  size="xs"
                  variant="ghost"
                  color="gray.400"
                  onClick={handleInfoToggle}
                />
              </HStack>
              {/* {!isMobile && (
                                <Text fontSize="sm" color="gray.400">
                                    Liquid HBD ready for transactions
                                </Text>
                            )} */}
            </Box>
          </HStack>

          <HStack spacing={3} align="center">
            <HStack spacing={1}>
              <Tooltip label="Send HBD" hasArrow>
                <IconButton
                  aria-label="Send HBD"
                  icon={<FaPaperPlane />}
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  onClick={handleSendHBD}
                />
              </Tooltip>
              <Tooltip label="Convert to Savings" hasArrow>
                <IconButton
                  aria-label="Convert to Savings"
                  icon={<FaArrowDown />}
                  size="sm"
                  colorScheme="green"
                  variant="outline"
                  onClick={handleHBDToSavings}
                />
              </Tooltip>
            </HStack>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="bold" color="primary">
                {hbdBalance}
              </Text>
              {liquidUsdValue && (
                <Text fontSize="sm" color="gray.400">
                  (${liquidUsdValue})
                </Text>
              )}
            </Box>
          </HStack>
        </HStack>

        {showInfo && (
          <Box mt={3} p={3} bg="muted" borderRadius="md">
            <Text color="gray.400" fontSize="sm">
              Liquid HBD ready for transactions. Convert to Savings in SkateBank
              to earn 15% APR!
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Bank view: Show savings and investment options
  if (isBankView) {
    return (
      <Box mb={3}>
        {/* Current Savings Balance */}
        <HStack align="center" mb={4} spacing={2} width="100%">
          <Image
            src="/images/hbd_savings.png"
            alt="HBD Savings Logo"
            width="6"
            height="6"
          />
          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
            Current Savings
          </Text>
          <Box flex={1} />
          <VStack spacing={0} align="end">
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="extrabold"
              color="lime"
            >
              {hbdSavingsBalance} HBD
            </Text>
            {savingsUsdValue && (
              <Text fontSize="sm" color="gray.400">
                (${savingsUsdValue})
              </Text>
            )}
          </VStack>
        </HStack>

        {/* Investment Actions */}
        <VStack spacing={3} align="stretch">
          <HStack spacing={2}>
            <Tooltip label="Add HBD to Savings" hasArrow>
              <Box
                as="button"
                px={4}
                py={2}
                fontSize="sm"
                bg="primary"
                color="background"
                borderRadius="md"
                fontWeight="bold"
                _hover={{ bg: "accent" }}
                onClick={handleAddToSavings}
                flex={1}
              >
                💰 Add to Savings
              </Box>
            </Tooltip>
            <Tooltip label="Withdraw from Savings (3-day cooldown)" hasArrow>
              <Box
                as="button"
                px={4}
                py={2}
                fontSize="sm"
                bg="muted"
                color="text"
                borderRadius="md"
                fontWeight="bold"
                _hover={{ bg: "accent", color: "background" }}
                onClick={handleWithdrawFromSavings}
                flex={1}
              >
                📤 Withdraw
              </Box>
            </Tooltip>
          </HStack>

          {/* Available HBD to invest */}
          <Box p={3} borderRadius="md" bg={theme.colors.muted}>
            <Text fontSize="sm" color="text" mb={1}>
              Available HBD to invest:{" "}
              <Text as="span" fontWeight="bold" color="primary">
                {hbdBalance} HBD
              </Text>
            </Text>
            <Text fontSize="xs" color="gray.400">
              Convert your liquid HBD to savings to start earning passive
              income!
            </Text>
          </Box>

          {/* Claimable Interest */}
          {estimatedClaimableInterest > 0 && (
            <Box p={3} borderRadius="md" bg={theme.colors.muted}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Text fontWeight="bold" color="lime">
                    💎 Claimable Interest
                  </Text>
                  {daysUntilClaim === 0 && estimatedClaimableInterest > 0 ? (
                    <Text color="gray.400" fontSize="sm">
                      Your earned rewards are ready!
                    </Text>
                  ) : daysUntilClaim > 0 ? (
                    <Text color="gray.400" fontSize="sm">
                      Rewards will be ready in {daysUntilClaim} day
                      {daysUntilClaim > 1 ? "s" : ""}
                    </Text>
                  ) : (
                    <Text color="gray.400" fontSize="sm">
                      No claimable interest yet
                    </Text>
                  )}
                  {lastInterestPayment && (
                    <Text color="gray.400" fontSize="xs">
                      Last payment: {daysAgo(lastInterestPayment)} days ago
                    </Text>
                  )}
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <Text fontWeight="bold" fontSize="lg" color="lime">
                    {estimatedClaimableInterest.toFixed(3)} HBD
                  </Text>
                  <Button
                    bg="lime"
                    color="black"
                    _hover={{ bg: "green.400" }}
                    size="sm"
                    isDisabled={
                      daysUntilClaim > 0 || estimatedClaimableInterest <= 0
                    }
                    onClick={onClaimInterest}
                  >
                    {daysUntilClaim > 0 ? `${daysUntilClaim}d` : "CLAIM"}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}

          {/* Investment Info */}
          <Box p={3} borderRadius="md" bg={theme.colors.muted}>
            <Text fontSize="sm" fontWeight="bold" mb={1}>
              📈 Investment Details
            </Text>
            <Text fontSize="xs" color="text" mb={1}>
              •{" "}
              <Text as="span" color="lime" fontWeight="bold">
                15% APR
              </Text>{" "}
              guaranteed returns
            </Text>
            <Text fontSize="xs" color="text" mb={1}>
              • Monthly interest payments
            </Text>
            <Text fontSize="xs" color="text">
              • 3-day withdrawal period for security
            </Text>
          </Box>
        </VStack>
      </Box>
    );
  }

  // Default view: Show both liquid and savings HBD with collapsible info
  return (
    <Box mb={3}>
      <HStack align="center" mb={2} spacing={2} width="100%">
        <CustomHiveIcon color="lime" />
        <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold">
          HBD
        </Text>
        <IconButton
          aria-label="Info about HBD"
          icon={<FaQuestionCircle />}
          size="xs"
          variant="ghost"
          color="gray.400"
          onClick={handleInfoToggle}
        />
        <Box flex={1} />
        <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold">
          {hbdBalance}
        </Text>
        <HStack spacing={1}>
          <Tooltip label="Send HBD" hasArrow>
            <IconButton
              aria-label="Send HBD"
              icon={<FaPaperPlane />}
              size="sm"
              bg="primary"
              color="background"
              _hover={{ bg: "accent" }}
              onClick={handleSendHBD}
            />
          </Tooltip>
          <Tooltip label="Send HBD to Savings" hasArrow>
            <IconButton
              aria-label="Send to Savings"
              icon={<FaArrowDown />}
              size="sm"
              bg="primary"
              color="background"
              _hover={{ bg: "accent" }}
              onClick={handleSendToSavings}
            />
          </Tooltip>
        </HStack>
      </HStack>

      {showInfo && (
        <Text color="gray.400" fontSize="sm" mb={4} pl={8}>
          A token that is always worth ~1 dollar of hive. It is often rewarded
          on posts along with HIVE.
        </Text>
      )}

      {/* HBD SAVINGS - Compact version */}
      <Box mb={4}>
        <HStack align="center" mb={2} spacing={2} width="100%">
          <Image
            src="/images/hbd_savings.png"
            alt="HBD Savings Logo"
            width="6"
            height="6"
          />
          <Text fontSize={{ base: "lg", md: "2xl" }} fontWeight="bold">
            HBD SAVINGS
          </Text>
          <Badge colorScheme="green" fontSize="xs">
            15% APR
          </Badge>
          <Box flex={1} />
          <VStack spacing={0} align="end">
            <Text
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="extrabold"
              color="lime"
            >
              {hbdSavingsBalance}
            </Text>
            {savingsUsdValue && (
              <Text fontSize="sm" color="gray.400">
                (${savingsUsdValue})
              </Text>
            )}
          </VStack>
          <Tooltip label="Unstake HBD" hasArrow>
            <IconButton
              aria-label="Unstake HBD"
              icon={<FaArrowUp />}
              size="sm"
              bg="primary"
              color="background"
              _hover={{ bg: "accent" }}
              onClick={handleWithdrawFromSavingsAlt}
            />
          </Tooltip>
        </HStack>

        {/* Claimable Interest - Compact */}
        {estimatedClaimableInterest > 0 && (
          <Box
            p={3}
            bg="background"
            borderRadius="md"
            border="1px solid"
            borderColor="primary"
            ml={8}
          >
            <HStack justify="space-between">
              <Box>
                <Text fontWeight="bold" fontSize="sm">
                  Claimable Interest
                </Text>
                {lastInterestPayment && (
                  <Text color="gray.400" fontSize="xs">
                    Last payment: {lastPaymentDays} days ago
                  </Text>
                )}
              </Box>
              <HStack>
                <Text fontWeight="bold" fontSize="md">
                  {estimatedClaimableInterest.toFixed(3)} HBD
                </Text>
                <Button
                  bg="primary"
                  color="background"
                  _hover={{ bg: "accent" }}
                  size="sm"
                  isDisabled={
                    daysUntilClaim > 0 || estimatedClaimableInterest <= 0
                  }
                  onClick={onClaimInterest}
                >
                  {daysUntilClaim > 0 ? `${daysUntilClaim}d` : "CLAIM"}
                </Button>
              </HStack>
            </HStack>
          </Box>
        )}
      </Box>
    </Box>
  );
});

export default HBDSection;
