// lib/uploadthing-cleanup.ts

import { UTApi } from "uploadthing/server";

// ✅ Create an instance of UTApi
const utapi = new UTApi();

/**
 * Delete a file from UploadThing by URL
 */
export async function deleteFileFromUploadThing(url: string): Promise<boolean> {
  try {
    const key = extractFileKey(url);
    if (!key) {
      console.warn("Could not extract file key from URL:", url);
      return false;
    }

    const result = await utapi.deleteFiles(key);
    console.log(`🧹 Deleted file: ${key}`, result);
    return result.success;
  } catch (error) {
    console.error("❌ Failed to delete file from UploadThing:", error);
    return false;
  }
}

/**
 * Delete multiple files from UploadThing
 */
export async function deleteFilesFromUploadThing(urls: string[]): Promise<boolean[]> {
  const results = await Promise.all(
    urls.map(url => deleteFileFromUploadThing(url))
  );
  return results;
}

/**
 * Extract the file key from a UploadThing URL
 */
function extractFileKey(url: string): string | null {
  try {
    const patterns = [
      /ufs\.sh\/f\/([^\/]+)/,
      /utfs\.io\/f\/([^\/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  } catch (error) {
    console.error("Error extracting file key:", error);
    return null;
  }
}

/**
 * Get all files from UploadThing
 */
export async function listAllFiles() {
  try {
    const files = await utapi.listFiles();
    return files;
  } catch (error) {
    console.error("❌ Failed to list files:", error);
    return null;
  }
}