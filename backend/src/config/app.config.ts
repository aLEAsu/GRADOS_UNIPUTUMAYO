import { registerAs } from '@nestjs/config';

export interface AppConfig {
  port: number;
  environment: string;
  corsOrigin: string;
  uploadDir: string;
  maxFileSize: number;
  logLevel: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiration: string;
  refreshExpiration: string;
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  frontendCallbackUrl: string;
}

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface SignaturesConfig {
  privateKeyPath: string;
  certificatePath: string;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

export default registerAs('app', (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  environment: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'https://grados-utp-1.onrender.com',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
  logLevel: process.env.LOG_LEVEL || 'debug',
}));

export const jwtConfig = registerAs('jwt', (): JwtConfig => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret) {
    throw new Error('JWT_ACCESS_SECRET (or JWT_SECRET) must be defined in environment variables');
  }

  return {
    accessSecret,
    refreshSecret: refreshSecret || `${accessSecret}-refresh-key`,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || process.env.JWT_EXPIRATION || '1h',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  };
});

export const googleOAuthConfig = registerAs('google', (): GoogleOAuthConfig => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'https://grados-utp.onrender.com/api/v1/auth/google/callback',
  frontendCallbackUrl: process.env.FRONTEND_CALLBACK_URL || 'https://grados-utp-1.onrender.com/auth/callback',
}));

export const mailConfig = registerAs('mail', (): MailConfig => ({
  host: process.env.MAIL_HOST || 'localhost',
  port: parseInt(process.env.MAIL_PORT || '1025', 10),
  user: process.env.MAIL_USER || '',
  pass: process.env.MAIL_PASS || '',
  from: process.env.MAIL_FROM || 'noreply@itp.edu.co',
}));

export const signaturesConfig = registerAs('signatures', (): SignaturesConfig => ({
  privateKeyPath: process.env.SIGNATURE_PRIVATE_KEY_PATH || './certs/private-key.pem',
  certificatePath: process.env.SIGNATURE_CERT_PATH || './certs/certificate.pem',
}));

export const throttleConfig = registerAs('throttle', (): ThrottleConfig => ({
  ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
}));
