// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { utapi } from 'uploadthing/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, PDF' 
      }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size: 5MB' 
      }, { status: 400 });
    }

    // ✅ Upload to UploadThing (same as vendor/ticket images)
    const uploadResult = await utapi.uploadFiles(file);
    
    if (!uploadResult.data) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    console.log('File uploaded successfully:', {
      originalName: file.name,
      url: uploadResult.data.url,
      key: uploadResult.data.key,
      size: file.size,
      type: file.type,
      uploadedBy: session.user.email,
    });

    return NextResponse.json({
      success: true,
      url: uploadResult.data.url,
      key: uploadResult.data.key,
      originalName: file.name,
      size: file.size,
      type: file.type,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to upload file' 
    }, { status: 500 });
  }
}