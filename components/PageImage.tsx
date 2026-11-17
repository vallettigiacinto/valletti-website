"use client";

import Image from "next/image";
import { useAdminStore } from "@/lib/admin-store";

/**
 * Renders a page-section image that Roberto can change from
 * /admin/pages (Page Content). Falls back to the seeded default if no
 * picture has been chosen for that section yet.
 * Picture choices are loaded from Supabase (or /data locally) via the
 * shared store, see lib/admin-store.tsx.
 */
export default function PageImage({
  sectionKey,
  fallbackSrc,
  alt,
  className,
  sizes = "100vw",
  priority = false,
}: {
  sectionKey: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  /** Passed to next/image so the browser picks a large enough file. */
  sizes?: string;
  /** Preload the image (use for the above-the-fold hero only). */
  priority?: boolean;
}) {
  const { pageImages, mediaUrl } = useAdminStore();
  const src = mediaUrl(pageImages[sectionKey]) ?? fallbackSrc;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}
