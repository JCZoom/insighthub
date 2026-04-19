import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { getCurrentUser } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dashboardId, thumbnail } = await request.json();

    if (!dashboardId || !thumbnail) {
      return NextResponse.json(
        { error: 'Missing dashboardId or thumbnail data' },
        { status: 400 }
      );
    }

    // Validate dashboard ID format (basic security check)
    if (!/^[a-zA-Z0-9-_]+$/.test(dashboardId)) {
      return NextResponse.json(
        { error: 'Invalid dashboard ID format' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL
    const base64Data = thumbnail.replace(/^data:image\/[a-z]+;base64,/, '');

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Validate image size (limit to 5MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Thumbnail too large (max 5MB)' },
        { status: 413 }
      );
    }

    // Define file path
    const thumbnailsDir = join(process.cwd(), 'public', 'thumbnails');
    const filePath = join(thumbnailsDir, `${dashboardId}.png`);

    // Save the thumbnail
    await writeFile(filePath, imageBuffer);

    return NextResponse.json({
      success: true,
      path: `/thumbnails/${dashboardId}.png`
    });

  } catch (error) {
    console.error('Thumbnail save error:', error);
    return NextResponse.json(
      { error: 'Failed to save thumbnail' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get('dashboardId');

    if (!dashboardId) {
      return NextResponse.json(
        { error: 'Missing dashboardId parameter' },
        { status: 400 }
      );
    }

    // Validate dashboard ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(dashboardId)) {
      return NextResponse.json(
        { error: 'Invalid dashboard ID format' },
        { status: 400 }
      );
    }

    // Define file path
    const thumbnailsDir = join(process.cwd(), 'public', 'thumbnails');
    const filePath = join(thumbnailsDir, `${dashboardId}.png`);

    try {
      // Check if file exists
      await access(filePath);

      // Delete the thumbnail
      await unlink(filePath);

      return NextResponse.json({ success: true });
    } catch (error) {
      // File doesn't exist or couldn't be deleted
      return NextResponse.json(
        { error: 'Thumbnail not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Thumbnail delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete thumbnail' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get('dashboardId');

    if (!dashboardId) {
      return NextResponse.json(
        { error: 'Missing dashboardId parameter' },
        { status: 400 }
      );
    }

    // Validate dashboard ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(dashboardId)) {
      return NextResponse.json(
        { error: 'Invalid dashboard ID format' },
        { status: 400 }
      );
    }

    // Define file path
    const thumbnailsDir = join(process.cwd(), 'public', 'thumbnails');
    const filePath = join(thumbnailsDir, `${dashboardId}.png`);

    try {
      // Check if file exists
      await access(filePath);

      return NextResponse.json({
        exists: true,
        path: `/thumbnails/${dashboardId}.png`
      });
    } catch (error) {
      return NextResponse.json({
        exists: false
      });
    }

  } catch (error) {
    console.error('Thumbnail check error:', error);
    return NextResponse.json(
      { error: 'Failed to check thumbnail' },
      { status: 500 }
    );
  }
}