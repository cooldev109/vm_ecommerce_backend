import Transbank from 'transbank-sdk';
const { WebpayPlus, Options, IntegrationApiKeys, Environment, IntegrationCommerceCodes } = Transbank;

/**
 * Webpay Plus configuration
 * In production, use production credentials from environment variables
 */

// Determine Webpay environment from WEBPAY_ENVIRONMENT variable
// Can be 'integration' or 'production'
const webpayEnv = process.env.WEBPAY_ENVIRONMENT || 'integration';
const isWebpayProduction = webpayEnv === 'production';

// Configure Webpay Plus
// Use environment variables if provided, otherwise use SDK defaults
const commerceCode = process.env.WEBPAY_COMMERCE_CODE ||
  IntegrationCommerceCodes.WEBPAY_PLUS;

const apiKey = process.env.WEBPAY_API_KEY ||
  IntegrationApiKeys.WEBPAY;

const environment = isWebpayProduction
  ? Environment.Production
  : Environment.Integration;

// Create Webpay Plus transaction instance
export const webpayTransaction = new WebpayPlus.Transaction(
  new Options(commerceCode, apiKey, environment)
);

// Webpay configuration constants
const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

export const WEBPAY_CONFIG = {
  returnUrl: process.env.WEBPAY_RETURN_URL || `${backendBaseUrl}/api/payments/webpay/return`,
  frontendReturnUrl: `${frontendBaseUrl}/payment/result`,
  frontendSubscriptionUrl: `${frontendBaseUrl}/subscription/result`,
  isProduction: isWebpayProduction,
  environment: webpayEnv,
  commerceCode,
};

export default webpayTransaction;
