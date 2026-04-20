import { Metadata } from "next";
import InviteWrapper from "./InviteWrapper";

export const metadata: Metadata = {
  title: "Invite | Skatehive",
  description: "Join Skatehive through an invite link.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function InvitePage() {
  return <InviteWrapper />;
}
