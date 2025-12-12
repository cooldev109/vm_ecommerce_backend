import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure invoices directory exists
const INVOICES_DIR = path.join(__dirname, '../../invoices');
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

/**
 * Generate invoice for a paid order
 * POST /api/invoices/generate
 * Body: { orderId }
 */
export async function generateInvoice(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'Order ID is required'
        }
      });
    }

    // Find order and verify ownership
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    // Verify order is paid
    if (order.paymentStatus !== 'PAID') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ORDER_NOT_PAID',
          message: 'Invoice can only be generated for paid orders'
        }
      });
    }

    // Check if invoice already exists
    let invoice = await prisma.invoice.findUnique({
      where: { orderId }
    });

    if (invoice) {
      return res.json({
        success: true,
        data: {
          invoice: {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            orderId: invoice.orderId,
            invoiceDate: invoice.invoiceDate,
            pdfUrl: `/api/invoices/${invoice.id}/pdf`
          },
          message: 'Invoice already exists'
        }
      });
    }

    // Generate invoice number (sequential)
    const invoiceCount = await prisma.invoice.count();
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Create invoice record
    invoice = await prisma.invoice.create({
      data: {
        id: invoiceNumber,
        invoiceNumber,
        orderId,
        userId: order.userId,
        invoiceDate: new Date(),
        customerType: order.taxId ? 'BUSINESS' : 'INDIVIDUAL',
        customerName: `${order.firstName} ${order.lastName}`,
        customerTaxId: order.taxId || '',
        customerEmail: order.email,
        customerAddress: `${order.shippingAddress}, ${order.shippingCity}, ${order.shippingPostalCode}, ${order.shippingCountry}`,
        items: order.items.map(item => ({
          productName: item.name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          total: parseFloat(item.price) * item.quantity
        })),
        subtotal: parseFloat(order.subtotal),
        taxAmount: 0, // Will calculate if needed
        shippingCost: parseFloat(order.shippingCost),
        total: parseFloat(order.total),
        status: 'ISSUED',
        pdfUrl: '' // Will be updated after PDF generation
      }
    });

    // Generate PDF
    const pdfFileName = `${invoice.id}.pdf`;
    const pdfPath = path.join(INVOICES_DIR, pdfFileName);

    await generateInvoicePDF(order, invoice, pdfPath);

    // Update invoice with PDF URL
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: `/api/invoices/${invoice.id}/pdf` }
    });

    logger.info('Invoice generated', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      orderId
    });

    res.status(201).json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          orderId: invoice.orderId,
          invoiceDate: invoice.invoiceDate,
          pdfUrl: invoice.pdfUrl
        }
      }
    });
  } catch (error) {
    logger.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVOICE_GENERATION_ERROR',
        message: 'Failed to generate invoice',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
}

/**
 * Generate PDF document for invoice
 */
