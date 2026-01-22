import crypto from 'crypto';
import logger from './logger.js';

/**
 * Flow.cl Payment Gateway Configuration
 * Documentation: https://www.flow.cl/docs/api.html
 */

// Determine Flow environment from FLOW_ENVIRONMENT variable
const flowEnv = process.env.FLOW_ENVIRONMENT || 'sandbox';
const isFlowProduction = flowEnv === 'production';

// Flow API URLs
const FLOW_API_URL = isFlowProduction
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api';

// Flow credentials from environment
const apiKey = process.env.FLOW_API_KEY;
const secretKey = process.env.FLOW_SECRET_KEY;

// Frontend/Backend URLs
const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

export const FLOW_CONFIG = {
  apiUrl: FLOW_API_URL,
  apiKey,
  secretKey,
  isProduction: isFlowProduction,
  environment: flowEnv,

  // Return URLs for different payment types
  urls: {
    // Order payments
    orderReturn: `${backendBaseUrl}/api/payments/flow/return`,
    orderConfirm: `${backendBaseUrl}/api/payments/flow/confirm`,
    frontendOrderResult: `${frontendBaseUrl}/payment/result`,

    // Subscription payments
    subscriptionReturn: `${backendBaseUrl}/api/subscriptions/flow/return`,
    subscriptionConfirm: `${backendBaseUrl}/api/subscriptions/flow/confirm`,
    frontendSubscriptionResult: `${frontendBaseUrl}/subscription/result`,

    // Subscription upgrade payments
    upgradeReturn: `${backendBaseUrl}/api/subscriptions/upgrade/flow/return`,
    upgradeConfirm: `${backendBaseUrl}/api/subscriptions/upgrade/flow/confirm`,
  }
};

/**
 * Generate HMAC-SHA256 signature for Flow API
 * @param {Object} params - Parameters to sign (sorted alphabetically)
 * @returns {string} - HMAC-SHA256 signature
 */
export function generateFlowSignature(params) {
  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();

  // Create string from sorted parameters
  const dataToSign = sortedKeys
    .map(key => `${key}${params[key]}`)
    .join('');

  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(dataToSign);
  return hmac.digest('hex');
}

/**
 * Make a signed request to Flow API
 * @param {string} endpoint - API endpoint (e.g., '/payment/create')
 * @param {Object} params - Request parameters
 * @param {string} method - HTTP method ('GET' or 'POST')
 * @returns {Promise<Object>} - API response
 */
export async function flowApiRequest(endpoint, params = {}, method = 'POST') {
  // Add API key to params
  const requestParams = {
    ...params,
    apiKey
  };

  // Generate signature
  const signature = generateFlowSignature(requestParams);
  requestParams.s = signature;

  const url = `${FLOW_API_URL}${endpoint}`;

  logger.info('Flow API request', { endpoint, method, params: { ...requestParams, s: '[HIDDEN]' } });

  let response;
  if (method === 'GET') {
    const queryString = new URLSearchParams(requestParams).toString();
    response = await fetch(`${url}?${queryString}`, { method: 'GET' });
  } else {
    // POST with form data
    const formData = new URLSearchParams();
    Object.entries(requestParams).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
  }

  const responseText = await response.text();

  if (!response.ok) {
    logger.error('Flow API error', { status: response.status, body: responseText });
    throw new Error(`Flow API error: ${response.status} - ${responseText}`);
  }

  try {
    const jsonResponse = JSON.parse(responseText);
    logger.info('Flow API response', { endpoint, response: jsonResponse });
    return jsonResponse;
  } catch (e) {
    logger.error('Flow API invalid JSON response', { body: responseText });
    throw new Error(`Flow API returned invalid JSON: ${responseText}`);
  }
}

/**
 * Create a Flow payment
 * @param {Object} paymentData - Payment details
 * @returns {Promise<Object>} - Flow payment response with URL and token
 */
export async function createFlowPayment({
  commerceOrder,
  subject,
  currency = 'CLP',
  amount,
  email,
  urlConfirmation,
  urlReturn,
  optional = {}
}) {
  const params = {
    commerceOrder,
    subject,
    currency,
    amount: Math.round(amount), // Flow requires integer amounts
    email,
    urlConfirmation,
    urlReturn,
    ...optional
  };

  return flowApiRequest('/payment/create', params);
}

/**
 * Get payment status by token
 * @param {string} token - Flow token
 * @returns {Promise<Object>} - Payment status
 */
export async function getFlowPaymentStatus(token) {
  return flowApiRequest('/payment/getStatus', { token }, 'GET');
}

/**
 * Get payment status by Flow order number
 * @param {number} flowOrder - Flow order number
 * @returns {Promise<Object>} - Payment status
 */
export async function getFlowPaymentByFlowOrder(flowOrder) {
  return flowApiRequest('/payment/getStatusByFlowOrder', { flowOrder }, 'GET');
}

/**
 * Flow Payment Status Codes
 * 1 = Pending
 * 2 = Paid
 * 3 = Rejected
 * 4 = Cancelled
 */
export const FLOW_STATUS = {
  PENDING: 1,
  PAID: 2,
  REJECTED: 3,
  CANCELLED: 4
};

export default FLOW_CONFIG;
