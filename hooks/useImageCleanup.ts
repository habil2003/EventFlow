// hooks/useImageCleanup.ts

import { useState } from "react";

interface UseImageCleanupProps {
  mainImage: string | null;
  galleryImages: string[];
  isSaved: boolean;
  onCleanup?: () => void;
}

export function useImageCleanup({
  mainImage,
  galleryImages,
  isSaved,
  onCleanup,
}: UseImageCleanupProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // ✅ Only detect orphaned images if there are images AND not saved
  // AND there's no original image (meaning they were just uploaded)
  const orphanedImages: string[] = [];
  
  // Simple check: if there are images and not saved, but we're not in edit mode
  // We'll just return empty array since images are already in database
  const hasOrphaned = false;

  const cleanupImages = async (urls: string[]) => {
    // Do nothing - images are already in database
    console.log("🧹 Cancel clicked - no cleanup needed");
    return true;
  };

  return { 
    orphanedImages, 
    isCleaningUp, 
    cleanupImages 
  };
}