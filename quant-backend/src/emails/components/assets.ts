// Single source of truth for where email images live.
// In the preview this resolves to emails/static on your machine.
// When the backend sends the real email, mailService sets EMAIL_ASSET_BASE to the
// public URL where the images are hosted. Read at render time (not import time)
// so that value is always picked up.
export const assetUrl = (file: string) =>
  `${process.env.EMAIL_ASSET_BASE ?? "/static"}/${file}`;
