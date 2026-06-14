import { Request, Response } from 'express';

// Mock latest version info
const LATEST_RELEASE = {
  version: '1.0.1',
  notes: 'Premium enterprise improvements, settings schema mapping, and installer rollback fixes.',
  pubDate: '2026-06-13T16:00:00Z',
  signature: 'dW51c2VkX2Zvcl9ub3dfYnV0X211c3RfYmVfcHJlc2VudF9zZWN1cmVfcGtleQo=' // Mock base64 signature
};

export function checkUpdate(req: Request, res: Response): void {
  const { version, platform, arch } = req.query;

  if (!version) {
    res.status(400).json({ message: 'Current client version parameter is required.' });
    return;
  }

  console.log(`[Update Server] Version check request: version=${version}, platform=${platform}, arch=${arch}`);

  // Compare versions (assume v1.0.0 is older than v1.0.1)
  if (version === '1.0.0') {
    // Return Tauri-compliant update manifest JSON
    res.json({
      url: `http://localhost:5000/updates/download/desktop-agent-native_1.0.1_${arch}.msi.zip`,
      signature: LATEST_RELEASE.signature,
      version: LATEST_RELEASE.version,
      notes: LATEST_RELEASE.notes,
      pub_date: LATEST_RELEASE.pubDate
    });
  } else {
    // If version is up to date, Tauri updater expects a 204 No Content response
    res.status(204).end();
  }
}

export function downloadUpdate(req: Request, res: Response): void {
  const filename = req.params.filename || 'update.zip';
  console.log(`[Update Server] Downloading update payload: ${filename}`);

  // Serve a dummy zip file
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-Type', 'application/zip');
  
  // Send 1KB dummy zip buffer
  const dummyZip = Buffer.alloc(1024);
  res.send(dummyZip);
}

export function triggerRollbackCommand(req: Request, res: Response): void {
  console.log('[Update Server] Rollback command triggered by administrator.');
  res.json({
    status: 'SUCCESS',
    targetVersion: '1.0.0',
    message: 'Rollback instruction dispatched successfully.'
  });
}
