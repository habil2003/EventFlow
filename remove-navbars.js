const fs = require('fs');
const path = require('path');

// List of files that still have navbars
const filesToFix = [
    'app/admin/analytics/page.tsx',
    'app/admin/disputes/page.tsx',
    'app/bookings/[id]/page.tsx',
    'app/dashboard/events/[id]/page.tsx',
    'app/events/page.tsx',
    'app/events/[id]/page.tsx',
    'app/marketplace/page.tsx',
    'app/organizer/checkin/page.tsx',
    'app/organizer/create/page.tsx',
    'app/organizer/events/page.tsx',
    'app/organizer/events/[id]/bookings/page.tsx',
    'app/organizer/events/[id]/edit/page.tsx',
    'app/organizer/events/[id]/page.tsx',
    'app/organizer/payouts/page.tsx',
    'app/organizer/sales/page.tsx',
    'app/vendor/bookings/page.tsx',
    'app/vendor/packages/page.tsx',
    'app/vendor/packages/[id]/edit/page.tsx',
    'app/vendor/payouts/page.tsx',
    'app/vendor/setup/page.tsx',
    'app/vendors/[id]/book/page.tsx',
    'app/vendors/[id]/packages/page.tsx',
    'app/vendors/[id]/page.tsx'
];

// Pattern to match navbar (with or without motion)
const navbarPattern = /(\/\* Navigation Bar \*\/\s*)?<motion\.nav[\s\S]*?<\/motion\.nav>|<nav className="sticky top-0 z-50 bg-white\/80 dark:bg-gray-900\/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 shadow-sm">[\s\S]*?<\/nav>/g;

let totalFixed = 0;

filesToFix.forEach(filePath => {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Remove navbar
    content = content.replace(navbarPattern, '');
    
    // Also remove any empty comment lines left behind
    content = content.replace(/{\/\* Navigation Bar \*\/}\s*/g, '');
    
    if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Fixed: ${filePath}`);
        totalFixed++;
    } else {
        console.log(`⚠️ No change: ${filePath}`);
    }
});

console.log(`\n📊 Total files fixed: ${totalFixed}`);