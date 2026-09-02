/**
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getAirNowCurrentLatLong,
  getAirNowCurrentZip,
  getAirNowForecastLatLong,
  getAirNowHealth,
  getAirNowHistoricalLatLong,
  getAirNowHistoricalZip,
} from '../controllers/airnow.controller.js';

const router = Router();

router.get('/health', getAirNowHealth);
router.get('/observation/latlong/current', getAirNowCurrentLatLong);
router.get('/observation/zip/current', getAirNowCurrentZip);
router.get('/observation/latlong/historical', getAirNowHistoricalLatLong);
router.get('/observation/zip/historical', getAirNowHistoricalZip);
router.get('/forecast/latlong', getAirNowForecastLatLong);

export default router;
