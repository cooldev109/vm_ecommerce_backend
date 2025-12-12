import Transbank from 'transbank-sdk';
const { WebpayPlus, Options, IntegrationApiKeys, Environment, IntegrationCommerceCodes } = Transbank;

/**
 * Webpay Plus configuration
 * In production, use production credentials from environment variables
 */

const isProduction = process.env.NODE_ENV === 'production';

// Configure Webpay Plus
const commerceCode = isProduction
  ? process.env.WEBPAY_COMMERCE_CODE
  : IntegrationCommerceCodes.WEBPAY_PLUS;

const apiKey = isProduction
  ? process.env.WEBPAY_API_KEY
  : IntegrationApiKeys.WEBPAY;

const environment = isProduction
  ? Environment.Production
  : Environment.Integration;

// Create Webpay Plus transaction instance
export const webpayTransaction = new WebpayPlus.Transaction(
  new Options(commerceCode, apiKey, environment)
);

// Webpay configuration constants
const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
export const WEBPAY_CONFIG = {
  returnUrl: process.env.WEBPAY_RETURN_URL || 'http://localhost:3000/api/payments/webpay/return',
  frontendReturnUrl: `${frontendBaseUrl}/payment/result`,
  frontendSubscriptionUrl: `${frontendBaseUrl}/subscription/result`,
  isProduction,
  commerceCode,
};

export default webpayTransaction;
