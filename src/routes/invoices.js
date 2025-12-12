import express from 'express';
import {
  generateInvoice,
  getInvoicePDF,
  getInvoiceByOrderId,
  getAllInvoices
} from '../controllers/invoiceController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * User invoice routes (require authentication)
 */

// Generate invoice for an order
router.post('/generate', authenticate, generateInvoice);

// Get invoice PDF
router.get('/:invoiceId/pdf', authenticate, getInvoicePDF);

// Get invoice by order ID
router.get('/order/:orderId', authenticate, getInvoiceByOrderId);

/**
 * Admin invoice routes (require authentication and admin role)
 */

// Get all invoices (admin)
router.get('/admin/all', authenticate, requireAdmin, getAllInvoices);

// Test endpoint - creates a test order and invoice
router.post('/test', authenticate, async (req, res) => {
  const { PrismaClient } = await import('../generated/prisma/index.js');
  const prisma = new PrismaClient();

  try {
    // Create test order
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        firstName: req.user.profile?.firstName || 'Test',
        lastName: req.user.profile?.lastName || 'User',
        email: req.user.email,
        phone: '+56912345678',
        taxId: '12345678-9',
        shippingAddress: '123 Test Street',
        shippingCity: 'Santiago',
        shippingPostalCode: '8320000',
        shippingCountry: 'Chile',
        billingAddress: '123 Test Street',
        billingCity: 'Santiago',
        billingPostalCode: '8320000',
        billingCountry: 'Chile',
        subtotal: 48.00,
        shippingCost: 5.00,
        total: 53.00,
        status: 'PROCESSING',
        paymentStatus: 'PAID',
        paymentMethod: 'WEBPAY',
        paymentDate: new Date(),
        items: {
          create: [
            {
              productId: '1', // Assumes product ID 1 exists
              name: 'Test Candle',
              price: 48.00,
              quantity: 1
            }
          ]
        }
      },
      include: { items: true }
    });

    // Generate invoice using the controller
    req.body = { orderId: order.id };
    const { generateInvoice } = await import('../controllers/invoiceController.js');
    await generateInvoice(req, res);
  } catch (error) {
    console.error('Test invoice error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
});

export default router;
