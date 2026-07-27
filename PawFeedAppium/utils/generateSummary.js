const fs = require('fs-extra');
const path = require('path');

async function generateSummary() {
    const resultsPath = path.join(__dirname, '..', '.wdio-results.jsonl');
    let results = [];

    if (fs.existsSync(resultsPath)) {
        const lines = fs.readFileSync(resultsPath, 'utf-8').trim().split('\n').filter(Boolean);
        results = lines.map(line => JSON.parse(line));
    } else {
        results = [{
            title: 'Fallback Execution',
            parent: 'System Execution',
            passed: false,
            duration: 10,
            error: 'No test log found - process might have crashed early.'
        }];
    }

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : '0.00';
    const totalDurationMs = results.reduce((acc, curr) => acc + (curr.duration || 10), 0);

    const markdownSummary = `
## 📱 PawFeed Mobile Appium Mega E2E Pipeline Results

| Metric | Value |
| :--- | :--- |
| **Application** | PawFeed Android App |
| **Total Tests Executed** | **${totalTests}** |
| **Passed Tests** | ✅ ${passedTests} |
| **Failed Tests** | ❌ ${failedTests} |
| **Pass Rate** | **${passRate}%** |
| **Total Duration** | ${(totalDurationMs / 1000).toFixed(2)} seconds |

### 📊 Category Breakdown

| Category | Total | Passed | Failed |
| :--- | :---: | :---: | :---: |
${Object.entries(
    results.reduce((acc, r) => {
        const cat = r.parent || 'General';
        if (!acc[cat]) acc[cat] = { total: 0, passed: 0, failed: 0 };
        acc[cat].total++;
        if (r.passed) acc[cat].passed++;
        else acc[cat].failed++;
        return acc;
    }, {})
).map(([cat, s]) => `| ${cat} | ${s.total} | ${s.passed} | ${s.failed} |`).join('\n')}
`;

    console.log(markdownSummary);

    const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummaryFile) {
        fs.appendFileSync(stepSummaryFile, markdownSummary, 'utf-8');
        console.log('Appended summary to $GITHUB_STEP_SUMMARY');
    }
}

if (require.main === module) {
    generateSummary().catch(console.error);
}

module.exports = { generateSummary };
