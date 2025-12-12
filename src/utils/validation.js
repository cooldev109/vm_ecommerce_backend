import { z } from 'zod';

/**
 * Validation schema for user registration
 */
export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).default('INDIVIDUAL'),
  taxId: z.string().optional(),
  preferredLanguage: z.enum(['ES', 'EN', 'FR', 'DE', 'PT', 'ZH', 'HI']).default('ES'),
});

/**
 * Validation schema for user login
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Validation schema for profile update
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  customerType: z.enum(['INDIVIDUAL', 'BUSINESS']).optional(),
  taxId: z.string().optional(),
  preferredLanguage: z.enum(['ES', 'EN', 'FR', 'DE', 'PT', 'ZH', 'HI']).optional(),
});

/**
 * Validation schema for address creation/update
 */
export const addressSchema = z.object({
  type: z.enum(['SHIPPING', 'BILLING']),
  street: z.string().min(1, 'Street is required').max(255),
  city: z.string().min(1, 'City is required').max(100),
  region: z.string().min(1, 'Region is required').max(100),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().min(1, 'Country is required').max(100).default('Chile'),
  isDefault: z.boolean().default(false),
});

/**
 * Middleware to validate request body against a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Get validation errors from Zod
      const zodErrors = result.error?.errors || result.error?.issues || [];

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: zodErrors.map(err => ({
            field: err.path ? err.path.join('.') : 'unknown',
            message: err.message,
          })),
        },
      });
    }

    req.body = result.data; // Replace body with validated data
    next();
  };
}

/**
 * Validation schema for query parameters (pagination, filters)
 */
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Validate Chilean RUT (Tax ID)
 * @param {string} rut - RUT to validate (format: 12345678-9)
 * @returns {boolean} True if RUT is valid
 */
export function validateRUT(rut) {
  if (!rut || typeof rut !== 'string') return false;

  // Remove dots and hyphens
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '');

  // Must have at least 2 characters (number + verifier)
  if (cleanRUT.length < 2) return false;

  const body = cleanRUT.slice(0, -1);
  const verifier = cleanRUT.slice(-1).toUpperCase();

  // Body must be numeric
  if (!/^\d+$/.test(body)) return false;

  // Calculate verifier digit
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const expectedVerifier = 11 - (sum % 11);
  let calculatedVerifier;

  if (expectedVerifier === 11) {
    calculatedVerifier = '0';
  } else if (expectedVerifier === 10) {
    calculatedVerifier = 'K';
  } else {
    calculatedVerifier = expectedVerifier.toString();
  }

  return verifier === calculatedVerifier;
}
