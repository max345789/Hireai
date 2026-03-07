class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

function throwValidation(message) {
  throw new ValidationError(message, 400);
}

function asString(value, field, options = {}) {
  const { required = false, min = 0, max = 5000, trim = true, allowEmpty = false } = options;

  if (value == null) {
    if (required) throwValidation(`${field} is required`);
    return null;
  }

  if (typeof value !== 'string') {
    throwValidation(`${field} must be a string`);
  }

  const normalized = trim ? value.trim() : value;

  if (!allowEmpty && normalized.length === 0) {
    if (required) throwValidation(`${field} is required`);
    return null;
  }

  if (normalized.length < min) {
    throwValidation(`${field} must be at least ${min} characters`);
  }

  if (normalized.length > max) {
    throwValidation(`${field} must be <= ${max} characters`);
  }

  return normalized;
}

function asEnum(value, field, allowed, options = {}) {
  const { required = false, fallback = null } = options;

  if (value == null || value === '') {
    if (required) throwValidation(`${field} is required`);
    return fallback;
  }

  if (!allowed.includes(value)) {
    throwValidation(`${field} must be one of: ${allowed.join(', ')}`);
  }

  return value;
}

function asBoolean(value, field, options = {}) {
  const { required = false, fallback = false } = options;

  if (value == null) {
    if (required) throwValidation(`${field} is required`);
    return fallback;
  }

  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;

  throwValidation(`${field} must be a boolean`);
}

function asInteger(value, field, options = {}) {
  const { required = false, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, fallback = null } = options;

  if (value == null || value === '') {
    if (required) throwValidation(`${field} is required`);
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throwValidation(`${field} must be an integer`);
  }

  if (parsed < min || parsed > max) {
    throwValidation(`${field} must be between ${min} and ${max}`);
  }

  return parsed;
}

function asEmail(value, field, options = {}) {
  const normalized = asString(value, field, { required: options.required, min: 3, max: 320 });
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowered);
  if (!valid) throwValidation(`${field} must be a valid email`);
  return lowered;
}

function asPhone(value, field, options = {}) {
  const normalized = asString(value, field, { required: options.required, min: 7, max: 32 });
  if (!normalized) return null;

  const cleaned = normalized.replace(/\s+/g, '');
  const valid = /^\+?[0-9().-]{7,32}$/.test(cleaned);
  if (!valid) throwValidation(`${field} must be a valid phone number`);
  return cleaned;
}

function safeLimit(raw, fallback = 100, max = 200) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

module.exports = {
  ValidationError,
  asString,
  asEnum,
  asBoolean,
  asInteger,
  asEmail,
  asPhone,
  safeLimit,
};
