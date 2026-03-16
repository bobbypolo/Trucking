/**
 * Migration Script: Update Dispatcher Capabilities
 * 
 * This script updates the capabilityMatrix for existing companies in localStorage
 * to add the LOAD_TRACK capability to dispatcher roles.
 * 
 * Run this in the browser console to fix dispatcher access to the loadboard.
 */

console.log('🔧 Starting Dispatcher Capability Migration...');

// Get companies from localStorage
const companiesKey = 'loadpilot_companies_v1';
const companiesJson = localStorage.getItem(companiesKey);

if (!companiesJson) {
    console.log('❌ No companies found in localStorage');
} else {
    const companies = JSON.parse(companiesJson);
    console.log(`📦 Found ${companies.length} company(ies)`);

    let updated = false;

    companies.forEach((company, index) => {
        console.log(`\n🏢 Processing company ${index + 1}: ${company.name}`);
        console.log(`   Operating Mode: ${company.operatingMode || 'Small Team'}`);

        if (!company.capabilityMatrix) {
            console.log('   ⚠️  No capability matrix found - skipping');
            return;
        }

        // Check dispatcher role (lowercase for Small Team, uppercase for Split Roles/Enterprise)
        const dispatcherRoles = ['dispatcher', 'DISPATCHER'];

        dispatcherRoles.forEach(role => {
            if (company.capabilityMatrix[role]) {
                const capabilities = company.capabilityMatrix[role];
                const hasLoadTrack = capabilities.some(cap => cap.capability === 'LOAD_TRACK');

                if (!hasLoadTrack) {
                    console.log(`   ✅ Adding LOAD_TRACK to ${role} role`);
                    company.capabilityMatrix[role].push({
                        capability: 'LOAD_TRACK',
                        level: 'Allow'
                    });
                    updated = true;
                } else {
                    console.log(`   ℹ️  ${role} already has LOAD_TRACK`);
                }
            }
        });
    });

    if (updated) {
        localStorage.setItem(companiesKey, JSON.stringify(companies));
        console.log('\n✅ Migration complete! Companies updated in localStorage.');
        console.log('🔄 Please refresh the page for changes to take effect.');
    } else {
        console.log('\n✅ No updates needed - all dispatchers already have LOAD_TRACK capability.');
    }
}

console.log('\n📋 Current company capability matrix:');
if (companiesJson) {
    const companies = JSON.parse(companiesJson);
    companies.forEach(company => {
        console.log(`\n${company.name}:`);
        if (company.capabilityMatrix) {
            Object.keys(company.capabilityMatrix).forEach(role => {
                if (role.toLowerCase().includes('dispatch')) {
                    console.log(`  ${role}:`, company.capabilityMatrix[role]);
                }
            });
        }
    });
}
