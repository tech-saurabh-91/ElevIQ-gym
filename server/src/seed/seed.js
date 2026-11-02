import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { Member, Plan, Location } from '../models/Member.js';
import { Staff, Shift, TrainingRecord } from '../models/Staff.js';
import { ClassType, ClassSession, Booking, PersonalSession } from '../models/Class.js';
import { Equipment, Maintenance } from '../models/Equipment.js';
import { Payment, Invoice, Expense, Product, Sale } from '../models/Finance.js';
import { CheckIn, Locker, Announcement, ContactMessage, GalleryItem, Review, Notification, Campaign } from '../models/Operations.js';

let seed = 42;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const daysAhead = (n) => new Date(Date.now() + n * 864e5);

const IMG = [
  '1534438327276-14e5300c3a48', '1550345332-09e3ac987658', '1558611848-73f7eb4001a1',
  '1517836357463-d25dfeac3438', '1571902943202-507ec2618e8f', '1526506118085-60ce8714f8c5',
  '1594381898411-846e7d193883', '1540497077202-7c8a3999166f', '1571019613454-1cb2f99b2d8b',
  '1534258936925-c58bed479fcb', '1546483875-ad9014c88eba', '1541534741688-6078c6bfb5c5',
  '1605296867304-46d5465a13f1', '1583454110551-21f2fa2afe61', '1518611012118-696072aa579a',
  '1599058917765-a780eda07a3e', '1584735935682-2f2b69dff9d2', '1574680096145-d05b474e2155',
  '1517963879433-6ad2b056d712', '1581009146145-b5ef050c2e1e',
];
const img = (i, w = 1200) => `https://images.unsplash.com/photo-${IMG[i % IMG.length]}?w=${w}&q=75&fit=crop&auto=format`;

const FIRST = ['Aarav', 'Priya', 'Liam', 'Sofia', 'Noah', 'Emma', 'Rahul', 'Ananya', 'Mateo', 'Lucia', 'Kenji', 'Yuki', 'Amara', 'Tobi', 'Hannah', 'Omar', 'Fatima', 'Lucas', 'Chloe', 'Arjun', 'Meera', 'Felix', 'Greta', 'Diego', 'Isabella', 'Rohan', 'Sana', 'Ethan', 'Maya', 'Vikram', 'Nadia', 'Tom', 'Ines', 'Kabir', 'Leila', 'Jonas', 'Aisha', 'Marco', 'Elena', 'Suresh'];
const LAST = ['Sharma', 'Patel', 'Murphy', 'Garcia', 'Johnson', 'Brown', 'Verma', 'Nair', 'Rodriguez', 'Lopez', 'Tanaka', 'Sato', 'Okafor', 'Bakare', 'Miller', 'Hassan', 'Ali', 'Silva', 'Dubois', 'Mehta', 'Iyer', 'Weber', 'Schmidt', 'Torres', 'Romano', 'Kapoor', 'Khan', 'Walker', 'Lewis', 'Reddy', 'Ahmed', 'Clarke', 'Moreau', 'Singh', 'Haddad', 'Keller', 'Diallo', 'Ricci', 'Costa', 'Iyer'];

const COUNTRIES = [
  { code: 'IN', currency: 'INR', locale: 'en-IN', tz: 'Asia/Kolkata' },
  { code: 'US', currency: 'USD', locale: 'en-US', tz: 'America/Chicago' },
  { code: 'DE', currency: 'EUR', locale: 'de-DE', tz: 'Europe/Berlin' },
  { code: 'GB', currency: 'GBP', locale: 'en-GB', tz: 'Europe/London' },
  { code: 'BR', currency: 'BRL', locale: 'pt-BR', tz: 'America/Sao_Paulo' },
  { code: 'JP', currency: 'JPY', locale: 'ja-JP', tz: 'Asia/Tokyo' },
  { code: 'AE', currency: 'AED', locale: 'ar-AE', tz: 'Asia/Dubai' },
  { code: 'AU', currency: 'AUD', locale: 'en-AU', tz: 'Australia/Sydney' },
];

