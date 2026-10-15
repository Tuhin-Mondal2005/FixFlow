'use strict';

const { getSettings } = require('./settingsService');
const { round2 } = require('../utils/geo');
const ApiError = require('../utils/ApiError');

/** Resolve the quoted price for a service + optional package. Packages are service LEVELS, not products. */
function quotePrice(service, packageName) {
  if (!packageName) return { price: service.startingPrice, packageName: '' };
  const pkg = (service.packages || []).find((p) => p.name.toLowerCase() === packageName.toLowerCase());
  if (!pkg) throw ApiError.badRequest(`"${packageName}" is not a valid package for ${service.name}`);
  return { price: pkg.price, packageName: pkg.name };
}

/** Commission rate (percent) for a service: per-service override, otherwise the category default. */
async function commissionRateFor(service) {
  if (service.commissionRate !== null && service.commissionRate !== undefined) return service.commissionRate;
  const settings = await getSettings();
  return settings.commissionRates[service.category] ?? 15;
}

/** Section 31: Customer pays 1000 @15% -> platform 150, technician 850. */
function splitAmount(amount, ratePercent) {
  const commission = round2((amount * ratePercent) / 100);
  return { commission, technicianEarning: round2(amount - commission) };
}

module.exports = { quotePrice, commissionRateFor, splitAmount };
