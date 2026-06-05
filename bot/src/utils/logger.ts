type LogMeta = Record<string, unknown>;

const maskPhone = (value: string): string => {
  if (value.length <= 6) return value;
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
};

const formatMeta = (meta?: LogMeta): string => {
  if (!meta) return "";
  return ` ${JSON.stringify(meta)}`;
};

export const truncate = (value: string, maxLength = 120): string => {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
};

export const logInfo = (message: string, meta?: LogMeta): void => {
  console.info(`[info] ${message}${formatMeta(meta)}`);
};

export const logWarn = (message: string, meta?: LogMeta): void => {
  console.warn(`[warn] ${message}${formatMeta(meta)}`);
};

export const logError = (message: string, meta?: LogMeta): void => {
  console.error(`[error] ${message}${formatMeta(meta)}`);
};

export const logPhone = (phoneNumber: string): string => {
  return maskPhone(phoneNumber);
};
