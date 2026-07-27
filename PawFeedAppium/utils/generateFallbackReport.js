const path = require('path');
const { generateReport } = require('./xlsxReporter');
const { generateHtmlReport } = require('./generateHtmlReport');
const fs = require('fs-extra');

async function generateFallbackReport() {
    const fallbackData = [{
        title: 'Fatal Appium / WDIO Execution Crash',
        parent: 'System Execution',
        passed: false,
        duration: 15,
        error: 'The Appium test runner crashed or exited early before specs completed.'
    }];

    const reportsDir = path.join(__dirname, '..', 'reports');
    const excelOutputPath = path.join(reportsDir, 'test-results.xlsx');
    const htmlOutputPath = path.join(reportsDir, 'execution-report.html');

    fs.ensureDirSync(reportsDir);
    await generateReport(fallbackData, excelOutputPath);
    await generateHtmlReport(fallbackData, htmlOutputPath);
    console.log('Fallback reports generated successfully at:', reportsDir);
}

module.exports = { generateFallbackReport };

if (require.main === module) {
    generateFallbackReport().catch(console.error);
}
