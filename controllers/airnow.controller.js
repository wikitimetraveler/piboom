/**
 * Development work by David Lane
 */
import {
  getAirNowStatus,
  getCurrentObservationByLatLong,
  getCurrentObservationByZip,
  getForecastByLatLong,
  getHistoricalObservationByLatLong,
  getHistoricalObservationByZip,
} from '../services/airnow.service.js';

function mapError(res, error) {
  const code = error?.code || 'AIRNOW_ERROR';
  if (code === 'AIRNOW_NOT_CONFIGURED') {
    return res.status(503).json({ ok: false, error: code, message: error.message });
  }
  if (code === 'INVALID_LAT' || code === 'INVALID_LON' || code === 'INVALID_ZIP' || code === 'INVALID_DATE' || code === 'INVALID_DISTANCE') {
    return res.status(400).json({ ok: false, error: code, message: error.message });
  }
  if (code === 'AIRNOW_HTTP_ERROR') {
    return res.status(error.status >= 400 ? error.status : 502).json({
      ok: false,
      error: code,
      message: error.message,
    });
  }
  console.error('airnow:', error.message);
  return res.status(500).json({ ok: false, error: code, message: 'AirNow request failed' });
}

export async function getAirNowHealth(_req, res) {
  res.json({ ok: true, ...getAirNowStatus() });
}

export async function getAirNowCurrentLatLong(req, res) {
  try {
    const payload = await getCurrentObservationByLatLong({
      lat: req.query.lat ?? req.query.latitude,
      lon: req.query.lon ?? req.query.longitude,
      distance: req.query.distance,
    });
    return res.json(payload);
  } catch (error) {
    return mapError(res, error);
  }
}

export async function getAirNowCurrentZip(req, res) {
  try {
    const payload = await getCurrentObservationByZip({
      zipCode: req.query.zip ?? req.query.zipCode,
      distance: req.query.distance,
    });
    return res.json(payload);
  } catch (error) {
    return mapError(res, error);
  }
}

export async function getAirNowHistoricalLatLong(req, res) {
  try {
    const payload = await getHistoricalObservationByLatLong({
      lat: req.query.lat ?? req.query.latitude,
      lon: req.query.lon ?? req.query.longitude,
      date: req.query.date,
      distance: req.query.distance,
    });
    return res.json(payload);
  } catch (error) {
    return mapError(res, error);
  }
}

export async function getAirNowHistoricalZip(req, res) {
  try {
    const payload = await getHistoricalObservationByZip({
      zipCode: req.query.zip ?? req.query.zipCode,
      date: req.query.date,
      distance: req.query.distance,
    });
    return res.json(payload);
  } catch (error) {
    return mapError(res, error);
  }
}

export async function getAirNowForecastLatLong(req, res) {
  try {
    const payload = await getForecastByLatLong({
      lat: req.query.lat ?? req.query.latitude,
      lon: req.query.lon ?? req.query.longitude,
      date: req.query.date,
    });
    return res.json(payload);
  } catch (error) {
    return mapError(res, error);
  }
}

export default {
  getAirNowHealth,
  getAirNowCurrentLatLong,
  getAirNowCurrentZip,
  getAirNowHistoricalLatLong,
  getAirNowHistoricalZip,
  getAirNowForecastLatLong,
};
