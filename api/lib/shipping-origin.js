const DEFAULT_SHIPPING_ORIGIN = {
  name: 'IMPETUS',
  company: 'IMPETUS',
  phone: '5511111111',
  email: 'ventas@impetus.mx',
  country_code: 'MX',
  postal_code: '94295',
  state: 'Veracruz',
  city: 'Boca del Rio',
  colony: 'Remes',
  street: 'C. 4',
  number: '409',
};

const ORIGIN_ENV_MAP = {
  name: 'SKYDROPX_ORIGIN_NAME',
  company: 'SKYDROPX_ORIGIN_COMPANY',
  phone: 'SKYDROPX_ORIGIN_PHONE',
  email: 'SKYDROPX_ORIGIN_EMAIL',
  country_code: 'SKYDROPX_ORIGIN_COUNTRY_CODE',
  postal_code: 'SKYDROPX_ORIGIN_POSTAL_CODE',
  state: 'SKYDROPX_ORIGIN_STATE',
  city: 'SKYDROPX_ORIGIN_CITY',
  colony: 'SKYDROPX_ORIGIN_COLONY',
  street: 'SKYDROPX_ORIGIN_STREET',
  number: 'SKYDROPX_ORIGIN_NUMBER',
};

function getOptionalEnvVar(key) {
  return typeof process.env[key] === 'string' ? process.env[key].trim() : '';
}

function getShippingOrigin() {
  return Object.entries(ORIGIN_ENV_MAP).reduce((origin, [field, envKey]) => {
    origin[field] = getOptionalEnvVar(envKey) || DEFAULT_SHIPPING_ORIGIN[field];
    return origin;
  }, {});
}

module.exports = {
  DEFAULT_SHIPPING_ORIGIN,
  getShippingOrigin,
};
