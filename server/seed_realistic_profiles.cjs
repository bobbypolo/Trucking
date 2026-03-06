/**
 * Comprehensive User Profile Seeding Script
 * Creates realistic, detailed user profiles for testing all features
 * Run with: node server/seed_realistic_profiles.cjs
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

let serviceAccount;
try {
    serviceAccount = require('./serviceAccount.json');
} catch (e) {
    console.error('ERROR: Firebase Service Account not found');
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const SEED_COMPANY_ID = "iscope-authority-001";

// Realistic User Profiles with Complete Data
const REALISTIC_USERS = [
    // ========== MANAGEMENT & ADMIN ==========
    {
        email: 'admin@loadpilot.com',
        password: 'admin123',
        name: 'Michael Chen',
        role: 'admin',
        phone: '+1-312-555-0101',
        title: 'Chief Operations Officer',
        department: 'Executive',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 125000,
        hireDate: '2020-01-15',
        bio: 'Veteran logistics executive with 15+ years experience. Specializes in fleet optimization and technology integration.',
        certifications: ['CDL Class A', 'Hazmat', 'Logistics Management'],
        emergencyContact: { name: 'Lisa Chen', phone: '+1-312-555-0102', relationship: 'Spouse' }
    },
    {
        email: 'architect@loadpilot.com',
        password: 'admin123',
        name: 'Dr. Sarah Martinez',
        role: 'ORG_OWNER_SUPER_ADMIN',
        phone: '+1-312-555-0103',
        title: 'System Architect & CTO',
        department: 'Technology',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 150000,
        hireDate: '2019-06-01',
        bio: 'PhD in Computer Science. Designed LoadPilot\'s core architecture. Expert in distributed systems and logistics optimization.',
        certifications: ['AWS Solutions Architect', 'Google Cloud Professional', 'Scrum Master'],
        emergencyContact: { name: 'Carlos Martinez', phone: '+1-312-555-0104', relationship: 'Spouse' }
    },
    {
        email: 'opsmanager@loadpilot.com',
        password: 'admin123',
        name: 'James Thompson',
        role: 'OPS_MANAGER',
        phone: '+1-312-555-0105',
        title: 'Operations Manager',
        department: 'Operations',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 95000,
        hireDate: '2021-03-10',
        bio: 'Former dispatcher with 10 years field experience. Known for efficiency improvements and team development.',
        certifications: ['Six Sigma Green Belt', 'PMP'],
        emergencyContact: { name: 'Emily Thompson', phone: '+1-312-555-0106', relationship: 'Spouse' }
    },

    // ========== DISPATCH & OPERATIONS ==========
    {
        email: 'dispatch@loadpilot.com',
        password: 'dispatch123',
        name: 'Rachel Kim',
        role: 'DISPATCHER',
        phone: '+1-312-555-0107',
        title: 'Lead Dispatcher',
        department: 'Dispatch',
        location: 'Chicago, IL',
        payModel: 'hourly',
        payRate: 28.50,
        hireDate: '2021-08-15',
        bio: 'Expert route planner with exceptional communication skills. Manages 15+ drivers daily. Specializes in intermodal logistics.',
        certifications: ['Dispatch Management', 'Crisis Communication'],
        emergencyContact: { name: 'David Kim', phone: '+1-312-555-0108', relationship: 'Brother' },
        shiftPreference: 'Day',
        languages: ['English', 'Korean']
    },
    {
        email: 'fused_ops@kci.com',
        password: 'admin123',
        name: 'Marcus Williams',
        role: 'OPS',
        phone: '+1-317-555-0201',
        title: 'Operations Coordinator',
        department: 'Operations',
        location: 'Indianapolis, IN',
        payModel: 'salary',
        payRate: 62000,
        hireDate: '2022-01-20',
        bio: 'Multi-skilled operations professional. Handles dispatch, customer service, and basic accounting for small fleet operations.',
        certifications: ['Logistics Coordinator'],
        emergencyContact: { name: 'Angela Williams', phone: '+1-317-555-0202', relationship: 'Mother' }
    },

    // ========== ACCOUNTING & FINANCE ==========
    {
        email: 'ar@loadpilot.com',
        password: 'admin123',
        name: 'Jennifer Lopez',
        role: 'ACCOUNTING_AR',
        phone: '+1-312-555-0109',
        title: 'Accounts Receivable Specialist',
        department: 'Finance',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 58000,
        hireDate: '2021-11-01',
        bio: 'Detail-oriented AR specialist. Maintains 98% collection rate. Expert in freight billing and factoring.',
        certifications: ['QuickBooks Certified', 'Accounts Receivable Management'],
        emergencyContact: { name: 'Roberto Lopez', phone: '+1-312-555-0110', relationship: 'Spouse' }
    },
    {
        email: 'ap@loadpilot.com',
        password: 'admin123',
        name: 'David Patel',
        role: 'ACCOUNTING_AP',
        phone: '+1-312-555-0111',
        title: 'Accounts Payable Clerk',
        department: 'Finance',
        location: 'Chicago, IL',
        payModel: 'hourly',
        payRate: 24.00,
        hireDate: '2022-06-15',
        bio: 'Efficient AP processor. Handles vendor payments, fuel cards, and driver settlements. Strong attention to detail.',
        certifications: ['Accounts Payable Fundamentals'],
        emergencyContact: { name: 'Priya Patel', phone: '+1-312-555-0112', relationship: 'Sister' }
    },
    {
        email: 'payroll@loadpilot.com',
        password: 'payroll123',
        name: 'Amanda Rodriguez',
        role: 'PAYROLL_SETTLEMENTS',
        phone: '+1-312-555-0113',
        title: 'Payroll & Settlements Manager',
        department: 'Finance',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 72000,
        hireDate: '2020-09-01',
        bio: 'Certified payroll professional. Manages driver settlements, tax compliance, and benefits administration for 50+ drivers.',
        certifications: ['CPP - Certified Payroll Professional', 'FLSA Compliance'],
        emergencyContact: { name: 'Miguel Rodriguez', phone: '+1-312-555-0114', relationship: 'Spouse' }
    },
    {
        email: 'fused_finance@kci.com',
        password: 'admin123',
        name: 'Robert Johnson',
        role: 'FINANCE',
        phone: '+1-317-555-0203',
        title: 'Finance Manager',
        department: 'Finance',
        location: 'Indianapolis, IN',
        payModel: 'salary',
        payRate: 68000,
        hireDate: '2021-05-10',
        bio: 'Handles all financial operations for small fleet: AR, AP, payroll, and financial reporting.',
        certifications: ['CPA Candidate', 'Financial Management'],
        emergencyContact: { name: 'Mary Johnson', phone: '+1-317-555-0204', relationship: 'Wife' }
    },

    // ========== SAFETY & COMPLIANCE ==========
    {
        email: 'safety@loadpilot.com',
        password: 'safety123',
        name: 'Thomas Anderson',
        role: 'SAFETY_COMPLIANCE',
        phone: '+1-312-555-0115',
        title: 'Director of Safety & Compliance',
        department: 'Safety',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 82000,
        hireDate: '2020-04-01',
        bio: 'Former DOT auditor with 12 years experience. Maintains company\'s 95+ safety score. Expert in FMCSA regulations and driver training.',
        certifications: ['CSA Expert', 'DOT Compliance Specialist', 'Safety Management Certificate'],
        emergencyContact: { name: 'Patricia Anderson', phone: '+1-312-555-0116', relationship: 'Spouse' }
    },
    {
        email: 'maint@loadpilot.com',
        password: 'admin123',
        name: 'Carlos Ramirez',
        role: 'MAINTENANCE_MANAGER',
        phone: '+1-312-555-0117',
        title: 'Fleet Maintenance Manager',
        department: 'Maintenance',
        location: 'Chicago, IL',
        payModel: 'salary',
        payRate: 75000,
        hireDate: '2019-11-15',
        bio: 'ASE Master Technician. Manages preventive maintenance program for 40+ trucks and 80+ trailers. Reduced downtime by 35%.',
        certifications: ['ASE Master Technician', 'Diesel Engine Specialist', 'Fleet Management'],
        emergencyContact: { name: 'Maria Ramirez', phone: '+1-312-555-0118', relationship: 'Wife' }
    },

    // ========== DRIVERS (Detailed Profiles) ==========
    {
        email: 'driver1@loadpilot.com',
        password: 'driver123',
        name: 'Marcus Rodriguez',
        role: 'driver',
        phone: '+1-773-555-0301',
        title: 'Senior Company Driver',
        department: 'Operations',
        location: 'Chicago, IL',
        homeState: 'IL',
        payModel: 'percent',
        payRate: 28,
        hireDate: '2018-03-15',
        bio: 'Top-performing driver with 8 years OTR experience. Specializes in intermodal drayage. Perfect safety record. Mentor to new drivers.',
        certifications: ['CDL Class A', 'Hazmat', 'Tanker', 'Doubles/Triples', 'TWIC Card'],
        safetyScore: 98,
        onboardingStatus: 'Completed',
        preferredRoutes: ['Chicago-Indianapolis', 'Chicago-Detroit'],
        equipmentPreference: 'Automatic Transmission',
        emergencyContact: { name: 'Sofia Rodriguez', phone: '+1-773-555-0302', relationship: 'Wife' },
        languages: ['English', 'Spanish'],
        yearsExperience: 8,
        totalMiles: 850000,
        endorsements: ['H', 'N', 'T', 'X']
    },
    {
        email: 'driver2@loadpilot.com',
        password: 'driver123',
        name: 'Sarah Chen',
        role: 'driver',
        phone: '+1-317-555-0401',
        title: 'Company Driver',
        department: 'Operations',
        location: 'Indianapolis, IN',
        homeState: 'IN',
        payModel: 'percent',
        payRate: 26,
        hireDate: '2020-07-01',
        bio: 'Reliable regional driver. Excellent customer service skills. Specializes in time-sensitive deliveries.',
        certifications: ['CDL Class A', 'Hazmat', 'TWIC Card'],
        safetyScore: 95,
        onboardingStatus: 'Completed',
        preferredRoutes: ['Indianapolis-Chicago', 'Indianapolis-Cincinnati'],
        equipmentPreference: 'Day Cab',
        emergencyContact: { name: 'Michael Chen', phone: '+1-317-555-0402', relationship: 'Brother' },
        languages: ['English', 'Mandarin'],
        yearsExperience: 4,
        totalMiles: 420000,
        endorsements: ['H', 'X']
    },
    {
        email: 'driver3@loadpilot.com',
        password: 'driver123',
        name: 'David Thompson',
        role: 'driver',
        phone: '+1-614-555-0501',
        title: 'Company Driver',
        department: 'Operations',
        location: 'Columbus, OH',
        homeState: 'OH',
        payModel: 'percent',
        payRate: 25,
        hireDate: '2021-02-10',
        bio: 'Former military logistics specialist. Strong work ethic and attention to detail. Quick learner.',
        certifications: ['CDL Class A', 'Hazmat'],
        safetyScore: 92,
        onboardingStatus: 'Completed',
        preferredRoutes: ['Columbus-Chicago', 'Columbus-Detroit'],
        equipmentPreference: 'Sleeper Cab',
        emergencyContact: { name: 'Jennifer Thompson', phone: '+1-614-555-0502', relationship: 'Wife' },
        languages: ['English'],
        yearsExperience: 3,
        totalMiles: 310000,
        endorsements: ['H']
    },
    {
        email: 'driver4@loadpilot.com',
        password: 'driver123',
        name: 'Elena Garcia',
        role: 'driver',
        phone: '+1-214-555-0601',
        title: 'Regional Driver',
        department: 'Operations',
        location: 'Dallas, TX',
        homeState: 'TX',
        payModel: 'percent',
        payRate: 27,
        hireDate: '2019-09-20',
        bio: 'Experienced regional driver. Excellent fuel efficiency record. Known for professional communication with customers.',
        certifications: ['CDL Class A', 'Hazmat', 'Tanker', 'TWIC Card'],
        safetyScore: 96,
        onboardingStatus: 'Completed',
        preferredRoutes: ['Dallas-Houston', 'Dallas-San Antonio'],
        equipmentPreference: 'Automatic Transmission',
        emergencyContact: { name: 'Juan Garcia', phone: '+1-214-555-0602', relationship: 'Husband' },
        languages: ['English', 'Spanish'],
        yearsExperience: 6,
        totalMiles: 620000,
        endorsements: ['H', 'N', 'X']
    },
    {
        email: 'driver5@loadpilot.com',
        password: 'driver123',
        name: 'James Wilson',
        role: 'driver',
        phone: '+1-404-555-0701',
        title: 'Company Driver',
        department: 'Operations',
        location: 'Atlanta, GA',
        homeState: 'GA',
        payModel: 'percent',
        payRate: 26,
        hireDate: '2021-11-05',
        bio: 'Newer driver with strong potential. Eager to learn and improve. Consistently meets delivery windows.',
        certifications: ['CDL Class A'],
        safetyScore: 89,
        onboardingStatus: 'Completed',
        preferredRoutes: ['Atlanta-Charlotte', 'Atlanta-Nashville'],
        equipmentPreference: 'Day Cab',
        emergencyContact: { name: 'Linda Wilson', phone: '+1-404-555-0702', relationship: 'Mother' },
        languages: ['English'],
        yearsExperience: 2,
        totalMiles: 180000,
        endorsements: []
    },

    // ========== FLEET MANAGEMENT ==========
    {
        email: 'fleetowner@kci.com',
        password: 'fleet123',
        name: 'Richard Hayes',
        role: 'FLEET_OO_ADMIN_PORTAL',
        phone: '+1-317-555-0801',
        title: 'Fleet Owner',
        department: 'Fleet Management',
        location: 'Indianapolis, IN',
        payModel: 'revenue_share',
        payRate: 15,
        hireDate: '2017-05-01',
        bio: 'Independent fleet owner with 5 trucks. Partners with LoadPilot for dispatch and back-office services. 20+ years in trucking.',
        certifications: ['CDL Class A', 'Business Management'],
        fleetSize: 5,
        emergencyContact: { name: 'Barbara Hayes', phone: '+1-317-555-0802', relationship: 'Wife' }
    },
    {
        email: 'operator1@gmail.com',
        password: 'admin123',
        name: 'Tony Martinez',
        role: 'owner_operator',
        phone: '+1-317-555-0901',
        title: 'Owner Operator',
        department: 'Independent Contractors',
        location: 'Indianapolis, IN',
        homeState: 'IN',
        payModel: 'percent',
        payRate: 75,
        hireDate: '2020-08-15',
        bio: 'Independent owner-operator leased to Richard Hayes fleet. Owns 2018 Freightliner Cascadia. Specializes in regional runs.',
        certifications: ['CDL Class A', 'Hazmat', 'TWIC Card'],
        safetyScore: 94,
        onboardingStatus: 'Completed',
        truckOwned: '2018 Freightliner Cascadia',
        managedByUserId: 'fleetowner@kci.com',
        emergencyContact: { name: 'Rosa Martinez', phone: '+1-317-555-0902', relationship: 'Wife' },
        yearsExperience: 12,
        totalMiles: 1200000
    },
    {
        email: 'operator2@gmail.com',
        password: 'admin123',
        name: 'Kevin Brown',
        role: 'owner_operator',
        phone: '+1-317-555-1001',
        title: 'Owner Operator',
        department: 'Independent Contractors',
        location: 'Fort Wayne, IN',
        homeState: 'IN',
        payModel: 'percent',
        payRate: 75,
        hireDate: '2021-03-20',
        bio: 'Owner-operator with Hayes fleet. Owns 2020 Kenworth T680. Focuses on fuel efficiency and customer satisfaction.',
        certifications: ['CDL Class A', 'Hazmat'],
        safetyScore: 91,
        onboardingStatus: 'Completed',
        truckOwned: '2020 Kenworth T680',
        managedByUserId: 'fleetowner@kci.com',
        emergencyContact: { name: 'Michelle Brown', phone: '+1-317-555-1002', relationship: 'Wife' },
        yearsExperience: 9,
        totalMiles: 950000
    },

    // ========== SMALL BUSINESS ==========
    {
        email: 'smallbiz@kci.com',
        password: 'admin123',
        name: 'Lisa Anderson',
        role: 'OWNER_ADMIN',
        phone: '+1-260-555-1101',
        title: 'Owner/Operator',
        department: 'Executive',
        location: 'Fort Wayne, IN',
        payModel: 'owner',
        payRate: 0,
        hireDate: '2015-01-01',
        bio: 'Small fleet owner with 3 trucks. Handles all aspects of business: dispatch, accounting, safety, and occasionally drives.',
        certifications: ['CDL Class A', 'Small Business Management'],
        fleetSize: 3,
        emergencyContact: { name: 'Tom Anderson', phone: '+1-260-555-1102', relationship: 'Husband' }
    },

    // ========== CUSTOMER ==========
    {
        email: 'customer@gmail.com',
        password: 'admin123',
        name: 'Patricia Williams',
        role: 'customer',
        phone: '+1-312-555-1201',
        title: 'Logistics Coordinator',
        department: 'Supply Chain',
        location: 'Chicago, IL',
        company: 'Global Manufacturing Inc.',
        bio: 'Logistics coordinator for major manufacturing company. Manages freight for 50+ shipments per week.',
        emergencyContact: { name: 'Global Manufacturing Security', phone: '+1-312-555-1202', relationship: 'Company' }
    }
];

async function seedRealisticProfiles() {
    console.log('🚀 Starting Realistic User Profile Seeding...\n');

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const user of REALISTIC_USERS) {
        try {
            // Check if user exists in Firebase Auth
            let firebaseUser;
            try {
                firebaseUser = await admin.auth().getUserByEmail(user.email);
                console.log(`✓ Firebase user exists: ${user.email}`);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    // Create Firebase user
                    firebaseUser = await admin.auth().createUser({
                        email: user.email,
                        password: user.password,
                        displayName: user.name,
                        emailVerified: true
                    });
                    console.log(`✓ Created Firebase user: ${user.email}`);
                    created++;
                } else {
                    throw error;
                }
            }

            // Create/Update comprehensive Firestore profile
            const userProfile = {
                id: firebaseUser.uid,
                company_id: SEED_COMPANY_ID,
                email: user.email,
                name: user.name,
                role: user.role,

                // Contact Information
                phone: user.phone || null,
                title: user.title || null,
                department: user.department || null,
                location: user.location || null,

                // Employment Details
                pay_model: user.payModel || 'salary',
                pay_rate: user.payRate || 0,
                hire_date: user.hireDate || null,

                // Profile Details
                bio: user.bio || null,
                certifications: user.certifications || [],
                emergency_contact: user.emergencyContact || null,

                // Driver-Specific Fields
                home_state: user.homeState || null,
                safety_score: user.safetyScore || 100,
                onboarding_status: user.onboardingStatus || 'Completed',
                preferred_routes: user.preferredRoutes || [],
                equipment_preference: user.equipmentPreference || null,
                languages: user.languages || ['English'],
                years_experience: user.yearsExperience || 0,
                total_miles: user.totalMiles || 0,
                endorsements: user.endorsements || [],

                // Fleet Owner Fields
                fleet_size: user.fleetSize || null,
                truck_owned: user.truckOwned || null,
                managed_by_user_id: user.managedByUserId || null,

                // Customer Fields
                company: user.company || null,

                // Additional Fields
                shift_preference: user.shiftPreference || null,

                // System Fields
                restricted: false,
                override_active: false,
                audit_history: [],
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(firebaseUser.uid).set(userProfile, { merge: true });
            console.log(`  ↳ Created/Updated Firestore profile for ${user.name}`);
            console.log(`     Role: ${user.role} | ${user.title || 'N/A'}`);
            if (user.bio) {
                console.log(`     Bio: ${user.bio.substring(0, 60)}...`);
            }
            console.log('');

        } catch (error) {
            console.error(`✗ Error processing ${user.email}:`, error.message);
            errors++;
        }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   Total Users: ${REALISTIC_USERS.length}`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${REALISTIC_USERS.length - created}`);
    console.log(`   Errors: ${errors}`);

    if (errors === 0) {
        console.log('\n✅ Realistic user profile seeding completed successfully!');
        console.log('\n👥 User Profiles Created:');
        console.log('   - Management: 3 users (COO, CTO, Ops Manager)');
        console.log('   - Dispatch: 2 users (Lead Dispatcher, Ops Coordinator)');
        console.log('   - Finance: 4 users (AR, AP, Payroll, Finance Manager)');
        console.log('   - Safety: 2 users (Safety Director, Maintenance Manager)');
        console.log('   - Drivers: 5 detailed profiles with experience levels');
        console.log('   - Fleet: 3 users (Fleet Owner, 2 Owner-Operators)');
        console.log('   - Small Business: 1 owner/operator');
        console.log('   - Customer: 1 logistics coordinator');
    } else {
        console.log('\n⚠️  Seeding completed with errors.');
    }
}

// Run the seeding
seedRealisticProfiles()
    .then(() => {
        console.log('\n🎉 Done! All user profiles are ready for testing.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
