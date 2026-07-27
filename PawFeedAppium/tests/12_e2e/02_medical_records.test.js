describe('Medical Records E2E', () => {
    it('should navigate to the Medical Records tab', async () => {
        // Find the bottom navigation button for Medical (assuming it has an icon or specific text)
        await browser.execute(() => {
            const navBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.textContent.includes('Medical') || b.innerHTML.includes('fa-notes-medical'));
            if (navBtn) navBtn.click();
            else window.switchTab('medical'); // Fallback to calling the global function directly
        });

        // Verify we are on the medical tab
        const medicalTitle = await $('h2*=Medical History');
        await medicalTitle.waitForDisplayed({ timeout: 10000 });
    });

    it('should add a new medical record', async () => {
        // Click Add Record button
        await browser.execute(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('+ Add Record'));
            if (btn) btn.click();
        });

        // Wait for modal
        const modal = await $('#medicalRecordModal');
        await modal.waitForDisplayed({ timeout: 5000 });

        // Fill out form
        await $('#medRecordTitle').setValue('Annual Rabies Vaccine');
        await $('#medRecordDate').setValue('2026-07-27');
        await $('#medRecordType').selectByAttribute('value', 'Vaccine');
        await $('#medRecordProvider').setValue('Happy Paws Clinic');
        await $('#medRecordNotes').setValue('Routine checkup and rabies shot. No issues.');

        // Save
        const saveBtn = await $('button=💾 Save Record');
        
        if (!(await saveBtn.isExisting())) {
            await browser.execute(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save Record'));
                if (btn) btn.click();
            });
        } else {
            await saveBtn.click();
        }

        // Wait for modal to close
        await modal.waitForDisplayed({ timeout: 5000, reverse: true });
    });

    it('should verify the medical record appears in the history', async () => {
        const recordsBox = await $('#medicalRecordsBox');
        await recordsBox.waitForDisplayed({ timeout: 5000 });
        
        const html = await recordsBox.getHTML();
        expect(html).toContain('Annual Rabies Vaccine');
        expect(html).toContain('Happy Paws Clinic');
    });
});
