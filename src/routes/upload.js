/**
 * Upload Routes
 * Handles file uploads for product images and audio files
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir('uploads/products');
ensureDir('uploads/audio');

// Configure multer storage for images
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/products/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer storage for audio
const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/audio/');
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - only allow images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp)'));
  }
};

// File filter - only allow audio
const audioFilter = (req, file, cb) => {
  const allowedTypes = /mp3|wav|ogg|m4a|aac/;
  const allowedMimes = /audio\/(mpeg|mp3|wav|ogg|m4a|aac|x-m4a)/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimes.test(file.mimetype);

  if (mimetype || extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed (mp3, wav, ogg, m4a, aac)'));
  }
};

// Configure multer upload for images
const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: imageFilter
});

// Configure multer upload for audio
const uploadAudio = multer({
  storage: audioStorage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for audio
  },
  fileFilter: audioFilter
});

/**
 * POST /api/upload/product-image
 * Upload a product image
 * Protected: Admin only
 */
router.post('/product-image', authenticate, requireAdmin, uploadImage.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No file uploaded'
        }
      });
    }

    // Return the file path that can be used in the database
    const filePath = `/uploads/products/${req.file.filename}`;

    res.json({
      success: true,
      filePath: filePath,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to upload image'
      }
    });
  }
});

/**
 * POST /api/upload/audio
 * Upload an audio file
 * Protected: Admin only
 */
router.post('/audio', authenticate, requireAdmin, uploadAudio.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          message: 'No file uploaded'
        }
      });
    }

    // Return the file path that can be used in the database
    const filePath = `/audio/${req.file.filename}`;

    res.json({
      success: true,
      filePath: filePath,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to upload audio'
      }
    });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          message: 'File size too large. Maximum size is 5MB'
        }
      });
    }
    return res.status(400).json({
      error: {
        message: error.message
      }
    });
  }

  if (error) {
    return res.status(400).json({
      error: {
        message: error.message
      }
    });
  }

  next();
});

export default router;
