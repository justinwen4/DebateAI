"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Handles legacy implicit-flow hash errors that the server callback route cannot read. */
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const errorCode = hashParams.get("error_code");
    const error = hashParams.get("error");
    const errorDescription = hashParams.get("error_description");

    if (errorCode === "otp_expired" || error === "access_denied") {
      router.replace("/auth/error?code=otp_expired");
      return;
    }

    if (errorDescription) {
      router.replace(`/auth/error?reason=${encodeURIComponent(errorDescription.replace(/\+/g, " "))}`);
    }
  }, [router]);

  return null;
}
