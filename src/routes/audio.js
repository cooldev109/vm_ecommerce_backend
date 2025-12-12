import express from 'express';
import {
  getAudioContent,
  getAudioById,
  getMyAudioLibrary,
  streamAudio,
  redeemAccessKey,
  createAudioContent,
  updateAudioContent,
  deleteAudioContent,
  generateAccessKeys,
  getAllAccessKeys,
} from '../controllers/audioController.js';
import { authenticate, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAudioContent); // List all audio (metadata only)
router.get('/:id', getAudioById); // Get single audio metadata

// Stream with optional auth (previews are public, full content requires auth)
router.get('/:id/stream', optionalAuth, streamAudio);

// User routes (authenticated)
router.get('/user/my-library', authenticate, getMyAudioLibrary); // Get user's accessible library
router.post('/redeem-key', authenticate, redeemAccessKey); // Redeem access key

// Admin routes
router.post('/admin', authenticate, requireAdmin, createAudioContent);
router.put('/admin/:id', authenticate, requireAdmin, updateAudioContent);
router.delete('/admin/:id', authenticate, requireAdmin, deleteAudioContent);
router.post('/admin/generate-keys', authenticate, requireAdmin, generateAccessKeys);
router.get('/admin/keys', authenticate, requireAdmin, getAllAccessKeys);

export default router;
