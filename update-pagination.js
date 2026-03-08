const fs = require('fs');

const dirs = [
    'src/app/modules/monitoring/monitoring.ts',
    'src/app/modules/transactions/transactions.component.ts',
    'src/app/modules/dashboard/overview/overview.ts',
    'src/app/modules/routing/routing.ts',
    'src/app/modules/developers/monitoring/developer-monitoring.ts',
    'src/app/modules/developers/transactions/developer-transactions.ts',
    'src/app/modules/developers/dashboard/developer-dashboard.ts',
    'src/app/modules/developers/developers.ts'
];

dirs.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        const oldCode = /pages = computed\(\(\) => \{\s+return Array\.from\(\{ length: this\.totalPages\(\) \}, \(_, i\) => i \+ 1\);\s+\}\);/g;
        const newCode = `pages = computed(() => {
        const total = this.totalPages();
        let start = Math.max(1, this.currentPage() - 2);
        let end = Math.min(total, start + 4);
        if (end - start < 4) {
            start = Math.max(1, end - 4);
        }
        return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
    });`;
        const replaced = content.replace(oldCode, newCode);
        if (content !== replaced) {
            fs.writeFileSync(file, replaced);
            console.log('Updated', file);
        }
    }
});