async function generateInvoicePDF(order, invoice, pdfPath) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('V&M CANDLE EXPERIENCE', 50, 50);
      doc.fontSize(10).text('Velas Artesanales Premium', 50, 75);
      doc.fontSize(10).text('Santiago, Chile', 50, 90);
      doc.fontSize(10).text('contacto@vmcandles.com', 50, 105);

      // Invoice title
      doc.fontSize(16).text('FACTURA / INVOICE', 400, 50);
      doc.fontSize(10).text(`N°: ${invoice.invoiceNumber}`, 400, 70);
      doc.fontSize(10).text(`Fecha: ${new Date(invoice.invoiceDate).toLocaleDateString('es-CL')}`, 400, 85);
      doc.fontSize(10).text(`Orden: ${order.id}`, 400, 100);

      // Line separator
      doc.moveTo(50, 130).lineTo(550, 130).stroke();

      // Customer information
      doc.fontSize(12).text('CLIENTE / CUSTOMER', 50, 150);
      doc.fontSize(10).text(`Nombre: ${order.firstName} ${order.lastName}`, 50, 170);
      doc.fontSize(10).text(`Email: ${order.email}`, 50, 185);
      doc.fontSize(10).text(`Teléfono: ${order.phone}`, 50, 200);
      if (order.taxId) {
        doc.fontSize(10).text(`RUT: ${order.taxId}`, 50, 215);
      }

      // Shipping address
      doc.fontSize(12).text('DIRECCIÓN DE ENVÍO', 300, 150);
      doc.fontSize(10).text(order.shippingAddress, 300, 170);
      doc.fontSize(10).text(`${order.shippingCity}, ${order.shippingPostalCode}`, 300, 185);
      doc.fontSize(10).text(order.shippingCountry, 300, 200);

      // Line separator
      doc.moveTo(50, 240).lineTo(550, 240).stroke();

      // Table header
      const tableTop = 260;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('PRODUCTO', 50, tableTop);
      doc.text('CANTIDAD', 300, tableTop);
      doc.text('PRECIO', 380, tableTop);
      doc.text('SUBTOTAL', 470, tableTop);

      // Line under header
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Table rows
      doc.font('Helvetica');
      let yPosition = tableTop + 25;

      order.items.forEach(item => {
        const itemTotal = parseFloat(item.price) * item.quantity;

        doc.fontSize(9).text(item.name, 50, yPosition, { width: 230 });
        doc.text(item.quantity.toString(), 300, yPosition);
        doc.text(`$${parseFloat(item.price).toFixed(0)}`, 380, yPosition);
        doc.text(`$${itemTotal.toFixed(0)}`, 470, yPosition);

        yPosition += 25;
      });

      // Line before totals
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 15;

      // Totals
      doc.fontSize(10);
      doc.text('Subtotal:', 380, yPosition);
      doc.text(`$${parseFloat(order.subtotal).toFixed(0)}`, 470, yPosition);
      yPosition += 20;

      doc.text('Envío:', 380, yPosition);
      doc.text(`$${parseFloat(order.shippingCost).toFixed(0)}`, 470, yPosition);
      yPosition += 25;

      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('TOTAL:', 380, yPosition);
      doc.text(`$${parseFloat(order.total).toFixed(0)}`, 470, yPosition);

      // Footer
      doc.fontSize(8).font('Helvetica').text(
        'Gracias por su compra / Thank you for your purchase',
        50,
        750,
        { align: 'center', width: 500 }
      );

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        logger.info('PDF generated successfully', { pdfPath });
        resolve(pdfPath);
      });

      stream.on('error', (error) => {
        logger.error('Error writing PDF:', error);
        reject(error);
      });
    } catch (error) {
      logger.error('Error creating PDF:', error);
      reject(error);
    }
  });
}

/**
 * Get invoice PDF
 * GET /api/invoices/:invoiceId/pdf
 */
export async function getInvoicePDF(req, res) {
  try {
    const { invoiceId } = req.params;

    // Find invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        order: {
          select: { userId: true }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found'
        }
      });
    }

    // Verify user owns this invoice (or is admin)
    if (req.user.role !== 'ADMIN' && invoice.order.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }

    // Get PDF file
    const pdfPath = path.join(INVOICES_DIR, `${invoiceId}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PDF_NOT_FOUND',
          message: 'Invoice PDF not found'
        }
      });
    }

    // Send PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Error fetching invoice PDF:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PDF_FETCH_ERROR',
        message: 'Failed to fetch invoice PDF'
      }
    });
  }
}

/**
 * Get invoice by order ID
 * GET /api/invoices/order/:orderId
 */
export async function getInvoiceByOrderId(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Find order and verify ownership
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        invoice: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    if (!order.invoice) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found for this order'
        }
      });
    }

    res.json({
      success: true,
      data: {
        invoice: {
          id: order.invoice.id,
          invoiceNumber: order.invoice.invoiceNumber,
          orderId: order.invoice.orderId,
          invoiceDate: order.invoice.invoiceDate,
          pdfUrl: order.invoice.pdfUrl
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVOICE_FETCH_ERROR',
        message: 'Failed to fetch invoice'
      }
    });
  }
}

/**
 * Admin: Get all invoices
 * GET /api/admin/invoices
 */
export async function getAllInvoices(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { invoiceDate: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              total: true,
              status: true,
              paymentStatus: true
            }
          }
        }
      }),
      prisma.invoice.count()
    ]);

    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      total: invoice.total,
      status: invoice.status,
      pdfUrl: invoice.pdfUrl,
      order: {
        id: invoice.order.id,
        status: invoice.order.status,
        paymentStatus: invoice.order.paymentStatus
      }
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        invoices: formattedInvoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore: parseInt(page) < totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INVOICES_FETCH_ERROR',
        message: 'Failed to fetch invoices'
      }
    });
  }
}
