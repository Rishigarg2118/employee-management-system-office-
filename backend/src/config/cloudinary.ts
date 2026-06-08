import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

/**
 * Uploads a local file to Cloudinary and deletes the local file afterwards.
 * @param localFilePath Absolute path to the local file
 * @param folder Cloudinary folder name (e.g. 'avatars', 'documents')
 * @returns Object with secure_url and public_id
 */
export async function uploadToCloudinary(
  localFilePath: string,
  folder: string
): Promise<{ secure_url: string; public_id: string }> {
  const isCloudinaryConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (!isCloudinaryConfigured) {
    console.warn('[Cloudinary] Warning: Cloudinary credentials missing. Serving file locally.');
    const filename = path.basename(localFilePath);
    return {
      secure_url: `/uploads/${filename}`,
      public_id: `local_${filename}`
    };
  }

  let uploadSuccess = false;
  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: `premium_hrms/${folder}`,
      resource_type: 'auto',
    });
    uploadSuccess = true;
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (err) {
    console.error('[Cloudinary Upload Error]:', err);
    console.warn('[Cloudinary] Warning: Upload failed. Falling back to local serving.');
    const filename = path.basename(localFilePath);
    return {
      secure_url: `/uploads/${filename}`,
      public_id: `local_${filename}`
    };
  } finally {
    // Only delete local temp file if Cloudinary upload succeeded.
    // If it failed/was unconfigured, we keep the file in /uploads for static serving.
    if (uploadSuccess) {
      try {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
      } catch (unlinkErr) {
        console.warn(`[Cloudinary] Failed to delete local temp file: ${localFilePath}`, unlinkErr);
      }
    }
  }
}

/**
 * Deletes a file from Cloudinary by its public ID.
 * @param publicId Cloudinary public ID of the resource
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[Cloudinary Delete Error]:', err);
  }
}
