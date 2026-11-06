import type { Metadata } from "next";
import ApiAccess from "@/components/ApiAccess";

export const metadata: Metadata = {
  title: "API Access — LegalCompass",
  description: "Public LegalCompass API: key, base URL, examples and a live tester for IPC↔BNS, CrPC↔BNSS and IEA↔BSA lookups.",
};

export default function Page() {
  return <ApiAccess />;
}