async function run() {
  await connectDB(process.env.MONGO_URI);
  console.log('[seed] clearing collections...');
  const collections = [User, Member, Plan, Location, Staff, Shift, TrainingRecord, ClassType, ClassSession, Booking, PersonalSession, Equipment, Maintenance, Payment, Invoice, Expense, Product, Sale, CheckIn, Locker, Announcement, ContactMessage, GalleryItem, Review, Notification, Campaign];
  const existing = new Set((await mongoose.connection.db.listCollections().toArray()).map((c) => c.name));
  for (const m of collections) {
    if (existing.has(m.collection.name)) await mongoose.connection.db.dropCollection(m.collection.name);
  }

  /* ---------------- Locations & Plans ---------------- */
  const locations = await Location.insertMany([
    { code: 'BLR-01', name: 'GymFlow Indiranagar', city: 'Bengaluru', country: 'IN', timezone: 'Asia/Kolkata', address: '100 Ft Road, Indiranagar, Bengaluru 560038', phone: '+91 80 4567 8901', email: 'blr@gymflow.io', capacity: 420, sqft: 18000, facilities: ['Olympic lifting', 'Swimming pool', 'Sauna', 'Steam', 'CrossFit box', 'Yoga studio'], lat: 12.9716, lng: 77.6412 },
    { code: 'AUS-02', name: 'GymFlow East Austin', city: 'Austin', country: 'US', timezone: 'America/Chicago', address: '2401 E Cesar Chavez St, Austin, TX 78702', phone: '+1 512 555 0142', email: 'austin@gymflow.io', capacity: 360, sqft: 22000, facilities: ['Rooftop track', 'Climbing wall', 'Recovery lounge', 'Boxing ring', 'Spin studio'], lat: 30.2637, lng: -97.7205 },
    { code: 'BER-03', name: 'GymFlow Kreuzberg', city: 'Berlin', country: 'DE', timezone: 'Europe/Berlin', address: 'Oranienstraße 183, 10999 Berlin', phone: '+49 30 5567 8901', email: 'berlin@gymflow.io', capacity: 280, sqft: 14500, facilities: ['Hypertrophy lab', 'Physio studio', 'Cold plunge', 'Cafe'], lat: 52.5011, lng: 13.4216 },
  ]);

  const plans = await Plan.insertMany([
    { code: 'TRIAL', name: 'Day Pass', tagline: 'Try the floor', description: 'Single-day access to your nearest GymFlow club.', price: 12, billing: 'drop-in', durationDays: 1, visitLimit: 1, features: ['Full floor access', 'Locker for the day', 'Group class taster'], color: '#94a3b8' },
    { code: 'ESSENTIAL', name: 'Essential', tagline: 'Train your way', description: 'Unlimited access to your home club with the essentials covered.', price: 39, billing: 'monthly', durationDays: 30, features: ['Unlimited gym access', '1 group class / week', 'Locker access', 'Mobile app'], popular: false, color: '#22d3ee' },
    { code: 'PRO', name: 'Pro', tagline: 'Most popular', description: 'All clubs, all classes, plus quarterly body assessments.', price: 69, billing: 'monthly', durationDays: 30, features: ['All-clubs access', 'Unlimited group classes', 'Quarterly body composition', 'Guest pass x2 / month', 'Recovery lounge'], popular: true, color: '#a78bfa' },
    { code: 'ELITE', name: 'Elite', tagline: 'Coached & curated', description: 'Everything in Pro plus 4 personal training sessions monthly.', price: 129, billing: 'monthly', durationDays: 30, features: ['Everything in Pro', '4 PT sessions / month', 'Nutrition planning', 'Priority booking', 'Free merch pack'], color: '#f472b6' },
    { code: 'FAMILY', name: 'Family', tagline: 'Up to 5 people', description: 'One plan for the whole household across every location.', price: 159, billing: 'monthly', durationDays: 30, familySlots: 5, maxLocations: 3, features: ['Up to 5 members', 'All-clubs access', 'Kids activity hour', 'Family locker'], color: '#34d399' },
    { code: 'CORP', name: 'Corporate', tagline: 'Teams of 10+', description: 'Volume pricing for companies investing in team wellbeing.', price: 29, billing: 'monthly', durationDays: 30, maxLocations: 3, features: ['Volume discount', 'Onsite workshops', 'Billing on invoice', 'HR dashboard'], color: '#fbbf24' },
    { code: 'ANNUAL', name: 'Pro Annual', tagline: '2 months free', description: 'Pro membership billed yearly with two months on us.', price: 690, billing: 'yearly', durationDays: 365, features: ['All Pro features', '2 months free', 'Annual assessment', 'Guest pass x4 / month'], color: '#60a5fa' },
  ]);

  /* ---------------- Users & Members ---------------- */
  const admin = await User.create({ name: 'Aria Kapoor', email: 'admin@gymflow.io', password: 'admin123', role: 'admin', country: 'IN', currency: 'USD', locale: 'en', phone: '+91 98765 43210' });

  const trainerDefs = [
    ['Marcus Reed', 'Head Coach', 'strength', 'US', 'Strength & Conditioning, Olympic Lifting'],
    ['Ananya Iyer', 'Group Fitness Lead', 'group-fitness', 'IN', 'HIIT, Dance Fitness'],
    ['Lena Fischer', 'Yoga & Mobility', 'mind-body', 'DE', 'Vinyasa, Breathwork'],
    ['Diego Alvarez', 'Boxing Coach', 'sports', 'US', 'Boxing, Conditioning'],
    ['Yuki Tanaka', 'Personal Trainer', 'training', 'JP', 'Hypertrophy, Rehab'],
    ['Zara Khan', 'Nutrition & Recovery', 'training', 'AE', 'Nutrition, Recovery'],
    ['Tom Becker', 'Front Desk Supervisor', 'front-desk', 'DE', 'Operations'],
    ['Nadia Haddad', 'Club Manager', 'management', 'GB', 'Operations, Sales'],
  ];

  const staffDocs = [];
  for (let i = 0; i < trainerDefs.length; i += 1) {
    const [name, jobTitle, discipline, country, spec] = trainerDefs[i];
    const department = ['front-desk', 'management'].includes(discipline) ? discipline : 'training';
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@gymflow.io`;
    const user = await User.create({ name, email, password: 'trainer123', role: department === 'front-desk' || department === 'management' ? 'admin' : 'trainer', country, phone: `+${int(100, 999)} ${int(100, 999)} ${int(1000, 9999)}` });
    const staff = await Staff.create({
      user: user._id,
      employeeId: `GF-E${String(201 + i)}`,
      jobTitle,
      department,
      location: pick(locations)._id,
      employmentType: rnd() > 0.3 ? 'full-time' : 'part-time',
      hiredAt: daysAgo(int(120, 1400)),
      salary: int(2800, 7200),
      shift: pick(['Morning', 'Evening', 'Split']),
      weeklyHours: pick([20, 32, 40, 40, 45]),
      specializations: spec.split(', ').filter(Boolean),
      certifications: [
        { name: 'NASM Certified Personal Trainer', issuedAt: daysAgo(int(200, 1200)), expiresAt: daysAhead(int(120, 900)), id: `NASM-${int(10000, 99999)}` },
        { name: pick(['First Aid & CPR', 'Precision Nutrition L1', 'Kettlebell Level 2', 'Group Fitness Instructor']), issuedAt: daysAgo(int(100, 900)), expiresAt: daysAhead(int(60, 700)), id: `CRED-${int(10000, 99999)}` },
      ],
      rating: +(3.9 + rnd() * 1.1).toFixed(1),
      performanceScore: int(72, 98),
      kpis: { sessionsCompleted: int(120, 900), membersCoached: int(20, 240), attendanceRate: int(82, 99), revenueGenerated: int(4000, 42000), nps: int(45, 96) },
      status: 'active',
      accessLevel: ['floor', 'studio', 'office'].slice(0, int(1, 3)),
    });
    await TrainingRecord.insertMany([
      { staff: staff._id, title: 'NASM-CPT Renewal', provider: 'NASM', completedAt: daysAgo(int(60, 500)), expiresAt: daysAhead(int(200, 900)), credentialId: `NASM-${int(10000, 99999)}` },
      { staff: staff._id, title: 'Emergency Response & CPR', provider: 'Red Cross', completedAt: daysAgo(int(30, 300)), expiresAt: daysAhead(int(100, 600)), credentialId: `RC-${int(10000, 99999)}` },
    ]);
    staffDocs.push(staff);
  }

  const trainerPool = staffDocs.slice(0, 6);

  const memberDocs = [];
  const memberCount = 64;
  for (let i = 0; i < memberCount; i += 1) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 7) % LAST.length];
    const c = COUNTRIES[i % COUNTRIES.length];
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@mail.com`;
    const plan = plans[int(1, 6)];
    const joinedAt = daysAgo(int(3, 700));
    const demo = i < 12;
    const expiresAt = demo
      ? daysAhead(int(60, 300))
      : rnd() > 0.15
        ? new Date(joinedAt.getTime() + int(30, 400) * 864e5)
        : daysAhead(int(-40, 90));
    const status = demo
      ? 'active'
      : expiresAt < new Date()
        ? pick(['expired', 'cancelled'])
        : rnd() > 0.08
          ? 'active'
          : pick(['frozen', 'pending']);
    const user = await User.create({
      name: `${first} ${last}`,
      email,
      password: 'member123',
      role: 'member',
      phone: `+${int(10, 99)} ${int(100, 999)} ${int(1000, 9999)}`,
      country: c.code,
      currency: c.currency,
      locale: c.locale,
      timezone: c.tz,
      lastLoginAt: daysAgo(int(0, 20)),
    });
    const memberId = `GF-${String(1001 + i).padStart(5, '0')}`;
    const member = await Member.create({
      user: user._id,
      memberId,
      firstName: first,
      lastName: last,
      gender: pick(['male', 'female', 'male', 'female', 'other']),
      dob: new Date(int(1975, 2005), int(0, 11), int(1, 28)),
      photo: '',
      bloodGroup: pick(['A+', 'B+', 'O+', 'AB+', 'A-', 'O-']),
      address: { city: pick(['Bengaluru', 'Austin', 'Berlin', 'London', 'São Paulo', 'Tokyo', 'Dubai', 'Sydney']), country: c.code },
      emergencyContact: { name: `${pick(FIRST)} ${last}`, phone: `+${int(10, 99)} ${int(100, 999)} ${int(1000, 9999)}`, relation: pick(['Spouse', 'Parent', 'Sibling', 'Friend']) },
      goals: [pick(['Fat loss', 'Muscle gain', 'Endurance', 'Mobility', 'Sport performance']), pick(['Fat loss', 'Muscle gain', 'Endurance', 'Mobility'])],
      healthNotes: rnd() > 0.75 ? pick(['Lower back - avoid heavy axial load', 'Knee brace on right leg', 'Mild asthma - keep inhaler nearby', '']) : '',
      plan: plan._id,
      planName: plan.name,
      homeLocation: pick(locations)._id,
      status,
      joinedAt,
      expiresAt,
      autoRenew: rnd() > 0.3,
      visitsThisMonth: int(0, 22),
      totalVisits: int(0, 420),
      lastVisitAt: daysAgo(int(0, 40)),
      rfid: rnd() > 0.5 ? `RF${int(100000, 999999)}` : '',
      qrToken: `QR${memberId}`,
      familyGroup: rnd() > 0.85 ? `FAM-${int(100, 999)}` : '',
      company: rnd() > 0.7 ? pick(['Tata Digital', 'Stripe', 'Siemens', 'Razorpay', 'Deutsche Bank', 'Infosys']) : '',
      referralCode: `${first.slice(0, 3).toUpperCase()}${String(1001 + i).slice(-3)}`,
      referredBy: rnd() > 0.7 ? `GF-${String(int(1001, 1064)).padStart(5, '0')}` : '',
      rating: rnd() > 0.6 ? +(3.5 + rnd() * 1.5).toFixed(1) : 0,
      tags: [plan.code, pick(['morning', 'evening', 'weekender', 'competitive', 'beginner'])],
      balance: rnd() > 0.85 ? int(5, 120) : 0,
    });
    memberDocs.push(member);
  }

  /* ---------------- Class types & sessions ---------------- */
  const classTypes = await ClassType.insertMany([
    { name: 'Power HIIT', category: 'cardio', intensity: 5, durationMin: 40, defaultCapacity: 24, color: '#f472b6', calories: 520, description: 'Explosive intervals that torch calories and build engine.' },
    { name: 'Olympic Lifting', category: 'strength', intensity: 5, durationMin: 60, defaultCapacity: 12, color: '#f87171', calories: 410, description: 'Snatch and clean & jerk technique under coach eyes.' },
    { name: 'Vinyasa Flow', category: 'mind-body', intensity: 2, durationMin: 55, defaultCapacity: 20, color: '#34d399', calories: 220, description: 'Breath-led flow to build mobility and calm.' },
    { name: 'Boxing Basics', category: 'sports', intensity: 4, durationMin: 45, defaultCapacity: 18, color: '#fbbf24', calories: 480, description: 'Footwork, combos and pad work for all levels.' },
    { name: 'Spin Sprint', category: 'cardio', intensity: 4, durationMin: 45, defaultCapacity: 26, color: '#60a5fa', calories: 550, description: 'Ride to the beat with hill climbs and sprints.' },
    { name: 'Hypertrophy Lab', category: 'strength', intensity: 3, durationMin: 60, defaultCapacity: 14, color: '#a78bfa', calories: 360, description: 'Tempo-driven hypertrophy blocks with video review.' },
    { name: 'Core & Mobility', category: 'mind-body', intensity: 2, durationMin: 30, defaultCapacity: 22, color: '#22d3ee', calories: 180, description: 'Bulletproof your midsection and unlock hips.' },
    { name: 'CrossFit WOD', category: 'group-fitness', intensity: 5, durationMin: 60, defaultCapacity: 20, color: '#fb923c', calories: 600, description: 'Constantly varied functional movement, scored.' },
    { name: 'Dance Cardio', category: 'group-fitness', intensity: 3, durationMin: 45, defaultCapacity: 30, color: '#e879f9', calories: 430, description: 'Choreography that feels like a night out.' },
    { name: 'Recovery & Stretch', category: 'mind-body', intensity: 1, durationMin: 40, defaultCapacity: 16, color: '#4ade80', calories: 120, description: 'Myofascial release, breathwork and down-regulation.' },
  ]);

  const sessions = [];
  const times = ['06:00', '07:15', '08:30', '10:00', '12:00', '17:00', '18:15', '19:30', '20:45'];
  for (let d = -7; d <= 21; d += 1) {
    const date = daysAhead(d);
    const perDay = int(4, 7);
    for (let k = 0; k < perDay; k += 1) {
      const type = pick(classTypes);
      const trainer = pick(trainerPool);
      const start = pick(times);
      const [h, m] = start.split(':').map(Number);
      const endMin = h * 60 + m + type.durationMin;
      const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const capacity = type.defaultCapacity + int(-4, 4);
      const booked = Math.max(0, Math.min(capacity, int(0, capacity)));
      const status = booked >= capacity ? 'full' : d < 0 ? 'completed' : 'scheduled';
      sessions.push({
        classType: type._id,
        title: type.name,
        trainer: trainer._id,
        location: pick(locations)._id,
        room: pick(['Studio A', 'Studio B', 'Main Floor', 'Rooftop', 'Boxing Zone']),
        date,
        start,
        end,
        capacity,
        booked,
        status,
        isRecurring: rnd() > 0.7,
        recurrence: rnd() > 0.7 ? 'Weekly' : '',
        rating: +(3.8 + rnd() * 1.2).toFixed(1),
      });
    }
  }
  const sessionDocs = await ClassSession.insertMany(sessions);

  const bookingDocs = [];
  const bookedPairs = new Set();
  for (let i = 0; i < 340; i += 1) {
    const session = pick(sessionDocs);
    const member = pick(memberDocs);
    const key = `${session._id}-${member._id}`;
    if (bookedPairs.has(key)) continue;
    bookedPairs.add(key);
    const r = rnd();
    const status = r > 0.86 ? 'cancelled' : r > 0.78 ? 'no-show' : r > 0.7 ? 'checked-in' : r > 0.64 ? 'waitlist' : 'booked';
    bookingDocs.push({
      session: session._id,
      member: member._id,
      status,
      bookedAt: daysAgo(int(0, 25)),
      source: pick(['web', 'mobile', 'web', 'front-desk']),
      checkedInAt: status === 'checked-in' ? daysAgo(int(0, 25)) : undefined,
    });
  }
  await Booking.insertMany(bookingDocs);

  const ptDocs = [];
  for (let i = 0; i < 40; i += 1) {
    ptDocs.push({
      member: pick(memberDocs)._id,
      trainer: pick(trainerPool)._id,
      date: daysAhead(int(-5, 20)),
      start: pick(times),
      durationMin: pick([45, 60, 60, 90]),
      focus: pick(['Fat loss block', 'Strength peak', 'Return to sport', 'Posture correction', 'Contest prep']),
      status: pick(['scheduled', 'scheduled', 'completed', 'cancelled']),
      price: pick([45, 55, 65, 75]),
    });
  }
  await PersonalSession.insertMany(ptDocs);

  /* ---------------- Equipment ---------------- */
  const eqNames = [
    ['Technogym Run Now 700', 'cardio', 'Technogym'], ['Assault AirBike Elite', 'cardio', 'Assault'],
    ['Rogue Rower ERG', 'cardio', 'Rogue'], ['Peloton Bike+', 'cardio', 'Peloton'],
    ['Rogue RML-690 Rack', 'strength', 'Rogue'], ['Hammer Strength Leg Press', 'strength', 'Hammer Strength'],
    ['Eleiko Competition Barbell', 'free-weights', 'Eleiko'], ['Rogue Ohio Bar', 'free-weights', 'Rogue'],
    ['PowerBlock Elite 90', 'free-weights', 'PowerBlock'], ['Rogue Dumbbell Set 5-50', 'free-weights', 'Rogue'],
    ['Concept2 SkiErg', 'cardio', 'Concept2'], ['Rogue Echo Bike', 'cardio', 'Rogue'],
    ['Cable Crossover Dual', 'strength', 'Life Fitness'], ['Smith Machine', 'strength', 'Hammer Strength'],
    ['Functional Trainer FT500', 'strength', 'Life Fitness'], ['Kettlebell Wall', 'functional', 'Rogue'],
    ['Battle Rope 50ft', 'functional', 'Rogue'], ['Sled Push Pro', 'functional', 'Rogue'],
    ['Treadmill TrackMaster', 'cardio', 'TrackMaster'], ['StairClimber StepMill', 'cardio', 'StairMaster'],
    ['Yoga Mat Rack', 'studio', 'Manduka'], ['Spin Bike Wattbike Atom', 'studio', 'Wattbike'],
    ['BOSU Balance Set', 'functional', 'BOSU'], ['Rowing Erg PM5', 'cardio', 'Concept2'],
    ['Incline Bench Adjustable', 'strength', 'Rogue'], ['Pec Deck Fly', 'strength', 'Hammer Strength'],
    ['Lat Pulldown Machine', 'strength', 'Life Fitness'], ['Hip Thrust Bench', 'strength', 'Rogue'],
    ['Cryotherapy Chamber', 'recovery', 'CRYO'], ['Infrared Sauna 4P', 'recovery', 'Sunlighten'],
    ['Percussion Gun Set', 'recovery', 'Therabody'], ['Compression Boots', 'recovery', 'Normatec'],
    ['Massage Table', 'recovery', 'EarthLite'], ['Trap Bar Hex', 'free-weights', 'Rogue'],
    ['Weight Plates 25kg Set', 'free-weights', 'Eleiko'], ['Squat Ramp Platform', 'strength', 'Rogue'],
  ];
  const eqDocs = [];
  for (let i = 0; i < eqNames.length; i += 1) {
    const [name, category, brand] = eqNames[i];
    const status = rnd() > 0.88 ? 'maintenance' : rnd() > 0.96 ? 'out-of-order' : 'in-use';
    const purchasedAt = daysAgo(int(60, 1500));
    eqDocs.push(await Equipment.create({
      assetTag: `AST-${String(1001 + i)}`,
      name,
      category,
      brand,
      model: `${brand.slice(0, 3).toUpperCase()}-${int(100, 999)}`,
      serialNumber: `SN${int(1000000, 9999999)}`,
      location: pick(locations)._id,
      zone: pick(['Cardio Deck', 'Free Weight Zone', 'Strength Hall', 'Studio 1', 'Recovery Lounge', 'Functional Turf']),
      purchasedAt,
      cost: int(450, 24000),
      warrantyExpiresAt: new Date(purchasedAt.getTime() + int(1, 5) * 365 * 864e5),
      condition: pick(['excellent', 'good', 'good', 'fair', 'poor']),
      status,
      usageCount: int(40, 4200),
      usageMinutes: int(200, 42000),
      lastServicedAt: daysAgo(int(5, 200)),
      nextServiceAt: daysAhead(int(-20, 120)),
      vendor: pick(['Technogym India', 'Rogue Fitness', 'Life Fitness', 'Amazon Business', 'Local Fitness Supplies']),
      safetyScore: int(68, 100),
    }));
  }

  const maintDocs = [];
  const maintTitles = [
    'Lubricate deck belt', 'Replace worn cable', 'Quarterly safety inspection', 'Brake pad replacement',
    'Loose bolt torque check', 'Console firmware update', 'Frame weld inspection', 'Seat pad reupholstery',
    'Electrical safety test', 'Resistance calibration',
  ];
  for (let i = 0; i < 22; i += 1) {
    const eq = pick(eqDocs);
    const status = pick(['open', 'in-progress', 'done', 'done', 'deferred']);
    maintDocs.push(await Maintenance.create({
      equipment: eq._id,
      type: pick(['preventive', 'corrective', 'inspection', 'safety']),
      title: pick(maintTitles),
      description: 'Routine service ticket raised from weekly floor walk.',
      priority: pick(['low', 'medium', 'medium', 'high', 'critical']),
      status,
      requestedBy: admin._id,
      assignedTo: pick(staffDocs)._id,
      vendor: pick(['Technogym India', 'Rogue Fitness', 'In-house technician']),
      scheduledFor: daysAhead(int(-10, 25)),
      startedAt: status === 'done' || status === 'in-progress' ? daysAgo(int(0, 12)) : undefined,
      completedAt: status === 'done' ? daysAgo(int(0, 10)) : undefined,
      cost: status === 'done' ? int(20, 1800) : 0,
      downtimeHours: status === 'done' ? int(1, 48) : int(0, 24),
      checklist: [
        { item: 'Visual inspection', done: status === 'done' },
        { item: 'Function test', done: status === 'done' },
        { item: 'Safety sign-off', done: status === 'done' },
      ],
    }));
  }

  /* ---------------- Finance ---------------- */
  const categories = ['membership', 'personal-training', 'retail', 'locker', 'other'];
  const methods = ['card', 'card', 'card', 'cash', 'bank-transfer', 'upi', 'wallet'];
  const gateways = ['stripe', 'stripe', 'stripe', 'paypal', 'square', 'razorpay', 'manual'];
  const payments = [];
  for (let i = 0; i < 620; i += 1) {
    const member = pick(memberDocs);
    const plan = plans.find((p) => p._id.equals(member.plan)) || plans[2];
    const cat = rnd() > 0.78 ? pick(categories.slice(1)) : 'membership';
    const amount = cat === 'membership' ? plan.price * pick([1, 1, 1, 2, 3]) : pick([25, 45, 55, 65, 75, 120, 15, 30]);
    const status = rnd() > 0.94 ? 'refunded' : rnd() > 0.97 ? 'failed' : rnd() > 0.95 ? 'pending' : 'paid';
    payments.push({
      receiptNo: `RCT-${String(100000 + i)}`,
      member: member._id,
      payerName: `${member.firstName} ${member.lastName}`,
      amount,
      currency: 'USD',
      method: pick(methods),
      gateway: pick(gateways),
      status,
      category: cat,
      description: cat === 'membership' ? `${plan.name} renewal` : cat === 'personal-training' ? 'Personal training pack' : cat === 'retail' ? 'Retail purchase' : 'Locker rental',
      paidAt: daysAgo(int(0, 365)),
      location: pick(locations)._id,
      reference: `ref_${int(100000, 999999)}`,
      refundedAmount: status === 'refunded' ? amount : 0,
      refundReason: status === 'refunded' ? 'Plan downgrade' : '',
      createdBy: admin._id,
    });
  }
  await Payment.insertMany(payments);

  const invoices = [];
  for (let i = 0; i < 90; i += 1) {
    const member = pick(memberDocs);
    const items = [{ name: pick(['Pro membership', 'Elite membership', 'PT pack x10', 'Locker annual', 'Corporate seat']), qty: int(1, 3), price: pick([39, 69, 129, 159, 29]) }];
    const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
    const taxRate = pick([0, 5, 8, 10, 18, 19]);
    const tax = Math.round(subtotal * taxRate) / 100;
    invoices.push({
      invoiceNo: `INV-${String(200000 + i)}`,
      member: member._id,
      email: `${member.firstName.toLowerCase()}.${member.lastName.toLowerCase()}@mail.com`,
      items,
      subtotal,
      tax,
      taxRate,
      total: subtotal + tax,
      currency: 'USD',
      status: pick(['paid', 'paid', 'issued', 'issued', 'overdue', 'draft', 'void']),
      dueAt: daysAhead(int(-30, 30)),
      issuedAt: daysAgo(int(0, 120)),
      paidAt: rnd() > 0.5 ? daysAgo(int(0, 100)) : undefined,
      notes: 'Net 15 payment terms',
    });
  }
  await Invoice.insertMany(invoices);

  const expenseDefs = [
    ['Club rent - Indiranagar', 'rent', 8200], ['Club rent - East Austin', 'rent', 11400],
    ['Club rent - Kreuzberg', 'rent', 7600], ['Electricity & water', 'utilities', 2400],
    ['Staff payroll', 'payroll', 38500], ['Equipment lease', 'equipment', 6400],
    ['Meta ads - summer campaign', 'marketing', 4200], ['Google Ads', 'marketing', 2800],
    ['Cleaning & laundry', 'supplies', 1600], ['Supplement restock', 'supplies', 3900],
    ['Preventive maintenance contract', 'maintenance', 2100], ['Software subscriptions', 'other', 940],
    ['Insurance premium', 'other', 3100], ['Physio contractor', 'maintenance', 1800],
  ];
  const expenses = [];
  for (let m = 0; m < 14; m += 1) {
    for (const [title, category, base] of expenseDefs) {
      expenses.push({
        title,
        category,
        amount: Math.round(base * (0.85 + rnd() * 0.35)),
        currency: 'USD',
        vendor: pick(['WeWork', 'Grid Energy', 'Gusto', 'Amazon', 'Meta', 'Google', 'Local Vendor']),
        paidAt: daysAgo(m * 30 + int(0, 28)),
        location: pick(locations)._id,
        method: 'bank-transfer',
        createdBy: admin._id,
      });
    }
  }
  await Expense.insertMany(expenses);

  const products = await Product.insertMany([
    { sku: 'SUP-001', name: 'Whey Isolate 2kg', category: 'supplements', price: 54, cost: 32, stock: 46, lowStockAt: 12, supplier: 'Nutrabay', taxRate: 8, sold: 210 },
    { sku: 'SUP-002', name: 'Creatine Mono 500g', category: 'supplements', price: 24, cost: 11, stock: 8, lowStockAt: 15, supplier: 'Nutrabay', taxRate: 8, sold: 340 },
    { sku: 'SUP-003', name: 'BCAA Intra 400g', category: 'supplements', price: 32, cost: 17, stock: 22, lowStockAt: 10, supplier: 'Optimum', taxRate: 8, sold: 130 },
    { sku: 'ACC-011', name: 'Lifting Belt 10mm', category: 'accessories', price: 69, cost: 34, stock: 14, lowStockAt: 6, supplier: 'Rogue', taxRate: 8, sold: 76 },
    { sku: 'ACC-012', name: 'Wrist Wraps Pair', category: 'accessories', price: 22, cost: 9, stock: 31, lowStockAt: 10, supplier: 'Rogue', taxRate: 8, sold: 145 },
    { sku: 'APP-021', name: 'GymFlow Shaker 700ml', category: 'apparel', price: 18, cost: 6, stock: 58, lowStockAt: 20, supplier: 'PrintCo', taxRate: 8, sold: 260 },
    { sku: 'APP-022', name: 'Performance Tee', category: 'apparel', price: 34, cost: 14, stock: 9, lowStockAt: 12, supplier: 'BlankApparel', taxRate: 8, sold: 98 },
    { sku: 'APP-023', name: 'Training Shorts', category: 'apparel', price: 42, cost: 18, stock: 26, lowStockAt: 10, supplier: 'BlankApparel', taxRate: 8, sold: 87 },
    { sku: 'REC-031', name: 'Massage Gun Mini', category: 'recovery', price: 89, cost: 45, stock: 11, lowStockAt: 5, supplier: 'Therabody', taxRate: 8, sold: 54 },
    { sku: 'REC-032', name: 'Resistance Band Set', category: 'recovery', price: 27, cost: 10, stock: 40, lowStockAt: 15, supplier: 'Rogue', taxRate: 8, sold: 167 },
    { sku: 'HYD-041', name: 'Electrolyte Tabs x30', category: 'nutrition', price: 16, cost: 6, stock: 5, lowStockAt: 20, supplier: 'Nuun', taxRate: 8, sold: 302 },
    { sku: 'HYD-042', name: 'Bottle 1L Tritan', category: 'nutrition', price: 14, cost: 5, stock: 62, lowStockAt: 20, supplier: 'PrintCo', taxRate: 8, sold: 189 },
  ]);

  const sales = [];
  for (let i = 0; i < 160; i += 1) {
    const items = [];
    const n = int(1, 3);
    let subtotal = 0;
    for (let k = 0; k < n; k += 1) {
      const p = pick(products);
      const qty = int(1, 2);
      subtotal += p.price * qty;
      items.push({ productId: p._id, name: p.name, sku: p.sku, qty, price: p.price, total: p.price * qty });
    }
    sales.push({
      saleNo: `SAL-${String(300000 + i)}`,
      location: pick(locations)._id,
      items,
      subtotal,
      tax: 0,
      discount: rnd() > 0.85 ? int(2, 10) : 0,
      total: subtotal,
      currency: 'USD',
      paymentMethod: pick(['card', 'card', 'cash', 'wallet']),
      customer: rnd() > 0.4 ? `${pick(FIRST)} ${pick(LAST)}` : '',
      soldBy: admin._id,
      soldAt: daysAgo(int(0, 120)),
    });
  }
  await Sale.insertMany(sales);

  /* ---------------- Operations ---------------- */
  const checkins = [];
  for (let i = 0; i < 720; i += 1) {
    const member = pick(memberDocs);
    const inAt = daysAgo(int(0, 45));
    const dur = int(25, 130);
    checkins.push({
      member: member._id,
      method: pick(['qr', 'qr', 'rfid', 'mobile', 'manual']),
      location: pick(locations)._id,
      inAt,
      outAt: rnd() > 0.06 ? new Date(inAt.getTime() + dur * 60000) : undefined,
      durationMin: rnd() > 0.06 ? dur : undefined,
      verifiedBy: admin._id,
      device: pick(['Turnstile-1', 'Turnstile-2', 'Front Desk iPad', 'Mobile App']),
    });
  }
  await CheckIn.insertMany(checkins);

  const lockers = [];
  for (let i = 1; i <= 60; i += 1) {
    const status = pick(['available', 'occupied', 'occupied', 'occupied', 'maintenance']);
    lockers.push({
      number: `L-${String(i).padStart(3, '0')}`,
      location: pick(locations)._id,
      zone: pick(['Zone A', 'Zone B', 'Zone C']),
      size: pick(['small', 'medium', 'medium', 'large']),
      status,
      member: status === 'occupied' ? pick(memberDocs)._id : undefined,
      assignedAt: status === 'occupied' ? daysAgo(int(1, 120)) : undefined,
      expiresAt: status === 'occupied' ? daysAhead(int(-5, 180)) : undefined,
      fee: pick([0, 10, 15, 25]),
    });
  }
  await Locker.insertMany(lockers);

  await Announcement.insertMany([
    { title: 'New Kreuzberg club now open', body: 'Our third location on Oranienstraße is live. Elite and Pro members get instant access from today.', audience: 'all', channel: 'in-app', priority: 'high', pinned: true, image: img(2) },
    { title: 'Sunday mobility workshop', body: 'Join Lena for a 90-minute deep mobility lab. Free for Pro and Elite members.', audience: 'members', priority: 'normal', image: img(10) },
    { title: 'Schedule change: Spin Sprint', body: 'From Monday, Spin Sprint moves to 06:00 and 19:30 to fit early birds and after-work riders.', audience: 'members', priority: 'normal' },
    { title: 'Quarterly safety inspections', body: 'Equipment in the Strength Hall will be rotated through inspection on Thursday morning.', audience: 'all', priority: 'high' },
    { title: 'Refer a friend, get a month free', body: 'Share your referral code at checkout. Both sides get a month credited after 30 days.', audience: 'members', priority: 'normal' },
  ]);

  await ContactMessage.insertMany([
    { name: 'Rohit Malhotra', email: 'rohit@company.com', phone: '+91 98111 22334', subject: 'Corporate plan for 40 staff', message: 'We are looking at a corporate plan for our Bengaluru office. Can you share volume pricing?', topic: 'corporate', status: 'new' },
    { name: 'Emily Carter', email: 'emily.c@mail.com', subject: 'Personal training enquiry', message: 'Do you have female trainers available for early morning sessions?', topic: 'personal-training', status: 'in-progress' },
    { name: 'Jonas Weber', email: 'jonas@web.de', subject: 'Freezing membership', message: 'I am travelling for 6 weeks. How do I freeze my Pro plan?', topic: 'membership', status: 'replied', reply: 'You can freeze for up to 8 weeks per year from your member portal.' },
    { name: 'Sana Khan', email: 'sana.khan@mail.com', subject: 'Locker issue', message: 'Locker L-014 lock is jammed.', topic: 'support', status: 'closed' },
    { name: 'Diego Torres', email: 'diego@t.co', subject: 'Class waitlist question', message: 'How does the waitlist move when someone cancels?', topic: 'membership', status: 'new' },
    { name: 'Aisha Bello', email: 'aisha@mail.com', subject: 'Great trainers!', message: 'Ananya and Marcus are brilliant. Keep it up.', topic: 'feedback', status: 'new' },
  ]);

  const galleryDefs = [
    ['Indiranagar main floor', 'facility', 0], ['Rooftop track sessions', 'facility', 1],
    ['Power HIIT in action', 'classes', 3], ['Olympic lifting clinic', 'classes', 4],
    ['East Austin free weight zone', 'facility', 5], ['Coach Marcus Reed', 'trainers', 9],
    ['Coach Ananya Iyer', 'trainers', 2], ['Boxing basics night', 'classes', 6],
    ['Kreuzberg hypertrophy lab', 'facility', 7], ['Summer throwdown event', 'events', 12],
    ['Spin studio', 'facility', 8], ['Recovery lounge', 'facility', 14],
    ['Member transformation night', 'members', 15], ['Studio yoga flow', 'classes', 16],
    ['Functional turf area', 'equipment', 17], ['Sauna & cold plunge', 'facility', 18],
    ['Personal training bay', 'trainers', 19], ['Community 5K launch', 'events', 11],
  ];
  await GalleryItem.insertMany(galleryDefs.map(([title, category, ix], i) => ({
    title,
    category,
    type: 'image',
    url: img(ix, 1400),
    thumbnail: img(ix, 700),
    description: `${title} at GymFlow — captured by our community team.`,
    tags: [category, 'gymflow'],
    featured: i % 5 === 0,
    order: i,
    active: true,
    location: pick(locations)._id,
  })));

  await Review.insertMany([
    { name: 'Priya Sharma', role: 'Pro member, 2 years', rating: 5, title: 'Best gym I have used', comment: 'The coaching quality is on another level. Marcus rewrote my squat in one session and I have been pain free since.', featured: true, category: 'coaching' },
    { name: 'Liam Murphy', role: 'Elite member', rating: 5, title: 'Worth every penny', comment: 'Four PT sessions a month plus the recovery lounge. The app books everything in seconds.', featured: true, category: 'value' },
    { name: 'Sofia Garcia', role: 'Family plan', rating: 4, title: 'Great for families', comment: 'Kids activity hour means I can actually train while they are looked after.', featured: true, category: 'facilities' },
    { name: 'Kenji Tanaka', role: 'Essential member', rating: 5, title: 'Spotless equipment', comment: 'Everything is maintained and labelled. The maintenance team clearly cares.', featured: false, category: 'facilities' },
    { name: 'Amara Okafor', role: 'Pro member', rating: 5, title: 'Classes are addictive', comment: 'Power HIIT and Dance Cardio rotate enough that it never feels repetitive.', featured: true, category: 'classes' },
    { name: 'Omar Hassan', role: 'Corporate', rating: 4, title: 'Smooth onboarding', comment: 'Our HR dashboard and invoice billing made rollout across 40 people painless.', featured: false, category: 'billing' },
    { name: 'Chloe Dubois', role: 'Pro member', rating: 5, title: 'Community feeling', comment: 'I moved cities and my membership transferred instantly to the Berlin club.', featured: false, category: 'service' },
    { name: 'Arjun Mehta', role: 'Day pass', rating: 4, title: 'Day pass was generous', comment: 'Full floor access with no upsell pressure. Signed up on the spot.', featured: false, category: 'value' },
  ]);

  await Campaign.insertMany([
    { name: 'Win-back: lapsed members', channel: 'email', subject: 'We saved your spot', body: 'Come back for two weeks on us.', audience: 'lapsed', status: 'sent', sentAt: daysAgo(12), stats: { sent: 820, opened: 391, clicked: 96, converted: 41 }, budget: 400, spend: 380 },
    { name: 'Pro plan upgrade push', channel: 'email', subject: 'Unlock all-clubs access', body: 'Upgrade to Pro before the 30th.', audience: 'all', status: 'sent', sentAt: daysAgo(5), stats: { sent: 1440, opened: 640, clicked: 154, converted: 63 }, budget: 600, spend: 540 },
    { name: 'Summer throwdown', channel: 'social', subject: 'Team competition', body: 'Register your team of 3.', audience: 'all', status: 'scheduled', scheduledFor: daysAhead(6), budget: 1200, spend: 0 },
    { name: 'Corporate wellness Q3', channel: 'email', subject: 'Team wellbeing, sorted', body: 'Volume pricing for teams of 10+.', audience: 'prospects', status: 'draft', budget: 800, spend: 0 },
    { name: 'PT pack SMS drop', channel: 'sms', subject: '', body: '10 sessions, 15% off this week only.', audience: 'vip', status: 'sending', scheduledFor: daysAgo(1), stats: { sent: 210, opened: 133, clicked: 44, converted: 18 }, budget: 300, spend: 210 },
  ]);

  const shiftDocs = [];
  for (let d = -7; d <= 14; d += 1) {
    for (const s of staffDocs) {
      if (rnd() > 0.62) continue;
      shiftDocs.push({
        staff: s._id,
        date: daysAhead(d),
        start: pick(['05:30', '07:00', '09:00', '12:00', '15:00', '17:00']),
        end: pick(['13:30', '15:00', '17:00', '20:00', '22:00', '23:00']),
        location: s.location,
        role: s.jobTitle,
        status: d < 0 ? pick(['confirmed', 'confirmed', 'absent']) : pick(['scheduled', 'scheduled', 'confirmed', 'swapped']),
      });
    }
  }
  await Shift.insertMany(shiftDocs);

  const demoMember = memberDocs[0];
  await Notification.insertMany([
    { user: demoMember.user, title: 'Payment received', body: 'Your Pro membership renewal of $69 was successful.', type: 'payment' },
    { user: demoMember.user, title: 'Class confirmed', body: 'Power HIIT tomorrow at 06:00 is confirmed. See you there.', type: 'booking' },
    { user: demoMember.user, title: 'Membership expiring', body: 'Your plan expires in 14 days. Renew now to keep your rate.', type: 'system' },
    { user: admin._id, title: '6 new contact enquiries', body: 'The website contact form needs a reply within 24 hours.', type: 'system' },
  ]);

  await Promise.all(memberDocs.slice(0, 12).map((m, i) =>
    Notification.create({ user: m.user, title: `Welcome to GymFlow, ${m.firstName}!`, body: 'Complete your profile to unlock your QR check-in pass.', type: 'system' })
  ));

  const counts = {
    locations: await Location.countDocuments(),
    plans: await Plan.countDocuments(),
    users: await User.countDocuments(),
    members: await Member.countDocuments(),
    staff: await Staff.countDocuments(),
    classTypes: await ClassType.countDocuments(),
    sessions: await ClassSession.countDocuments(),
    bookings: await Booking.countDocuments(),
    equipment: await Equipment.countDocuments(),
    maintenance: await Maintenance.countDocuments(),
    payments: await Payment.countDocuments(),
    invoices: await Invoice.countDocuments(),
    expenses: await Expense.countDocuments(),
    products: await Product.countDocuments(),
    sales: await Sale.countDocuments(),
    checkins: await CheckIn.countDocuments(),
    lockers: await Locker.countDocuments(),
    gallery: await GalleryItem.countDocuments(),
    reviews: await Review.countDocuments(),
    campaigns: await Campaign.countDocuments(),
    shifts: await Shift.countDocuments(),
  };
  console.log('[seed] done:', JSON.stringify(counts, null, 2));
  console.log('[seed] logins -> admin@gymflow.io/admin123 | marcus.reed@gymflow.io/trainer123 | member login: any seeded email + member123');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
