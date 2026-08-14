/**
 * Browser Studio routes
 * Development work by David Lane
 */
import { Router } from 'express';
import multer from 'multer';
import studioController from '../controllers/studio.controller.js';

const router = Router();

const bounceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      /audio\//.test(file.mimetype || '') ||
      /\.(wav|webm|ogg|opus|mp3)$/i.test(name);
    cb(null, !!ok);
  },
});

router.get('/health', studioController.getHealth);
router.post('/sessions', studioController.postSession);
router.get('/sessions/:code', studioController.getSessionByCode);
router.post('/livekit-token', studioController.postLivekitToken);
router.post('/listen/unlock', studioController.postListenUnlock);
router.get('/releases', studioController.getReleases);
router.get('/releases/:id/audio', studioController.getReleaseAudio);
router.post('/releases', bounceUpload.single('audio'), studioController.postRelease);
router.post('/assistant/chat', studioController.postEngineerChat);
router.post('/egress/audio', studioController.postStudioAudioEgress);
router.post('/egress/stop', studioController.postStudioAudioEgressStop);

export default router;
