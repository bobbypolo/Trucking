#!/usr/bin/env node
/**
 * API Configuration Verification Script
 * Checks all required API keys and configurations for LoadPilot
 */

require('dotenv').config();
const https = require('https');

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkEnvVar(varName, required = true) {
    const value = process.env[varName];
    if (value && value !== 'your_api_key_here' && value !== 'your_project_id' && !value.includes('your_')) {
        log(`✅ ${varName}: Configured`, 'green');
        return true;
    } else if (required) {
        log(`❌ ${varName}: Missing or placeholder`, 'red');
        return false;
    } else {
        log(`⚠️  ${varName}: Not configured (optional)`, 'yellow');
        return null;
    }
}

async function testGoogleMapsAPI(apiKey) {
    return new Promise((resolve) => {
        if (!apiKey || apiKey.includes('your_')) {
            log('⏭️  Skipping Google Maps API test (no key configured)', 'yellow');
            resolve(false);
            return;
        }

        const url = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;

        https.get(url, (res) => {
            if (res.statusCode === 200) {
                log('✅ Google Maps API: Key is valid and accessible', 'green');
                resolve(true);
            } else if (res.statusCode === 403) {
                log('❌ Google Maps API: Key rejected (check restrictions or enable APIs)', 'red');
                resolve(false);
            } else {
                log(`⚠️  Google Maps API: Unexpected status ${res.statusCode}`, 'yellow');
                resolve(false);
            }
        }).on('error', (err) => {
            log(`❌ Google Maps API: Network error - ${err.message}`, 'red');
            resolve(false);
        });
    });
}

async function testFirebaseConfig() {
    const requiredVars = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_APP_ID'
    ];

    let allConfigured = true;
    for (const varName of requiredVars) {
        if (!checkEnvVar(varName, true)) {
            allConfigured = false;
        }
    }

    return allConfigured;
}

async function main() {
    log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
    log('║     LoadPilot API Configuration Verification          ║', 'cyan');
    log('╚════════════════════════════════════════════════════════╝\n', 'cyan');

    log('📋 Checking Environment Variables...\n', 'blue');

    // Firebase Configuration
    log('🔥 Firebase Configuration:', 'blue');
    const firebaseOk = await testFirebaseConfig();
    console.log();

    // Google Maps API
    log('🗺️  Google Maps API:', 'blue');
    const mapsKeyConfigured = checkEnvVar('VITE_GOOGLE_MAPS_API_KEY', true);
    if (mapsKeyConfigured) {
        await testGoogleMapsAPI(process.env.VITE_GOOGLE_MAPS_API_KEY);
    }
    console.log();

    // Weather APIs
    log('🌤️  Weather APIs:', 'blue');
    checkEnvVar('VITE_WEATHER_API_KEY', false);
    checkEnvVar('VITE_OPENWEATHER_API_KEY', false);
    console.log();

    // Database Configuration
    log('🗄️  Database Configuration:', 'blue');
    checkEnvVar('DB_HOST', true);
    checkEnvVar('DB_USER', true);
    checkEnvVar('DB_PASSWORD', true);
    checkEnvVar('DB_NAME', true);
    console.log();

    // Backend Configuration
    log('⚙️  Backend Configuration:', 'blue');
    checkEnvVar('PORT', true);
    checkEnvVar('JWT_SECRET', true);
    console.log();

    // Summary
    log('═══════════════════════════════════════════════════════', 'cyan');
    log('📊 Summary:', 'blue');

    const criticalIssues = [];
    const warnings = [];

    if (!firebaseOk) {
        criticalIssues.push('Firebase configuration incomplete');
    }

    if (!mapsKeyConfigured) {
        criticalIssues.push('Google Maps API key missing');
    }

    if (!process.env.VITE_WEATHER_API_KEY && !process.env.VITE_OPENWEATHER_API_KEY) {
        warnings.push('No weather API configured (map weather features disabled)');
    }

    if (criticalIssues.length > 0) {
        log('\n❌ Critical Issues:', 'red');
        criticalIssues.forEach(issue => log(`   • ${issue}`, 'red'));
    }

    if (warnings.length > 0) {
        log('\n⚠️  Warnings:', 'yellow');
        warnings.forEach(warning => log(`   • ${warning}`, 'yellow'));
    }

    if (criticalIssues.length === 0 && warnings.length === 0) {
        log('\n✅ All critical APIs are configured!', 'green');
    }

    log('\n═══════════════════════════════════════════════════════', 'cyan');
    log('\n📖 For detailed setup instructions, see:', 'blue');
    log('   • API_CONFIGURATION_AUDIT.md', 'cyan');
    log('   • Knowledge Base: kci_trucklogix_pro_technical_reference', 'cyan');
    log('');
}

main().catch(err => {
    log(`\n❌ Error running verification: ${err.message}`, 'red');
    process.exit(1);
});
