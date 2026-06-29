"use client";

import { useState } from "react";
import { UploadButton } from "@uploadthing/react";
import { OurFileRouter } from "@/app/api/uploadthing/core";
import { TrashIcon } from "@heroicons/react/24/outline";

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onRemove?: () => void;
  existingImage?: string | null;
  label?: string;
}

export default function ImageUpload({ 
  onUploadComplete, 
  onRemove, 
  existingImage,
  label = "Upload Image"
}: ImageUploadProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(existingImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}
      
      {imageUrl ? (
        <div className="relative">
          <img 
            src={imageUrl} 
            alt="Uploaded" 
            className="w-full h-48 object-cover rounded-xl"
          />
          <button
            type="button"
            onClick={() => {
              setImageUrl(null);
              if (onRemove) onRemove();
            }}
            className="absolute top-2 right-2 p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
          >
            <TrashIcon className="h-4 w-4 text-white" />
          </button>
        </div>
      ) : (
        <div className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center p-6">
          <UploadButton<OurFileRouter>
            endpoint="imageUploader"
            onClientUploadComplete={(res) => {
              if (res && res[0]) {
                const url = res[0].ufsUrl || res[0].url;
                setImageUrl(url);
                onUploadComplete(url);
                setError(null);
              }
              setIsUploading(false);
            }}
            onUploadError={(error) => {
              console.error("Upload error:", error);
              setError(error.message || "Upload failed");
              setIsUploading(false);
            }}
            onUploadBegin={() => {
              setIsUploading(true);
              setError(null);
            }}
            className="ut-button:bg-indigo-600 ut-button:text-white ut-button:hover:bg-indigo-700 ut-button:rounded-lg ut-button:px-4 ut-button:py-2"
          />
          <p className="text-xs text-gray-400 mt-2">{label}</p>
          {isUploading && (
            <p className="text-sm text-indigo-600 mt-2">Uploading...</p>
          )}
        </div>
      )}
    </div>
  );
}