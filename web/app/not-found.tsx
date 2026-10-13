import type { Metadata } from "next";
import ComingSoon from "@/components/ComingSoon";

export const metadata: Metadata = {
  title: "Page not found · PikaMd",
};

export default function NotFound() {
  return <ComingSoon title="404" description="This page could not be found." />;
}
