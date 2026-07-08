export const ATTENDANCE_CONFIG = {
  GEO_VALIDATION_ENABLED: process.env.ATTENDANCE_GEO_VALIDATION_ENABLED !== 'false',
  OFFICE_LAT: parseFloat(process.env.ATTENDANCE_OFFICE_LAT ?? '-6.9003789'),
  OFFICE_LNG: parseFloat(process.env.ATTENDANCE_OFFICE_LNG ?? '107.6135768'),
  MAX_RADIUS_M: parseInt(process.env.ATTENDANCE_MAX_RADIUS_M ?? '200', 10),
} as const
