"use client";

import { useState, useEffect } from "react";
import { UploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { TrashIcon, PhotoIcon } from "@heroicons/react/24/outline";

interface ImageUploadProps {
  onUploadComplete: (url: string | string[]) => void;
  onRemove?: (url?: string) => void;
  existingImage?: string | null;
  label?: string;
  compact?: boolean;
  multiple?: boolean;
  onUploadBegin?: () => void;
  onUploadError?: (error: Error) => void;
}

export default function ImageUpload({ 
  onUploadComplete, 
  onRemove, 
  existingImage,
  label = "Upload Image",
  compact = false,
  multiple = false,
  onUploadBegin,
  onUploadError,
}: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(existingImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageHeight = compact ? "h-24" : "h-48";

  // Clean up on unmount if image wasn't saved
  useEffect(() => {
    return () => {
      if (imageUrl && !existingImage) {
        console.log("🧹 Cleaning up orphaned image:", imageUrl);
      }
    };
  }, [imageUrl, existingImage]);

  const handleUploadComplete = (res: any[]) => {
    if (res && res.length > 0) {
      if (multiple && res.length > 1) {
        const urls = res.map(file => file.ufsUrl || file.url);
        onUploadComplete(urls);
      } else {
        const url = res[0].ufsUrl || res[0].url;
        setImageUrl(url);
        onUploadComplete(url);
      }
      setError(null);
    }
    setIsUploading(false);
  };

  const handleUploadError = (error: any) => {
    console.error("Upload error:", error);
    setError(error.message || "Upload failed");
    setIsUploading(false);
    if (onUploadError) onUploadError(error);
  };

  const handleRemove = () => {
    if (imageUrl && !existingImage) {
      console.log("🧹 Cleaning up removed image:", imageUrl);
    }
    setImageUrl(null);
    if (onRemove) onRemove();
  };

  return (
    <div className="w-full">
      {error && (
        <div className="p-2 mb-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
          {error}
        </div>
      )}
      
      {imageUrl && !multiple ? (
        <div className="relative group">
          <img 
            src={imageUrl} 
            alt="Uploaded" 
            crossOrigin="anonymous"
            className={`w-full ${imageHeight} object-cover rounded-lg border border-gray-200 dark:border-gray-700`}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <UploadButton<OurFileRouter, "imageUploader">
          endpoint="imageUploader"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={handleUploadError}
          onUploadBegin={() => {
            setIsUploading(true);
            setError(null);
            if (onUploadBegin) onUploadBegin();
          }}
          appearance={{
            button: {
              backgroundColor: 'transparent',
              border: '2px dashed #d1d5db',
              borderRadius: '0.75rem',
              padding: compact ? '1rem' : '1.5rem',
              width: '100%',
              minHeight: compact ? '80px' : '100px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              color: '#6b7280',
              transition: 'all 0.2s',
              cursor: 'pointer',
            },
            container: {
              width: '100%',
            },
            allowedContent: {
              display: 'none',
            },
          }}
        />
      )}
    </div>
  );
}