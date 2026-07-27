describe('Pet Onboarding E2E', () => {
    it('should launch app and verify dashboard', async () => {
        // Wait for the main wrapper or top navbar to be visible
        const header = await $('#topUser');
        await header.waitForDisplayed({ timeout: 15000 });
        
        // Assert we are logged in or in the main app view
        const headerText = await header.getText();
        expect(headerText).toContain('Hi,');
    });

    it('should add a new pet', async () => {
        // Click the Add Pet button in the Pet List section
        // Note: we are in WEBVIEW context so we can use standard CSS selectors
        const addPetBtn = await $('button=+ Add New Pet');
        
        // If the direct text selector doesn't work, we can fallback to searching by onclick or evaluating JS
        if (!(await addPetBtn.isExisting())) {
            // Use JS click for stability in Hybrid apps
            await browser.execute(() => {
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add New Pet'));
                if (btn) btn.click();
            });
        } else {
            await addPetBtn.click();
        }

        // Wait for modal to appear
        const modal = await $('#petModal');
        await modal.waitForDisplayed({ timeout: 5000 });

        // Fill out form
        await $('#mpetName').setValue('Buddy');
        await $('#mpetType').selectByAttribute('value', 'Dog');
        
        // Wait for breeds to populate
        await browser.pause(1000); 
        await $('#mpetBreed').selectByIndex(1); // Select the first available breed
        
        await $('#mpetAge').setValue('2');
        await $('#mpetWeight').setValue('15');
        await $('#mhealthCondition').setValue('Healthy');
        
        // Save Pet
        const saveBtn = await $('button=💾 Save Pet');
        await saveBtn.click();
        
        // Wait for modal to close
        await modal.waitForDisplayed({ timeout: 5000, reverse: true });
    });

    it('should verify the new pet appears on the dashboard', async () => {
        // Check the pet list container
        const petList = await $('#petListBox');
        await petList.waitForDisplayed({ timeout: 5000 });
        
        const petListHTML = await petList.getHTML();
        expect(petListHTML).toContain('Buddy');
    });
});
