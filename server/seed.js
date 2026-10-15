'use strict';

/**
 * Seeds the database with the admin account and the service catalogue.
 *
 *   node seed.js           adds missing data, keeps existing data
 *   node seed.js --reset   wipes the database first (DEVELOPMENT ONLY)
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const env = require('./config/env');
const connectDB = require('./config/db');
const User = require('./models/User');
const Service = require('./models/Service');
const { getSettings } = require('./services/settingsService');

const pkg = (b, d, p) => [
  { name: 'Basic', price: b, description: 'Standard service' },
  { name: 'Deep', price: d, description: 'Thorough service' },
  { name: 'Premium', price: p, description: 'Most comprehensive service' },
];

const SERVICES = [
  // Appliance
  { name: 'AC Repair', slug: 'ac-repair', category: 'APPLIANCE', icon: '❄️', startingPrice: 399, durationMinutes: 90, minExperienceYears: 1, description: 'Diagnosis and repair of split / window AC: cooling issues, noise, leakage, gas top-up labour.' },
  { name: 'AC Cleaning', slug: 'ac-cleaning', category: 'APPLIANCE', icon: '🧊', startingPrice: 499, durationMinutes: 60, packages: pkg(499, 799, 999), description: 'Jet-wash cleaning of indoor and outdoor units for better cooling and air quality.' },
  { name: 'Refrigerator Repair', slug: 'refrigerator-repair', category: 'APPLIANCE', icon: '🧯', startingPrice: 349, durationMinutes: 75, description: 'Cooling, compressor, thermostat and door-seal problems diagnosed and repaired.' },
  { name: 'Washing Machine Repair', slug: 'washing-machine-repair', category: 'APPLIANCE', icon: '🧺', startingPrice: 349, durationMinutes: 75, description: 'Drum, drain, spin and error-code repairs for top and front load machines.' },
  { name: 'TV Repair', slug: 'tv-repair', category: 'APPLIANCE', icon: '📺', startingPrice: 399, durationMinutes: 60, description: 'Display, power and sound troubleshooting at home.' },
  { name: 'Microwave Repair', slug: 'microwave-repair', category: 'APPLIANCE', icon: '🍲', startingPrice: 299, durationMinutes: 45, description: 'Heating, turntable and keypad faults repaired.' },
  { name: 'Geyser Repair', slug: 'geyser-repair', category: 'APPLIANCE', icon: '🚿', startingPrice: 299, durationMinutes: 45, description: 'Thermostat, element and leakage repair for electric geysers.' },
  { name: 'Water Purifier Service', slug: 'water-purifier-service', category: 'APPLIANCE', icon: '💧', startingPrice: 349, durationMinutes: 45, description: 'Service and troubleshooting of RO / UV purifiers (filters are arranged by the customer).' },
  // Electrical
  { name: 'Fan Installation', slug: 'fan-installation', category: 'ELECTRICAL', icon: '🌀', startingPrice: 199, durationMinutes: 45, description: 'Installation of a ceiling / wall fan that you already own.' },
  { name: 'Light Installation', slug: 'light-installation', category: 'ELECTRICAL', icon: '💡', startingPrice: 149, durationMinutes: 30, description: 'Fitting of lights, tube lights and decorative fixtures you already own.' },
  { name: 'Switch/Socket Repair', slug: 'switch-socket-repair', category: 'ELECTRICAL', icon: '🔌', startingPrice: 149, durationMinutes: 30, description: 'Diagnosis, repair or replacement labour. Replacement items are arranged by the customer.' },
  { name: 'Wiring Repair', slug: 'wiring-repair', category: 'ELECTRICAL', icon: '⚡', startingPrice: 449, durationMinutes: 120, minExperienceYears: 2, description: 'Fault finding and repair of damaged or overloaded wiring.' },
  { name: 'Electrical Inspection', slug: 'electrical-inspection', category: 'ELECTRICAL', icon: '🔍', startingPrice: 399, durationMinutes: 60, minExperienceYears: 2, description: 'Safety check of your home wiring, earthing and load.' },
  { name: 'Appliance Installation', slug: 'appliance-installation', category: 'ELECTRICAL', icon: '🛠️', startingPrice: 349, durationMinutes: 60, description: 'Installation of appliances you already own (wall-mounted TV, chimney, geyser...).' },
  // Plumbing
  { name: 'Tap Repair', slug: 'tap-repair', category: 'PLUMBING', icon: '🚰', startingPrice: 149, durationMinutes: 30, description: 'Fix dripping or loose taps and mixers.' },
  { name: 'Pipe Leakage', slug: 'pipe-leakage', category: 'PLUMBING', icon: '🔧', startingPrice: 299, durationMinutes: 60, description: 'Detect and repair leaking pipes and joints.' },
  { name: 'Sink Repair', slug: 'sink-repair', category: 'PLUMBING', icon: '🧼', startingPrice: 249, durationMinutes: 45, description: 'Blocked or leaking kitchen / wash-basin sink repair.' },
  { name: 'Toilet Repair', slug: 'toilet-repair', category: 'PLUMBING', icon: '🚽', startingPrice: 299, durationMinutes: 60, description: 'Flush tank, seat and leakage repairs.' },
  { name: 'Shower Installation', slug: 'shower-installation', category: 'PLUMBING', icon: '🛁', startingPrice: 249, durationMinutes: 45, description: 'Installation of a shower set you already own.' },
  { name: 'Drainage Service', slug: 'drainage-service', category: 'PLUMBING', icon: '🕳️', startingPrice: 399, durationMinutes: 75, description: 'Unclog and clean blocked drains.' },
  // Cleaning
  { name: 'Bathroom Cleaning', slug: 'bathroom-cleaning', category: 'CLEANING', icon: '🧽', startingPrice: 399, durationMinutes: 60, packages: pkg(399, 599, 799), description: 'Scrubbing, descaling and sanitising of bathrooms.' },
  { name: 'Kitchen Cleaning', slug: 'kitchen-cleaning', category: 'CLEANING', icon: '🍳', startingPrice: 499, durationMinutes: 90, packages: pkg(499, 749, 999), description: 'Degreasing of counters, chimney, hob, cabinets and sink.' },
  { name: 'Sofa Cleaning', slug: 'sofa-cleaning', category: 'CLEANING', icon: '🛋️', startingPrice: 449, durationMinutes: 75, packages: pkg(449, 649, 849), description: 'Shampoo and vacuum cleaning of sofas.' },
  { name: 'Full Home Cleaning', slug: 'full-home-cleaning', category: 'CLEANING', icon: '🏠', startingPrice: 1499, durationMinutes: 240, packages: pkg(1499, 2499, 3499), description: 'Top-to-bottom cleaning of the whole home.' },
  { name: 'Water Tank Cleaning', slug: 'water-tank-cleaning', category: 'CLEANING', icon: '🛢️', startingPrice: 599, durationMinutes: 90, description: 'Mechanised cleaning and disinfection of overhead and underground tanks.' },
];

// Service photos. Put the files in server/Photos/ and list them here by service slug.
// Services without an entry keep their icon. Running "node seed.js" again re-applies this list
// (it never touches an image that was set to an external web link in the admin page).
// The first four services as they appear on the Services page (AC Cleaning, AC Repair, Geyser Repair, Microwave Repair).
const SERVICE_IMAGES = {
  'ac-cleaning': 'ac cleaning.jpeg',
  'ac-repair': 'ac repair.jpeg',
  'geyser-repair': 'geyser.jpeg',
  'microwave-repair': 'microwave.jpeg',
  'refrigerator-repair': 'refrigerator.jpeg',
  'washing-machine-repair': 'washing.jpeg',
  'water-purifier-service': 'water.jpeg',
  'tv-repair': 'tv.jpeg',
  'appliance-installation': 'appliance.jpeg',
  'electrical-inspection': 'inspection.jpeg',
  'fan-installation': 'fan.jpeg',
  'light-installation': 'light.jpeg',
  'switch-socket-repair': 'switch.jpeg',
  'wiring-repair': 'wiring.jpeg',
  'drainage-service': 'drainage.jpeg',
  'pipe-leakage': 'pipe.jpeg',
  'shower-installation': 'shower.jpeg',
  'sink-repair': 'sink.jpeg',
  'tap-repair': 'tap repair.jpeg',
  'toilet-repair': 'toilet.jpeg',
  'bathroom-cleaning': 'bathroom.jpeg',
  'full-home-cleaning': 'home.jpeg',
  'kitchen-cleaning': 'kitchen.jpeg',
  'sofa-cleaning': 'sofa.jpeg',
  'water-tank-cleaning': 'tank.jpeg',
};

async function main() {
  if (env.isProd) throw new Error('Refusing to seed in production');
  await connectDB();
  if (process.argv.includes('--reset')) {
    await mongoose.connection.dropDatabase();
    console.log('[seed] database dropped');
  }
  await getSettings();

  // Admin account
  if (!(await User.exists({ email: env.adminSeed.email }))) {
    await User.create({ name: 'FixFlow Admin', email: env.adminSeed.email, phone: '7044068337', passwordHash: await bcrypt.hash(env.adminSeed.password, 12), role: 'ADMIN' });
  }

  // Service catalogue
  for (const s of SERVICES) {
    await Service.updateOne({ slug: s.slug }, { $setOnInsert: { ...s, packages: s.packages || [], ratingAvg: 4.2 + ((s.name.length * 7) % 8) / 10, ratingCount: 20 + ((s.name.length * 13) % 80) } }, { upsert: true });
  }
  console.log(`[seed] ${SERVICES.length} services ready`);

  for (const [slug, file] of Object.entries(SERVICE_IMAGES)) {
    const svc = await Service.findOne({ slug }).select('imageUrl');
    if (svc && (!svc.imageUrl || svc.imageUrl.startsWith('/uploads/services/'))) {
      await Service.updateOne({ _id: svc._id }, { $set: { imageUrl: `/uploads/services/${encodeURIComponent(file)}` } });
    }
  }
  console.log(`[seed] service photos linked: ${Object.keys(SERVICE_IMAGES).length}`);

  console.log('\nAdmin login:');
  console.log(`  ${env.adminSeed.email} / ${env.adminSeed.password}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});