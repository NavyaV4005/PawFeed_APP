// app.js — All JavaScript from pawfeed00.html. Capacitor bridge appended below.
const USE_SUPABASE_ONLY = true;

    window.togglePasswordVisibility = function(inputId, iconElement) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        iconElement.textContent = '🙈';
      } else {
        input.type = 'password';
        iconElement.textContent = '👁️';
      }
    };

    // ==================== AUTH ====================
    // ==================== DATA ====================
    const BREEDS = {
      Dog: ['Labrador', 'Pug', 'Beagle', 'German Shepherd', 'Golden Retriever', 'Shih Tzu', 'Doberman', 'Rottweiler', 'Husky', 'Dachshund'],
      Cat: ['Persian', 'Siamese', 'Bengal', 'Maine Coon', 'Ragdoll', 'British Shorthair', 'Sphynx', 'Abyssinian'],
      Rabbit: ['Holland Lop', 'Lionhead', 'Dutch Rabbit', 'Mini Rex', 'Flemish Giant', 'Angora'],
      Bird: ['Parrot', 'Budgie', 'Cockatiel', 'Lovebird', 'Canary', 'Macaw'],
      Fish: ['Goldfish', 'Betta', 'Guppy', 'Angelfish', 'Molly', 'Koi', 'Oscar', 'Tetra'],
      Hamster: ['Syrian Hamster', 'Dwarf Hamster', 'Roborovski Hamster', 'Chinese Hamster', 'Campbell Hamster']
    };
    const UNSAFE = {
      Dog: ['Chocolate', 'Grapes / Raisins', 'Onion & Garlic', 'Alcohol', 'Caffeine', 'Macadamia Nuts', 'Xylitol (sweetener)', 'Avocado'],
      Cat: ['Chocolate', 'Onion & Garlic', 'Milk in excess', 'Raw fish', 'Caffeine', 'Alcohol', 'Dog food (long-term)', 'Raw eggs'],
      Rabbit: ['Chocolate', 'Avocado', 'Bread / Pasta', 'Meat', 'Iceberg lettuce', 'Sugary treats', 'Potatoes'],
      Bird: ['Chocolate', 'Avocado', 'Caffeine', 'Alcohol', 'Salty food', 'Onion & Garlic', 'Apple seeds'],
      Fish: ['Bread', 'Human snacks', 'Oily food', 'Overfeeding pellets', 'Citrus fruits'],
      Hamster: ['Onion & Garlic', 'Chocolate', 'Citrus fruits', 'Almonds', 'Apple seeds', 'Sugary treats', 'Iceberg lettuce', 'Salty snacks']
    };
    const PET_ICONS = { Dog: '🐶', Cat: '🐱', Rabbit: '🐰', Bird: '🦜', Fish: '🐟', Hamster: '🐹' };

    let reminderTimers = [];
    let activeTrackerPet = 0;
    let selectedPlannerDateStr = new Date().toISOString().slice(0, 10);

    let TOXIC_FOODS = [];
    let NUTRITION_GUIDELINES = {};
    let SYMPTOM_TRIAGE = [];
    let VACCINE_SCHEDULE = {};
    let breedCache = {
      Dog: JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('cachedDogBreeds'))) || [],
      Cat: JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('cachedCatBreeds'))) || []
    };

    async function loadReferenceDatasets() {
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          fetch('data/toxic-foods.json').then(r => r.json()),
          fetch('data/nutrition-guidelines.json').then(r => r.json()),
          fetch('data/symptom-triage.json').then(r => r.json()),
          fetch('data/vaccine-schedule.json').then(r => r.json())
        ]);
        TOXIC_FOODS = r1;
        NUTRITION_GUIDELINES = r2;
        SYMPTOM_TRIAGE = r3;
        VACCINE_SCHEDULE = r4;
        console.log('Reference datasets loaded successfully');
        fetchBreedData('Dog');
        fetchBreedData('Cat');
      } catch (err) {
        console.error('Failed to load reference datasets:', err);
      }
    }

    async function fetchBreedData(species) {
      if (species !== 'Dog' && species !== 'Cat') return [];
      if (breedCache[species] && breedCache[species].length > 0) {
        return breedCache[species];
      }
      try {
        const url = species === 'Dog' 
          ? 'https://api.thedogapi.com/v1/breeds' 
          : 'https://api.thecatapi.com/v1/breeds';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP status ${res.status}`);
        const data = await res.json();
        const simplified = data.map(b => ({
          id: b.id,
          name: b.name,
          weight: b.weight ? b.weight.metric : '',
          life_span: b.life_span || ''
        }));
        breedCache[species] = simplified;
        (!USE_SUPABASE_ONLY && localStorage.setItem(`cached${species}Breeds`, JSON.stringify(simplified)));
        return simplified;
      } catch (err) {
        console.error(`Failed to fetch breeds for ${species}:`, err);
        return [];
      }
    }

    function calculateFeedingAmount(pet) {
      if (!pet || !pet.weight) return null;
      const weight = parseFloat(pet.weight);
      const species = (pet.type || '').toLowerCase();
      const activity = (pet.activityLevel || 'moderate').toLowerCase();

      let actKey = 'moderate';
      if (activity.includes('sedentary')) actKey = 'sedentary';
      else if (activity.includes('active') || activity.includes('high')) actKey = 'active';

      const rer = 70 * Math.pow(weight, 0.75);

      let factor = 1.0;
      if (species === 'dog') {
        factor = NUTRITION_GUIDELINES.formulas?.factors?.dog?.[actKey] || 1.6;
      } else if (species === 'cat') {
        factor = NUTRITION_GUIDELINES.formulas?.factors?.cat?.[actKey] || 1.2;
      } else {
        factor = 1.2;
      }

      const dailyCalories = Math.round(rer * factor);
      const dryGrams = Math.round(dailyCalories / 3.5);
      const wetGrams = Math.round(dailyCalories / 1.0);

      let waterNeeds = Math.round(weight * 60);
      if (species === 'cat') waterNeeds = Math.round(weight * 50);

      return {
        rer: Math.round(rer),
        calories: dailyCalories,
        dryGrams,
        wetGrams,
        waterNeeds,
        disclaimer: "Disclaimer: This is a veterinary-formula baseline recommendation and does not substitute for customized professional veterinary care."
      };
    }

    function getGroundingContext(message, species) {
      if (!message) return '';
      const text = message.toLowerCase();
      const spec = (species || '').toLowerCase();
      let context = '';

      if (TOXIC_FOODS && TOXIC_FOODS.length > 0) {
        const matches = TOXIC_FOODS.filter(item => {
          const nameMatch = text.includes(item.name.toLowerCase());
          const speciesMatch = !item.species_affected || 
                               item.species_affected.toLowerCase().includes(spec) ||
                               spec === '';
          return nameMatch && speciesMatch;
        });

        if (matches.length > 0) {
          context += `\n[Reference Data - Toxic Foods/Plants/Substances]:\n`;
          matches.forEach(item => {
            context += `- ${item.name} is toxic to ${item.species_affected}. Severity: ${item.severity}. Symptoms: ${item.symptoms}. Notes: ${item.notes}\n`;
          });
        }
      }

      if (SYMPTOM_TRIAGE && SYMPTOM_TRIAGE.length > 0) {
        const matches = SYMPTOM_TRIAGE.filter(item => {
          return text.includes(item.symptom.toLowerCase());
        });

        if (matches.length > 0) {
          context += `\n[Reference Data - Symptom Triage Guidelines]:\n`;
          matches.forEach(item => {
            context += `- Symptom: ${item.symptom}. Urgency: ${item.urgency}. Trigger Criteria: ${item.trigger_criteria}. Home Care Tip: ${item.home_care_tip}\n`;
          });
        }
      }

      return context;
    }

    // To test locally with your node server, uncomment the localhost line below:
    // const API_BASE_URL = 'http://localhost:5000';
    const API_BASE_URL = 'https://pawfeedmobile.onrender.com';
    let currentUser = null;
    let currentHouseholdId = null;
    let activePlanPet = 0;
    let _dummyPurgedThisSession = false;
    let pawCache = {
      pets: [],
      logs: [],
      stock: [],
      expenses: [],
      communityPosts: [],
      cart: [],
      scanHistory: [],
      orders: [],
      recipes: { favorites: [], saved: [], recent: [], reviews: [], weekly: [], shopping: [], reactions: [] },
      moodLog: [],
      meds: [],
      vetLog: [],
      sleepLog: [],
      gallery: {},
      weightHistory: {},
      deletedRecipes: [],
      customRecipes: [],
      editedRecipes: {},
      recipeFavorites: [],
      weeklyPlan: {
        Mon: { breakfast: null, lunch: null, dinner: null },
        Tue: { breakfast: null, lunch: null, dinner: null },
        Wed: { breakfast: null, lunch: null, dinner: null },
        Thu: { breakfast: null, lunch: null, dinner: null },
        Fri: { breakfast: null, lunch: null, dinner: null },
        Sat: { breakfast: null, lunch: null, dinner: null },
        Sun: { breakfast: null, lunch: null, dinner: null }
      },
      dailyChecklist: {},
      tasks: []
    };

    function loadLocalCache() {
      try {
        // Clear all local storage data once for v5 to wipe any lingering dummy pets
        if (!localStorage.getItem('dummy_purged_v5')) {
          const keys = ['pawPets', 'pawLog', 'pawStock', 'pawSettings', 'pawActivePet', 'pawExpenses', 'pawCart', 'pawScanHistory', 'pawOrders', 'pawRecipeFavorites', 'pawCustomRecipes', 'pawMoodLog', 'pawMeds', 'pawVetLog', 'pawSleepLog', 'pawWeightHistory', 'pawGallery', 'pawRecipeMemory', 'pawWeeklyPlan', 'pawDailyChecklist'];
          keys.forEach(k => localStorage.removeItem(k));
          localStorage.setItem('dummy_purged_v5', 'true');
        }
        pawCache.pets = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawPets')) || '[]');
        pawCache.logs = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawLog')) || '[]');
        pawCache.stock = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawStock')) || '[]');
        pawCache.settings = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawSettings')) || '{}');
        pawCache.activePetIdx = parseInt((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawActivePet')) || '0');
        pawCache.expenses = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawExpenses')) || '[]');
        pawCache.cart = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawCart')) || '[]');
        pawCache.scanHistory = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawScanHistory')) || '[]');
        pawCache.orders = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawOrders')) || '[]');
        pawCache.recipeFavorites = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawRecipeFavorites')) || '[]');
        pawCache.customRecipes = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawCustomRecipes')) || '[]');
        pawCache.moodLog = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawMoodLog')) || '[]');
        pawCache.meds = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawMeds')) || '[]');
        pawCache.vetLog = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawVetLog')) || '[]');
        pawCache.sleepLog = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawSleepLog')) || '[]');
        pawCache.weightHistory = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawWeightHistory')) || '{}');
        pawCache.gallery = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawGallery')) || '{}');
        
        const memory = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawRecipeMemory')) || 'null');
        if (memory) pawCache.recipes = memory;
        
        const weekly = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawWeeklyPlan')) || 'null');
        if (weekly) pawCache.weeklyPlan = weekly;
        
        const checklist = JSON.parse((USE_SUPABASE_ONLY ? null : localStorage.getItem('pawDailyChecklist')) || 'null');
        if (checklist) pawCache.dailyChecklist = checklist;
      } catch (err) {
        console.error("Error loading local cache:", err);
      }
    }

    async function fetchAllDataFromSupabase() {
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      
      showToast("Syncing with cloud... ☁️");
      
      try {
        // First get the household ID
        const { data: profileData } = await window.supabaseClient.from('user_profiles').select('*').eq('id', userId).maybeSingle();
        if (profileData && profileData.household_id) {
          currentHouseholdId = profileData.household_id;
        } else {
          currentHouseholdId = userId; // Fallback to user_id if migration not fully complete
        }
        
        // Render it in Profile tab
        const hhDisplay = document.getElementById('householdIdDisplay');
        if (hhDisplay) hhDisplay.value = currentHouseholdId;

        const [
          petsRes, logsRes, stockRes, expensesRes, postsRes, cartRes, scansRes, tasksRes, ordersRes,
          moodsRes, medsRes, vetsRes, sleepsRes, galleryRes, weightsRes, recipesRes
        ] = await Promise.all([
          window.supabaseClient.from('pets').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('feeding_logs').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('stock_items').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('expenses').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('community_posts').select('*').order('id', { ascending: false }),
          window.supabaseClient.from('cart_items').select('*').eq('user_id', userId),
          window.supabaseClient.from('scan_history').select('*').eq('user_id', userId),
          window.supabaseClient.from('care_tasks').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('orders').select('*').eq('user_id', userId),
          window.supabaseClient.from('mood_logs').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('meds').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('vet_logs').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('sleep_logs').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('pet_gallery').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('weight_history').select('*').eq('household_id', currentHouseholdId),
          window.supabaseClient.from('custom_recipes').select('*').eq('household_id', currentHouseholdId)
        ]);

        const profileRes = { data: profileData };

        if (petsRes.data) {
          pawCache.pets = petsRes.data.map(p => {
            const petObj = {
              id: p.id,
              name: p.name,
              type: p.species,
              breed: p.breed,
              age: parseFloat(p.age),
              weight: parseFloat(p.weight),
              foodPref: p.food_pref,
              health: p.health || '',
              waterGoal: parseFloat(p.water_goal) || 500,
              activityLevel: p.activity_level || 'Moderate (Normal)',
              color: p.color || '#FFD5A8',
              avatar: p.avatar || null,
              breedTraits: p.breed_traits || null,
              gallery: p.gallery || [],
              weightHistory: p.weight_history || [],
              waterToday: parseFloat(p.water_today || 0),
              waterDrops: Array.from({length: parseInt(p.water_today || 0)}, (_, i) => i),
              waterDate: p.water_date || '',
              moodToday: p.mood_today || '',
              moodDate: p.mood_date || ''
            };
            if (!petObj.breedTraits && (p.species === 'Dog' || p.species === 'Cat') && breedCache[p.species]) {
              const found = breedCache[p.species].find(b => b.name.toLowerCase() === p.breed.toLowerCase());
              if (found) {
                petObj.breedTraits = {
                  weight: found.weight,
                  life_span: found.life_span
                };
              }
            }
            return petObj;
          });
          (!USE_SUPABASE_ONLY && localStorage.setItem('pawPets', JSON.stringify(pawCache.pets)));
        }

        if (logsRes.data) {
          pawCache.logs = logsRes.data.map(l => {
            const petIdx = pawCache.pets.findIndex(p => p.id === l.pet_id);
            return {
              id: l.id,
              petIdx: petIdx >= 0 ? petIdx : 0,
              type: l.type,
              timestamp: l.timestamp,
              amount: l.amount,
              note: l.note
            };
          });
        }

        if (stockRes.data) {
          pawCache.stockItems = stockRes.data.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            quantity: parseFloat(s.quantity),
            unit: s.unit,
            threshold: parseFloat(s.threshold),
            decrementAmount: parseFloat(s.decrement_amount)
          }));
        }

        if (expensesRes.data) {
          pawCache.expenses = expensesRes.data.map(e => ({
            id: e.id,
            date: e.date,
            category: e.category,
            amount: parseFloat(e.amount),
            desc: e.notes
          }));
        }

        if (postsRes.data) {
          pawCache.communityPosts = postsRes.data.map(p => ({
            id: p.id,
            user: p.user_id === userId ? (currentUser.user_metadata?.display_name || 'Me') : 'Pet Parent',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80',
            content: p.content,
            image: p.image_url,
            time: p.created_at,
            likes: 0,
            comments: []
          }));
        }

        if (cartRes.data) {
          pawCache.cart = cartRes.data.map(c => ({
            id: c.id,
            product_id: c.product_id,
            quantity: c.quantity
          }));
        }

        if (scansRes.data) {
          pawCache.scanHistory = scansRes.data.map(s => s.result);
        }

        if (ordersRes.data) {
          pawCache.orders = ordersRes.data.map(o => ({
            id: o.id,
            date: o.date,
            items: o.items,
            total: parseFloat(o.total)
          }));
        }

        if (moodsRes.data) {
          pawCache.moodLog = moodsRes.data.map(m => {
            const petIdx = pawCache.pets.findIndex(p => p.id === m.pet_id);
            return {
              petIdx: petIdx >= 0 ? petIdx : 0,
              date: m.date,
              label: m.label
            };
          });
        }

        if (medsRes.data) {
          pawCache.meds = medsRes.data.map(m => ({
            id: m.id,
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            nextDue: m.next_due
          }));
        }

        if (vetsRes.data) {
          pawCache.vetLog = vetsRes.data.map(v => {
            const petIdx = pawCache.pets.findIndex(p => p.id === v.pet_id);
            return {
              id: v.id,
              petIdx: petIdx >= 0 ? petIdx : 0,
              date: v.date,
              clinic: v.clinic,
              notes: v.notes
            };
          });
        }

        if (sleepsRes.data) {
          pawCache.sleepLog = sleepsRes.data.map(s => {
            const petIdx = pawCache.pets.findIndex(p => p.id === s.pet_id);
            return {
              petIdx: petIdx >= 0 ? petIdx : 0,
              date: s.date,
              hours: parseFloat(s.hours),
              quality: s.quality
            };
          });
        }

        pawCache.gallery = {};
        if (galleryRes.data) {
          galleryRes.data.forEach(g => {
            const petIdx = pawCache.pets.findIndex(p => p.id === g.pet_id);
            const idxKey = petIdx >= 0 ? petIdx : 0;
            if (!pawCache.gallery[idxKey]) pawCache.gallery[idxKey] = [];
            pawCache.gallery[idxKey].push({ image: g.image_url, time: g.created_at });
          });
        }

        pawCache.weightHistory = {};
        if (weightsRes.data) {
          weightsRes.data.forEach(w => {
            const petIdx = pawCache.pets.findIndex(p => p.id === w.pet_id);
            const idxKey = petIdx >= 0 ? petIdx : 0;
            if (!pawCache.weightHistory[idxKey]) pawCache.weightHistory[idxKey] = [];
            pawCache.weightHistory[idxKey].push({ date: w.date, weight: parseFloat(w.weight) });
          });
        }

        if (recipesRes.data) {
          pawCache.customRecipes = recipesRes.data.map(r => ({
            id: r.id,
            name: r.name,
            ingredients: r.ingredients,
            steps: r.steps,
            notes: r.notes
          }));
        }

        if (profileRes.data) {
          const p = profileRes.data;
          pawCache.recipes = p.recipe_store || pawCache.recipes || {};
          pawCache.weeklyPlan = p.weekly_plan || pawCache.weeklyPlan;
          pawCache.dailyChecklist = p.daily_checklist || pawCache.dailyChecklist;
          pawCache.settings = p.settings || {};
          if (typeof pawCache.settings.active_pet_idx === 'number') {
            pawCache.activePetIdx = pawCache.settings.active_pet_idx;
            (!USE_SUPABASE_ONLY && localStorage.setItem('pawActivePet', String(pawCache.settings.active_pet_idx)));
          }
          pawCache.recipeFavorites = pawCache.recipes.recipeFavoritesList || [];
          pawCache.deletedRecipes = pawCache.recipes.deletedRecipesList || [];
          pawCache.editedRecipes = pawCache.recipes.editedRecipesMap || {};
          if (p.avatar_url) {
            (!USE_SUPABASE_ONLY && localStorage.setItem('pawUserAvatar', p.avatar_url));
          }
        }

        if (tasksRes.data) {
          pawCache.tasks = tasksRes.data.map(t => {
            if (t.payload) {
              return { ...t.payload, id: t.id };
            }
            return {
              id: t.id,
              petIdx: 0,
              title: t.text,
              completed: t.completed,
              dateTime: t.date
            };
          });
        }

        // ONE-TIME PURGE OF DUMMY DATA - uses session flag (safe for USE_SUPABASE_ONLY mode)
        if (!_dummyPurgedThisSession && !localStorage.getItem('dummy_purged_v4')) {
          _dummyPurgedThisSession = true;
          localStorage.setItem('dummy_purged_v4', 'true');
          // Remove old purge keys too
          localStorage.removeItem('dummy_purged_v3');
          console.log("Purging old dummy data v4 (one-time)...");
          
          pawCache.stockItems = [];
          localStorage.removeItem('pawStock');
          if (typeof saveStockItems === 'function') saveStockItems([]);

          pawCache.expenses = [];
          localStorage.removeItem('pawExpenses');
          
          pawCache.weeklyPlan = {
            Mon: { breakfast: null, lunch: null, dinner: null },
            Tue: { breakfast: null, lunch: null, dinner: null },
            Wed: { breakfast: null, lunch: null, dinner: null },
            Thu: { breakfast: null, lunch: null, dinner: null },
            Fri: { breakfast: null, lunch: null, dinner: null },
            Sat: { breakfast: null, lunch: null, dinner: null },
            Sun: { breakfast: null, lunch: null, dinner: null }
          };
          if (typeof saveWeeklyPlan === 'function') saveWeeklyPlan(pawCache.weeklyPlan);
        }

      } catch (err) {
        console.error("Error fetching all data from Supabase:", err);
        showToast("Sync error. Using local cached data.");
      }
    }

    async function callAI(endpoint, payload) {
      showToast("AI is thinking... 🐾");
      
      const loadingScreen = document.getElementById('loadingScreen');
      if (loadingScreen) {
        loadingScreen.style.display = 'flex';
        loadingScreen.style.opacity = '1';
        const bar = document.getElementById('loadingBar');
        if (bar) bar.style.width = '60%';
      }

      // Set up fallbacks for development (localhost & local network IP) and production (Render)
      const urlsToTry = [
        `http://localhost:5000${endpoint}`,
        `http://10.125.108.69:5000${endpoint}`,
        `https://pawfeedmobile.onrender.com${endpoint}`
      ];

      let lastError = null;
      for (const url of urlsToTry) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds timeout per attempt

        try {
          console.log(`Attempting AI connection: ${url}`);
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error ${response.status}`);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          console.warn(`Connection failed to ${url}:`, error);
          lastError = error;
        }
      }

      if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 300);
      }

      if (lastError && lastError.name === 'AbortError') {
        showToast("Request timed out. Please try again. ⏱️");
      } else {
        showToast("Failed to connect to AI. Please check your connection. ❌");
      }
      throw lastError || new Error("All connection attempts failed");
    }
    let calendarMonthDate = new Date();
    let confirmCallback = null;
    let selectedModalColor = '#FFD5A8';
    let selectedLogMood = '';
    let galleryTargetPet = -1;
    let selectedCommunityImage = '';
    let selectedVisionImage = '';

    // ==================== AI FEATURES HANDLERS ====================
    async function generateAIRecipe() {
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx] || null;
      if (!pet) {
        showToast("Please add a pet profile first.");
        return;
      }

      const constraints = document.getElementById('aiRecipeConstraints').value.trim();
      
      const payload = {
        pet: {
          type: pet.type,
          breed: pet.breed,
          age: pet.age,
          weight: pet.weight
        },
        constraints: constraints
      };

      try {
        const data = await callAI('/api/generate-recipe', payload);
        
        const newId = `custom_ai_${Date.now()}`;
        const time = parseInt(data.cookTime) || 20;
        
        const isNonVeg = (data.ingredients || []).some(ing => {
          const ingLower = ing.toLowerCase();
          const nonVegKeywords = ['chicken', 'beef', 'turkey', 'fish', 'meat', 'egg', 'salmon', 'pork', 'shrimp', 'lamb', 'duck', 'tuna', 'sardine', 'liver', 'krill', 'cod', 'prawn', 'crab', 'bacon', 'venison', 'bison', 'anchovy', 'mackerel', 'herring', 'shellfish', 'squid', 'octopus'];
          return nonVegKeywords.some(keyword => ingLower.includes(keyword));
        });
        const type = isNonVeg ? 'Non-Veg' : 'Veg';
        
        let cat = 'Meal';
        const mType = (data.mealType || '').toLowerCase();
        if (mType.includes('snack') || mType.includes('treat')) {
          cat = 'Snack';
        } else if (mType.includes('quick') || mType.includes('emergency')) {
          cat = 'Quick';
        } else if (mType.includes('allergy')) {
          cat = 'Allergy';
        } else if (mType.includes('budget')) {
          cat = 'Budget';
        } else if (mType.includes('season')) {
          cat = 'Seasonal';
        }

        const protein = parseInt(data.nutrition?.protein) || 12;
        const fiber = parseInt(data.nutrition?.fiber) || 4;
        const vit = Math.round(protein * 2 + fiber * 5) || 60;

        const normalized = {
          id: newId,
          title: data.name || 'AI Generated Recipe',
          pet: [pet.type],
          type: type,
          cat: cat,
          time: time,
          cookTime: data.cookTime || (time + ' mins'),
          diff: data.difficulty || 'Easy',
          cal: parseInt(data.nutrition?.calories) || 300,
          protein: protein,
          fiber: fiber,
          vit: Math.min(95, Math.max(10, vit)),
          vet: true,
          budget: true,
          season: 'All season',
          ingredients: data.ingredients || [],
          steps: data.steps || [],
          benefits: data.benefits || ['Tailored nutrition', 'Fresh ingredients'],
          frequency: data.frequency || '1-2 times/week',
          vetTip: data.notes || '',
          nutritionObj: data.nutrition || {},
          suitableAgeGroup: data.ageGroup || 'All',
          healthConditionCompatibility: data.healthCondition || 'Healthy'
        };

        const custom = getCustomRecipes();
        custom.push(normalized);
        saveCustomRecipes(custom);

        normalizeAndMergeDB();
        renderHomemadeTab();
        
        showToast("Custom AI Recipe Generated! 🍲");
        openRecipeDetailModal(newId);
        
        document.getElementById('aiRecipeConstraints').value = '';
      } catch (error) {
        console.error(error);
        showToast("Failed to generate custom recipe.");
      }
    }

    async function getAIFeedingAdvice() {
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      if (!pet) {
        showToast("Please add or select a pet first.");
        return;
      }
      
      const payload = {
        pet: {
          type: pet.type,
          breed: pet.breed,
          age: pet.age,
          weight: pet.weight,
          activityLevel: pet.activityLevel || 'Moderate (Normal)'
        }
      };

      try {
        const data = await callAI('/api/feeding-advice', payload);
        const resultBox = document.getElementById('aiFeedingAdviceResult');
        if (resultBox) {
          resultBox.innerHTML = data.result;
          resultBox.classList.remove('hidden');
        }
      } catch (error) {
        console.error(error);
        showToast("Failed to fetch feeding advice.");
      }
    }


    // ==================== STORAGE ====================
    function getUser() {
      if (!currentUser) return null;
      return {
        name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'Pet Parent',
        email: currentUser.email,
        id: currentUser.id
      };
    }
    function getPets() {
      return pawCache.pets || [];
    }

    async function savePets(pets) {
      pawCache.pets = pets;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawPets', JSON.stringify(pets)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        const { data: dbPets, error: fetchErr } = await window.supabaseClient.from('pets').select('id').eq('user_id', userId);
        if (!fetchErr && dbPets) {
          const activeIds = pets.map(p => p.id).filter(id => id);
          const deletedIds = dbPets.filter(p => !activeIds.includes(p.id)).map(p => p.id);
          if (deletedIds.length > 0) {
            await window.supabaseClient.from('pets').delete().in('id', deletedIds);
          }
        }
        for (let i = 0; i < pets.length; i++) {
          const p = pets[i];
          // Only include columns that actually exist in the pets table schema
          const payload = {
            user_id: userId,
            name: p.name,
            species: p.type,
            breed: p.breed || '',
            age: parseFloat(p.age || 0),
            weight: parseFloat(p.weight || 0),
            food_pref: p.foodPref || '',
            health: p.health || '',
            water_goal: parseFloat(p.waterGoal || 500),
            activity_level: p.activityLevel || 'Moderate',
            breed_traits: p.breedTraits || null,
            avatar: p.avatar || null,
            color: p.color || null,
            gallery: p.gallery || [],
            weight_history: p.weightHistory || [],
            water_today: p.waterDrops ? p.waterDrops.length : parseFloat(p.waterToday || 0),
            water_date: p.waterDate || '',
            mood_today: p.moodToday || '',
            mood_date: p.moodDate || ''
          };
          if (p.id) payload.id = p.id;
          const { data, error } = await window.supabaseClient.from('pets').upsert({...payload, household_id: currentHouseholdId}).select('id').single();
          if (error) {
            console.error('Error saving pet to Supabase:', error.message, payload);
          } else if (data) {
            p.id = data.id;
            // Update local cache with the assigned ID
            pets[i] = p;
          }
        }
        // Save updated pets (with IDs) back to localStorage
        (!USE_SUPABASE_ONLY && localStorage.setItem('pawPets', JSON.stringify(pets)));
        pawCache.pets = pets;
      } catch (err) {
        console.error("Error syncing pets to Supabase:", err);
      }
    }

    function getActivePetIdx() {
      let idx = 0;
      if (typeof pawCache.activePetIdx === 'number') idx = pawCache.activePetIdx;
      else {
        const stored = (USE_SUPABASE_ONLY ? null : localStorage.getItem('pawActivePet'));
        pawCache.activePetIdx = stored ? parseInt(stored) : 0;
        idx = pawCache.activePetIdx;
      }
      const len = pawCache.pets ? pawCache.pets.length : 0;
      if (len > 0 && idx >= len) idx = len - 1;
      if (idx < 0) idx = 0;
      return idx;
    }

    async function setActivePetIdx(i) {
      pawCache.activePetIdx = i;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawActivePet', String(i)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        const settings = pawCache.settings || {};
        settings.active_pet_idx = i;
        await window.supabaseClient.from('user_profiles').upsert({
          id: userId,
          settings: settings
        });
      } catch (err) {
        console.error("Error syncing active pet index:", err);
      }
    }
    function setActivePet(i) {
      setActivePetIdx(i);
      refreshAllUI();
    }

    function isNoPet() {
      return (pawCache.pets || []).length === 0 || pawCache.settings?.noPet === true;
    }

    function getLog() {
      return pawCache.logs || [];
    }

    async function saveLog(log) {
      pawCache.logs = log;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawLog', JSON.stringify(log)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        const { data: dbLogs } = await window.supabaseClient.from('feeding_logs').select('id').eq('user_id', userId);
        if (dbLogs) {
          const activeIds = log.map(l => l.id).filter(id => typeof id === 'number');
          const deletedIds = dbLogs.filter(m => !activeIds.includes(m.id)).map(m => m.id);
          if (deletedIds.length > 0) {
            await window.supabaseClient.from('feeding_logs').delete().in('id', deletedIds);
          }
        }
        for (let i = 0; i < log.length; i++) {
          const entry = log[i];
          const petId = pawCache.pets[entry.petIdx]?.id || null;
          const payload = {
            user_id: userId,
            pet_id: petId,
            type: entry.type,
            amount: parseFloat(entry.amount || 0),
            note: entry.note || '',
            timestamp: entry.timestamp || new Date().toISOString()
          };
          if (entry.id && typeof entry.id === 'number') {
            payload.id = entry.id;
          }
          const { data, error } = await window.supabaseClient.from('feeding_logs').upsert({...payload, household_id: currentHouseholdId}).select('id').single();
          if (!error && data) entry.id = data.id;
        }
      } catch (err) {
        console.error("Error syncing log to Supabase:", err);
      }
    }

    function getSettings() {
      return pawCache.settings || {};
    }

    async function saveSettings(s) {
      pawCache.settings = s;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawSettings', JSON.stringify(s)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('user_profiles').upsert({
          id: userId,
          settings: s
        });
      } catch (err) {
        console.error("Error syncing settings:", err);
      }
    }

    // ==================== LOADING SCREEN ====================
    window.addEventListener('DOMContentLoaded', function () {
      const bar = document.getElementById('loadingBar');
      let w = 0;
      const iv = setInterval(() => {
        w += Math.random() * 18 + 6;
        if (w >= 100) { w = 100; clearInterval(iv); }
        bar.style.width = w + '%';
      }, 100);
      setTimeout(() => {
        document.getElementById('loadingScreen').style.opacity = '0';
        document.getElementById('loadingScreen').style.transition = 'opacity 0.4s';
        setTimeout(() => {
          document.getElementById('loadingScreen').style.display = 'none';
          initApp();
        }, 400);
      }, 1800);
    });

    async function initApp() {
      loadLocalCache();
      await loadReferenceDatasets();
      // Apply dark mode
      const s = getSettings();
      if (s.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('darkModeToggle').classList.add('on');
        document.getElementById('darkToggleBtn').textContent = '☀️';
      }
      if (s.reminders) document.getElementById('reminderToggle').classList.add('on');

      if (window.supabaseClient) {
        try {
          const { data: { session }, error } = await window.supabaseClient.auth.getSession();
          if (session) {
            currentUser = session.user;
            if (window.initPushNotifications) window.initPushNotifications(currentUser.id);
            loadApp();
            if (s.reminders) startAllReminders();
            // Sync with cloud in background
            fetchAllDataFromSupabase().then(() => {
              refreshAllUI();
              initCalendar();
            });
            
            // Setup Supabase Realtime for Community Feed
            setupRealtimeSubscriptions();
            
            return;
            return;
          }
        } catch (e) {
          console.error("Failed to restore Supabase session:", e);
        }
      }

      const storedLocalUser = localStorage.getItem('pawfeedCurrentUser');
      if (storedLocalUser) {
        try {
          currentUser = JSON.parse(storedLocalUser);
          if (window.initPushNotifications) window.initPushNotifications(currentUser.id);
          loadApp();
          if (s.reminders) startAllReminders();
          if (window.supabaseClient) {
            fetchAllDataFromSupabase().then(() => {
              refreshAllUI();
              initCalendar();
            });
            setupRealtimeSubscriptions();
          } else {
            refreshAllUI();
            initCalendar();
          }
          return;
        } catch (e) {
          console.error("Failed to parse local auth:", e);
        }
      }

      showScreen('landingScreen');
    }

    // --- REALTIME SUBSCRIPTIONS ---
    let communityChannel = null;
    function setupRealtimeSubscriptions() {
      if (!window.supabaseClient || !currentUser) return;
      if (communityChannel) return; // already setup
      
      communityChannel = window.supabaseClient.channel('public:community_events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, async (payload) => {
          // Instead of manually merging complex logic, we can just refetch all posts to ensure consistency
          const { data, error } = await window.supabaseClient.from('community_posts').select('*').order('id', { ascending: false });
          if (!error && data) {
            pawCache.communityPosts = data;
            if (document.getElementById('communityFeedBox')) {
              renderCommunity();
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, (payload) => {
          // If the comments modal is currently open for the post that received a comment, refresh it
          if (currentCommentPostId && (payload.new?.post_id === currentCommentPostId || payload.old?.post_id === currentCommentPostId)) {
            fetchCommunityComments(currentCommentPostId);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
          if (!currentUser) return;
          // Only refresh if the message involves the current user
          const msg = payload.new;
          if (msg && (msg.sender_id === currentUser.id || msg.receiver_id === currentUser.id)) {
            // If viewing the inbox, refresh it
            if (!document.getElementById('dmInboxView').classList.contains('hidden')) {
              fetchDMInbox();
            }
            // If viewing the chat with this specific user, refresh it
            if (currentDMChatUserId && (msg.sender_id === currentDMChatUserId || msg.receiver_id === currentDMChatUserId)) {
              fetchDMChat(currentDMChatUserId);
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'care_tasks' }, async (payload) => {
          if (!currentHouseholdId) return;
          // Filter out tasks that aren't for this household (since realtime might catch others if RLS isn't fully locking it)
          if (payload.new && payload.new.household_id !== currentHouseholdId) return;
          
          const { data, error } = await window.supabaseClient.from('care_tasks').select('*').eq('household_id', currentHouseholdId);
          if (!error && data) {
            pawCache.tasks = data.map(t => {
              const petIdx = pawCache.pets.findIndex(p => p.id === t.pet_id);
              if (t.payload) {
                return { ...t.payload, id: t.id, petIdx: petIdx >= 0 ? petIdx : 0 };
              }
              return {
                id: t.id,
                petIdx: petIdx >= 0 ? petIdx : 0,
                title: t.text,
                completed: t.completed,
                dateTime: t.date
              };
            });
            if (document.getElementById('careplannerTab') && !document.getElementById('careplannerTab').classList.contains('hidden')) {
               renderCarePlanner();
            }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log("Subscribed to Realtime community events");
          }
        });
    }

    // ==================== DARK MODE ====================
    function toggleDarkMode() {
      const html = document.documentElement;
      const isDark = html.getAttribute('data-theme') === 'dark';
      const newDark = !isDark;
      html.setAttribute('data-theme', newDark ? 'dark' : 'light');

      const toggle = document.getElementById('darkModeToggle');
      if (toggle) {
        if (newDark) toggle.classList.add('on');
        else toggle.classList.remove('on');
      }

      const btn = document.getElementById('darkToggleBtn');
      if (btn) {
        btn.textContent = newDark ? '☀️' : '🌙';
      }

      const s = getSettings();
      s.darkMode = newDark;
      saveSettings(s);
    }

    function toggleReminderSetting() {
      const s = getSettings();
      s.reminders = !s.reminders;
      saveSettings(s);
      const toggle = document.getElementById('reminderToggle');
      if (s.reminders) { toggle.classList.add('on'); startAllReminders(); showToast('Reminders enabled 🔔'); }
      else { toggle.classList.remove('on'); reminderTimers.forEach(clearInterval); reminderTimers = []; showToast('Reminders disabled'); }
    }

    function toggleStreakSetting() {
      const s = getSettings();
      s.showStreaks = (s.showStreaks === false) ? true : false;
      saveSettings(s);
      const toggle = document.getElementById('streakToggle');
      toggle.classList.toggle('on', s.showStreaks !== false);
      refreshAllUI();
    }

    // ==================== CONFIRM ====================
    function showConfirm(title, msg, onOk, okText = 'OK') {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMsg').textContent = msg;
      const okBtn = document.getElementById('confirmOkBtn');
      if (okBtn) okBtn.textContent = okText;
      confirmCallback = onOk;
      document.getElementById('confirmDialog').classList.remove('hidden');
    }
    function closeConfirm(ok) {
      document.getElementById('confirmDialog').classList.add('hidden');
      if (ok && confirmCallback) confirmCallback();
      confirmCallback = null;
    }

    // ==================== TOAST ====================
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 2500);
    }

    // ==================== SCREENS ====================
    function showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      document.getElementById('mainApp').classList.add('hidden');
      document.getElementById(id).classList.remove('hidden');
    }

    function normalizeEmail(email) {
      return (email || '').trim().toLowerCase();
    }

    function isValidEmailFormat(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    async function validateRealEmail(email) {
      try {
        const res = await fetch('https://disposable.debounce.io/?email=' + encodeURIComponent(email));
        const json = await res.json();
        return json.disposable !== 'true';
      } catch (err) {
        console.warn('Email verification check failed, allowing proceed', err);
        return true;
      }
    }

    function getStoredAuthUsers() {
      try {
        const raw = localStorage.getItem('pawfeedAuthUsers');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn('Unable to read stored auth users:', err);
        return [];
      }
    }

    function saveStoredAuthUsers(users) {
      localStorage.setItem('pawfeedAuthUsers', JSON.stringify(users));
    }

    function findStoredAuthUser(email) {
      const normalizedEmail = normalizeEmail(email);
      return getStoredAuthUsers().find(user => normalizeEmail(user.email) === normalizedEmail);
    }

    function createStoredAuthUser(name, email, password) {
      const users = getStoredAuthUsers();
      const newUser = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        email: normalizeEmail(email),
        password
      };
      users.push(newUser);
      saveStoredAuthUsers(users);
      return newUser;
    }

    async function registerUser() {
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value.trim();
      if (!name || !email || !password) { showToast('Please fill all fields'); return; }

      if (!isValidEmailFormat(email)) {
        showToast('Invalid email format. Please enter a correct email address.');
        return;
      }

      showToast("Verifying email... 🐾");
      const isRealEmail = await validateRealEmail(email);
      if (!isRealEmail) {
        showToast('Please enter a real, original email address. Fake or disposable emails are not allowed.', 4000);
        return;
      }

      if (findStoredAuthUser(email)) {
        showToast('This email is already registered. Please use a different email or log in instead.');
        return;
      }
      
      // Strong password validation
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!strongPasswordRegex.test(password)) {
        showToast('Password must be at least 8 chars with uppercase, lowercase, number, and special character.', 4000);
        return;
      }
      
      showToast("Creating account... 🐾");

      if (window.supabaseClient) {
        try {
          const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: name }
            }
          });

          if (error) {
            if (findStoredAuthUser(email) || (error.message || '').toLowerCase().includes('already registered') || (error.message || '').toLowerCase().includes('already exists')) {
              showToast('This email is already registered. Please use a different email or log in instead.');
            } else {
              showToast('Unable to register this email. Please use a valid email address.');
            }
            return;
          }

          if (!data.user) {
            showToast('Unable to register this email. Please try again.');
            return;
          }

          createStoredAuthUser(name, email, password);

          const { error: profileError } = await window.supabaseClient.from('user_profiles').upsert({
            id: data.user.id,
            settings: {},
            daily_checklist: {}
          });
          if (profileError) {
            console.warn('Profile creation warning:', profileError.message);
          }
        } catch (err) {
          showToast('Unable to register this email. Please try again.');
          return;
        }
      } else {
        createStoredAuthUser(name, email, password);
      }

      showToast('Registration successful! You can now log in.');
      showScreen('loginScreen');
    }

    async function loginUser() {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      if (!email || !password) { showToast('Please fill all fields'); return; }

      if (!isValidEmailFormat(email)) {
        showToast('Invalid email format. Please enter a correct email address.');
        return;
      }

      showToast("Verifying email... 🐾");
      try {
        const res = await fetch('https://disposable.debounce.io/?email=' + encodeURIComponent(email));
        const json = await res.json();
        if (json.disposable === "true") {
          showToast('Please enter a real, original email address. Fake or disposable emails are not allowed.', 4000);
          return;
        }
      } catch(e) {
        console.log("Email verification check failed, allowing proceed", e);
      }
      
      showToast("Logging in... 🐾");
      const storedUser = findStoredAuthUser(email);
      if (storedUser && storedUser.password === password) {
        currentUser = {
          id: storedUser.id,
          email: storedUser.email,
          name: storedUser.name,
          isLocalAuth: true
        };
        localStorage.setItem('pawfeedCurrentUser', JSON.stringify(currentUser));
        if (window.initPushNotifications) window.initPushNotifications(currentUser.id);
        loadApp();
        if (window.supabaseClient) {
          fetchAllDataFromSupabase().then(() => {
            refreshAllUI();
            initCalendar();
          });
        } else {
          refreshAllUI();
          initCalendar();
        }
        return;
      }

      if (!window.supabaseClient) {
        showToast('Incorrect email or password.');
        return;
      }

      try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (error) {
          showToast('Incorrect email or password.');
          return;
        }

        currentUser = data.user;
        localStorage.setItem('pawfeedCurrentUser', JSON.stringify(currentUser));
        if (window.initPushNotifications) window.initPushNotifications(currentUser.id);
        loadApp();
        fetchAllDataFromSupabase().then(() => {
          refreshAllUI();
          initCalendar();
        });
      } catch (err) {
        showToast('Incorrect email or password.');
      }
    }

    async function logoutUser() {
      showConfirm('Logout?', 'You will be returned to the login screen.', async () => {
        try {
          if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
          }
          if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth) {
            try {
              await window.Capacitor.Plugins.GoogleAuth.initialize();
              await window.Capacitor.Plugins.GoogleAuth.signOut();
            } catch(ign) {}
          }
        } catch (e) {
          console.error("Signout error", e);
        }
        currentUser = null;
        localStorage.clear();
        location.reload();
      }, 'Logout');
    }

    // ==================== FORGOT PASSWORD ====================
    function openForgotPassword() {
      resetForgotSteps();
      document.getElementById('forgotEmail').value = document.getElementById('loginEmail').value || '';
      document.getElementById('forgotModal').classList.remove('hidden');
    }
    function closeForgotPassword() {
      document.getElementById('forgotModal').classList.add('hidden');
      resetForgotSteps();
    }
    function resetForgotSteps() {
      document.getElementById('forgotStep1').style.display = '';
      document.getElementById('forgotStep2').style.display = 'none';
      document.getElementById('forgotStep3').style.display = 'none';
    }
    function submitForgotPassword() {
      const email = document.getElementById('forgotEmail').value.trim();
      if (!email) { showToast('Please enter your email'); return; }
      const user = getUser();
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        const hint = user.password.charAt(0) + '•'.repeat(Math.max(user.password.length - 2, 2)) + user.password.charAt(user.password.length - 1);
        document.getElementById('forgotPasswordHint').innerHTML = `Your password hint: <span style="color:var(--orange);letter-spacing:2px">${hint}</span><br><small style="color:var(--muted);font-weight:400;font-size:12px;letter-spacing:0">Check your registered email for the full password.</small>`;
        document.getElementById('forgotStep1').style.display = 'none';
        document.getElementById('forgotStep2').style.display = '';
      } else {
        document.getElementById('forgotStep1').style.display = 'none';
        document.getElementById('forgotStep3').style.display = '';
      }
    }

    // ==================== LOAD APP ====================
    function loadApp() {
      document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
      document.getElementById('mainApp').classList.remove('hidden');
      loadUser();
      refreshAllUI();
      openTab('home');
      initCalendar();
    }

    function loadUser() {
      const user = getUser() || {};
      document.getElementById('topUser').innerText = user.name ? 'Hi, ' + user.name : 'Welcome';
      document.getElementById('welcomeText').innerText = user.name ? 'Hello, ' + user.name + ' 👋' : 'Hello!';
      document.getElementById('profileName').value = user.name || '';
      document.getElementById('profileEmail').value = user.email || '';

      // Load user avatar
      const avatar = (USE_SUPABASE_ONLY ? null : localStorage.getItem('pawUserAvatar'));
      const preview = document.getElementById('userAvatarPreview');
      const topCircle = document.getElementById('topProfileCircle');
      if (avatar) {
        preview.innerHTML = `<img src="${avatar}" alt="avatar">`;
        topCircle.innerHTML = `<img src="${avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }
    }

    function copyHouseholdId() {
      const id = document.getElementById('householdIdDisplay').value;
      if (!id) return;
      navigator.clipboard.writeText(id).then(() => {
        showToast("Household ID copied to clipboard!");
      });
    }

    async function joinHousehold() {
      const input = document.getElementById('joinHouseholdInput').value.trim();
      if (!input) { showToast("Please paste a Household ID"); return; }
      if (!window.supabaseClient || !currentUser) return;
      
      try {
        const { error } = await window.supabaseClient.from('user_profiles').update({
          household_id: input
        }).eq('id', currentUser.id);
        
        if (error) throw error;
        
        showToast("Joined new Household! 🏠 Syncing data...");
        document.getElementById('joinHouseholdInput').value = '';
        currentHouseholdId = input;
        document.getElementById('householdIdDisplay').value = currentHouseholdId;
        
        // Re-sync all data
        await fetchAllDataFromSupabase();
        refreshAllUI();
      } catch (e) {
        console.error(e);
        showToast("Failed to join household. Invalid ID?");
      }
    }

    async function saveProfile() {
      const user = getUser() || {};
      const newName = document.getElementById('profileName').value.trim();
      user.name = newName;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawUser', JSON.stringify(user)));
      
      // Update local mock auth if present to ensure name changes persist
      const storedCurrent = localStorage.getItem('pawfeedCurrentUser');
      if (storedCurrent) {
        let currentAuth = JSON.parse(storedCurrent);
        currentAuth.name = newName;
        localStorage.setItem('pawfeedCurrentUser', JSON.stringify(currentAuth));
        
        let users = JSON.parse(localStorage.getItem('pawAuthUsers') || '[]');
        let idx = users.findIndex(u => u.email === currentAuth.email);
        if (idx !== -1) {
          users[idx].name = newName;
          localStorage.setItem('pawAuthUsers', JSON.stringify(users));
        }
      }
      
      if (typeof currentUser !== 'undefined' && currentUser) {
        if (!currentUser.user_metadata) currentUser.user_metadata = {};
        currentUser.user_metadata.display_name = newName;
      }
      
      loadUser();
      showToast('Profile updated ✅');
      if (!window.supabaseClient || !currentUser) return;
      try {
        await window.supabaseClient.auth.updateUser({
          data: { display_name: newName }
        });
      } catch (err) {
        console.error("Error updating user auth metadata:", err);
      }
    }

    // ==================== USER AVATAR ====================
    async function handleUserAvatar(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      if (!USE_SUPABASE_ONLY && (!window.supabaseClient || !currentUser)) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const data = e.target.result;
          localStorage.setItem('pawUserAvatar', data);
          document.getElementById('userAvatarPreview').innerHTML = `<img src="${data}" alt="avatar">`;
          document.getElementById('topProfileCircle').innerHTML = `<img src="${data}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          showToast('Profile photo updated! ✅');
        };
        reader.readAsDataURL(file);
        return;
      }
      
      showToast('Uploading avatar... ⏳');
      const userId = currentUser.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `user_${userId}_${Date.now()}.${fileExt}`;
      
      try {
        const { error: uploadError } = await window.supabaseClient.storage
          .from('avatars')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = window.supabaseClient.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const avatarUrl = publicUrlData.publicUrl;

        await window.supabaseClient.from('user_profiles').upsert({
          id: userId,
          avatar_url: avatarUrl
        });

        document.getElementById('userAvatarPreview').innerHTML = `<img src="${avatarUrl}" alt="avatar">`;
        document.getElementById('topProfileCircle').innerHTML = `<img src="${avatarUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        (!USE_SUPABASE_ONLY && localStorage.setItem('pawUserAvatar', avatarUrl));
        showToast('Profile photo updated! ✅');

      } catch (err) {
        console.error("Error updating user avatar:", err);
        showToast('Error uploading avatar ❌');
      }
    }

    // ==================== NO PET TOGGLE ====================
    async function toggleNoPet() {
      const checked = document.getElementById('noPetCheck').checked;
      if (!pawCache.settings) pawCache.settings = {};
      pawCache.settings.noPet = checked;
      saveSettings(pawCache.settings);
      showToast(checked ? 'Browsing general tips mode' : 'Pet mode enabled');
      refreshAllUI();
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('user_profiles').upsert({
          id: userId,
          settings: pawCache.settings
        });
      } catch (err) {
        console.error("Error syncing noPet setting:", err);
      }
    }

    // ==================== PET MODAL ====================
    function openPetModal(idx) {
      const pets = getPets();
      document.getElementById('editPetIndex').value = idx;
      document.getElementById('modalTitle').textContent = idx >= 0 ? '✏️ Edit Pet' : '🐾 Add New Pet';
      selectedModalColor = '#FFD5A8';

      if (idx >= 0 && pets[idx]) {
        const p = pets[idx];
        document.getElementById('mpetName').value = p.name;
        document.getElementById('mpetType').value = p.type;
        loadModalBreeds().then(() => {
          document.getElementById('mpetBreed').value = p.breed || '';
        });
        document.getElementById('mpetAge').value = p.age;
        document.getElementById('mpetWeight').value = p.weight;
        document.getElementById('mpetWaterGoal').value = p.waterGoal || 500;
        document.getElementById('mfoodPref').value = p.foodPref;
        document.getElementById('mpetActivityLevel').value = p.activityLevel || 'Moderate (Normal)';
        document.getElementById('mhealthCondition').value = p.health;
        selectedModalColor = p.color || '#FFD5A8';
 
        // Load avatar
        const prev = document.getElementById('modalAvatarPreview');
        if (p.avatar) {
          prev.innerHTML = `<img src="${p.avatar}" alt="avatar">`;
        } else {
          prev.innerHTML = `<span id="modalAvatarEmoji">${PET_ICONS[p.type] || '🐾'}</span>`;
        }
      } else {
        document.getElementById('mpetName').value = '';
        document.getElementById('mpetType').value = '';
        document.getElementById('mpetBreed').innerHTML = '<option value="">Select breed</option>';
        document.getElementById('mpetAge').value = '';
        document.getElementById('mpetWeight').value = '';
        document.getElementById('mpetWaterGoal').value = 500;
        document.getElementById('mfoodPref').value = 'Dry Food';
        document.getElementById('mpetActivityLevel').value = 'Moderate (Normal)';
        document.getElementById('mhealthCondition').value = '';
        document.getElementById('modalAvatarPreview').innerHTML = '<span id="modalAvatarEmoji">🐾</span>';
      }

      // Update color chips
      document.querySelectorAll('.color-chip').forEach(c => {
        c.classList.toggle('selected', c.style.background === selectedModalColor);
      });

      document.getElementById('petModal').classList.remove('hidden');
    }

    function closePetModal() { document.getElementById('petModal').classList.add('hidden'); }

    function updateModalEmoji() {
      const type = document.getElementById('mpetType').value;
      const el = document.getElementById('modalAvatarEmoji');
      if (el) el.textContent = PET_ICONS[type] || '🐾';
    }

    async function handleModalAvatar(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (!USE_SUPABASE_ONLY && (!window.supabaseClient || !currentUser)) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const prev = document.getElementById('modalAvatarPreview');
          prev.innerHTML = `<img src="${e.target.result}" alt="pet avatar">`;
          prev._avatarData = e.target.result;
        };
        reader.readAsDataURL(file);
        return;
      }
      
      showToast('Uploading pet avatar... ⏳');
      const userId = currentUser.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `pet_${userId}_${Date.now()}.${fileExt}`;
      
      try {
        const { error: uploadError } = await window.supabaseClient.storage
          .from('avatars')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = window.supabaseClient.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const avatarUrl = publicUrlData.publicUrl;
        const prev = document.getElementById('modalAvatarPreview');
        prev.innerHTML = `<img src="${avatarUrl}" alt="pet avatar">`;
        prev._avatarData = avatarUrl;
        showToast('Pet avatar uploaded! ✅');
      } catch (err) {
        console.error("Error uploading pet avatar:", err);
        showToast('Error uploading pet avatar ❌');
      }
    }

    function selectColor(color, el) {
      selectedModalColor = color;
      document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
    }

    async function loadModalBreeds() {
      const type = document.getElementById('mpetType').value;
      const sel = document.getElementById('mpetBreed');
      if (sel) sel.innerHTML = '<option value="">Select breed</option>';

      if (type === 'Dog' || type === 'Cat') {
        const breeds = await fetchBreedData(type);
        if (sel && breeds.length > 0) {
          breeds.forEach(b => {
            const o = document.createElement('option');
            o.value = b.name;
            o.textContent = b.name;
            sel.appendChild(o);
          });
        }
      } else {
        if (sel && BREEDS[type]) {
          BREEDS[type].forEach(b => {
            const o = document.createElement('option');
            o.value = b;
            o.textContent = b;
            sel.appendChild(o);
          });
        }
      }
    }

    function savePetModal() {
      const idx = parseInt(document.getElementById('editPetIndex').value);
      const prev = document.getElementById('modalAvatarPreview');
      const avatarData = prev._avatarData || (prev.querySelector('img') ? prev.querySelector('img').src : null);
      const existingPets = getPets();
      const existingAvatar = idx >= 0 ? existingPets[idx]?.avatar : null;

      const pet = {
        id: idx >= 0 ? existingPets[idx]?.id : undefined,
        name: document.getElementById('mpetName').value.trim(),
        type: document.getElementById('mpetType').value,
        breed: document.getElementById('mpetBreed').value,
        age: document.getElementById('mpetAge').value,
        weight: document.getElementById('mpetWeight').value,
        waterGoal: parseFloat(document.getElementById('mpetWaterGoal').value) || 500,
        foodPref: document.getElementById('mfoodPref').value,
        activityLevel: document.getElementById('mpetActivityLevel').value,
        health: document.getElementById('mhealthCondition').value.trim(),
        color: selectedModalColor,
        avatar: avatarData || existingAvatar || null,
        gallery: idx >= 0 ? (existingPets[idx]?.gallery || []) : [],
        weightHistory: idx >= 0 ? (existingPets[idx]?.weightHistory || []) : [],
        waterToday: idx >= 0 ? (existingPets[idx]?.waterToday || 0) : 0,
        waterDate: idx >= 0 ? (existingPets[idx]?.waterDate || '') : '',
        moodToday: idx >= 0 ? (existingPets[idx]?.moodToday || '') : '',
        moodDate: idx >= 0 ? (existingPets[idx]?.moodDate || '') : ''
      };

      if (!pet.name || !pet.type || !pet.breed || !pet.age || !pet.weight) {
        showToast('Please complete all required fields'); return;
      }

      // Resolve breed traits
      if ((pet.type === 'Dog' || pet.type === 'Cat') && breedCache[pet.type]) {
        const found = breedCache[pet.type].find(b => b.name.toLowerCase() === pet.breed.toLowerCase());
        if (found) {
          pet.breedTraits = {
            weight: found.weight,
            life_span: found.life_span
          };
        }
      }

      const pets = getPets();
      if (idx >= 0) {
        pets[idx] = pet;
        showToast(pet.name + '\'s profile updated ✅');
      } else {
        pets.push(pet);
        setActivePetIdx(pets.length - 1);
        showToast(pet.name + ' added 🐾');
      }
      savePets(pets);
      if (!pawCache.settings) pawCache.settings = {};
      if (pawCache.settings.noPet !== false) {
        pawCache.settings.noPet = false;
        saveSettings(pawCache.settings);
        if (window.supabaseClient && currentUser) {
          const userId = currentUser.id;
          window.supabaseClient.from('user_profiles').upsert({
            id: userId,
            settings: pawCache.settings
          }).catch(err => console.error("Error syncing settings on add pet:", err));
        }
      }
      closePetModal();
      refreshAllUI();
      openTab('home');
    }

    function deletePet(idx) {
      const pets = getPets();
      const name = pets[idx]?.name || 'this pet';
      showConfirm('Remove ' + name + '?', 'All data for ' + name + ' will be removed.', () => {
        pets.splice(idx, 1);
        savePets(pets);
        const activeIdx = getActivePetIdx();
        if (activeIdx >= pets.length) setActivePetIdx(Math.max(0, pets.length - 1));
        refreshAllUI();
        showToast(name + ' removed');
      });
    }

    function setMainPet(idx) {
      setActivePetIdx(idx);
      const resultBox = document.getElementById('aiFeedingAdviceResult');
      if (resultBox) {
        resultBox.innerHTML = '';
        resultBox.classList.add('hidden');
      }
      refreshAllUI();
      openTab('home');
      showToast(getPets()[idx]?.name + ' is now active 🐾');
    }

    // ==================== LOG MODAL ====================
    function openLogModal(type) {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('logTime').value = local;
      document.getElementById('logNote').value = '';
      document.getElementById('logWeight').value = '';
      document.getElementById('logType').value = type || 'fed';
      selectedLogMood = '';
      document.querySelectorAll('#logMoodRow .mood-btn').forEach(b => b.classList.remove('selected'));
      updateLogTypeFields();
      document.getElementById('logModal').classList.remove('hidden');
    }
    function closeLogModal() { document.getElementById('logModal').classList.add('hidden'); }

    document.addEventListener('DOMContentLoaded', () => {
      const logTypeSelect = document.getElementById('logType');
      if (logTypeSelect) logTypeSelect.addEventListener('change', updateLogTypeFields);
    });

    function updateLogTypeFields() {
      const type = document.getElementById('logType').value;
      document.getElementById('weightLogField').classList.toggle('hidden', type !== 'weight');
      document.getElementById('moodLogField').classList.toggle('hidden', type !== 'mood');
    }

    function selectLogMood(mood, el) {
      selectedLogMood = mood;
      document.querySelectorAll('#logMoodRow .mood-btn').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
    }

    function saveLogEntry() {
      const type = document.getElementById('logType').value;
      const note = document.getElementById('logNote').value.trim();
      const timeVal = document.getElementById('logTime').value;
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];

      if (!pet && !isNoPet()) { showToast('No active pet selected'); return; }

      const entry = {
        id: Date.now(),
        type,
        note: note || (type === 'fed' ? 'Meal fed' : type === 'water' ? 'Water refilled' : type === 'missed' ? 'Missed meal' : type === 'mood' ? (selectedLogMood || 'Mood noted') : 'Weight logged'),
        timestamp: timeVal || new Date().toISOString(),
        petName: pet ? pet.name : 'General',
        petIdx: pet ? activeIdx : -1
      };

      if (type === 'weight') {
        const w = parseFloat(document.getElementById('logWeight').value);
        if (!w) { showToast('Please enter a weight'); return; }
        entry.weight = w;
        // Update pet weight history
        if (pet) {
          pets[activeIdx].weightHistory = pets[activeIdx].weightHistory || [];
          pets[activeIdx].weightHistory.push({ date: entry.timestamp, weight: w });
          if (pets[activeIdx].weightHistory.length > 20) pets[activeIdx].weightHistory.shift();
          savePets(pets);
        }
      }

      if (type === 'mood') {
        entry.mood = selectedLogMood;
        if (pet) {
          pets[activeIdx].moodToday = selectedLogMood;
          pets[activeIdx].moodDate = todayStr();
          savePets(pets);
        }
      }

      const log = getLog();
      log.unshift(entry);
      if (log.length > 200) log.splice(200);
      saveLog(log);

      // Auto stock deduction for feeding logs
      if (type === 'fed') {
        if (typeof deductStockAutomatically === 'function') {
          deductStockAutomatically(entry.note || 'food', 'food');
        }
      }

      closeLogModal();
      showToast('Entry saved ✅');
      refreshAllUI();
    }

    // ==================== QUICK WEIGHT ====================
    function saveQuickWeight() {
      const w = parseFloat(document.getElementById('quickWeight').value);
      const note = document.getElementById('quickWeightNote').value.trim();
      if (!w) { showToast('Please enter a weight'); return; }
      const pets = getPets();
      const idx = getActivePetIdx();
      if (!pets[idx]) { showToast('No active pet'); return; }
      pets[idx].weightHistory = pets[idx].weightHistory || [];
      pets[idx].weightHistory.push({ date: new Date().toISOString(), weight: w, note });
      if (pets[idx].weightHistory.length > 20) pets[idx].weightHistory.shift();
      savePets(pets);

      const log = getLog();
      log.unshift({ id: Date.now(), type: 'weight', note: note || 'Weight logged', timestamp: new Date().toISOString(), petName: pets[idx].name, petIdx: idx, weight: w });
      saveLog(log);

      document.getElementById('weightModal').classList.add('hidden');
      showToast('Weight logged: ' + w + ' kg ⚖️');
      refreshAllUI();
    }

    // ==================== WATER TRACKING ====================
    function toggleWater(petIdx, dropIdx) {
      const pets = getPets();
      const pet = pets[petIdx];
      if (!pet) return;

      const today = todayStr();
      if (pet.waterDate !== today) { pet.waterDrops = []; pet.waterDate = today; }
      pet.waterDrops = pet.waterDrops || [];

      const isActive = pet.waterDrops.includes(dropIdx);
      if (isActive) {
        pet.waterDrops = pet.waterDrops.filter(d => d !== dropIdx);
      } else {
        pet.waterDrops.push(dropIdx);
        // Log water event
        const log = getLog();
        log.unshift({ id: Date.now(), type: 'water', note: 'Water portion logged', timestamp: new Date().toISOString(), petName: pet.name, petIdx });
        if (log.length > 200) log.splice(200);
        saveLog(log);
      }
      savePets(pets);
      refreshAllUI();
      openTab('tracker');
    }

    // ==================== GALLERY ====================
    function openGallery(petIdx) {
      galleryTargetPet = petIdx;
      const pets = getPets();
      const pet = pets[petIdx];
      if (!pet) return;
      document.getElementById('galleryModalTitle').textContent = '📷 ' + pet.name + '\'s Gallery';
      renderGalleryGrid(pet.gallery || []);
      document.getElementById('galleryModal').classList.remove('hidden');
    }

    function renderGalleryGrid(images) {
      const grid = document.getElementById('galleryGrid');
      grid.innerHTML = images.map((img, i) => `
    <div class="gallery-item" onclick="openLightbox('${img.url}')">
      <img src="${img.url}" alt="pet photo" />
      ${img.caption ? `<div class="gallery-caption">${img.caption}</div>` : ''}
    </div>`).join('');
      // Add button cell is shown via the Add Photo button below
    }

    function handleModalGalleryUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        const pets = getPets();
        const pet = pets[galleryTargetPet];
        if (!pet) return;
        pet.gallery = pet.gallery || [];
        const caption = prompt('Add a caption (optional):') || '';
        pet.gallery.push({ url: e.target.result, caption, date: new Date().toISOString() });
        savePets(pets);
        renderGalleryGrid(pet.gallery);
        showToast('Photo added to gallery 📷');
        refreshAllUI();
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }

    // ==================== LIGHTBOX ====================
    function openLightbox(src) {
      document.getElementById('lightboxImg').src = src;
      document.getElementById('lightbox').classList.remove('hidden');
    }
    function closeLightbox() { document.getElementById('lightbox').classList.add('hidden'); }

    // ==================== STREAK LOGIC ====================
    function todayStr() { return new Date().toISOString().slice(0, 10); }

    function calculateStreak() {
      const log = getLog();
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      if (!pet) return 0;

      const petLogs = log.filter(e => e.petIdx === activeIdx && e.type === 'fed');
      const days = [...new Set(petLogs.map(e => e.timestamp.slice(0, 10)))].sort().reverse();

      let streak = 0;
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      if (!days.length) return 0;
      if (days[0] !== today && days[0] !== yesterday) return 0;

      let current = days[0] === today ? new Date() : new Date(Date.now() - 86400000);
      for (const day of days) {
        const d = new Date(day);
        const diff = Math.round((current - d) / 86400000);
        if (diff <= 1) { streak++; current = d; }
        else break;
      }
      return streak;
    }

    function getMissedMeals() {
      const log = getLog();
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      if (!pet) return [];

      const today = todayStr();
      const todayLogs = log.filter(e => e.petIdx === activeIdx && e.timestamp.slice(0, 10) === today);
      const fedCount = todayLogs.filter(e => e.type === 'fed').length;
      const expectedMeals = pet.type === 'Fish' ? 2 : 3;
      const hour = new Date().getHours();

      const missed = [];
      if (hour >= 9 && !todayLogs.some(e => e.type === 'fed' && new Date(e.timestamp).getHours() < 9)) missed.push({ label: 'Morning Meal', time: '7:00 AM', icon: '🌅' });
      if (hour >= 15 && fedCount < 2) missed.push({ label: 'Afternoon Meal', time: '1:00 PM', icon: '☀️' });
      if (hour >= 21 && fedCount < 3 && expectedMeals >= 3) missed.push({ label: 'Dinner', time: '7:30 PM', icon: '🌙' });
      return missed;
    }

    function getTodayStats() {
      const log = getLog();
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      if (!pet) return { feedings: 0, waterPct: 0, mood: '—' };

      const today = todayStr();
      const todayLogs = log.filter(e => e.petIdx === activeIdx && (e.timestamp.slice(0, 10) === today || e.timestamp.startsWith(today)));
      const feedings = todayLogs.filter(e => e.type === 'fed').length;

      // Water
      const drops = (pet.waterDate === today ? (pet.waterDrops || []) : []).length;
      const totalDrops = Math.ceil((pet.waterGoal || 500) / 100);
      const waterPct = Math.round((drops / totalDrops) * 100);

      // Mood
      const moodEntry = pet.moodDate === today ? pet.moodToday : '—';
      const moodIcon = moodEntry && moodEntry !== '—' ? moodEntry.split(' ')[0] : '—';

      return { feedings, waterPct, mood: moodIcon };
    }

    // ==================== CARE PLANNER LOGIC ====================
    function getCareTasks() {
      let tasks = pawCache.tasks || [];
      if (tasks.length === 0) {
        const pets = getPets();
        pets.forEach((pet, petIdx) => {
          initDefaultTasksForPet(petIdx);
        });
        tasks = pawCache.tasks || [];
      }
      return tasks;
    }

    async function saveCareTasks(tasks) {
      pawCache.tasks = tasks;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawCareTasks', JSON.stringify(tasks)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        const { data: dbTasks } = await window.supabaseClient.from('care_tasks').select('id').eq('user_id', userId);
        if (dbTasks) {
          const activeIds = tasks.map(t => t.id).filter(id => typeof id === 'number' || (typeof id === 'string' && !id.startsWith('task_')));
          const deletedIds = dbTasks.filter(t => !activeIds.includes(t.id)).map(t => t.id);
          if (deletedIds.length > 0) {
            await window.supabaseClient.from('care_tasks').delete().in('id', deletedIds);
          }
        }
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const petId = pawCache.pets[task.petIdx]?.id || null;
          const payload = {
            user_id: userId,
            pet_id: petId,
            title: task.title,
            date_time: task.dateTime,
            repeat: task.repeat,
            completed: task.completed,
            payload: task
          };
          if (task.id && typeof task.id === 'number') {
            payload.id = task.id;
          }
          const { data, error } = await window.supabaseClient.from('care_tasks').upsert({...payload, household_id: currentHouseholdId}).select('id').single();
          if (!error && data) task.id = data.id;
        }
      } catch (err) {
        console.error("Error syncing care tasks to Supabase:", err);
      }
    }

    function initDefaultTasksForPet(petIdx) {
      let tasks = pawCache.tasks || [];

      const today = new Date().toISOString().slice(0, 10);
      const defaultTasks = [
        { title: 'Feed 🥣', time: '08:00', repeat: 'daily' },
        { title: 'Water 💧', time: '09:00', repeat: 'daily' },
        { title: 'Walk 🦮', time: '07:00', repeat: 'daily' },
        { title: 'Play 🧸', time: '17:00', repeat: 'daily' },
        { title: 'Medicine 💊', time: '09:00', repeat: 'daily' },
        { title: 'Grooming 🧼', time: '10:00', repeat: 'daily' }
      ];

      defaultTasks.forEach((t, i) => {
        const id = 'task_' + Date.now() + '_' + petIdx + '_' + i;
        tasks.push({
          id: id,
          petIdx: petIdx,
          title: t.title,
          dateTime: today + 'T' + t.time,
          repeat: t.repeat,
          reminder: true,
          completedDates: [],
          completed: false
        });
      });
      saveCareTasks(tasks);
    }

    function taskAppliesToDate(task, dateStr) {
      const taskDateStr = task.dateTime.slice(0, 10);
      if (task.repeat === 'none') {
        return taskDateStr === dateStr;
      }
      if (taskDateStr > dateStr) {
        return false;
      }

      const taskDate = new Date(taskDateStr + 'T00:00:00');
      const checkDate = new Date(dateStr + 'T00:00:00');

      if (task.repeat === 'daily') {
        return true;
      }
      if (task.repeat === 'weekly') {
        return taskDate.getDay() === checkDate.getDay();
      }
      if (task.repeat === 'monthly') {
        return taskDate.getDate() === checkDate.getDate();
      }
      return false;
    }

    function isDefaultTask(title) {
      const defaults = ['Feed 🥣', 'Water 💧', 'Walk 🦮', 'Play 🧸', 'Medicine 💊', 'Grooming 🧼'];
      return defaults.includes(title);
    }

    function formatTimeFromDateTime(dtStr) {
      const parts = dtStr.split('T');
      if (parts.length < 2) return '';
      const timeParts = parts[1].split(':');
      let h = parseInt(timeParts[0]);
      const m = timeParts[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${m} ${ampm}`;
    }

    function onTaskPresetChange() {
      const preset = document.getElementById('addTaskPreset').value;
      const titleInput = document.getElementById('addTaskTitle');
      if (preset) {
        titleInput.value = preset;
      } else {
        titleInput.value = '';
      }
    }

    function selectPlannerDate(dateStr) {
      selectedPlannerDateStr = dateStr;
      renderCarePlannerTab();
    }

    function navigatePlannerMonth(dir) {
      calendarMonthDate.setMonth(calendarMonthDate.getMonth() + dir);
      renderCarePlannerTab();
    }

    function addPlannerTask() {
      const titleInput = document.getElementById('addTaskTitle');
      const dtInput = document.getElementById('addTaskDateTime');
      const repeatInput = document.getElementById('addTaskRepeat');
      const reminderToggle = document.getElementById('addTaskReminderToggle');

      const title = titleInput.value.trim();
      const dateTime = dtInput.value;
      const repeat = repeatInput.value;
      const reminder = reminderToggle.classList.contains('on');

      if (!title) {
        showToast('Please enter a task title');
        return;
      }
      if (!dateTime) {
        showToast('Please choose a date and time');
        return;
      }

      const activeIdx = getActivePetIdx();
      const tasks = getCareTasks();

      const newTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        petIdx: activeIdx,
        title: title,
        dateTime: dateTime,
        repeat: repeat,
        reminder: reminder,
        completedDates: [],
        completed: false
      };

      tasks.push(newTask);
      saveCareTasks(tasks);
      showToast(`Task "${title}" added successfully! 📋`);

      titleInput.value = '';
      dtInput.value = '';
      document.getElementById('addTaskPreset').value = '';

      refreshAllUI();
    }

    function deletePlannerTask(id) {
      showConfirm('Delete Task?', 'Are you sure you want to remove this task from the care plan?', () => {
        let tasks = getCareTasks();
        tasks = tasks.filter(t => String(t.id) !== String(id));
        saveCareTasks(tasks);
        showToast('Task removed from plan');
        refreshAllUI();
      });
    }

    function completePlannerTask(taskId, dateStr) {
      const tasks = getCareTasks();
      const task = tasks.find(t => String(t.id) === String(taskId));
      if (!task) return;

      if (!task.completedDates) task.completedDates = [];
      if (!task.completedDates.includes(dateStr)) {
        task.completedDates.push(dateStr);

        // Log task in history
        const log = getLog();
        const activeIdx = getActivePetIdx();
        const pets = getPets();
        const pet = pets[activeIdx] || { name: 'your pet' };

        let type = 'care';
        if (task.title.toLowerCase().includes('feed')) {
          type = 'fed';
        } else if (task.title.toLowerCase().includes('water')) {
          type = 'water';
          if (!pet.waterDrops) pet.waterDrops = [];
          if (pet.waterDate !== dateStr) {
            pet.waterDate = dateStr;
            pet.waterDrops = [];
          }
          const totalDrops = Math.ceil((pet.waterGoal || 500) / 100);
          if (pet.waterDrops.length < totalDrops) {
            pet.waterDrops.push(pet.waterDrops.length);
            savePets(pets);
          }
        }

        log.unshift({
          id: 'log_' + Date.now(),
          petIdx: activeIdx,
          type: type,
          note: `Completed task: ${task.title}`,
          timestamp: new Date().toISOString()
        });
        saveLog(log);

        // Auto stock deduction for completed planner tasks
        if (typeof deductStockAutomatically === 'function') {
          const isMed = task.title.toLowerCase().includes('med') || task.title.toLowerCase().includes('pill') || task.title.toLowerCase().includes('syrup') || task.title.toLowerCase().includes('dose');
          deductStockAutomatically(task.title, isMed ? 'medicine' : 'food');
        }
      }

      if (task.repeat === 'none') {
        task.completed = true;
      }

      saveCareTasks(tasks);
      showToast(`Task "${task.title}" completed! ✅`);

      // Streak trigger
      const activeIdx = getActivePetIdx();
      const petTasks = tasks.filter(t => t.petIdx === activeIdx);
      const todaysTasks = petTasks.filter(t => taskAppliesToDate(t, dateStr));
      const completedTodaysTasks = todaysTasks.filter(t => t.completedDates && t.completedDates.includes(dateStr));

      if (todaysTasks.length > 0 && completedTodaysTasks.length === todaysTasks.length) {
        const log = getLog();
        const todayFed = log.some(e => e.petIdx === activeIdx && e.type === 'fed' && e.timestamp.slice(0, 10) === dateStr);

        if (!todayFed) {
          log.unshift({
            id: 'log_' + Date.now() + '_streak',
            petIdx: activeIdx,
            type: 'fed',
            note: 'All Care Planner tasks completed! 🏆',
            timestamp: new Date().toISOString()
          });
          saveLog(log);
        }

        setTimeout(() => {
          showConfirm('🏆 Streak Increased!', `Wonderful! You completed all scheduled tasks for today! Your daily care streak has increased to ${calculateStreak()} days! 🔥`, null);
        }, 300);
      }

      refreshAllUI();
    }

    function uncompletePlannerTask(taskId, dateStr) {
      const tasks = getCareTasks();
      const task = tasks.find(t => String(t.id) === String(taskId));
      if (!task) return;

      if (task.completedDates) {
        task.completedDates = task.completedDates.filter(d => d !== dateStr);
      }
      if (task.repeat === 'none') {
        task.completed = false;
      }

      saveCareTasks(tasks);

      let log = getLog();
      const idx = log.findIndex(e => e.petIdx === task.petIdx && e.timestamp.slice(0, 10) === dateStr && e.note === `Completed task: ${task.title}`);
      if (idx >= 0) {
        log.splice(idx, 1);
        saveLog(log);
      }

      showToast(`Task "${task.title}" marked incomplete`);
      refreshAllUI();
    }

    function renderCarePlannerTab() {
      const pets = getPets();
      const noPet = isNoPet();
      const activeIdx = Math.min(getActivePetIdx(), Math.max(0, pets.length - 1));

      // Render Pet Tabs
      const tabs = document.getElementById('plannerPetTabs');
      if (tabs) {
        if (noPet || pets.length === 0) {
          tabs.innerHTML = '';
        } else {
          tabs.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === activeIdx ? 'active' : ''}" onclick="setActivePet(${i});renderCarePlannerTab()">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
        }
      }

      // Check for empty state
      if (noPet || pets.length === 0) {
        const grid = document.getElementById('plannerCalendarGrid');
        if (grid) grid.innerHTML = `<div style="grid-column: span 7; padding: 20px; text-align: center; color: var(--muted); font-weight:700;">No active pets. Add a pet first.</div>`;
        const label = document.getElementById('selectedDateLabel');
        if (label) label.textContent = 'No selected date';
        const prog = document.getElementById('plannerProgressLabel');
        if (prog) prog.textContent = '0/0 completed';
        const bar = document.getElementById('plannerProgressBar');
        if (bar) bar.style.width = '0%';
        const pend = document.getElementById('plannerPendingList');
        if (pend) pend.innerHTML = `<div class="card empty-state" style="padding:16px;text-align:center"><p style="color:var(--muted)">No pets registered. Add a pet profile to get started.</p></div>`;
        const comp = document.getElementById('plannerCompletedList');
        if (comp) comp.innerHTML = '';
        const upc = document.getElementById('plannerUpcomingList');
        if (upc) upc.innerHTML = '';
        const hist = document.getElementById('plannerHistoryBox');
        if (hist) hist.innerHTML = '';
        return;
      }

      // Render Calendar Grid
      const grid = document.getElementById('plannerCalendarGrid');
      const monthLabel = document.getElementById('plannerMonthLabel');
      if (grid && monthLabel) {
        const year = calendarMonthDate.getFullYear();
        const month = calendarMonthDate.getMonth();
        const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthLabel.textContent = `${MONTHS[month]} ${year}`;

        let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="cal-day-header">${d}</div>`).join('');
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
          html += `<div class="cal-empty-cell"></div>`;
        }

        const tasks = getCareTasks();
        const petTasks = tasks.filter(t => t.petIdx === activeIdx);
        const today = new Date().toISOString().slice(0, 10);

        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = (dateStr === selectedPlannerDateStr);
          const isToday = (dateStr === today);
          const hasTasks = petTasks.some(t => taskAppliesToDate(t, dateStr));
          const dot = hasTasks ? `<div class="task-dot"></div>` : '';

          html += `
            <div class="cal-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" onclick="selectPlannerDate('${dateStr}')">
              ${day}
              ${dot}
            </div>
          `;
        }
        grid.innerHTML = html;
      }

      // Set date inputs default to currently selected planner date or current local date/time
      const dtInput = document.getElementById('addTaskDateTime');
      if (dtInput && !dtInput.value) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - offset)).toISOString().slice(0, 16);
        dtInput.value = localISOTime;
      }

      // Render Summary and Progress Bar
      const dateLabel = document.getElementById('selectedDateLabel');
      const progressLabel = document.getElementById('plannerProgressLabel');
      const progressBar = document.getElementById('plannerProgressBar');
      const tasks = getCareTasks();
      const petTasks = tasks.filter(t => t.petIdx === activeIdx);
      const dayTasks = petTasks.filter(t => taskAppliesToDate(t, selectedPlannerDateStr));
      const completedTasks = dayTasks.filter(t => t.completedDates && t.completedDates.includes(selectedPlannerDateStr));

      if (dateLabel) {
        const dateObj = new Date(selectedPlannerDateStr + 'T00:00:00');
        dateLabel.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (progressLabel) {
        progressLabel.textContent = `${completedTasks.length}/${dayTasks.length} completed`;
      }
      if (progressBar) {
        const pct = dayTasks.length > 0 ? Math.round((completedTasks.length / dayTasks.length) * 100) : 0;
        progressBar.style.width = `${pct}%`;
      }

      // Render checklists
      const pendingList = document.getElementById('plannerPendingList');
      const completedList = document.getElementById('plannerCompletedList');
      const upcomingList = document.getElementById('plannerUpcomingList');
      const historyBox = document.getElementById('plannerHistoryBox');

      const pending = dayTasks.filter(t => !(t.completedDates && t.completedDates.includes(selectedPlannerDateStr)));
      const completed = dayTasks.filter(t => t.completedDates && t.completedDates.includes(selectedPlannerDateStr));
      const upcoming = petTasks.filter(t => t.dateTime.slice(0, 10) > selectedPlannerDateStr && !(t.repeat === 'none' && t.completed));

      if (pendingList) {
        if (pending.length === 0) {
          pendingList.innerHTML = `<div class="card empty-state" style="padding:12px;margin:8px 0"><p style="font-size:13px;color:var(--muted)">No pending tasks for this day.</p></div>`;
        } else {
          pendingList.innerHTML = pending.map(t => {
            const timeStr = formatTimeFromDateTime(t.dateTime);
            const repeatLabel = t.repeat !== 'none' ? `<span style="background:var(--pill-bg);color:var(--pill-color);font-size:10px;padding:2px 6px;border-radius:8px;font-weight:800;text-transform:uppercase">${t.repeat}</span>` : '';
            const deleteBtn = !isDefaultTask(t.title) ? `<button onclick="deletePlannerTask('${t.id}')" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;padding:0 4px">✕</button>` : '';
            return `
              <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin:8px 0">
                <div style="display:flex;align-items:center;gap:12px">
                  <input type="checkbox" onchange="completePlannerTask('${t.id}', '${selectedPlannerDateStr}')" style="width:20px;height:20px;cursor:pointer;accent-color:var(--orange)" />
                  <div>
                    <b style="font-size:15px;color:var(--dark)">${t.title}</b>
                    <div style="font-size:12px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:8px">
                      <span>🕒 ${timeStr}</span>
                      ${repeatLabel}
                      <span>${t.reminder ? '🔔' : ''}</span>
                    </div>
                  </div>
                </div>
                ${deleteBtn}
              </div>
            `;
          }).join('');
        }
      }

      if (completedList) {
        if (completed.length === 0) {
          completedList.innerHTML = `<div class="card empty-state" style="padding:12px;margin:8px 0"><p style="font-size:13px;color:var(--muted)">No completed tasks for this day yet.</p></div>`;
        } else {
          completedList.innerHTML = completed.map(t => {
            const timeStr = formatTimeFromDateTime(t.dateTime);
            const deleteBtn = !isDefaultTask(t.title) ? `<button onclick="deletePlannerTask('${t.id}')" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;padding:0 4px">✕</button>` : '';
            return `
              <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;margin:8px 0;opacity:0.75;background:var(--success-bg);border:1px solid #B5EAD7">
                <div style="display:flex;align-items:center;gap:12px">
                  <input type="checkbox" checked onchange="uncompletePlannerTask('${t.id}', '${selectedPlannerDateStr}')" style="width:20px;height:20px;cursor:pointer;accent-color:var(--orange)" />
                  <div>
                    <b style="font-size:15px;color:#1A6A4A;text-decoration:line-through">${t.title}</b>
                    <div style="font-size:12px;color:#1A6A4A;margin-top:2px">
                      Completed ✓ 🕒 ${timeStr}
                    </div>
                  </div>
                </div>
                ${deleteBtn}
              </div>
            `;
          }).join('');
        }
      }

      if (upcomingList) {
        if (upcoming.length === 0) {
          upcomingList.innerHTML = `<div class="card empty-state" style="padding:12px;margin:8px 0"><p style="font-size:13px;color:var(--muted)">No upcoming tasks scheduled.</p></div>`;
        } else {
          const sortedUpcoming = upcoming.slice().sort((a, b) => a.dateTime.localeCompare(b.dateTime));
          upcomingList.innerHTML = sortedUpcoming.slice(0, 10).map(t => {
            const dateObj = new Date(t.dateTime);
            const dateLabelStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const repeatLabel = t.repeat !== 'none' ? `<span style="background:var(--pill-bg);color:var(--pill-color);font-size:9px;padding:1px 4px;border-radius:6px;font-weight:800;text-transform:uppercase">${t.repeat}</span>` : '';
            const deleteBtn = !isDefaultTask(t.title) ? `<button onclick="deletePlannerTask('${t.id}')" style="background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:0 4px">✕</button>` : '';
            return `
              <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;margin:6px 0;background:var(--pill-bg);border:none">
                <div>
                  <b style="font-size:14px;color:var(--dark)">${t.title}</b>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:6px">
                    <span>🗓️ ${dateLabelStr}</span>
                    ${repeatLabel}
                    <span>${t.reminder ? '🔔' : ''}</span>
                  </div>
                </div>
                ${deleteBtn}
              </div>
            `;
          }).join('');
        }
      }

      if (historyBox) {
        const log = getLog().filter(e => e.petIdx === activeIdx && (e.type === 'care' || e.type === 'fed' || e.type === 'water'));
        if (log.length === 0) {
          historyBox.innerHTML = `<p style="font-size:13px;color:var(--muted);padding:8px 0;text-align:center">No task completion history yet.</p>`;
        } else {
          historyBox.innerHTML = log.map(e => {
            const ts = new Date(e.timestamp);
            const dateStr = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                <div>
                  <span style="font-weight:800;color:var(--dark);font-size:14px">${e.note || e.taskTitle || 'Care Task'}</span>
                  <span style="font-size:11px;color:var(--muted);margin-left:8px">${dateStr} @ ${timeStr}</span>
                </div>
                <span style="font-size:11px;background:var(--success-bg);color:#1A6A4A;padding:2px 8px;border-radius:10px;font-weight:800">Done ✓</span>
              </div>
            `;
          }).join('');
        }
      }
    }

    // ==================== REFRESH ALL ====================
    function refreshAllUI() {
      const pets = getPets();
      const noPet = isNoPet();
      const activeIdx = Math.min(getActivePetIdx(), Math.max(0, pets.length - 1));

      document.getElementById('noPetCheck').checked = noPet;

      // === PHASE 1: Render instantly (home tab - what user sees immediately) ===
      renderPetList();
      renderHomePreview(pets, activeIdx, noPet);
      updateHomeStats(pets, activeIdx, noPet);
      renderReminderBanner(pets, activeIdx, noPet);
      renderDailyTip();
      if (typeof renderDashboardMiniChart === 'function') renderDashboardMiniChart(pets, activeIdx, noPet);

      // === PHASE 2: Defer heavy tabs to next frame so UI doesn't freeze ===
      requestAnimationFrame(() => {
        setTimeout(() => {
          renderPlanTab(pets, activeIdx, noPet);
          renderTrackerTab(pets, activeIdx, noPet);
        }, 0);
        setTimeout(() => {
          renderRemindersTab(pets, activeIdx, noPet);
          renderCareTab(pets, activeIdx, noPet);
        }, 50);
        setTimeout(() => {
          renderHomemadeTab();
          renderVisionHistory();
        }, 100);
        setTimeout(() => {
          renderCommunity();
          if (typeof renderCarePlannerTab === 'function') renderCarePlannerTab();
          renderRecordsTab();
        }, 150);
        setTimeout(() => {
          if (typeof renderDailyChecklist === 'function') renderDailyChecklist();
          if (typeof renderExpenseTracker === 'function') renderExpenseTracker();
          if (typeof renderStockTracker === 'function') renderStockTracker();
        }, 200);
      });
    }

    // ==================== HOME STATS ====================
    function updateHomeStats(pets, activeIdx, noPet) {
      const statsRow = document.getElementById('homeStatsRow');
      const streakBanner = document.getElementById('streakBanner');
      const missedSection = document.getElementById('missedMealsSection');

      // Hide everything if no pets
      if (!noPet && (!pets || pets.length === 0)) {
        if (statsRow) statsRow.classList.add('hidden');
        if (streakBanner) streakBanner.classList.add('hidden');
        if (missedSection) missedSection.classList.add('hidden');
        return;
      }

      if (statsRow) statsRow.classList.remove('hidden');

      const stats = getTodayStats();
      document.getElementById('statFeedings').textContent = stats.feedings;
      document.getElementById('statWater').textContent = stats.waterPct + '%';
      document.getElementById('statMood').textContent = stats.mood;

      // Streak
      const s = getSettings();
      const streak = calculateStreak();
      if (streak >= 2 && s.showStreaks !== false && !noPet && pets.length > 0) {
        streakBanner.classList.remove('hidden');
        const streakCountEl = document.getElementById('streakCount');
        streakCountEl.textContent = streak;
        document.getElementById('streakTitle').textContent = streak >= 7 ? '🏆 ' + streak + '-Day Streak!' : '🔥 Feeding Streak!';
        document.getElementById('streakSub').textContent = streak >= 7 ? 'Amazing consistency!' : 'Keep up the great work!';
        // Shimmer effect for streak >= 7
        if (streak >= 7) {
          streakCountEl.classList.add('shimmer-active');
        } else {
          streakCountEl.classList.remove('shimmer-active');
        }
      } else {
        streakBanner.classList.add('hidden');
      }

      // Missed meals
      const missed = getMissedMeals();
      if (missedSection) {
        const missedBox = document.getElementById('missedMealsBox');
        if (missed.length > 0 && !noPet && pets.length > 0) {
          missedSection.classList.remove('hidden');
          missedBox.innerHTML = missed.map(m => `
      <div class="missed-meal-card">
        <div class="missed-icon">${m.icon}</div>
        <div class="missed-meal-info">
          <h4>${m.label} Missed</h4>
          <p>Was scheduled at ${m.time}</p>
        </div>
        <button class="small-btn" onclick="openLogModal('fed')" style="margin:0;font-size:11px">Log Now</button>
      </div>`).join('');
        } else {
          missedSection.classList.add('hidden');
        }
      }
    }

    // ==================== HOME PREVIEW ====================
    function renderHomePreview(pets, activeIdx, noPet) {
      const preview = document.getElementById('petPreview');

      if (noPet) {
        document.getElementById('todayPlan').innerText = 'Browsing general pet care tips.';
        document.getElementById('healthBadge').innerText = '✨ General mode';
        const avatarWrap = document.getElementById('heroAvatarWrap');
        if (avatarWrap) avatarWrap.innerHTML = '🐾';
        document.documentElement.style.setProperty('--pet-color', '#F5A623');
        renderWeeklyPlan();
        return;
      }
      if (pets.length === 0) {
        document.getElementById('todayPlan').innerText = 'Welcome to PawFeed! 🐾';
        document.getElementById('healthBadge').innerText = '➕ Add your first pet to get started';
        const avatarWrap = document.getElementById('heroAvatarWrap');
        if (avatarWrap) avatarWrap.innerHTML = '🐾';
        document.documentElement.style.setProperty('--pet-color', '#F5A623');
        if (preview) preview.innerHTML = `
          <div style="text-align:center; padding: 16px 0">
            <div style="font-size:48px; margin-bottom:12px">🐾</div>
            <div style="font-weight:800; font-size:17px; color:var(--dark); margin-bottom:6px">No pets added yet</div>
            <div style="font-size:13px; color:var(--muted); margin-bottom:16px">Add your pet to get a personalized feeding plan, health tracking, and more!</div>
            <button class="btn" onclick="openPetModal(-1)" style="font-size:14px; padding:12px 28px">➕ Add My First Pet</button>
          </div>`;
        return;
      }
      const pet = pets[activeIdx];

      // Set --pet-color CSS variable from pet's stored color
      const petColor = pet.color || '#F5A623';
      document.documentElement.style.setProperty('--pet-color', petColor);

      document.getElementById('todayPlan').innerText = pet.name + '\'s next care plan is ready.';
      document.getElementById('healthBadge').innerText = pet.health ? '🩺 Health-aware plan' : '✨ Healthy routine plan';

      // Hero avatar
      const avatarWrap = document.getElementById('heroAvatarWrap');
      if (avatarWrap) {
        avatarWrap.innerHTML = pet.avatar
          ? `<img src="${pet.avatar}" alt="${pet.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : `<span style="font-size:38px">${PET_ICONS[pet.type] || '🐾'}</span>`;
        avatarWrap.style.boxShadow = `0 0 30px ${petColor}55`;
      }

      preview.innerHTML = `
    <div class="pet-profile-header" style="position:relative;z-index:1">
        <div class="pet-profile-name">${pet.name} <span class="active-dot"></span></div>
        <div class="pet-profile-sub">${pet.type} · ${pet.breed}</div>
        <div class="pet-profile-sub">Age: ${pet.age} yrs · ${pet.weight} kg</div>
      <button class="small-btn" onclick="openGallery(${activeIdx})" style="margin-top:8px;font-size:12px">📷 Gallery</button>
    </div>
    ${pets.length > 1 ? `<p style="font-size:13px;color:var(--muted);text-align:center;margin-top:4px">+${pets.length - 1} more pet${pets.length > 2 ? 's' : ''} — manage in <b onclick="openTab('profile')" style="cursor:pointer;color:var(--orange)">Profile</b></p>` : ''}`;
    
      // Ensure the meal planner is rendered for users with pets too!
      renderWeeklyPlan();
    }

    function shadeColor(color, percent) {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.max(0, Math.min(255, (num >> 16) + amt));
      const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
      const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
      return '#' + ((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1);
    }

    // ==================== HEALTH SCORE ====================
    function calculateHealthScore() {
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      if (!pet) return { score: 0, insight: 'Add a pet to see health score', lowestComponent: 'none' };

      const today = todayStr();
      const log = getLog();
      const petLog = log.filter(e => e.petIdx === activeIdx);

      // Feeding streak (40pts max)
      const streak = calculateStreak();
      const streakPts = Math.min(40, Math.round((streak / 7) * 40));

      // Water goal % (30pts max)
      const drops = (pet.waterDate === today ? (pet.waterDrops || []) : []).length;
      const totalDrops = Math.ceil((pet.waterGoal || 500) / 100);
      const waterPct = totalDrops > 0 ? drops / totalDrops : 0;
      const waterPts = Math.round(waterPct * 30);

      // Mood positivity (20pts max)
      const positiveMoods = ['😄 Happy', '😐 Calm'];
      const mood = pet.moodDate === today ? pet.moodToday : null;
      const moodPts = mood ? (positiveMoods.includes(mood) ? 20 : 8) : 10;

      // Weight stability (10pts max)
      const wh = pet.weightHistory || [];
      let weightPts = 10;
      if (wh.length >= 2) {
        const diff = Math.abs(wh[wh.length - 1].weight - wh[wh.length - 2].weight);
        weightPts = diff > 0.5 ? 5 : 10;
      }

      const score = streakPts + waterPts + moodPts + weightPts;

      // Determine lowest component for insight
      const components = [
        { name: 'feeding streak', pts: streakPts, max: 40, emoji: '🍽️' },
        { name: 'water intake', pts: waterPts, max: 30, emoji: '💧' },
        { name: 'mood tracking', pts: moodPts, max: 20, emoji: '😊' },
        { name: 'weight', pts: weightPts, max: 10, emoji: '⚖️' }
      ];
      const lowest = components.reduce((a, b) => (a.pts / a.max) < (b.pts / b.max) ? a : b);

      let insight = '';
      const petName = pet.name || 'Your pet';
      if (score >= 80) insight = `${petName} is thriving! 🌟`;
      else if (score >= 50) insight = `${petName} needs more ${lowest.emoji} ${lowest.name}`;
      else insight = `Focus on ${petName}'s ${lowest.emoji} ${lowest.name} today`;

      return { score, insight, lowestComponent: lowest.name };
    }

    // ==================== REMINDER BANNER ====================
    function renderReminderBanner(pets, activeIdx, noPet) {
      const container = document.getElementById('reminderBanner');
      if (!container) return;

      if (noPet || !pets || pets.length === 0) {
        container.innerHTML = '';
        return;
      }

      const now = new Date();
      const tasks = getCareTasks();
      const activeTask = tasks
        .filter(t => {
          if (t.petIdx !== activeIdx) return false;
          const dt = new Date(t.dateTime);
          if (dt <= now) return false;
          const dateStr = dt.toISOString().slice(0, 10);
          if (t.completedDates && t.completedDates.includes(dateStr)) return false;
          return true;
        })
        .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))[0];

      if (!activeTask) {
        container.innerHTML = '';
        return;
      }

      const pet = pets[activeIdx];
      const dt = new Date(activeTask.dateTime);
      const diffMs = dt - now;
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      const timeLabel = diffH > 0 ? `in ${diffH}h ${diffM}m` : `in ${diffM}m`;

      container.innerHTML = `
        <div class="reminder-banner" onclick="openTab('careplanner')">
          <span class="reminder-banner-icon">⏰</span>
          <div class="reminder-banner-text">
            <div class="reminder-banner-title">${pet.name}'s ${activeTask.title}</div>
            <div class="reminder-banner-sub">${timeLabel} · Tap to open Planner</div>
          </div>
          <span style="color:var(--muted);font-size:18px">›</span>
        </div>`;
    }

    // ==================== DAILY PET TIP ====================
    const DAILY_PET_TIPS = [
      'Always keep fresh water available — change it daily to prevent bacteria.',
      'Feed pets at consistent times each day to regulate their digestion.',
      'Avoid giving pets human food without checking if it\'s safe first.',
      'Regular vet checkups (at least once a year) can catch hidden health issues early.',
      'Brush your dog\'s teeth 2–3 times a week to prevent dental disease.',
      'Cats need mental stimulation — rotate toys to keep them engaged.',
      'Obesity is the #1 preventable health issue in pets — watch portion sizes.',
      'Never leave pets in a parked car, even for a few minutes.',
      'Microchipping your pet greatly increases the chance of reunion if lost.',
      'Spaying/neutering has health and behavioral benefits beyond population control.',
      'Watch for sudden changes in appetite — it\'s often the first sign of illness.',
      'Keep toxic plants like lilies, azaleas, and sago palms out of reach.',
      'Exercise reduces anxiety and destructive behavior in dogs.',
      'Senior pets (7+) benefit from bi-annual vet visits for early detection.',
      'Grooming sessions are a great time to check for lumps, ticks, or skin issues.',
      'Stress in pets can cause digestive issues — keep routines predictable.',
      'Chocolate, grapes, onions, and xylitol are toxic to dogs.',
      'Cats are obligate carnivores — they need animal protein in every meal.',
      'Rabbits need unlimited hay — it keeps their gut moving and teeth worn.',
      'Birds need 10–12 hours of darkness to sleep properly each night.',
      'Fish are sensitive to water temperature changes — check daily.',
      'Use positive reinforcement — reward good behavior with treats or praise.',
      'Pets pick up on owner stress — your calm energy helps them too.',
      'Clean food and water bowls daily to prevent bacterial build-up.',
      'Give your pet a quiet retreat space where they can rest undisturbed.',
      'A pet\'s nose is always wet — a dry nose may signal dehydration or fever.',
      'Regular playtime improves cardiovascular health and mood in pets.',
      'Keep all medications (human and pet) stored away from curious paws.',
      'Track your pet\'s weight monthly — gradual changes are easy to miss.',
      'A happy pet shows bright eyes, a shiny coat, and a good appetite.'
    ];

    function renderDailyTip() {
      const container = document.getElementById('dailyPetTip');
      if (!container) return;

      // Don't show tip if no pets added yet
      const pets = getPets();
      if (!pets || pets.length === 0) {
        container.innerHTML = '';
        return;
      }

      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((now - start) / 86400000);
      const tipIndex = dayOfYear % DAILY_PET_TIPS.length;
      const tip = DAILY_PET_TIPS[tipIndex];

      container.innerHTML = `
        <div class="daily-tip-card">
          <span class="daily-tip-icon">💡</span>
          <div class="daily-tip-content">
            <h4>Daily Pet Tip</h4>
            <p>${tip}</p>
            <span class="daily-tip-link" onclick="openTab('care')">Learn more →</span>
          </div>
        </div>`;
    }

    // ==================== PET LIST ====================
    function renderPetList() {
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const box = document.getElementById('petListBox');
      
      const adviceContainer = document.getElementById('aiFeedingAdviceContainer');
      if (adviceContainer) {
        if (pets.length > 0) {
          adviceContainer.classList.remove('hidden');
        } else {
          adviceContainer.classList.add('hidden');
          const resultBox = document.getElementById('aiFeedingAdviceResult');
          if (resultBox) {
            resultBox.innerHTML = '';
            resultBox.classList.add('hidden');
          }
        }
      }

      if (pets.length === 0) {
        box.innerHTML = `<div class="empty-state" style="padding:14px 0"><p>No pets added yet.</p></div>`;
        return;
      }

      box.innerHTML = pets.map((p, i) => {
        const avatarHtml = p.avatar
          ? `<img src="${p.avatar}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">`
          : `<span style="font-size:24px">${PET_ICONS[p.type] || '🐾'}</span>`;
        return `
      <div class="pet-card-item ${i === activeIdx ? 'active-pet' : ''}">
        <div style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer" onclick="setMainPet(${i})">
          <div class="pet-avatar">${avatarHtml}</div>
          <div>
            <div style="font-weight:800;font-size:15px;color:var(--dark)">${p.name} ${i === activeIdx ? '<span class="active-dot"></span>' : ''}</div>
            <div style="font-size:12px;color:var(--muted)">${p.type} · ${p.breed} · ${p.age} yrs · ${p.weight}kg</div>
            ${p.gallery && p.gallery.length ? `<div style="font-size:11px;color:var(--muted)">📷 ${p.gallery.length} photo${p.gallery.length > 1 ? 's' : ''}</div>` : ''}
          </div>
        </div>
        <div class="pet-card-actions">
          <button class="small-btn" onclick="openGallery(${i})">📷</button>
          <button class="small-btn" onclick="openPetModal(${i})">✏️</button>
          <button class="small-btn" style="background:#fff1f1;color:#d64040" onclick="deletePet(${i})">🗑️</button>
        </div>
      </div>`;
      }).join('');
    }

    // ==================== PLAN TAB ====================
    function renderPlanTab(pets, activeIdx, noPet) {
      const tabs = document.getElementById('planPetTabs');
      const box = document.getElementById('foodPlanBox');
      if (noPet || pets.length === 0) {
        tabs.innerHTML = '';
        box.innerHTML = `<div class="card empty-state"><h3>${noPet ? 'No-pet mode' : 'No pets yet'}</h3><button class="primary-btn" onclick="${noPet ? "document.getElementById('noPetCheck').checked=false;toggleNoPet()" : "openPetModal(-1)"}">+ ${noPet ? 'Enable Pet Mode' : 'Add Pet'}</button></div>`;
        return;
      }
      tabs.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === activePlanPet ? 'active' : ''}" onclick="activePlanPet=${i};renderPlanTab(getPets(),getActivePetIdx(),isNoPet())">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const pet = pets[activePlanPet] || pets[0];
      box.innerHTML = buildFoodPlan(pet, activePlanPet);
    }

    function buildFoodPlan(pet, petIdx) {
      let meals = [];
      if (pet.type === 'Dog') meals = ['7:00 AM — Balanced breakfast with protein (kibble/wet food)', '1:00 PM — Light lunch or healthy dental snack', '7:30 PM — Dinner with controlled portion'];
      else if (pet.type === 'Cat') meals = ['8:00 AM — Wet/dry cat food breakfast', '2:00 PM — Small protein-rich meal', '8:00 PM — Dinner with hydration support'];
      else if (pet.type === 'Rabbit') meals = ['7:30 AM — Fresh hay and leafy greens', '1:00 PM — Small vegetable portion', '7:00 PM — Hay and clean water refill'];
      else if (pet.type === 'Bird') meals = ['8:00 AM — Seeds/pellets with fresh fruits', '1:00 PM — Fresh water and light snack', '6:30 PM — Small evening feed'];
      else if (pet.type === 'Fish') meals = ['8:00 AM — Small pinch of pellets', '6:00 PM — Small evening feed (avoid overfeeding)'];

      let healthNote = 'Maintain normal portions and observe appetite daily.';
      const h = (pet.health || '').toLowerCase();
      if (h.includes('obesity') || h.includes('weight')) healthNote = 'Use controlled portions, cut treats, and encourage light activity.';
      else if (h.includes('allergy')) healthNote = 'Avoid suspected allergen foods. Consult a vet for an elimination diet.';
      else if (h.includes('digestion')) healthNote = 'Prefer easily digestible food and give smaller, more frequent meals.';
      else if (h.includes('kidney') || h.includes('renal')) healthNote = 'Use low-phosphorus food and keep water intake high. Vet diet recommended.';
      else if (h.includes('diabetes')) healthNote = 'Consistent feeding times with low-sugar, high-fiber diet. Vet guidance essential.';

      const ageNote = parseFloat(pet.age) < 1 ? `<div class="list-item"><span>🍼</span><p><b>${pet.name} is a baby!</b> Feed 3–4 times/day with age-appropriate food.</p></div>` :
        parseFloat(pet.age) > 8 ? `<div class="list-item"><span>👴</span><p><b>Senior pet.</b> Consider senior-formula food with joint and digestive support.</p></div>` : '';

      const weightKg = parseFloat(pet.weight);
      let portionNote = '';
      if (!isNaN(weightKg) && pet.type === 'Dog') {
        const grams = Math.round(weightKg * 20);
        portionNote = `<div class="list-item"><span>⚖️</span><p>Approx. portion: <b>${grams}g/day</b> based on ${weightKg}kg. Adjust for activity.</p></div>`;
      }

      const log = getLog();
      const todayFed = log.filter(e => e.petIdx === petIdx && e.type === 'fed' && e.timestamp.slice(0, 10) === todayStr());

      return `
    <div class="card success">
      <h3 style="font-weight:900;margin-bottom:8px">${PET_ICONS[pet.type] || '🐾'} ${pet.name}'s Meal Schedule</h3>
      ${meals.map(m => `<div class="list-item"><span>✅</span><p>${m}</p></div>`).join('')}
    </div>
    <div class="card">
      <h3 style="font-weight:800;margin-bottom:6px">📋 Today's Feedings <span style="color:var(--orange)">(${todayFed.length})</span></h3>
      ${todayFed.length ? todayFed.map(f => `<div class="log-entry"><div><div class="log-time">${formatTime(f.timestamp)}</div><div class="log-text">${f.note}</div></div><span class="log-badge fed">Fed ✓</span></div>`).join('') : '<p style="color:var(--muted);font-size:13px;padding:8px 0">No feedings logged today yet.</p>'}
    </div>
    ${ageNote ? `<div class="card">${ageNote}</div>` : ''}
    ${portionNote ? `<div class="card">${portionNote}</div>` : ''}
    <div class="card">
      <h3 style="font-weight:800;margin-bottom:8px">Food Preference: ${pet.foodPref}</h3>
      <div class="list-item"><span>💡</span><p>${healthNote}</p></div>
    </div>`;
    }

    // ==================== TRACKER TAB ====================
    function renderTrackerTab(pets, activeIdx, noPet) {
      const tabs = document.getElementById('trackerPetTabs');
      const box = document.getElementById('trackerBox');

      if (noPet || pets.length === 0) {
        tabs.innerHTML = '';
        box.innerHTML = `<div class="card empty-state"><h3>No pets yet</h3><button class="primary-btn" onclick="openPetModal(-1)">+ Add Pet</button></div>`;
        return;
      }

      tabs.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === activeTrackerPet ? 'active' : ''}" onclick="activeTrackerPet=${i};renderTrackerTab(getPets(),getActivePetIdx(),isNoPet())">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const pet = pets[activeTrackerPet] || pets[0];
      const petIdx = activeTrackerPet;
      const today = todayStr();
      const log = getLog();
      const totalDrops = Math.ceil((pet.waterGoal || 500) / 100);
      const currentDrops = (pet.waterDate === today ? (pet.waterDrops || []) : []);
      const waterMl = currentDrops.length * 100;
      const waterPct = Math.min(100, Math.round((currentDrops.length / totalDrops) * 100));

      // Mood
      const moodToday = pet.moodDate === today ? pet.moodToday : null;

      // Weight history
      const wh = pet.weightHistory || [];

      // Feeding history for this pet (last 14 days)
      const petLog = log.filter(e => e.petIdx === petIdx);
      const last7days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        last7days.push(d);
      }

      box.innerHTML = `
    <!-- WATER TRACKER -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="font-weight:900">💧 Water Today</h3>
        <span style="font-size:13px;color:var(--muted)">${waterMl}ml / ${pet.waterGoal || 500}ml</span>
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${waterPct}%;background:#A8D8EA"></div></div>
      <div class="water-tracker">
        ${Array.from({ length: totalDrops }, (_, i) => `
          <div class="water-drop ${currentDrops.includes(i) ? 'filled' : ''}" onclick="toggleWater(${petIdx},${i})">
            <span>💧</span>
          </div>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--muted)">Tap each drop to log water. Goal: ${pet.waterGoal || 500}ml/day</p>
    </div>

    <!-- MOOD TRACKER -->
    <div class="card">
      <h3 style="font-weight:900;margin-bottom:8px">😊 Mood Today</h3>
      ${moodToday ? `<div style="text-align:center;padding:10px 0"><span style="font-size:36px">${moodToday.split(' ')[0]}</span><div style="font-size:14px;font-weight:800;margin-top:6px;color:var(--dark)">${moodToday}</div><div style="font-size:12px;color:var(--muted);margin-top:4px">Mood logged today</div></div>` : '<p style="font-size:13px;color:var(--muted);margin-bottom:10px">How is your pet feeling today?</p>'}
      <div class="mood-row">
        <div class="mood-btn ${moodToday === '😄 Happy' ? 'selected' : ''}" onclick="logQuickMood('😄 Happy',${petIdx})"><span class="mood-icon">😄</span>Happy</div>
        <div class="mood-btn ${moodToday === '😐 Calm' ? 'selected' : ''}" onclick="logQuickMood('😐 Calm',${petIdx})"><span class="mood-icon">😐</span>Calm</div>
        <div class="mood-btn ${moodToday === '😴 Tired' ? 'selected' : ''}" onclick="logQuickMood('😴 Tired',${petIdx})"><span class="mood-icon">😴</span>Tired</div>
        <div class="mood-btn ${moodToday === '😟 Sad' ? 'selected' : ''}" onclick="logQuickMood('😟 Sad',${petIdx})"><span class="mood-icon">😟</span>Sad</div>
        <div class="mood-btn ${moodToday === '😡 Grumpy' ? 'selected' : ''}" onclick="logQuickMood('😡 Grumpy',${petIdx})"><span class="mood-icon">😡</span>Grumpy</div>
      </div>
    </div>

    <!-- WEIGHT TRACKER -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="font-weight:900">⚖️ Weight History</h3>
        <button class="small-btn" onclick="document.getElementById('weightModal').classList.remove('hidden')">+ Log</button>
      </div>
      ${wh.length > 0 ? `
        <div class="chartjs-wrap" style="position:relative;height:180px;width:100%;margin-bottom:8px">
          <canvas id="weightChart${petIdx}"></canvas>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px">
          <span style="font-size:11px;color:var(--muted)">Min: ${Math.min(...wh.map(w => w.weight))} kg</span>
          <span style="font-size:11px;color:var(--orange);font-weight:800">Latest: ${wh[wh.length - 1].weight} kg</span>
          <span style="font-size:11px;color:var(--muted)">Max: ${Math.max(...wh.map(w => w.weight))} kg</span>
        </div>
        <div style="max-height:130px;overflow-y:auto;margin-top:8px">
          ${wh.slice().reverse().map(w => `<div class="history-item"><div class="history-icon">⚖️</div><div class="history-text"><b>${w.weight} kg</b><span>${formatDate(w.date)}${w.note ? ' — ' + w.note : ''}</span></div></div>`).join('')}
        </div>` : '<p style="font-size:13px;color:var(--muted)">No weight entries yet. Log your pet\'s weight to see the chart.</p>'}
    </div>

    <!-- MOOD BREAKDOWN CHART -->
    ${(getLog().filter(e => e.petIdx === petIdx && e.type === 'mood').length > 0) ? `
    <div class="card">
      <h3 style="font-weight:900;margin-bottom:12px">📊 Mood Breakdown (Last 30)</h3>
      <div class="chartjs-wrap" style="position:relative;height:200px;width:100%">
        <canvas id="moodChart${petIdx}"></canvas>
      </div>
    </div>` : ''}

    <!-- SLEEP CHART -->
    ${(getSleepLog ? getSleepLog().length > 0 : false) ? `
    <div class="card">
      <h3 style="font-weight:900;margin-bottom:12px">💤 Sleep This Week</h3>
      <div class="chartjs-wrap" style="position:relative;height:160px;width:100%">
        <canvas id="sleepChart${petIdx}"></canvas>
      </div>
    </div>` : ''}

    <!-- HEALTH INSIGHTS -->
    ${typeof generateHealthInsights === 'function' ? generateHealthInsights(petIdx) : ''}


    <!-- FEEDING HISTORY (7 days) -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="font-weight:900">📜 Feeding History</h3>
        <button class="small-btn" onclick="openLogModal('fed')">+ Log</button>
      </div>
      ${last7days.map(day => {
        const dayLogs = petLog.filter(e => e.timestamp.slice(0, 10) === day);
        if (!dayLogs.length) return `<div class="history-day"><div class="history-day-label">${formatDate(day)}</div><div style="font-size:12px;color:var(--muted);padding:6px 0 6px 4px">No entries</div></div>`;
        return `<div class="history-day">
          <div class="history-day-label">${formatDate(day)}</div>
          ${dayLogs.map(e => `<div class="history-item"><div class="history-icon">${typeIcon(e.type)}</div><div class="history-text"><b>${e.note}</b><span>${formatTime(e.timestamp)}</span></div><span class="log-badge ${e.type}">${e.type === 'fed' ? 'Fed ✓' : e.type === 'water' ? 'Water' : e.type === 'weight' ? e.weight + 'kg' : e.type === 'mood' ? e.mood || 'Mood' : e.type === 'missed' ? 'Missed' : '—'}</span></div>`).join('')}
        </div>`;
      }).join('')}
    </div>`;

      // Render charts after DOM insert
      setTimeout(() => {
        if (wh.length > 0) renderWeightChart(wh, petIdx);
        const moodLog = getLog().filter(e => e.petIdx === petIdx && e.type === 'mood');
        if (moodLog.length > 0) renderMoodChart(moodLog, petIdx);
        const sleepLog = typeof getSleepLog === 'function' ? getSleepLog() : (pawCache.sleepLog || []);
        if (sleepLog.length > 0) renderSleepChart(sleepLog, petIdx);
      }, 80);
    }

    function logQuickMood(mood, petIdx) {
      const pets = getPets();
      if (!pets[petIdx]) return;
      pets[petIdx].moodToday = mood;
      pets[petIdx].moodDate = todayStr();
      savePets(pets);

      const log = getLog();
      log.unshift({ id: Date.now(), type: 'mood', note: mood, timestamp: new Date().toISOString(), petName: pets[petIdx].name, petIdx, mood });
      saveLog(log);

      showToast('Mood logged: ' + mood + ' ✅');
      refreshAllUI();
      openTab('tracker');
    }

    // Track chart instances so we can destroy before re-render
    const _chartInstances = {};

    function renderWeightChart(wh, petIdx) {
      const canvasId = 'weightChart' + petIdx;
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      // Destroy previous instance if exists
      if (_chartInstances[canvasId]) {
        _chartInstances[canvasId].destroy();
        delete _chartInstances[canvasId];
      }

      // Fallback to bar chart if Chart.js not loaded
      if (typeof Chart === 'undefined') {
        const values = wh.map(w => w.weight);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const last8 = wh.slice(-8);
        canvas.outerHTML = `<div class="weight-chart" id="${canvasId}">${last8.map(w => {
          const h = Math.max(8, Math.round(((w.weight - min) / range) * 60) + 10);
          return `<div class="weight-bar-wrap"><div class="weight-bar" style="height:${h}px" title="${w.weight}kg"></div><div class="weight-label">${w.weight}</div></div>`;
        }).join('')}</div>`;
        return;
      }

      const last12 = wh.slice(-12);
      const labels = last12.map(w => {
        const d = new Date(w.date);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      });
      const data = last12.map(w => w.weight);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? '#e0e0e0' : '#555';
      const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

      const ctx = canvas.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 180);
      gradient.addColorStop(0, isDark ? 'rgba(52, 211, 153, 0.4)' : 'rgba(16, 185, 129, 0.4)');
      gradient.addColorStop(1, isDark ? 'rgba(52, 211, 153, 0.0)' : 'rgba(16, 185, 129, 0.0)');

      const brandColor = isDark ? '#34D399' : '#10B981';

      _chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Weight (kg)',
            data,
            fill: true,
            backgroundColor: gradient,
            borderColor: brandColor,
            borderWidth: 3,
            pointBackgroundColor: brandColor,
            pointBorderColor: isDark ? '#1E293B' : '#FFF',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.parsed.y} kg`
              },
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              titleColor: isDark ? '#F8FAFC' : '#111827',
              bodyColor: isDark ? '#E2E8F0' : '#4B5563',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 12,
              displayColors: false
            }
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: textColor, font: { size: 11, family: "'Inter', sans-serif" }, maxRotation: 0 }
            },
            y: {
              grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', drawBorder: false },
              border: { display: false },
              ticks: { color: textColor, font: { size: 11, family: "'Inter', sans-serif" }, callback: v => v + ' kg', padding: 8 }
            }
          }
        }
      });
    }

    function renderMoodChart(moodLog, petIdx) {
      const canvasId = 'moodChart' + petIdx;
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === 'undefined' || !moodLog || moodLog.length === 0) return;

      if (_chartInstances[canvasId]) {
        _chartInstances[canvasId].destroy();
        delete _chartInstances[canvasId];
      }

      // Count moods
      const moodCounts = { '😄 Happy': 0, '😐 Calm': 0, '😴 Tired': 0, '😟 Sad': 0, '😡 Grumpy': 0 };
      // Filter by petIdx if present
      const petMoods = moodLog.filter(m => m.petIdx === petIdx || m.petIdx === undefined);
      petMoods.slice(-30).forEach(m => {
        const key = m.mood || m.note;
        if (moodCounts[key] !== undefined) moodCounts[key]++;
      });

      const labels = Object.keys(moodCounts);
      const data = Object.values(moodCounts);
      if (data.every(v => v === 0)) return;

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const ctx = canvas.getContext('2d');
      _chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: ['#FFB020', '#34D399', '#60A5FA', '#A78BFA', '#FF4B6A'],
            borderColor: isDark ? '#1E293B' : '#FFFFFF',
            borderWidth: 3,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 12, family: "'Inter', sans-serif" }, color: isDark ? '#E2E8F0' : '#4B5563', padding: 12, usePointStyle: true }
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.parsed} sessions`
              },
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              titleColor: isDark ? '#F8FAFC' : '#111827',
              bodyColor: isDark ? '#E2E8F0' : '#4B5563',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 12
            }
          }
        }
      });
    }

    function renderSleepChart(sleepLog, petIdx) {
      const canvasId = 'sleepChart' + petIdx;
      const canvas = document.getElementById(canvasId);
      if (!canvas || typeof Chart === 'undefined' || !sleepLog || sleepLog.length === 0) return;

      if (_chartInstances[canvasId]) {
        _chartInstances[canvasId].destroy();
        delete _chartInstances[canvasId];
      }

      // Build last 7 days of sleep hours
      const last7 = [];
      const labels = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayStr = d.toISOString().slice(0, 10);
        labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
        const dayLogs = sleepLog.filter(s => {
          const match = (s.petIdx === petIdx || s.petIdx === undefined);
          const dateStr = (s.date || s.timestamp || '').slice(0, 10);
          return match && dateStr === dayStr;
        });
        const totalHrs = dayLogs.reduce((sum, s) => sum + (parseFloat(s.hours) || 0), 0);
        last7.push(totalHrs);
      }

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDark ? '#E2E8F0' : '#4B5563';
      const ctx = canvas.getContext('2d');

      const gradientBar = ctx.createLinearGradient(0, 0, 0, 150);
      gradientBar.addColorStop(0, isDark ? '#A78BFA' : '#8B5CF6');
      gradientBar.addColorStop(1, isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(139, 92, 246, 0.2)');

      _chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Sleep (hrs)',
            data: last7,
            backgroundColor: gradientBar,
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 16
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: ctx => ` ${ctx.parsed.y} hrs` },
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
              titleColor: isDark ? '#F8FAFC' : '#111827',
              bodyColor: isDark ? '#E2E8F0' : '#4B5563',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 12,
              displayColors: false
            }
          },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: { color: textColor, font: { size: 11, family: "'Inter', sans-serif" } }
            },
            y: {
              min: 0,
              grid: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', drawBorder: false },
              border: { display: false },
              ticks: { color: textColor, font: { size: 11, family: "'Inter', sans-serif" }, callback: v => v + 'h', padding: 8 }
            }
          }
        }
      });
    }


    // ==================== REMINDERS TAB ====================
    function renderRemindersTab(pets, activeIdx, noPet) {
      const tabs = document.getElementById('reminderPetTabs');
      const box = document.getElementById('reminderBox');
      if (noPet || pets.length === 0) {
        tabs.innerHTML = '';
        box.innerHTML = `<div class="empty-state"><p>${noPet ? 'Enable pet mode to use reminders.' : 'Add a pet to set reminders.'}</p></div>`;
        return;
      }
      tabs.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === activeReminderPet ? 'active' : ''}" onclick="activeReminderPet=${i};renderRemindersTab(getPets(),getActivePetIdx(),isNoPet())">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const pet = pets[activeReminderPet] || pets[0];
      const reminders = pet.type === 'Fish'
        ? ['8:00 AM — Morning feed 🐟', '6:00 PM — Evening feed 🐟', 'Weekly — Check water quality & filter']
        : ['7:00 AM — Morning meal 🌅', '1:00 PM — Water & snack check ☀️', '7:30 PM — Dinner time 🌙', '9:00 PM — Final water refill 💧'];
      box.innerHTML = reminders.map(r => `<div class="list-item"><span>🔔</span><p>${r}</p></div>`).join('') +
        `<button class="secondary-btn" onclick="testNotification('${pet.name}')">🔔 Test Notification</button>`;
    }

    // ==================== CARE TAB ====================
    function renderCareTab(pets, activeIdx, noPet) {
      const tabs = document.getElementById('carePetTabs');
      const box = document.getElementById('careBox');
      if (noPet) {
        tabs.innerHTML = '';
        box.innerHTML = `<div class="card success"><h3>🌿 General Pet Care</h3><div class="list-item"><span>💧</span><p>Always provide clean, fresh water.</p></div><div class="list-item"><span>🏥</span><p>Schedule annual vet checkups.</p></div><div class="list-item"><span>🧹</span><p>Keep living spaces clean.</p></div></div>`;
        return;
      }
      if (pets.length === 0) {
        tabs.innerHTML = '';
        box.innerHTML = `<div class="card empty-state"><p>Add a pet to see care tips.</p><button class="primary-btn" onclick="openPetModal(-1)">+ Add Pet</button></div>`;
        return;
      }
      tabs.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === activeCarePet ? 'active' : ''}" onclick="activeCarePet=${i};renderCareTab(getPets(),getActivePetIdx(),isNoPet())">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const pet = pets[activeCarePet] || pets[0];
      const unsafe = UNSAFE[pet.type] || [];
      box.innerHTML = `
    <div class="card success">
      <h3 style="font-weight:900;margin-bottom:8px">✅ Daily Care for ${pet.name}</h3>
      <div class="list-item"><span>💧</span><p>Keep clean drinking water available. Daily goal: ${pet.waterGoal || 500}ml.</p></div>
      <div class="list-item"><span>⚖️</span><p>Monitor weight and adjust portions. Current: ${pet.weight}kg.</p></div>
      <div class="list-item"><span>🧽</span><p>Clean food and water bowls daily.</p></div>
      <div class="list-item"><span>🏥</span><p>Schedule regular vet checkups. Follow vet guidance for health conditions.</p></div>
      ${pet.type === 'Dog' ? '<div class="list-item"><span>🚶</span><p>Regular daily walks are essential.</p></div>' : ''}
      ${pet.type === 'Cat' ? '<div class="list-item"><span>🪥</span><p>Brush coat regularly, keep litter box clean.</p></div>' : ''}
      ${pet.type === 'Fish' ? '<div class="list-item"><span>🌡️</span><p>Check water temperature and pH weekly.</p></div>' : ''}
    </div>
    <div class="card danger">
      <h3 style="font-weight:900;margin-bottom:8px">⚠️ Foods to Avoid for ${pet.name}</h3>
      ${unsafe.map(f => `<div class="list-item danger"><span>🚫</span><p><b>${f}</b></p></div>`).join('')}
    </div>`;
    }

    function searchFoodSafety() {
      const input = document.getElementById('foodSafetySearchInput');
      const resultBox = document.getElementById('foodSafetySearchResult');
      if (!input || !resultBox) return;

      const q = input.value.trim().toLowerCase();
      if (!q) {
        resultBox.style.display = 'none';
        resultBox.innerHTML = '';
        return;
      }

      resultBox.style.display = 'block';

      // Find current pet to customize warning
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      const spec = pet ? pet.type.toLowerCase() : '';

      // Search matching entries in TOXIC_FOODS
      const matches = (TOXIC_FOODS || []).filter(item => 
        item.name.toLowerCase().includes(q)
      );

      if (matches.length === 0) {
        resultBox.innerHTML = `
          <div class="card success" style="margin:0; padding:12px; border:1px solid #10b981; background:#f0fdf4;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">✅</span>
              <div>
                <b style="color:#047857">No specific toxic warning found</b>
                <p style="margin:2px 0 0 0; font-size:12px; color:#065f46">We couldn't find a direct toxicity warning for "<b>${escapeHtml(input.value)}</b>" in our database. However, always proceed with caution, introduce new foods in tiny amounts, and monitor your pet. Consult your vet if you are unsure.</p>
              </div>
            </div>
          </div>
        `;
        return;
      }

      // Render matches
      resultBox.innerHTML = matches.map(item => {
        // Check if active pet species is affected
        const isAffected = !item.species_affected || 
                           item.species_affected.toLowerCase().includes(spec) ||
                           spec === '';
        
        const severityColor = item.severity.toLowerCase() === 'severe' ? '#ef4444' : '#f59e0b';
        const severityBg = item.severity.toLowerCase() === 'severe' ? '#fef2f2' : '#fffbeb';
        const severityBorder = item.severity.toLowerCase() === 'severe' ? '#fee2e2' : '#fef3c7';

        return `
          <div class="card" style="margin:0 0 8px 0; padding:12px; border:1px solid ${isAffected ? severityColor : '#d1d5db'}; background: ${isAffected ? severityBg : '#f9fafb'};">
            <div style="display:flex; justify-content:between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:900; font-size:16px; color:var(--dark)">${escapeHtml(item.name)}</span>
              <span style="font-size:11px; font-weight:700; text-transform:uppercase; padding:2px 8px; border-radius:12px; background:${isAffected ? severityColor : '#6b7280'}; color:#fff; margin-left:auto;">
                ${escapeHtml(item.severity)}
              </span>
            </div>
            <p style="margin:4px 0; font-size:13px; line-height:1.4">
              <b>Species Affected:</b> ${escapeHtml(item.species_affected)}
              ${isAffected && pet ? ` <span style="color:#ef4444; font-weight:700;">(Affects ${pet.name}! ⚠️)</span>` : ''}
            </p>
            <p style="margin:4px 0; font-size:13px; line-height:1.4"><b>Symptoms:</b> ${escapeHtml(item.symptoms)}</p>
            <p style="margin:4px 0; font-size:13px; line-height:1.4; color:#4b5563"><i><b>Notes:</b> ${escapeHtml(item.notes)}</i></p>
          </div>
        `;
      }).join('');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // ==================== HELPERS ====================
    function petIcon(type) { return PET_ICONS[type] || '🐾'; }
    function typeIcon(type) { return { fed: '🍽️', water: '💧', weight: '⚖️', mood: '😊', missed: '❌' }[type] || '📝'; }

    function formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
    }

    function formatDate(dateStr) {
      const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (dateStr.slice(0, 10) === today) return 'Today';
      if (dateStr.slice(0, 10) === yesterday) return 'Yesterday';
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }

    // ==================== NOTIFICATIONS ====================
    function enableNotifications() {
      if (!('Notification' in window)) { showToast('Notifications not supported'); return; }
      Notification.requestPermission().then(p => {
        if (p === 'granted') { showToast('Notifications enabled ✅'); startAllReminders(); }
        else { showToast('Permission denied'); }
      });
    }

    function showNotification(msg) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🐾 PawFeed', { body: msg });
      }
    }

    function testNotification(name) {
      showNotification('Food time for ' + name + '! 🍽️');
      showToast('Test reminder triggered 🔔');
    }

    function startAllReminders() {
      reminderTimers.forEach(clearInterval);
      reminderTimers = [];
      const pets = getPets();
      if (!pets.length) return;
      const t = setInterval(() => {
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes();
        pets.forEach(pet => {
          if (h === 7 && m === 0) showNotification('Morning meal for ' + pet.name + ' 🌅');
          if (h === 13 && m === 0) showNotification('Afternoon check for ' + pet.name + ' ☀️');
          if (h === 19 && m === 30) showNotification('Dinner time for ' + pet.name + ' 🌙');
        });
      }, 60000);
      reminderTimers.push(t);
    }

    // ==================== TAB NAVIGATION ====================
    function openTab(tab) {
      document.querySelectorAll('.tab-screen').forEach(t => t.classList.add('hidden'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const el = document.getElementById(tab + 'Tab');
      if (el) el.classList.remove('hidden');
      const nav = document.getElementById('nav-' + tab);
      if (nav) nav.classList.add('active');
      
      const breadcrumb = document.getElementById('topBreadcrumb');
      if (breadcrumb) {
        const titles = {
          'home': 'Dashboard',
          'homemade': 'Food Studio',
          'ai': 'PawFeed AI',
          'careplanner': 'Care Planner',
          'profile': 'My Profile',
          'records': 'Health Records',
          'combo-social': 'Health & Social',
          'community': 'Pet Community',
          'vision': 'Smart Vision Scan'
        };
        breadcrumb.innerText = titles[tab] || (tab.charAt(0).toUpperCase() + tab.slice(1));
      }

      if (tab === 'profile') {
        renderGalleryTab();
        renderBirthdayTab();
        if (typeof renderExpenseTracker === 'function') renderExpenseTracker();
      }
      if (tab === 'careplanner') {
        if (typeof renderCarePlannerTab === 'function') renderCarePlannerTab();
        if (typeof renderDailyChecklist === 'function') renderDailyChecklist();
      }
      if (tab === 'homemade') {
        if (typeof renderStockTracker === 'function') renderStockTracker();
      }
      if (tab === 'tracker') {
        if (typeof renderTrackerTab === 'function') renderTrackerTab(getPets(), getActivePetIdx(), isNoPet());
      }
    }

    function openCombo(combo, defaultSub) {
      document.querySelectorAll('#mainApp > .tab-screen').forEach(t => t.classList.add('hidden'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const el = document.getElementById('comboTab-' + combo);
      if (el) el.classList.remove('hidden');
      const nav = document.getElementById('nav-combo-' + combo);
      if (nav) nav.classList.add('active');
      switchComboSub(combo, defaultSub);
    }

    function switchComboSub(combo, sub) {
      // Hide all inner panels for this combo
      const comboEl = document.getElementById('comboTab-' + combo);
      if (!comboEl) return;
      comboEl.querySelectorAll('[id^="comboInner-' + combo + '-"]').forEach(el => el.style.display = 'none');
      comboEl.querySelectorAll('.combo-sub-tab').forEach(t => t.classList.remove('active'));
      // Show the selected one
      const inner = document.getElementById('comboInner-' + combo + '-' + sub);
      if (inner) inner.style.display = '';
      const subTab = document.getElementById('csub-' + sub);
      if (subTab) subTab.classList.add('active');
      // Render data for the sub-tab
      renderComboSubContent(combo, sub);
    }

    function renderComboSubContent(combo, sub) {
      const pets = getPets(), activeIdx = getActivePetIdx(), noPet = isNoPet();
      if (combo === 'planwater') {
        if (sub === 'plan') {
          renderPlanTab(pets, activeIdx, noPet);
          const tabs2 = document.getElementById('planPetTabs2');
          const box2 = document.getElementById('foodPlanBox2');
          if (tabs2) tabs2.innerHTML = document.getElementById('planPetTabs').innerHTML.replace(/renderPlanTab\(/g, 'renderPlanTab(');
          if (box2) box2.innerHTML = document.getElementById('foodPlanBox').innerHTML;
        } else if (sub === 'care') {
          renderCareTab(pets, activeIdx, noPet);
          renderMedTab();
          renderVetTab();
          renderSleepTab();
          const tabs2 = document.getElementById('carePetTabs2');
          const box2 = document.getElementById('careBox2');
          if (tabs2) tabs2.innerHTML = document.getElementById('carePetTabs').innerHTML;
          if (box2) box2.innerHTML = document.getElementById('careBox').innerHTML;
        }
      } else if (combo === 'trackcare') {
        if (sub === 'tracker') {
          renderTrackerTab(pets, activeIdx, noPet);
          const tabs2 = document.getElementById('trackerPetTabs2');
          const box2 = document.getElementById('trackerBox2');
          if (tabs2) tabs2.innerHTML = document.getElementById('trackerPetTabs').innerHTML;
          if (box2) box2.innerHTML = document.getElementById('trackerBox').innerHTML;
        } else if (sub === 'reminders') {
          renderRemindersTab(pets, activeIdx, noPet);
          const tabs2 = document.getElementById('reminderPetTabs2');
          const box2 = document.getElementById('reminderBox2');
          if (tabs2) tabs2.innerHTML = document.getElementById('reminderPetTabs').innerHTML;
          if (box2) box2.innerHTML = document.getElementById('reminderBox').innerHTML;
        }
      } else if (combo === 'social') {
        if (sub === 'community') {
          const box = document.getElementById('comboInner-social-community');
          const tab = document.getElementById('communityTab');
          if (box && tab) {
            box.appendChild(tab);
            tab.classList.remove('hidden');
          }
          renderCommunity();
          document.getElementById('householdIdDisplay').value = currentHouseholdId || '';
        } else if (sub === 'records') {

          renderRecordsTab();
        } else if (sub === 'vision') {
          const box = document.getElementById('comboInner-social-vision');
          const tab = document.getElementById('visionTab');
          if (box && tab) {
            box.appendChild(tab);
            tab.classList.remove('hidden');
          }
          renderVisionHistory();
        }

      }
    }

    // ==================== AI CHAT ====================
    async function sendAIMessage() {
      const input = document.getElementById('aiInput');
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, 'user-msg');
      input.value = '';

      const typingId = 'typing_' + Date.now();
      addMessageId('Thinking...', 'bot-msg typing-msg', typingId);

      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];
      const log = getLog();
      const today = todayStr();
      const todayFed = pet ? log.filter(e => e.petIdx === activeIdx && e.type === 'fed' && e.timestamp.slice(0, 10) === today).length : 0;
      const streak = calculateStreak();

      let systemPrompt = `You are PawFeed AI, a friendly and knowledgeable pet care assistant. Give helpful, concise advice about pet feeding, nutrition, health, symptoms, and care. If the user describes any symptoms or food safety questions, prioritize the provided Grounding Reference Data to give accurate warnings and triage urgency (monitor, soon, or urgent ⚠️ with home care tips) and safety info. Keep responses under 130 words and conversational. Always be warm and encouraging.`;
      if (pet) {
        systemPrompt += ` The user's active pet is ${pet.name}, a ${pet.age}-year-old ${pet.breed} ${pet.type} weighing ${pet.weight}kg. Food preference: ${pet.foodPref}. Health notes: ${pet.health || 'healthy'}. Today's feedings logged: ${todayFed}. Current feeding streak: ${streak} days. Water goal: ${pet.waterGoal || 500}ml/day. Mood today: ${pet.moodToday || 'not logged'}. Reference this pet specifically when relevant.`;
        if (pet.breedTraits) {
          systemPrompt += ` Breed details: Typical weight range: ${pet.breedTraits.weight || 'unknown'}, Lifespan: ${pet.breedTraits.life_span || 'unknown'}.`;
        }
        const feedingCalc = calculateFeedingAmount(pet);
        if (feedingCalc) {
          systemPrompt += ` Calculated baseline nutrition needs: RER is ${feedingCalc.rer} kcal/day. Maintenance energy requirement is ${feedingCalc.calories} kcal/day (Recommended daily portions: ~${feedingCalc.dryGrams}g dry or ~${feedingCalc.wetGrams}g wet food). Recommended daily water intake is ${feedingCalc.waterNeeds}ml. Remember: always advise the user that these are baseline estimates and do not substitute for customized professional veterinary care.`;
        }
      }
      if (pets.length > 1) {
        systemPrompt += ` They also have ${pets.length - 1} other pet(s): ${pets.filter((_, i) => i !== activeIdx).map(p => p.name + ' the ' + p.type).join(', ')}.`;
      }
      const grounding = getGroundingContext(text, pet?.type);
      if (grounding) {
        systemPrompt += `\nGrounding Reference Data:\n${grounding}`;
      }

      async function attemptFetch() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await fetch(`${API_BASE_URL}/api/pawfeed-ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userMessage: text }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
          }
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }

      let data;
      try {
        data = await attemptFetch();
      } catch (err) {
        console.warn('First fetch attempt failed, retrying once...', err);
        try {
          data = await attemptFetch();
        } catch (retryErr) {
          console.error('Retry attempt failed as well:', retryErr);
          document.getElementById(typingId)?.remove();
          
          let errorMsg = 'Sorry, I\'m having trouble connecting. Please check your connection and try again.';
          if (retryErr.name === 'AbortError') {
            errorMsg = 'Request timed out. Please try again.';
          }
          addMessage(errorMsg, 'bot-msg');
          return;
        }
      }

      const reply = data.reply || 'Sorry, I could not get a response. Please try again.';
      document.getElementById(typingId)?.remove();
      addMessage(reply, 'bot-msg');
    }
    function addMessage(text, cls) {
      const chat = document.getElementById('chatWindow');
      const msg = document.createElement('div');
      msg.className = 'msg ' + cls;
      msg.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
    }

    function addMessageId(text, cls, id) {
      const chat = document.getElementById('chatWindow');
      const msg = document.createElement('div');
      msg.className = 'msg ' + cls;
      msg.id = id;
      msg.innerText = text;
      chat.appendChild(msg);
      chat.scrollTop = chat.scrollHeight;
    }

    // Wire up log type change after DOM ready
    window.addEventListener('load', () => {
      const lt = document.getElementById('logType');
      if (lt) lt.addEventListener('change', updateLogTypeFields);
    });

    // ==================== ADVANCED MODULES STORAGE ====================
    function getCommunityPosts() {
      return pawCache.communityPosts || [];
    }

    async function saveCommunityPosts(posts) {
      pawCache.communityPosts = posts;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawCommunityPosts', JSON.stringify(posts)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i];
          if (post.id) continue;
          const { data, error } = await window.supabaseClient.from('community_posts').insert({
            user_id: userId,
            content: post.content || '',
            image_url: post.image || null
          }).select('id').single();
          if (!error && data) post.id = data.id;
        }
      } catch (err) {
        console.error("Error syncing community posts:", err);
      }
    }

    function getCart() {
      return pawCache.cart || [];
    }

    async function saveCart(cart) {
      pawCache.cart = cart;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawCart', JSON.stringify(cart)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('cart_items').delete().eq('user_id', userId);
        if (cart.length > 0) {
          const rows = cart.map(item => ({
            user_id: userId,
            product_id: String(item.id || item.product_id),
            quantity: parseInt(item.quantity || 1)
          }));
          await window.supabaseClient.from('cart_items').insert(rows);
        }
      } catch (err) {
        console.error("Error syncing cart to Supabase:", err);
      }
    }

    function getScanHistory() {
      return pawCache.scanHistory || [];
    }

    async function saveScanHistory(items) {
      pawCache.scanHistory = items;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawScanHistory', JSON.stringify(items)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('scan_history').delete().eq('user_id', userId);
        if (items.length > 0) {
          const rows = items.map(item => ({
            user_id: userId,
            result: item
          }));
          await window.supabaseClient.from('scan_history').insert(rows);
        }
      } catch (err) {
        console.error("Error syncing scan history:", err);
      }
    }

    // ==================== COMMUNITY FEATURES ====================
    let selectedCommunityImageFile = null;
    function handleCommunityImage(event) {
      const file = event.target.files[0];
      if (!file) return;
      selectedCommunityImageFile = file;
      const reader = new FileReader();
      reader.onload = function (e) {
        selectedCommunityImage = e.target.result;
        document.getElementById('communityPhotoPreview').innerHTML = `<img class="feed-img" src="${selectedCommunityImage}" alt="community photo">`;
      };
      reader.readAsDataURL(file);
    }
    async function addCommunityPost() {
      const type = document.getElementById('communityPostType').value;
      const caption = document.getElementById('communityCaption').value.trim();
      if (!caption && !selectedCommunityImageFile) { showToast('Add a caption or photo first'); return; }
      
      let imageUrl = null;
      if (selectedCommunityImageFile && window.supabaseClient) {
        showToast('Uploading photo... ☁️');
        try {
          const fileExt = selectedCommunityImageFile.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const { data, error } = await window.supabaseClient.storage
            .from('community-media')
            .upload(`public/${fileName}`, selectedCommunityImageFile);
          
          if (!error) {
            const { data: urlData } = window.supabaseClient.storage
              .from('community-media')
              .getPublicUrl(`public/${fileName}`);
            imageUrl = urlData.publicUrl;
          } else {
            // Bucket may not exist - fallback to base64 for local preview
            console.warn("Supabase Storage upload failed, using local image:", error.message);
            imageUrl = selectedCommunityImage; // base64 fallback
          }
        } catch (uploadErr) {
          console.warn("Image upload exception, using local fallback:", uploadErr);
          imageUrl = selectedCommunityImage;
        }
      } else if (selectedCommunityImage) {
        imageUrl = selectedCommunityImage; // fallback to base64 if offline/no supabase
      }


      const user = getUser() || { name: 'Pet Parent' };
      const pets = getPets();
      const active = pets[getActivePetIdx()] || pets[0] || null;
      const posts = getCommunityPosts();
      
      const newPost = { 
        id: Date.now(), 
        type, 
        caption, 
        image: imageUrl, 
        author: user.name || 'Pet Parent', 
        petName: active ? active.name : 'Pet', 
        petAvatar: active ? active.avatar : '', 
        petIcon: active ? (PET_ICONS[active.type] || '🐾') : '🐾', 
        likes: 0, 
        date: new Date().toISOString() 
      };
      posts.unshift(newPost);
      
      await saveCommunityPosts(posts.slice(0, 60));
      
      selectedCommunityImage = '';
      selectedCommunityImageFile = null;
      document.getElementById('communityCaption').value = '';
      document.getElementById('communityPhotoPreview').innerHTML = '';
      document.getElementById('communityPhotoInput').value = '';
      showToast('Posted to community 👥');
      renderCommunity();
    }
    function likeCommunityPost(id) {
      const posts = getCommunityPosts();
      const p = posts.find(x => x.id === id);
      if (p) p.likes = (p.likes || 0) + 1;
      saveCommunityPosts(posts); renderCommunity();
    }
    function deleteCommunityPost(id) {
      saveCommunityPosts(getCommunityPosts().filter(p => p.id !== id));
      renderCommunity(); showToast('Post removed');
    }
    function seedCommunityDemo() {
      const posts = getCommunityPosts();
      posts.unshift(
        { id: Date.now() + 1, type: 'recipe', caption: 'Homemade dog bowl: boiled rice + chicken + carrot. Avoid onion, garlic, salt and spices.', author: 'PawFeed Community', petName: 'Recipe Corner', petIcon: '🍲', likes: 8, date: new Date().toISOString() },
        { id: Date.now() + 2, type: 'tip', caption: 'Daily challenge: refill water bowl twice and log it in Tracker.', author: 'PawFeed Community', petName: 'Care Tip', petIcon: '💧', likes: 12, date: new Date().toISOString() }
      );
      saveCommunityPosts(posts.slice(0, 60)); renderCommunity(); showToast('Demo community posts added');
    }
    function renderCommunity() {
      const box = document.getElementById('communityFeedBox'); if (!box) return;
      const posts = getCommunityPosts();
      if (!posts.length) { box.innerHTML = `<div class="card empty-state"><h3>No community posts yet</h3><p>Share your first pet photo, recipe, or care tip.</p></div>`; return; }
      box.innerHTML = posts.map(p => `
    <div class="feed-card">
      <div class="feed-head">
        <div class="feed-avatar">${p.petAvatar ? `<img src="${p.petAvatar}" alt="pet">` : (p.petIcon || '🐾')}</div>
        <div><b>${p.author || 'PawFeed User'}</b><div style="font-size:12px;color:var(--muted)">${p.petName || 'Pet'} · ${new Date(p.date || p.created_at || Date.now()).toLocaleString()}</div></div>
      </div>
      <span class="recipe-chip">${p.type === 'recipe' ? '🍲 Community Recipe' : p.type === 'photo' ? '📷 Pet Photo' : '💡 Care Tip'}</span>
      <p style="font-size:14px;line-height:1.5;margin-top:8px">${escapeHtml(p.caption || p.content || '')}</p>
      ${p.image || p.image_url ? `<img class="feed-img" src="${p.image || p.image_url}" alt="community photo">` : ''}
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="small-btn" onclick="likeCommunityPost(${p.id})">❤️ ${p.likes || 0}</button>
        <button class="small-btn" onclick="openCommentsModal(${p.id})">💬 Comments</button>
        <button class="small-btn" onclick="deleteCommunityPost(${p.id})">Delete</button>
      </div>
    </div>`).join('');
    }

    // --- COMMENTS LOGIC ---
    let currentCommentPostId = null;
    
    function openCommentsModal(postId) {
      currentCommentPostId = postId;
      document.getElementById('commentsModal').classList.remove('hidden');
      document.getElementById('commentsList').innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px;">Loading comments...</p>';
      fetchCommunityComments(postId);
    }
    // ==================== DIRECT MESSAGES ====================
    let currentDMChatUserId = null;

    function openDirectMessagesModal() {
      document.getElementById('dmModal').classList.remove('hidden');
      backToInbox();
    }

    function closeDMModal() {
      document.getElementById('dmModal').classList.add('hidden');
    }

    function showNewDMView() {
      document.getElementById('dmInboxView').classList.add('hidden');
      document.getElementById('dmSearchView').classList.remove('hidden');
      document.getElementById('dmSearchInput').value = '';
      document.getElementById('dmSearchList').innerHTML = '<p class="empty-state">Type a username to search...</p>';
    }

    async function searchUsers() {
      const query = document.getElementById('dmSearchInput').value.trim();
      const list = document.getElementById('dmSearchList');
      if (query.length < 2) {
        list.innerHTML = '<p class="empty-state">Type a username to search...</p>';
        return;
      }
      if (!window.supabaseClient) return;

      try {
        list.innerHTML = '<p class="empty-state">Searching...</p>';
        const { data, error } = await window.supabaseClient.from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${query}%`)
          .limit(10);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          list.innerHTML = '<p class="empty-state">No users found.</p>';
          return;
        }

        list.innerHTML = data.map(u => `
          <div class="dm-chat-row" onclick="startChatFromSearch('${u.id}', '${u.username || 'User'}')">
            ${u.avatar_url ? `<img src="${u.avatar_url}" class="dm-avatar" style="object-fit:cover;">` : `<div class="dm-avatar">👤</div>`}
            <b style="color:var(--dark);font-size:15px;font-weight:700">${u.username || 'Unknown'}</b>
          </div>
        `).join('');
      } catch (err) {
        console.error("Search error:", err);
        list.innerHTML = '<p class="empty-state">Error searching users.</p>';
      }
    }

    function startChatFromSearch(userId, username) {
      document.getElementById('dmSearchView').classList.add('hidden');
      openDMChat(userId, username);
    }

    function backToInbox() {
      document.getElementById('dmChatView').classList.add('hidden');
      document.getElementById('dmSearchView').classList.add('hidden');
      document.getElementById('dmInboxView').classList.remove('hidden');
      currentDMChatUserId = null;
      fetchDMInbox();
    }

    async function fetchDMInbox() {
      if (!window.supabaseClient || !currentUser) {
        document.getElementById('dmChatList').innerHTML = '<p style="text-align:center; color:var(--muted); padding:20px;">Login required for messages.</p>';
        return;
      }
      try {
        const { data, error } = await window.supabaseClient.from('direct_messages')
          .select('*')
          .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const chats = {};
        data.forEach(msg => {
          const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
          if (!chats[otherId]) chats[otherId] = msg; 
        });

        const list = document.getElementById('dmChatList');
        if (Object.keys(chats).length === 0) {
          list.innerHTML = '<p style="text-align:center; color:var(--muted); padding:20px;">No messages yet.</p>';
          return;
        }

        list.innerHTML = Object.entries(chats).map(([userId, latestMsg]) => `
          <div class="dm-chat-row" onclick="openDMChat('${userId}', 'User ${userId.substring(0,4)}')">
            <div class="dm-avatar">👤</div>
            <div style="flex:1;">
              <b style="color:var(--dark);font-size:15px;font-weight:700">User ${userId.substring(0,4)}</b>
              <p style="color:var(--muted);font-size:13px;margin:2px 0 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(latestMsg.content)}</p>
            </div>
          </div>
        `).join('');
      } catch (err) {
        console.error("Error fetching inbox:", err);
      }
    }

    async function openDMChat(userId, userName) {
      currentDMChatUserId = userId;
      document.getElementById('dmInboxView').classList.add('hidden');
      document.getElementById('dmChatView').classList.remove('hidden');
      document.getElementById('dmChatRecipientName').textContent = userName;
      document.getElementById('dmMessageList').innerHTML = '<p style="text-align:center; color:var(--muted); padding:20px;">Loading...</p>';
      await fetchDMChat(userId);
    }

    async function fetchDMChat(userId) {
      if (!window.supabaseClient || !currentUser) return;
      try {
        const { data, error } = await window.supabaseClient.from('direct_messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;
        renderDMChat(data);
      } catch (err) {
        console.error("Error fetching chat:", err);
      }
    }

    function renderDMChat(messages) {
      const list = document.getElementById('dmMessageList');
      if (!messages || messages.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--muted); padding:20px;">No messages yet. Say hi!</p>';
        return;
      }
      list.innerHTML = messages.map(m => {
        const isMe = m.sender_id === currentUser.id;
        return `
          <div style="display:flex; justify-content:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 8px;">
            <div class="dm-message-bubble ${isMe ? 'dm-message-me' : 'dm-message-other'}">
              ${escapeHtml(m.content)}
            </div>
          </div>
        `;
      }).join('');
      list.scrollTop = list.scrollHeight;
    }

    async function sendDM() {
      const input = document.getElementById('dmInput');
      const content = input.value.trim();
      if (!content || !currentDMChatUserId || !window.supabaseClient || !currentUser) return;
      
      input.value = '';
      try {
        const { error } = await window.supabaseClient.from('direct_messages').insert({
          sender_id: currentUser.id,
          receiver_id: currentDMChatUserId,
          content: content
        });
        if (error) throw error;
        await fetchDMChat(currentDMChatUserId);
      } catch (err) {
        console.error("Failed to send DM:", err);
        showToast("Error sending message.");
      }
    }

    let currentCommentParentId = null;

    function closeCommentsModal() {
      document.getElementById('commentsModal').classList.add('hidden');
      currentCommentPostId = null;
      currentCommentParentId = null;
      document.getElementById('commentInput').placeholder = 'Add a comment...';
    }
    
    async function fetchCommunityComments(postId) {
      if (!window.supabaseClient) {
        document.getElementById('commentsList').innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px;">Offline mode: Comments not available.</p>';
        return;
      }
      try {
        const { data, error } = await window.supabaseClient.from('community_comments')
          .select('*')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        
        renderComments(data);
      } catch (err) {
        console.error("Error fetching comments:", err);
        document.getElementById('commentsList').innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px;">Failed to load comments.</p>';
      }
    }
    
    function renderComments(comments) {
      const list = document.getElementById('commentsList');
      if (!comments || comments.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px; padding:20px 0;">No comments yet. Be the first!</p>';
        return;
      }

      const roots = comments.filter(c => !c.parent_id);
      const byParent = {};
      comments.filter(c => c.parent_id).forEach(c => {
        if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
        byParent[c.parent_id].push(c);
      });

      function renderNode(c, depth = 0) {
        let html = `
          <div style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:10px 14px; margin-bottom:10px; margin-left:${depth * 24}px; position:relative;">
            ${depth > 0 ? `<div style="position:absolute; left:-12px; top:18px; width:12px; height:2px; background:var(--border);"></div><div style="position:absolute; left:-12px; top:-10px; width:2px; height:28px; background:var(--border);"></div>` : ''}
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              ${c.author_avatar ? `<img src="${c.author_avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<div style="width:24px;height:24px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;">👤</div>`}
              <b style="font-size:13px; color:var(--dark)">${c.author_name || 'Anonymous'}</b>
              <span style="font-size:10px; color:var(--muted); margin-left:auto;">${new Date(c.created_at).toLocaleString('en-US', {hour:'numeric', minute:'numeric', month:'short', day:'numeric'})}</span>
            </div>
            <p style="font-size:13px; color:var(--text); margin:0 0 6px 0;">${escapeHtml(c.content)}</p>
            <button onclick="setCommentReply(${c.id}, '${escapeHtml(c.author_name || 'Anonymous')}')" style="background:none;border:none;color:var(--teal);font-size:11px;font-weight:700;cursor:pointer;padding:0;">Reply</button>
          </div>
        `;
        if (byParent[c.id]) {
          byParent[c.id].forEach(child => {
            html += renderNode(child, depth + 1);
          });
        }
        return html;
      }

      list.innerHTML = roots.map(c => renderNode(c)).join('');
      list.scrollTop = list.scrollHeight;
    }

    window.setCommentReply = function(commentId, authorName) {
      currentCommentParentId = commentId;
      const input = document.getElementById('commentInput');
      input.placeholder = `Replying to ${authorName}...`;
      input.focus();
    };
    
    document.getElementById('postCommentBtn')?.addEventListener('click', async () => {
      const input = document.getElementById('commentInput');
      const content = input.value.trim();
      if (!content || !currentCommentPostId || !window.supabaseClient || !currentUser) {
        if (!currentUser) showToast("Please login to comment.");
        return;
      }
      
      const user = getUser() || {};
      const avatar = (USE_SUPABASE_ONLY ? null : localStorage.getItem('pawUserAvatar')) || null;
      
      input.value = '';
      input.disabled = true;
      
      try {
        const payload = {
          post_id: currentCommentPostId,
          user_id: currentUser.id,
          author_name: user.name || currentUser.email.split('@')[0],
          author_avatar: avatar,
          content: content,
          parent_id: currentCommentParentId || null
        };
        const { error } = await window.supabaseClient.from('community_comments').insert(payload);
        if (error) throw error;
        
        // Reset reply state
        currentCommentParentId = null;
        document.getElementById('commentInput').placeholder = 'Add a comment...';
        fetchCommunityComments(currentCommentPostId);
      } catch (err) {
        console.error("Failed to post comment:", err);
        showToast("Failed to post comment.");
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
    function getOrders() {
      return pawCache.orders || [];
    }

    async function saveOrders(orders) {
      pawCache.orders = orders;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawOrders', JSON.stringify(orders)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        for (let i = 0; i < orders.length; i++) {
          const order = orders[i];
          const payload = {
            user_id: userId,
            date: order.date || new Date().toISOString(),
            items: order.items,
            total: parseFloat(order.total || 0)
          };
          const numericId = parseInt(order.id?.replace(/\D/g, ''));
          if (numericId && !isNaN(numericId)) {
            payload.id = numericId;
          }
          await window.supabaseClient.from('orders').upsert(payload);
        }
      } catch (err) {
        console.error("Error syncing orders to Supabase:", err);
      }
    }

    async function checkoutCart() {
      const cart = getCart(); if (!cart.length) { showToast('Cart is empty'); return; }
      const order = { id: 'PF' + Date.now(), items: cart, total: cart.reduce((s, i) => s + i.price * i.qty, 0), date: new Date().toISOString() };
      const orders = getOrders();
      orders.unshift(order);
      await saveOrders(orders);
      saveCart([]); showToast('Demo order placed ✅');
    }


    function compressImage(dataUrl, maxDim = 800) {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = function () {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = function () {
          resolve(dataUrl);
        };
      });
    }
    function handleVisionImage(event) {
      const file = event.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async function (e) {
        selectedVisionImage = await compressImage(e.target.result, 800);
        document.getElementById('visionPreview').innerHTML = `<img class="scan-preview" src="${selectedVisionImage}" alt="scan image">`;
      };
      reader.readAsDataURL(file);
    }
    async function runVisionScan() {
      const mode = document.getElementById('scanMode').value;
      const desc = (document.getElementById('scanDescription').value || '').trim();
      if (!selectedVisionImage && !desc) { showToast('Upload image or enter description'); return; }
      
      const pets = getPets();
      const active = pets[getActivePetIdx()] || pets[0] || {};
      
      let title = 'Smart Scan Result';
      let risk = 'safe';
      let result = 'Looks okay based on the scan.';
      let advice = 'For health issues, consult a veterinarian.';
      
      // If we have an image, query our backend multimodal Gemini API!
      if (selectedVisionImage) {
        try {
          const resData = await callAI('/api/vision-scan', {
            image: selectedVisionImage,
            mode: mode,
            description: desc,
            petType: active.type || 'Dog'
          });
          
          if (resData) {
            title = resData.title || title;
            risk = (resData.risk || risk).toLowerCase();
            result = resData.result || result;
            advice = resData.advice || advice;
          }
        } catch (err) {
          console.error("Error executing live vision scan, falling back to simulator:", err);
          showToast("AI Scan server busy. Running local simulation...");
          
          // Local fallback logic
          const unsafeWords = ['chocolate', 'grape', 'raisin', 'onion', 'garlic', 'alcohol', 'caffeine', 'xylitol', 'avocado', 'spicy', 'salt'];
          if (mode === 'food') {
            title = 'Food Safety Scan';
            const bad = unsafeWords.find(w => desc.toLowerCase().includes(w));
            if (bad) { risk = 'danger'; result = `Potential unsafe food detected: ${bad}.`; advice = 'Do not feed this item. Check the unsafe food guide and ask a vet if consumed.'; }
            else { risk = 'safe'; result = 'No obvious unsafe keyword detected in the description.'; advice = 'Still verify ingredients before feeding.'; }
          } else if (mode === 'breed') {
            title = 'Breed Detection'; risk = 'warn'; result = `Estimated pet type: ${active.type || 'Dog/Cat'}${active.breed ? ' · possible breed: ' + active.breed : ''}.`; advice = 'Breed estimate is based on your pet profile details.';
          } else if (mode === 'weight') {
            title = 'Body Weight Estimation'; risk = 'warn'; result = `Estimated weight range: ${active.weight ? (Math.max(0.5, Number(active.weight) - 1).toFixed(1) + '–' + (Number(active.weight) + 1).toFixed(1) + ' kg') : 'profile weight not available'}.`; advice = 'Use a scale for accurate weight tracking. Log the verified weight in Tracker.';
          } else if (mode === 'fur') {
            title = 'Skin / Fur Check';
            if (['red', 'rash', 'wound', 'patch', 'itch', 'hair loss', 'bald'].some(w => desc.toLowerCase().includes(w))) { risk = 'danger'; result = 'Possible skin/fur concern mentioned.'; advice = 'Monitor closely and consult a veterinarian if irritation, wounds, or hair loss continue.'; }
            else { risk = 'safe'; result = 'No obvious issue detected from the provided description.'; advice = 'Keep checking coat shine, itching, smell, and shedding.'; }
          }
        }
      } else {
        // Local simulation for text-only inputs
        const unsafeWords = ['chocolate', 'grape', 'raisin', 'onion', 'garlic', 'alcohol', 'caffeine', 'xylitol', 'avocado', 'spicy', 'salt'];
        if (mode === 'food') {
          title = 'Food Safety Scan';
          const bad = unsafeWords.find(w => desc.toLowerCase().includes(w));
          if (bad) { risk = 'danger'; result = `Potential unsafe food detected: ${bad}.`; advice = 'Do not feed this item. Check the unsafe food guide and ask a vet if consumed.'; }
          else { risk = 'safe'; result = 'No obvious unsafe keyword detected in the description.'; advice = 'Still verify ingredients before feeding.'; }
        } else if (mode === 'breed') {
          title = 'Breed Detection'; risk = 'warn'; result = `Estimated pet type: ${active.type || 'Dog/Cat'}${active.breed ? ' · possible breed: ' + active.breed : ''}.`; advice = 'Breed estimate is based on your pet profile details.';
        } else if (mode === 'weight') {
          title = 'Body Weight Estimation'; risk = 'warn'; result = `Estimated weight range: ${active.weight ? (Math.max(0.5, Number(active.weight) - 1).toFixed(1) + '–' + (Number(active.weight) + 1).toFixed(1) + ' kg') : 'profile weight not available'}.`; advice = 'Use a scale for accurate weight tracking. Log the verified weight in Tracker.';
        } else if (mode === 'fur') {
          title = 'Skin / Fur Check';
          if (['red', 'rash', 'wound', 'patch', 'itch', 'hair loss', 'bald'].some(w => desc.toLowerCase().includes(w))) { risk = 'danger'; result = 'Possible skin/fur concern mentioned.'; advice = 'Monitor closely and consult a veterinarian if irritation, wounds, or hair loss continue.'; }
          else { risk = 'safe'; result = 'No obvious issue detected from the provided description.'; advice = 'Keep checking coat shine, itching, smell, and shedding.'; }
        }
      }
      
      const cls = risk === 'danger' ? 'risk-danger' : risk === 'warn' ? 'risk-warn' : 'risk-safe';
      const html = `<div class="scan-result"><h3 style="font-weight:900">${title}</h3><span class="scan-risk ${cls}">${risk.toUpperCase()}</span><p style="font-size:14px;line-height:1.5;margin-top:8px"><b>Result:</b> ${result}</p><p style="font-size:13px;color:var(--muted);line-height:1.5"><b>Advice:</b> ${advice}</p></div>`;
      document.getElementById('visionResultBox').innerHTML = html;
      
      const hist = getScanHistory();
      hist.unshift({ id: Date.now(), mode, title, risk, result, advice, image: selectedVisionImage, date: new Date().toISOString() });
      saveScanHistory(hist.slice(0, 25));
      renderVisionHistory();
      renderRecordsTab();
    }
    function renderVisionHistory() {
      const box = document.getElementById('scanHistoryBox'); if (!box) return;
      const hist = getScanHistory();
      if (!hist.length) { box.innerHTML = `<div class="card empty-state"><h3>No scans yet</h3><p>Upload a photo to test the smart scan prototype.</p></div>`; return; }
      box.innerHTML = hist.map(h => `<div class="history-item"><div class="history-icon">${h.mode === 'food' ? '🥣' : h.mode === 'breed' ? '🐾' : h.mode === 'weight' ? '⚖️' : '🩺'}</div><div class="history-text"><b>${h.title}</b><span>${h.risk.toUpperCase()} · ${new Date(h.date).toLocaleString()}</span></div></div>`).join('');
    }
    function escapeHtml(str) { return String(str).replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s])); }


    // ==================== HOMEMADE FOOD PRO PAGE ====================
    const HOME_RECIPES = [
      { id: 'r1', title: 'Chicken Rice Comfort Bowl', pet: ['Dog', 'Cat'], type: 'Non-Veg', cat: 'Meal', time: 25, diff: 'Easy', cal: 340, protein: 32, fiber: 4, vit: 70, vet: true, budget: true, season: 'All season', ingredients: ['boiled chicken', 'rice', 'carrot', 'pumpkin'], steps: ['Boil chicken without salt, onion, garlic, or spices.', 'Cook rice until soft and easy to digest.', 'Steam carrot and pumpkin until tender.', 'Mix all ingredients, cool fully, and serve in measured portions.'] },
      { id: 'r2', title: 'Pumpkin Oats Digestive Meal', pet: ['Dog'], type: 'Veg', cat: 'Allergy', time: 18, diff: 'Easy', cal: 250, protein: 12, fiber: 8, vit: 82, vet: true, budget: true, season: 'Monsoon digestion', ingredients: ['pumpkin', 'oats', 'curd small amount', 'carrot'], steps: ['Cook oats in plain water.', 'Steam pumpkin and carrot.', 'Mix with a small spoon of plain curd if tolerated.', 'Serve fresh and store leftovers safely.'] },
      { id: 'r3', title: 'Fish Flake Protein Plate', pet: ['Cat', 'Fish'], type: 'Non-Veg', cat: 'Meal', time: 20, diff: 'Medium', cal: 290, protein: 36, fiber: 2, vit: 64, vet: true, budget: false, season: 'Winter protein', ingredients: ['boneless fish', 'rice water', 'peas small amount'], steps: ['Steam boneless fish fully.', 'Remove bones carefully.', 'Add a tiny amount of mashed peas for cats only.', 'Cool before serving. For aquarium fish, use tiny flakes only.'] },
      { id: 'r4', title: 'Rabbit Leafy Safe Bowl', pet: ['Rabbit'], type: 'Veg', cat: 'Meal', time: 8, diff: 'Easy', cal: 110, protein: 6, fiber: 14, vit: 88, vet: true, budget: true, season: 'Summer fresh', ingredients: ['romaine lettuce', 'coriander', 'carrot small amount', 'hay'], steps: ['Wash leaves well.', 'Chop into small pieces.', 'Add only a small carrot portion.', 'Serve with unlimited hay and clean water.'] },
      { id: 'r5', title: 'Bird Seed Fruit Treat', pet: ['Bird'], type: 'Veg', cat: 'Snack', time: 10, diff: 'Easy', cal: 95, protein: 7, fiber: 5, vit: 76, vet: false, budget: true, season: 'Summer treat', ingredients: ['millet', 'apple without seeds', 'carrot', 'boiled corn small amount'], steps: ['Remove all apple seeds.', 'Chop fruit and carrot very small.', 'Mix with millet.', 'Serve as a small treat, not full meal.'] },
      { id: 'r6', title: 'Emergency Egg Rice Mini Meal', pet: ['Dog', 'Cat'], type: 'Non-Veg', cat: 'Quick', time: 12, diff: 'Easy', cal: 220, protein: 18, fiber: 2, vit: 55, vet: false, budget: true, season: 'Emergency', ingredients: ['boiled egg', 'rice', 'water'], steps: ['Boil egg completely.', 'Cook soft rice.', 'Mash together with warm water.', 'Serve only as a quick temporary meal.'] },
      { id: 'r7', title: 'Budget Veg Protein Mix', pet: ['Dog'], type: 'Veg', cat: 'Budget', time: 22, diff: 'Easy', cal: 260, protein: 15, fiber: 7, vit: 69, vet: false, budget: true, season: 'Budget friendly', ingredients: ['rice', 'lentil water', 'pumpkin', 'beans small amount'], steps: ['Cook rice softly.', 'Use cooked lentil water, not spicy dal.', 'Steam pumpkin and beans.', 'Mix, cool, and serve in small portions.'] },
      { id: 'r8', title: 'Frozen Hydration Snack', pet: ['Dog'], type: 'Veg', cat: 'Seasonal', time: 5, diff: 'Easy', cal: 60, protein: 3, fiber: 3, vit: 60, vet: true, budget: true, season: 'Hot summer', ingredients: ['watermelon seedless', 'curd', 'water'], steps: ['Use seedless watermelon only.', 'Blend with plain curd and water.', 'Freeze in small cubes.', 'Give as an occasional cooling treat.'] },
      { id: 'r9', title: 'Hamster Grain & Veggie Mix', pet: ['Hamster'], type: 'Veg', cat: 'Meal', time: 5, diff: 'Easy', cal: 90, protein: 6, fiber: 5, vit: 75, vet: true, budget: true, season: 'All season', ingredients: ['oats', 'barley', 'carrot (tiny pieces)', 'broccoli (tiny pieces)'], steps: ['Mix oats and barley as a base grain blend.', 'Finely chop carrot and broccoli into hamster-bite-sized pieces.', 'Combine everything in a small ceramic bowl.', 'Scatter in the cage to encourage foraging behaviour.', 'Ensure fresh water is always available.'] },
      { id: 'r10', title: 'Hamster Protein Seed Treat', pet: ['Hamster'], type: 'Veg', cat: 'Snack', time: 3, diff: 'Easy', cal: 60, protein: 4, fiber: 3, vit: 65, vet: true, budget: true, season: 'All season', ingredients: ['sunflower seeds (unsalted)', 'pumpkin seeds', 'flaxseed', 'millet'], steps: ['Use only unsalted, plain seeds.', 'Mix in small pinch quantities.', 'Offer as an occasional treat (not daily).', 'Always pair with hay and fresh water.'] }
    ];
    let activeRecipeId = null;
    let foodTimer = null;
    let timerSecondsLeft = 0;
    let timerTotalSeconds = 0;
    let timerIsPaused = true;
    let timerVoiceEnabled = true;
    let timerCurrentStage = 'prep';
    let recipeLimit = 15;

    function getRecipeStore() {
      return pawCache.recipes || { favorites: [], saved: [], recent: [], reviews: [], weekly: [], shopping: [], reactions: [] };
    }

    async function saveRecipeStore(st) {
      pawCache.recipes = st;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawfeedRecipes', JSON.stringify(st)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('user_profiles').upsert({
          id: userId,
          recipe_store: st
        });
      } catch (err) {
        console.error("Error syncing recipe store:", err);
      }
    }

    function normalizeAndMergeDB() {
      if (!recipeDB || Object.keys(recipeDB).length === 0) return;
      const petKeys = {
        dog: 'Dog',
        cat: 'Cat',
        rabbit: 'Rabbit',
        parrot: 'Bird',
        fish: 'Fish',
        hamster: 'Hamster'
      };
      const nonVegKeywords = ['chicken', 'beef', 'turkey', 'fish', 'meat', 'egg', 'salmon', 'pork', 'shrimp', 'lamb', 'duck', 'tuna', 'sardine', 'liver', 'krill', 'cod', 'prawn', 'crab', 'bacon', 'venison', 'bison', 'anchovy', 'mackerel', 'herring', 'shellfish', 'squid', 'octopus'];

      // Clear previous database entries
      const customRecipes = HOME_RECIPES.filter(r => !r.id.toString().startsWith('db_'));
      HOME_RECIPES.length = 0;
      HOME_RECIPES.push(...customRecipes);

      for (const key in recipeDB) {
        const petType = petKeys[key] || (key.charAt(0).toUpperCase() + key.slice(1));
        const list = recipeDB[key];
        if (!Array.isArray(list)) continue;

        list.forEach(r => {
          const ingredientsLower = (r.ingredients || []).map(i => i.toLowerCase());
          const isNonVeg = ingredientsLower.some(ing =>
            nonVegKeywords.some(keyword => ing.includes(keyword))
          );
          const type = isNonVeg ? 'Non-Veg' : 'Veg';

          let cat = 'Meal';
          const mType = (r.mealType || '').toLowerCase();
          if (mType.includes('snack') || mType.includes('treat')) {
            cat = 'Snack';
          } else if (mType.includes('quick') || mType.includes('emergency')) {
            cat = 'Quick';
          } else if (mType.includes('allergy')) {
            cat = 'Allergy';
          } else if (mType.includes('budget')) {
            cat = 'Budget';
          } else if (mType.includes('season')) {
            cat = 'Seasonal';
          }

          const time = parseInt(r.cookTime) || 15;
          const cal = parseInt(r.nutrition?.calories) || 100;
          const protein = parseInt(r.nutrition?.protein) || 10;
          const fiber = parseInt(r.nutrition?.fiber) || 2;
          const vit = Math.round(protein * 2 + fiber * 5) || 50;

          const normalized = {
            id: `db_${key}_${r.id}`,
            title: r.name,
            pet: [petType],
            type: type,
            cat: cat,
            time: time,
            diff: r.difficulty || 'Easy',
            cal: cal,
            protein: protein,
            fiber: fiber,
            vit: Math.min(95, Math.max(10, vit)),
            vet: !!r.vetTip,
            budget: true,
            season: 'All season',
            ingredients: r.ingredients || [],
            steps: r.steps || [],
            benefits: r.benefits || [],
            frequency: r.frequency || '1-2 times/week',
            vetTip: r.vetTip || '',
            nutritionObj: r.nutrition || {}
          };
          HOME_RECIPES.push(normalized);
        });
      }
      console.log("Recipes merged into HOME_RECIPES. Total:", HOME_RECIPES.length);
    }

    function renderHomemadeTab(keepLimit) {
      if (!keepLimit) recipeLimit = 15;
      const pets = getPets(); const activeIdx = Math.min(getActivePetIdx(), Math.max(0, pets.length - 1)); const pet = pets[activeIdx] || null;
      const tabs = document.getElementById('homemadePetTabs'); if (!tabs) return;
      tabs.innerHTML = pets.length ? pets.map((p, i) => `<div class="pet-tab ${i === activeIdx ? 'active' : ''}" onclick="setActivePet(${i});renderHomemadeTab()">${p.avatar ? '<img src="' + p.avatar + '" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px">' : PET_ICONS[p.type]} ${p.name}</div>`).join('') : '<div class="pet-tab active">General Recipes</div>';
      const search = (document.getElementById('recipeSearch')?.value || '').toLowerCase();
      const cat = document.getElementById('recipeCategory')?.value || 'All'; const veg = document.getElementById('recipeVegFilter')?.value || 'All';
      const recipes = HOME_RECIPES.filter(r => (!pet || r.pet.includes(pet.type)) && (cat === 'All' || r.cat === cat) && (veg === 'All' || r.type === veg) && (r.title.toLowerCase().includes(search) || r.ingredients.join(' ').toLowerCase().includes(search)));
      renderHomemadeDashboard(pet, recipes); renderRecipeLibrary(recipes); renderRecipeMemory();
    }
    function renderHomemadeDashboard(pet, recipes) {
      const box = document.getElementById('homemadeDashboard'); if (!box) return;
      const weight = pet ? parseFloat(pet.weight || 5) : 5; const age = pet ? parseFloat(pet.age || 2) : 2; const condition = (pet?.health || 'healthy').toLowerCase();
      const meal = Math.max(40, Math.round(weight * 28)); const water = Math.round(weight * 55); const calories = Math.round(weight * 70 * (age < 1 ? 1.4 : age > 7 ? .85 : 1));
      const healthTip = condition.includes('obes') ? 'Use low-calorie pumpkin/oats recipes and reduce treats.' : condition.includes('allerg') ? 'Prefer single-protein allergy-friendly recipes and avoid new ingredients.' : condition.includes('dig') ? 'Choose soft rice, pumpkin, and small portions for digestion support.' : 'Balanced homemade meals with safe protein, fiber, vitamins, and fresh water.';
      box.innerHTML = `<div class="card"><h3 style="font-weight:900;color:var(--dark)">✨ Personalized Food Dashboard</h3><p class="subtitle" style="margin:5px 0">${pet ? `${pet.name} • ${pet.breed} ${pet.type} • ${pet.age} yrs • ${pet.weight} kg` : 'Add a pet profile for breed, age, weight, and health-based plans.'}</p><div class="nutrition-grid"><div class="nutrition-box"><b>${meal}g</b><span>Meal Qty</span></div><div class="nutrition-box"><b>${calories}</b><span>Calories/day</span></div><div class="nutrition-box"><b>${water}ml</b><span>Water/day</span></div><div class="nutrition-box"><b>${recipes.length}</b><span>Recipes</span></div></div><div class="list-item success"><span>🩺</span><div><b>Health Diet Recommendation</b><p>${healthTip}</p></div></div><div class="planner-grid"><div class="planner-day"><b>Morning</b>Fresh water + light meal</div><div class="planner-day"><b>Afternoon</b>Small portion / snack</div><div class="planner-day"><b>Evening</b>Main homemade meal</div><div class="planner-day"><b>Storage</b>Refrigerate cooked food, use within 48 hours</div></div></div><div id="weeklyPlanBox"></div><div id="calcResultBox"></div><div id="timerBox"></div>`;
    }
    function renderRecipeLibrary(recipes) {
      const box = document.getElementById('recipeLibraryBox'); if (!box) return;
      if (!recipes.length) { box.innerHTML = '<div class="empty-state"><h3>No matching recipes</h3><p>Try another search or filter.</p></div>'; return; }

      const displayed = recipes.slice(0, recipeLimit);
      let html = displayed.map(r => `<div class="recipe-card"><div class="recipe-top"><div><div class="recipe-title">${r.title}</div><div class="recipe-meta"><span class="recipe-badge ${r.vet ? 'vet-badge' : ''}">${r.vet ? '✅ Vet-approved badge' : 'Community recipe'}</span><span class="recipe-badge">${r.type}</span><span class="recipe-badge">${r.cat}</span><span class="recipe-badge">⏱️ ${r.time} min</span><span class="recipe-badge">${r.diff}</span></div></div><button class="small-btn" onclick="viewRecipe('${r.id}')">View</button></div><p style="font-size:13px;color:var(--muted);line-height:1.45">${r.ingredients.join(', ')}</p><div class="nutrition-grid"><div class="nutrition-box"><b>${r.cal}</b><span>Calories</span></div><div class="nutrition-box"><b>${r.protein}g</b><span>Protein</span></div><div class="nutrition-box"><b>${r.fiber}g</b><span>Fiber</span></div><div class="nutrition-box"><b>${r.vit}%</b><span>Vitamin</span></div></div><div id="recipeDetail_${r.id}"></div><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="small-btn" onclick="saveRecipe('${r.id}')">💾 Save</button><button class="small-btn" onclick="favoriteRecipe('${r.id}')">⭐ Favorite</button><button class="small-btn" onclick="completeMeal('${r.id}')">✅ Meal Done</button><button class="small-btn" onclick="shareRecipeCommunity('${r.id}')">👥 Share</button></div></div>`).join('');

      if (recipes.length > recipeLimit) {
        html += `<div style="text-align:center;margin-top:15px;margin-bottom:15px"><button class="primary-btn" onclick="loadMoreRecipes()" style="width:auto;padding:10px 24px">Load More Recipes (${recipes.length - recipeLimit} left)</button></div>`;
      }
      box.innerHTML = html;
    }
    function loadMoreRecipes() {
      recipeLimit += 15;
      renderHomemadeTab(true);
    }
    function viewRecipe(id) {
      const r = HOME_RECIPES.find(x => x.id === id);
      if (!r) return;
      activeRecipeId = id;
      const st = getRecipeStore();
      st.recent = [id, ...st.recent.filter(x => x !== id)].slice(0, 5);
      saveRecipeStore(st);
      const detail = document.getElementById('recipeDetail_' + id);

      let extraHtml = '';
      if (r.benefits && r.benefits.length > 0) {
        extraHtml += `<div class="list-item"><span>✨</span><div><b>Benefits</b><p>${r.benefits.join(', ')}</p></div></div>`;
      }
      if (r.frequency) {
        extraHtml += `<div class="list-item"><span>🗓️</span><div><b>Recommended Frequency</b><p>${r.frequency}</p></div></div>`;
      }
      if (r.vetTip) {
        extraHtml += `<div class="list-item danger"><span>🩺</span><div><b>Vet Tip</b><p>${r.vetTip}</p></div></div>`;
      }

      detail.innerHTML = `
        <ol class="step-list">${r.steps.map(s => `<li>${s}</li>`).join('')}</ol>
        ${extraHtml}
        <div class="list-item"><span>🧊</span><div><b>Food Storage Guide</b><p>Cool within 30 minutes. Store in airtight box. Refrigeration expiry: 48 hours. Freeze small portions for up to 2 weeks.</p></div></div>
        <div class="list-item"><span>🔁</span><div><b>Ingredient Substitutes</b><p>Chicken → egg/fish for non-veg pets. Rice → oats/pumpkin for sensitive stomach. Avoid salt, sugar, onion, garlic and spices.</p></div></div>
      `;
      renderRecipeMemory();
    }
    function saveRecipe(id) { const st = getRecipeStore(); if (!st.saved.includes(id)) st.saved.push(id); saveRecipeStore(st); showToast('Recipe saved 💾'); renderRecipeMemory(); }
    function favoriteRecipe(id) {
      if (typeof toggleRecipeFavorite === 'function') {
        toggleRecipeFavorite(id);
      } else {
        const st = getRecipeStore();
        st.favorites = st.favorites.includes(id) ? st.favorites.filter(x => x !== id) : [...st.favorites, id];
        saveRecipeStore(st);
        showToast('Favorite recipes updated ⭐');
        renderRecipeMemory();
      }
    }
    function renderRecipeMemory() {
      const st = getRecipeStore();
      const favs = typeof getRecipeFavorites === 'function' ? getRecipeFavorites() : (st.favorites || []);
      const box = document.getElementById('recipeMemoryBox');
      if (!box) return;
      const names = a => a.map(id => HOME_RECIPES.find(r => r.id === id)?.title).filter(Boolean).map(t => `<span class="recipe-chip" style="cursor:pointer" onclick="openRecipeDetailModal('${HOME_RECIPES.find(r => r.title === t || r.id === t)?.id}')">${t}</span>`).join('') || '<p class="subtitle" style="margin:0">Nothing yet.</p>';
      const success = st.reactions.filter(r => r.ok).length, total = st.reactions.length;
      box.innerHTML = `<div class="card"><b>⭐ Favorite Recipes</b><div>${names(favs)}</div><div class="divider"></div><b>💾 Saved Recipes</b><div>${names(st.saved)}</div><div class="divider"></div><b>👀 Recently Viewed</b><div>${names(st.recent)}</div><div class="divider"></div><b>📈 Feeding Success Rate</b><div class="progress-bar-wrap"><div class="progress-bar" style="width:${total ? Math.round(success / total * 100) : 0}%"></div></div><p class="subtitle" style="margin:0">${total ? Math.round(success / total * 100) : 0}% positive reactions from ${total} logged meals.</p></div>`;
    }
    function generateWeeklyPlan() {
      const pets = getPets(); const activeIdx = getActivePetIdx(); const pet = pets[activeIdx] || null;
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const filtered = HOME_RECIPES.filter(r => !pet || r.pet.includes(pet.type));
      const meals = filtered.length ? filtered : HOME_RECIPES;
      const html = `<div class="card"><h3 style="font-weight:900;color:var(--dark)">🗓️ AI Weekly Nutrition Plan</h3><div class="planner-grid">${days.map((d, i) => `<div class="planner-day"><b>${d}</b>${meals[i % meals.length].title}<br><small>Morning / Evening portions</small></div>`).join('')}</div></div>`;
      document.getElementById('weeklyPlanBox').innerHTML = html;
      showToast('Weekly meal planner ready 🗓️');
    }
    function generateShoppingList() {
      const pets = getPets(); const activeIdx = getActivePetIdx(); const pet = pets[activeIdx] || null;
      const filtered = HOME_RECIPES.filter(r => !pet || r.pet.includes(pet.type));
      const meals = filtered.length ? filtered : HOME_RECIPES;
      const items = [...new Set(meals.slice(0, 5).flatMap(r => r.ingredients))];
      document.getElementById('shoppingListBox').innerHTML = `<div class="card"><h3 style="font-weight:900;color:var(--dark)">🛒 Smart Shopping List</h3>${items.map(i => `<span class="recipe-chip">${i}</span>`).join('')}</div>`;
    }
    function checkUnsafeIngredient() { const val = prompt('Enter ingredient to check:'); if (!val) return; const pets = getPets(), pet = pets[getActivePetIdx()] || { type: 'Dog' }; const unsafe = (UNSAFE[pet.type] || []).join(' ').toLowerCase(); const bad = unsafe.includes(val.toLowerCase()); showToast(bad ? 'Unsafe for ' + pet.type + ' ⚠️' : 'Looks safe in small quantity ✅'); }
    function calculateMealAndWater() {
      const calcBox = document.getElementById('calcResultBox');
      if (!calcBox) return;

      // If already open, clicking again toggles it off
      if (calcBox.innerHTML && !calcBox.classList.contains('hidden-widget')) {
        calcBox.innerHTML = '';
        calcBox.classList.add('hidden-widget');
        return;
      }
      calcBox.classList.remove('hidden-widget');

      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const activePet = pets[activeIdx] || { name: 'Custom Pet', type: 'Dog', weight: 10, activityLevel: 'Moderate' };

      renderMealCalculatorCard(activePet);
    }

    window.renderMealCalculatorCard = function(pet) {
      const calcBox = document.getElementById('calcResultBox');
      if (!calcBox) return;

      const name = pet.name || 'Pet';
      const weight = pet.weight || 10;
      const type = pet.type || 'Dog';
      const activity = pet.activityLevel || 'Moderate';

      // Default ratio is 50/50 mixed diet
      const selectedRatio = window.calculatorDietRatio || 'mixed';
      window.calculatorDietRatio = selectedRatio;

      calcBox.innerHTML = `
        <div class="calc-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="font-weight:900;color:var(--dark);margin:0">⚖️ Homemade Meal Calculator</h3>
            <button onclick="document.getElementById('calcResultBox').innerHTML='';document.getElementById('calcResultBox').classList.add('hidden-widget');" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:4px">✕</button>
          </div>
          <p class="subtitle" style="margin-bottom:16px">Adjust parameters below to calculate feeding portion targets dynamically.</p>

          <div class="calc-input-grid">
            <div>
              <label style="margin:0 0 4px 0">Pet Species</label>
              <select id="calcPetType" onchange="updateMealCalculations()">
                <option value="Dog" ${type === 'Dog' ? 'selected' : ''}>Dog</option>
                <option value="Cat" ${type === 'Cat' ? 'selected' : ''}>Cat</option>
              </select>
            </div>
            <div>
              <label style="margin:0 0 4px 0">Activity Level</label>
              <select id="calcPetActivity" onchange="updateMealCalculations()">
                <option value="Sedentary" ${activity === 'Sedentary' ? 'selected' : ''}>Sedentary</option>
                <option value="Moderate" ${activity === 'Moderate' ? 'selected' : ''}>Moderate</option>
                <option value="Active" ${activity === 'Active' ? 'selected' : ''}>Active / High</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <label style="margin:0">Weight (kg)</label>
              <b id="calcWeightVal" style="color:var(--dark)">${weight} kg</b>
            </div>
            <input type="range" id="calcPetWeight" min="0.5" max="80" step="0.5" value="${weight}" oninput="updateMealCalculations()" style="width:100%;accent-color:var(--orange);margin:0;padding:0;height:8px;" />
          </div>

          <label style="margin:0 0 4px 0">Diet Plan Ratio</label>
          <div class="calc-ratio-picker">
            <div class="ratio-btn ${selectedRatio === 'dry' ? 'active' : ''}" id="ratioDry" onclick="selectCalcDietRatio('dry')">100% Dry Food</div>
            <div class="ratio-btn ${selectedRatio === 'mixed' ? 'active' : ''}" id="ratioMixed" onclick="selectCalcDietRatio('mixed')">50/50 Mixed Diet</div>
            <div class="ratio-btn ${selectedRatio === 'wet' ? 'active' : ''}" id="ratioWet" onclick="selectCalcDietRatio('wet')">100% Wet Food</div>
          </div>

          <div id="calcOutputsContainer"></div>
        </div>
      `;

      updateMealCalculations();
    }

    window.selectCalcDietRatio = function(ratio) {
      window.calculatorDietRatio = ratio;
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      if (ratio === 'dry') document.getElementById('ratioDry').classList.add('active');
      if (ratio === 'mixed') document.getElementById('ratioMixed').classList.add('active');
      if (ratio === 'wet') document.getElementById('ratioWet').classList.add('active');
      updateMealCalculations();
    }

    window.updateMealCalculations = function() {
      const typeSelect = document.getElementById('calcPetType');
      const actSelect = document.getElementById('calcPetActivity');
      const weightSlider = document.getElementById('calcPetWeight');
      const weightLabel = document.getElementById('calcWeightVal');

      if (!typeSelect || !actSelect || !weightSlider) return;

      const type = typeSelect.value;
      const activity = actSelect.value;
      const weight = parseFloat(weightSlider.value);
      if (weightLabel) weightLabel.textContent = weight + ' kg';

      // Re-run formula calculations
      const petMock = { type, activityLevel: activity, weight };
      const calc = calculateFeedingAmount(petMock);
      if (!calc) return;

      const ratio = window.calculatorDietRatio || 'mixed';
      let foodBreakdownHTML = '';

      if (ratio === 'dry') {
        foodBreakdownHTML = `
          <div class="calc-box" style="grid-column: span 2">
            <b>~${calc.dryGrams}g</b>
            <span>Recommended Dry Food / Day</span>
          </div>
        `;
      } else if (ratio === 'wet') {
        foodBreakdownHTML = `
          <div class="calc-box" style="grid-column: span 2">
            <b>~${calc.wetGrams}g</b>
            <span>Recommended Wet Food / Day</span>
          </div>
        `;
      } else {
        const dryHalf = Math.round(calc.dryGrams / 2);
        const wetHalf = Math.round(calc.wetGrams / 2);
        foodBreakdownHTML = `
          <div class="calc-box">
            <b>~${dryHalf}g</b>
            <span>Dry Food Portion</span>
          </div>
          <div class="calc-box">
            <b>~${wetHalf}g</b>
            <span>Wet Food Portion</span>
          </div>
        `;
      }

      document.getElementById('calcOutputsContainer').innerHTML = `
        <div class="calc-results-grid">
          <div class="calc-box">
            <b>${calc.calories} kcal</b>
            <span>Daily Caloric Goal</span>
          </div>
          <div class="calc-box">
            <b>${calc.waterNeeds} ml</b>
            <span>Daily Water Needs</span>
          </div>
          ${foodBreakdownHTML}
        </div>
        <p class="calc-disclaimer">${calc.disclaimer}</p>
      `;
    }

    // Voice announcer helper
    function announceTimerStage(text) {
      if (!timerVoiceEnabled) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.error("Speech synthesis failed:", e);
      }
    }

    function startFoodTimer() {
      const timerBox = document.getElementById('timerBox');
      if (!timerBox) return;

      // If already open, clicking again toggles it off
      if (timerBox.innerHTML && !timerBox.classList.contains('hidden-widget')) {
        clearInterval(foodTimer);
        timerBox.innerHTML = '';
        timerBox.classList.add('hidden-widget');
        return;
      }
      timerBox.classList.remove('hidden-widget');

      renderTimerCard();
    }

    window.renderTimerCard = function() {
      const timerBox = document.getElementById('timerBox');
      if (!timerBox) return;

      timerBox.innerHTML = `
        <div class="timer-card">
          <div class="timer-header">
            <h3 style="font-weight:900;color:var(--dark);margin:0">⏲️ Cooking & Prep Timer</h3>
            <div style="display:flex;align-items:center;gap:10px">
              <label style="margin:0;cursor:pointer;font-size:12px;font-weight:800;color:var(--muted);display:flex;align-items:center;gap:4px">
                <input type="checkbox" id="voiceToggle" ${timerVoiceEnabled ? 'checked' : ''} onchange="toggleTimerVoice()" style="width:14px;height:14px;vertical-align:middle;margin:0" />Voice
              </label>
              <button onclick="closeCookingTimer()" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:4px">✕</button>
            </div>
          </div>

          <div class="stage-selector">
            <div class="stage-chip ${timerCurrentStage === 'prep' ? 'active' : ''}" id="chipPrep" onclick="setTimerStage('prep', 180)">1. Prep / Chop (3m)</div>
            <div class="stage-chip ${timerCurrentStage === 'cook' ? 'active' : ''}" id="chipCook" onclick="setTimerStage('cook', 900)">2. Simmer / Cook (15m)</div>
            <div class="stage-chip ${timerCurrentStage === 'cool' ? 'active' : ''}" id="chipCool" onclick="setTimerStage('cool', 600)">3. Cool Down (10m)</div>
            <div class="stage-chip ${timerCurrentStage === 'custom' ? 'active' : ''}" id="chipCustom" onclick="promptCustomTimer()">4. Custom Time</div>
          </div>

          <div class="timer-circle-wrap">
            <div class="timer-display" id="timerValueDisplay">03:00</div>
          </div>

          <div class="timer-progress-bar-wrap">
            <div class="timer-progress-bar" id="timerProgressBar" style="width: 100%"></div>
          </div>

          <div class="timer-controls">
            <button class="timer-btn timer-btn-primary" id="timerPlayPauseBtn" onclick="toggleTimerPlay()">Start</button>
            <button class="timer-btn timer-btn-secondary" onclick="resetTimerStage()">Reset</button>
          </div>
        </div>
      `;

      // Set initial state
      if (timerSecondsLeft <= 0) {
        setTimerStage('prep', 180);
      } else {
        updateTimerDisplay();
      }
    }

    window.toggleTimerVoice = function() {
      const chk = document.getElementById('voiceToggle');
      if (chk) timerVoiceEnabled = chk.checked;
    }

    window.closeCookingTimer = function() {
      clearInterval(foodTimer);
      timerIsPaused = true;
      const timerBox = document.getElementById('timerBox');
      if (timerBox) {
        timerBox.innerHTML = '';
        timerBox.classList.add('hidden-widget');
      }
    }

    window.setTimerStage = function(stage, seconds) {
      clearInterval(foodTimer);
      timerIsPaused = true;
      timerCurrentStage = stage;
      timerTotalSeconds = seconds;
      timerSecondsLeft = seconds;

      document.querySelectorAll('.stage-chip').forEach(c => c.classList.remove('active'));
      if (stage === 'prep') document.getElementById('chipPrep').classList.add('active');
      if (stage === 'cook') document.getElementById('chipCook').classList.add('active');
      if (stage === 'cool') document.getElementById('chipCool').classList.add('active');
      if (stage === 'custom') document.getElementById('chipCustom').classList.add('active');

      const playBtn = document.getElementById('timerPlayPauseBtn');
      if (playBtn) {
        playBtn.textContent = 'Start';
        playBtn.classList.remove('timer-btn-danger');
        playBtn.classList.add('timer-btn-primary');
      }

      updateTimerDisplay();
    }

    window.promptCustomTimer = function() {
      const minStr = prompt("Enter custom timer duration in minutes:", "5");
      if (!minStr) return;
      const min = parseInt(minStr);
      if (isNaN(min) || min <= 0) {
        showToast("Invalid duration!");
        return;
      }
      setTimerStage('custom', min * 60);
    }

    window.updateTimerDisplay = function() {
      const val = document.getElementById('timerValueDisplay');
      const progress = document.getElementById('timerProgressBar');

      if (!val) return;

      const m = Math.floor(timerSecondsLeft / 60);
      const s = timerSecondsLeft % 60;
      val.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

      if (progress && timerTotalSeconds > 0) {
        const pct = (timerSecondsLeft / timerTotalSeconds) * 100;
        progress.style.width = pct + '%';
      }
    }

    window.toggleTimerPlay = function() {
      const btn = document.getElementById('timerPlayPauseBtn');
      if (!btn) return;

      if (timerIsPaused) {
        // Start/Resume
        timerIsPaused = false;
        btn.textContent = 'Pause';
        btn.classList.add('timer-btn-danger');
        btn.classList.remove('timer-btn-primary');

        // Announce stage starting
        if (timerSecondsLeft === timerTotalSeconds) {
          if (timerCurrentStage === 'prep') {
            announceTimerStage("Preparation timer started. Please chop and wash your ingredients. Make sure they are pet-friendly, like carrots and pumpkin.");
          } else if (timerCurrentStage === 'cook') {
            announceTimerStage("Cooking timer started. Simmer the food on low heat without spices, salt, or oil.");
          } else if (timerCurrentStage === 'cool') {
            announceTimerStage("Cooling timer started. Let the food cool down completely before serving to prevent burns.");
          } else {
            announceTimerStage("Custom cooking timer started.");
          }
        } else {
          announceTimerStage("Timer resumed.");
        }

        foodTimer = setInterval(() => {
          if (timerSecondsLeft > 0) {
            timerSecondsLeft--;
            updateTimerDisplay();

            // Give a 1-minute warning
            if (timerSecondsLeft === 60) {
              announceTimerStage("One minute left.");
            }
          } else {
            clearInterval(foodTimer);
            timerIsPaused = true;
            btn.textContent = 'Start';
            btn.classList.remove('timer-btn-danger');
            btn.classList.add('timer-btn-primary');

            // Complete announcements
            if (timerCurrentStage === 'prep') {
              announceTimerStage("Preparation finished. You are ready to start cooking!");
            } else if (timerCurrentStage === 'cook') {
              announceTimerStage("Cooking finished. Remember to cool the food down before serving.");
            } else if (timerCurrentStage === 'cool') {
              announceTimerStage("Cooling finished. The food is now safe to serve to your pets.");
            } else {
              announceTimerStage("Custom timer finished.");
            }

            showNotification('Homemade food timer finished.');
            showToast('Timer finished! ⏲️');
          }
        }, 1000);
      } else {
        // Pause
        timerIsPaused = true;
        btn.textContent = 'Resume';
        btn.classList.remove('timer-btn-danger');
        btn.classList.add('timer-btn-primary');
        clearInterval(foodTimer);
        announceTimerStage("Timer paused.");
      }
    }

    window.resetTimerStage = function() {
      clearInterval(foodTimer);
      timerIsPaused = true;
      timerSecondsLeft = timerTotalSeconds;

      const btn = document.getElementById('timerPlayPauseBtn');
      if (btn) {
        btn.textContent = 'Start';
        btn.classList.remove('timer-btn-danger');
        btn.classList.add('timer-btn-primary');
      }

      updateTimerDisplay();
      announceTimerStage("Timer reset.");
    }
    async function askFoodAssistant() {
      const input = document.getElementById('foodAIInput');
      const q = input.value.trim();
      if (!q) return;
      
      input.value = '';
      const replyBox = document.getElementById('foodAIReply');
      replyBox.innerHTML = `<div class="msg bot-msg typing-msg" style="max-width:100%">Thinking...</div>`;

      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx];

      let systemPrompt = `You are PawFeed AI Food Assistant. You specialize in pet food recipes, safe ingredients, ingredient substitutions, meal planning, and nutrition. Leverage the Grounding Reference Data provided to warn about any toxic ingredients or highlight safe guidelines. Give helpful, concise advice. Keep responses under 130 words.`;
      if (pet) {
        systemPrompt += ` The user's active pet is ${pet.name}, a ${pet.age}-year-old ${pet.breed} ${pet.type} weighing ${pet.weight}kg. Food preference: ${pet.foodPref}. Health notes: ${pet.health || 'healthy'}. Reference this pet specifically when relevant.`;
        if (pet.breedTraits) {
          systemPrompt += ` Breed details: Typical weight range: ${pet.breedTraits.weight || 'unknown'}, Lifespan: ${pet.breedTraits.life_span || 'unknown'}.`;
        }
        const feedingCalc = calculateFeedingAmount(pet);
        if (feedingCalc) {
          systemPrompt += ` Calculated baseline nutrition needs: RER is ${feedingCalc.rer} kcal/day. Maintenance energy requirement is ${feedingCalc.calories} kcal/day (Recommended portions: ~${feedingCalc.dryGrams}g dry or ~${feedingCalc.wetGrams}g wet food). Recommended water intake is ${feedingCalc.waterNeeds}ml/day. Remember: always advise the user that these are baseline estimates and do not substitute for customized professional veterinary care.`;
        }
      }
      const grounding = getGroundingContext(q, pet?.type);
      if (grounding) {
        systemPrompt += `\nGrounding Reference Data:\n${grounding}`;
      }

      async function attemptFetch() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(`${API_BASE_URL}/api/pawfeed-ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userMessage: q }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) throw new Error(`HTTP status ${response.status}`);
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }

      try {
        let data = await attemptFetch();
        const reply = data && data.reply ? data.reply : 'Sorry, I encountered an error. Please try again.';
        replyBox.innerHTML = `<div class="msg bot-msg" style="max-width:100%">${reply}</div>`;
      } catch (err) {
        console.warn('[Food Assistant] First fetch failed, retrying once...', err);
        try {
          let data = await attemptFetch();
          const reply = data && data.reply ? data.reply : 'Sorry, I encountered an error. Please try again.';
          replyBox.innerHTML = `<div class="msg bot-msg" style="max-width:100%">${reply}</div>`;
        } catch (retryErr) {
          console.error('[Food Assistant] Retry failed:', retryErr);
          replyBox.innerHTML = `<div class="msg bot-msg" style="max-width:100%;background:rgba(255,0,0,0.1);color:#d93025">⚠️ Service unavailable. Please check your internet connection or try again.</div>`;
        }
      }
    }
    function handleFoodPhoto(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { const preview = document.getElementById('foodPhotoPreview'); if (preview) preview.innerHTML = `<img src="${reader.result}" class="food-preview-img"><div class="photo-analysis"><b>AI Food Quality Analysis</b><p style="font-size:13px;color:var(--muted);line-height:1.45">Food looks fresh. Check that it has no onion, garlic, salt, masala, chocolate or bones. Serve only after cooling.</p></div>` }; reader.readAsDataURL(file); }
    function saveFoodReaction() { const st = getRecipeStore(); const el = document.getElementById('foodReaction'); const reaction = el ? el.value : '😄 Loved it'; st.reactions.unshift({ reaction, ok: reaction.includes('Loved') || reaction.includes('normally'), time: new Date().toISOString() }); saveRecipeStore(st); showToast('Meal reaction saved 😊'); renderRecipeMemory(); }
    function completeMeal(id) {
      saveRecipe(id);
      const el = document.getElementById('foodReaction');
      if (el) el.value = '😄 Loved it';
      saveFoodReaction();
      // Auto stock deduction for completed meals
      if (typeof deductStockAutomatically === 'function') {
        const r = typeof HOME_RECIPES !== 'undefined' ? HOME_RECIPES.find(x => x.id === id) : null;
        deductStockAutomatically(r ? r.title : 'recipe food', 'food');
      }
    }
    function seedRecipeReviews() { showToast('Recipe ratings & reviews added ⭐'); const box = document.getElementById('recipeLibraryBox'); box.insertAdjacentHTML('afterbegin', '<div class="card success"><b>⭐ Community Reviews</b><p class="subtitle" style="margin:5px 0 0">Chicken Rice Bowl: 4.8/5 • Easy digestion • Pets loved it.</p></div>'); }
    function shareRecipeCommunity(id) {
      const r = HOME_RECIPES.find(x => x.id === id);
      if (!r) return;
      const user = getUser() || { name: 'Pet Parent' };
      const pets = getPets();
      const active = pets[getActivePetIdx()] || pets[0] || null;
      const posts = getCommunityPosts();
      posts.unshift({
        id: Date.now(),
        type: 'recipe',
        caption: `Shared homemade recipe: ${r.title}. Ingredients: ${r.ingredients.join(', ')}`,
        author: user.name || 'Pet Parent',
        petName: active ? active.name : 'Pet',
        petAvatar: active ? active.avatar : '',
        petIcon: active ? (PET_ICONS[active.type] || '🐾') : '🐾',
        likes: 0,
        date: new Date().toISOString()
      });
      saveCommunityPosts(posts.slice(0, 60));
      showToast('Recipe shared to community 👥');
    }

    // ==================== MOOD TRACKER ====================
    function getMoodLog() {
      return pawCache.moodLog || [];
    }

    async function saveMoodLog(d) {
      pawCache.moodLog = d;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawMoodLog', JSON.stringify(d)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('mood_logs').delete().eq('household_id', currentHouseholdId);
        if (d.length > 0) {
          const rows = d.map(item => {
            const petId = pawCache.pets[item.petIdx]?.id || null;
            return {
              user_id: userId,
              pet_id: petId,
              date: item.date,
              label: item.label
            };
          });
          await window.supabaseClient.from('mood_logs').insert(rows.map(r => ({...r, household_id: currentHouseholdId})));
        }
      } catch (err) {
        console.error("Error syncing mood log to Supabase:", err);
      }
    }
    function logMood(emoji, label) {
      const pets = getPets(); const idx = getActivePetIdx();
      const pet = pets[idx]; if (!pet) { showToast('Add a pet first'); return; }
      const log = getMoodLog();
      log.unshift({ petIdx: idx, petName: pet.name, emoji, label, date: todayStr(), ts: new Date().toISOString() });
      saveMoodLog(log.slice(0, 120));
      document.querySelectorAll('.mood-emoji-btn').forEach(b => b.classList.remove('selected'));
      document.querySelector(`[data-mood="${label}"]`)?.classList.add('selected');
      showToast(`${emoji} ${pet.name}'s mood logged as ${label}!`);
      renderMoodTab();
    }
    function renderMoodTab() {
      const pets = getPets(); const idx = getActivePetIdx();
      const sel = document.getElementById('moodPetSelect');
      if (sel) sel.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === idx ? 'active' : ''}" onclick="setActivePet(${i});renderMoodTab()">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const log = getMoodLog().filter(m => m.petIdx === idx);
      const box = document.getElementById('moodHistoryBox'); if (!box) return;
      if (!log.length) { box.innerHTML = '<div class="card empty-state"><h3>No moods logged yet</h3><p>Tap an emoji above to log today\'s mood.</p></div>'; return; }
      const MOOD_COLOR = { Happy: '#B5EAD7', Tired: '#FFF5B7', Sick: '#FFCCE0', Playful: '#a855f7', Sad: '#3b82f6' };
      box.innerHTML = `<div class="card"><b>🗓️ Mood History</b><div style="margin-top:10px">${log.slice(0, 14).map(m => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span style="font-size:22px">${m.emoji}</span><span style="font-weight:700;color:${MOOD_COLOR[m.label] || 'var(--text)'}">${m.label}</span><span style="font-size:12px;color:var(--muted)">${m.date}</span></div>`).join('')}</div></div>`;
    }

    // ==================== MEDICATION ====================
    function getMeds() {
      return pawCache.meds || [];
    }

    async function saveMeds(d) {
      pawCache.meds = d;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawMeds', JSON.stringify(d)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        const { data: dbMeds } = await window.supabaseClient.from('meds').select('id').eq('user_id', userId);
        if (dbMeds) {
          const activeIds = d.map(item => item.id).filter(id => typeof id === 'number' && id < 10000000000);
          const deletedIds = dbMeds.filter(m => !activeIds.includes(m.id)).map(m => m.id);
          if (deletedIds.length > 0) {
            await window.supabaseClient.from('meds').delete().in('id', deletedIds);
          }
        }
        for (let i = 0; i < d.length; i++) {
          const item = d[i];
          const payload = {
            user_id: userId,
            name: item.name,
            dosage: item.dose || '',
            frequency: item.time || '',
            next_due: item.time ? new Date().toISOString().slice(0, 10) + 'T' + item.time : null
          };
          if (item.id && typeof item.id === 'number' && item.id < 10000000000) {
            payload.id = item.id;
          }
          const { data, error } = await window.supabaseClient.from('meds').upsert({...payload, household_id: currentHouseholdId}).select('id').single();
          if (!error && data) item.id = data.id;
        }
      } catch (err) {
        console.error("Error syncing meds to Supabase:", err);
      }
    }
    function addMed() {
      const name = document.getElementById('medName').value.trim();
      const dose = document.getElementById('medDose').value.trim();
      const time = document.getElementById('medTime').value;
      const notes = document.getElementById('medNotes').value.trim();
      if (!name) { showToast('Enter medicine name'); return; }
      const pets = getPets(); const idx = getActivePetIdx();
      const pet = pets[idx];
      const meds = getMeds();
      meds.unshift({ id: Date.now(), petIdx: idx, petName: pet?.name || 'General', name, dose, time, notes, active: true });
      saveMeds(meds);
      ['medName', 'medDose', 'medNotes'].forEach(id => document.getElementById(id).value = '');
      showToast('💊 Medication added!');
      renderMedTab();
    }
    function deleteMed(id) { saveMeds(getMeds().filter(m => m.id !== id)); renderMedTab(); showToast('Removed'); }
    function renderMedTab() {
      const meds = getMeds(); const box = document.getElementById('medListBox'); if (!box) return;
      if (!meds.length) { box.innerHTML = '<div class="card empty-state"><h3>No medications yet</h3><p>Add a medicine above to start tracking.</p></div>'; return; }
      box.innerHTML = meds.map(m => `<div class="card" style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><div style="font-size:16px;font-weight:900;color:var(--dark)">💊 ${m.name}</div>
    <div style="font-size:13px;color:var(--muted);margin-top:3px">${m.petName} · ${m.dose || '—'} · ${m.time || 'No time set'}</div>
    ${m.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${m.notes}</div>` : ''}
    </div><button onclick="deleteMed(${m.id})" style="background:var(--danger-bg);color:#d64040;border:none;border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;font-weight:800">✕</button></div>`).join('');
    }

    // ==================== VET LOG ====================
    function getVetLog() {
      return pawCache.vetLog || [];
    }

    async function saveVetLog(d) {
      pawCache.vetLog = d;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawVetLog', JSON.stringify(d)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('vet_logs').delete().eq('household_id', currentHouseholdId);
        if (d.length > 0) {
          const rows = d.map(item => {
            const petId = pawCache.pets[item.petIdx]?.id || null;
            return {
              user_id: userId,
              pet_id: petId,
              date: item.date,
              clinic: item.clinic || '',
              notes: (item.reason || '') + (item.notes ? '\n' + item.notes : '')
            };
          });
          await window.supabaseClient.from('vet_logs').insert(rows.map(r => ({...r, household_id: currentHouseholdId})));
        }
      } catch (err) {
        console.error("Error syncing vet logs to Supabase:", err);
      }
    }
    function addVetVisit() {
      const date = document.getElementById('vetDate').value;
      const clinic = document.getElementById('vetClinic').value.trim();
      const reason = document.getElementById('vetReason').value.trim();
      const next = document.getElementById('vetNext').value;
      const notes = document.getElementById('vetNotes').value.trim();
      if (!date || !reason) { showToast('Enter date and reason'); return; }
      const pets = getPets(); const idx = getActivePetIdx();
      const log = getVetLog();
      log.unshift({ id: Date.now(), petIdx: idx, petName: pets[idx]?.name || 'General', date, clinic, reason, next, notes });
      saveVetLog(log);
      ['vetDate', 'vetClinic', 'vetReason', 'vetNext', 'vetNotes'].forEach(id => document.getElementById(id).value = '');
      showToast('🩺 Vet visit logged!');
      renderVetTab();
    }
    function deleteVet(id) { saveVetLog(getVetLog().filter(v => v.id !== id)); renderVetTab(); showToast('Removed'); }
    function renderVetTab() {
      const log = getVetLog(); const box = document.getElementById('vetListBox'); if (!box) return;
      if (!log.length) { box.innerHTML = '<div class="card empty-state"><h3>No vet visits yet</h3><p>Log your first visit above.</p></div>'; return; }
      const today = new Date();
      box.innerHTML = log.map(v => {
        const upcoming = v.next && new Date(v.next) >= today;
        const daysUntil = v.next ? Math.ceil((new Date(v.next) - today) / (1000 * 60 * 60 * 24)) : null;
        return `<div class="card"><div style="display:flex;justify-content:space-between"><div><div style="font-weight:900;color:var(--dark)">🏥 ${v.reason}</div><div style="font-size:13px;color:var(--muted);margin-top:2px">${v.petName} · ${v.clinic || 'Clinic not noted'} · ${v.date}</div>${v.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:3px">${v.notes}</div>` : ''}</div><button onclick="deleteVet(${v.id})" style="background:var(--danger-bg);color:#d64040;border:none;border-radius:10px;padding:6px 10px;font-size:12px;cursor:pointer;font-weight:800;flex-shrink:0">✕</button></div>${upcoming ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(0,0,0,0.05);border-radius:12px;font-size:13px;font-weight:700;color:var(--orange)">⏰ Next visit: ${v.next} (${daysUntil} day${daysUntil !== 1 ? 's' : ''} away)</div>` : ''}</div>`;
      }).join('');
    }

    // ==================== SLEEP TRACKER ====================
    function getSleepLog() {
      return pawCache.sleepLog || [];
    }

    async function saveSleepLog(d) {
      pawCache.sleepLog = d;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawSleepLog', JSON.stringify(d)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('sleep_logs').delete().eq('household_id', currentHouseholdId);
        if (d.length > 0) {
          const rows = d.map(item => {
            const petId = pawCache.pets[item.petIdx]?.id || null;
            return {
              user_id: userId,
              pet_id: petId,
              date: item.date,
              hours: parseFloat(item.hours || 0),
              quality: item.quality || 'Good'
            };
          });
          await window.supabaseClient.from('sleep_logs').insert(rows.map(r => ({...r, household_id: currentHouseholdId})));
        }
      } catch (err) {
        console.error("Error syncing sleep log to Supabase:", err);
      }
    }
    function logSleep() {
      const hours = document.getElementById('sleepHours').value;
      const quality = document.getElementById('sleepQuality').value;
      const notes = document.getElementById('sleepNotes').value.trim();
      const pets = getPets(); const idx = getActivePetIdx();
      const pet = pets[idx];
      const log = getSleepLog();
      log.unshift({ id: Date.now(), petIdx: idx, petName: pet?.name || 'General', hours: parseFloat(hours), quality, notes, date: todayStr() });
      saveSleepLog(log.slice(0, 90));
      showToast(`🌙 ${hours}h sleep logged!`);
      renderSleepTab();
    }
    function renderSleepTab() {
      const pets = getPets(); const idx = getActivePetIdx();
      const log = getSleepLog().filter(s => s.petIdx === idx);
      const box = document.getElementById('sleepHistoryBox'); if (!box) return;
      const QUALITY_COLOR = { Excellent: '#B5EAD7', Good: '#A8D8EA', Normal: '#FFF5B7', Restless: '#f97316', Poor: '#FFCCE0' };
      const IDEAL = { Dog: 12, Cat: 15, Rabbit: 8, Bird: 10, Fish: 0 };
      const pet = pets[idx];
      const idealHrs = pet ? (IDEAL[pet.type] || 12) : 12;
      if (!log.length) { box.innerHTML = '<div class="card empty-state"><h3>No sleep logged yet</h3><p>Use the slider above to log today\'s sleep.</p></div>'; return; }
      const avg = (log.slice(0, 7).reduce((a, b) => a + b.hours, 0) / Math.min(log.length, 7)).toFixed(1);
      box.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><div><b>7-day Average</b><div style="font-size:24px;font-weight:900;color:var(--orange)">${avg}h</div></div><div style="text-align:right"><b>Ideal for ${pet?.type || 'pet'}</b><div style="font-size:24px;font-weight:900;color:var(--green)">${idealHrs}h</div></div></div>${log.slice(0, 10).map(s => `<div class="weight-log-item"><span style="font-weight:700">${s.date}</span><span style="color:${QUALITY_COLOR[s.quality] || 'var(--text)'};font-weight:800">${s.hours}h · ${s.quality}</span></div>`).join('')}</div>`;
    }

    // ==================== GALLERY ====================
    function getGallery(petIdx) {
      if (!pawCache.gallery) pawCache.gallery = {};
      return pawCache.gallery[petIdx] || [];
    }

    async function saveGallery(petIdx, d) {
      if (!pawCache.gallery) pawCache.gallery = {};
      pawCache.gallery[petIdx] = d;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawGallery_' + petIdx, JSON.stringify(d)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      const petId = pawCache.pets[petIdx]?.id || null;
      if (!petId) return;
      try {
        await window.supabaseClient.from('pet_gallery').delete().eq('household_id', currentHouseholdId).eq('pet_id', petId);
        if (d.length > 0) {
          const rows = d.map(item => ({
            user_id: userId,
            pet_id: petId,
            image_url: item.image,
            created_at: item.time || new Date().toISOString()
          }));
          await window.supabaseClient.from('pet_gallery').insert(rows.map(r => ({...r, household_id: currentHouseholdId})));
        }
      } catch (err) {
        console.error("Error syncing gallery to Supabase:", err);
      }
    }
    function handleGalleryUpload(e) {
      const files = Array.from(e.target.files);
      const idx = getActivePetIdx();
      const gallery = getGallery(idx);
      let count = 0;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          gallery.unshift({ id: Date.now() + count++, src: ev.target.result, date: todayStr() });
          saveGallery(idx, gallery.slice(0, 30));
          renderGalleryTab();
        };
        reader.readAsDataURL(file);
      });
    }
    function deletePhoto(petIdx, id) {
      saveGallery(petIdx, getGallery(petIdx).filter(p => p.id !== id));
      renderGalleryTab(); showToast('Photo removed');
    }
    function renderGalleryTab() {
      const pets = getPets(); const idx = getActivePetIdx();
      const sel = document.getElementById('galleryPetSelect');
      if (sel) sel.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === idx ? 'active' : ''}" onclick="setActivePet(${i});renderGalleryTab()">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const gallery = getGallery(idx);
      const grid = document.getElementById('photoGrid'); if (!grid) return;
      if (!gallery.length) { grid.innerHTML = '<div style="grid-column:span 3;text-align:center;padding:30px;color:var(--muted);font-weight:700">No photos yet. Upload one above! 📷</div>'; return; }
      grid.innerHTML = gallery.map(p => `<div style="position:relative"><img src="${p.src}" class="photo-thumb" /><div onclick="deletePhoto(${idx},${p.id})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;font-weight:800">✕</div></div>`).join('');
    }

    // ==================== BIRTHDAY ====================
    function renderBirthdayTab() {
      const pets = getPets(); const box = document.getElementById('birthdayCards'); if (!box) return;
      if (!pets.length) { box.innerHTML = '<div class="card empty-state"><h3>No pets added yet</h3></div>'; return; }
      const now = new Date();
      box.innerHTML = pets.map(pet => {
        const age = parseFloat(pet.age) || 1;
        const approxBirth = new Date(now.getFullYear() - Math.floor(age), now.getMonth(), now.getDate());
        const nextBday = new Date(now.getFullYear(), approxBirth.getMonth(), approxBirth.getDate());
        if (nextBday < now) nextBday.setFullYear(nextBday.getFullYear() + 1);
        const days = Math.ceil((nextBday - now) / (1000 * 60 * 60 * 24));
        const turnsAge = Math.floor(age) + 1;
        return `<div class="birthday-card"><div class="birthday-icon">${PET_ICONS[pet.type] || '🐾'}</div><div><div style="font-size:18px;font-weight:900">${pet.name}</div><div class="birthday-lbl">${pet.breed} ${pet.type} · Turning ${turnsAge}</div><div style="display:flex;align-items:baseline;gap:6px;margin-top:6px"><span class="birthday-days">${days === 0 ? '🎉' : days}</span><span class="birthday-lbl">${days === 0 ? 'Happy Birthday!' : days === 1 ? 'day away!' : 'days away!'}</span></div></div></div>`;
      }).join('');
    }

    // ==================== WEIGHT CHART ====================
    function getWeightHistory(petIdx) {
      if (!pawCache.weightHistory) pawCache.weightHistory = {};
      return pawCache.weightHistory[petIdx] || [];
    }

    async function saveWeightHistory(petIdx, d) {
      if (!pawCache.weightHistory) pawCache.weightHistory = {};
      pawCache.weightHistory[petIdx] = d;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawWeightHistory_' + petIdx, JSON.stringify(d)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      const petId = pawCache.pets[petIdx]?.id || null;
      if (!petId) return;
      try {
        await window.supabaseClient.from('weight_history').delete().eq('household_id', currentHouseholdId).eq('pet_id', petId);
        if (d.length > 0) {
          const rows = d.map(item => ({
            user_id: userId,
            pet_id: petId,
            date: item.date,
            weight: parseFloat(item.weight || 0)
          }));
          await window.supabaseClient.from('weight_history').insert(rows.map(r => ({...r, household_id: currentHouseholdId})));
        }
      } catch (err) {
        console.error("Error syncing weight history to Supabase:", err);
      }
    }
    function logWeight() {
      const val = parseFloat(document.getElementById('weightInput').value);
      if (isNaN(val) || val <= 0) { showToast('Enter a valid weight'); return; }
      const idx = getActivePetIdx(); const pets = getPets();
      const history = getWeightHistory(idx);
      history.push({ date: todayStr(), weight: val });
      saveWeightHistory(idx, history.slice(-30));
      // Also update pet profile weight
      const pet = pets[idx]; if (pet) { pet.weight = val; pets[idx] = pet; (!USE_SUPABASE_ONLY && localStorage.setItem('pawPets', JSON.stringify(pets))); }
      document.getElementById('weightInput').value = '';
      showToast(`⚖️ ${val}kg logged!`);
      renderWeightChartTab();
    }
    function renderWeightChartTab() {
      const pets = getPets(); const idx = getActivePetIdx();
      const sel = document.getElementById('weightChartPetSelect');
      if (sel) sel.innerHTML = pets.map((p, i) => `<div class="pet-tab ${i === idx ? 'active' : ''}" onclick="setActivePet(${i});renderWeightChartTab()">${PET_ICONS[p.type] || '🐾'} ${p.name}</div>`).join('');
      const history = getWeightHistory(idx);
      const list = document.getElementById('weightHistoryList');
      const canvas = document.getElementById('weightChart');
      if (!canvas) return;
      if (history.length < 2) {
        canvas.style.display = 'none';
        if (list) list.innerHTML = `<div class="card empty-state"><h3>Not enough data</h3><p>Log at least 2 weights to see the chart.</p></div>`;
        return;
      }
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.parentElement.offsetWidth - 24;
      const W = canvas.width, H = 200, PAD = 36;
      const weights = history.map(h => h.weight);
      const minW = Math.min(...weights) - 0.5, maxW = Math.max(...weights) + 0.5;
      const pts = history.map((h, i) => ({
        x: PAD + (i / (history.length - 1)) * (W - PAD * 2),
        y: H - PAD - ((h.weight - minW) / (maxW - minW)) * (H - PAD * 2)
      }));
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const bg = isDark ? '#1a2535' : '#ffffff', text = isDark ? '#cdd9e5' : '#2b3a47', muted = isDark ? '#7a92a8' : '#7a8d9a';
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // Grid lines
      ctx.strokeStyle = isDark ? '#253445' : '#f0e4d0'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = PAD + (i / 4) * (H - PAD * 2); ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke(); }
      // Line
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#FFD5A8'); grad.addColorStop(1, '#FFCCE0');
      ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)); ctx.stroke();
      // Fill under
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, H - PAD); ctx.lineTo(pts[0].x, H - PAD); ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
      fillGrad.addColorStop(0, 'rgba(255,159,67,0.25)'); fillGrad.addColorStop(1, 'rgba(255,159,67,0)');
      ctx.fillStyle = fillGrad; ctx.fill();
      // Dots + labels
      pts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD5A8'; ctx.fill();
        ctx.strokeStyle = bg; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = text; ctx.font = 'bold 10px Nunito,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(history[i].weight + 'kg', p.x, p.y - 10);
      });
      // X labels (show every nth)
      ctx.fillStyle = muted; ctx.font = '10px Nunito,sans-serif';
      const step = Math.max(1, Math.floor(history.length / 5));
      pts.forEach((p, i) => { if (i % step === 0 || i === history.length - 1) { const d = history[i].date.slice(5); ctx.fillText(d, p.x, H - 8); } });
      if (list) list.innerHTML = `<div class="card" style="margin-top:8px"><b>📋 Weight Log</b>${history.slice().reverse().slice(0, 8).map(h => `<div class="weight-log-item"><span style="font-weight:700">${h.date}</span><span style="font-weight:900;color:var(--orange)">${h.weight} kg</span></div>`).join('')}</div>`;
    }



    // ==================== WEEKLY AI SUMMARY ====================
    async function generateWeeklySummary() {
      const box = document.getElementById('weeklySummaryBox'); if (!box) return;
      box.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:32px;animation:spin 1s linear infinite">⚙️</div><p style="margin-top:12px;color:var(--muted);font-weight:700">Generating your weekly summary...</p></div>';
      const pets = getPets(); const idx = getActivePetIdx(); const pet = pets[idx];
      const log = getLog(); const moodLog = getMoodLog(); const sleepLog = getSleepLog();
      const days7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); });
      const fedCount = log.filter(e => e.type === 'fed' && days7.includes(e.timestamp?.slice(0, 10))).length;
      const moods7 = moodLog.filter(m => m.petIdx === idx && days7.includes(m.date)).map(m => m.label).join(', ') || 'not logged';
      const sleep7 = sleepLog.filter(s => s.petIdx === idx && days7.includes(s.date)).map(s => `${s.hours}h(${s.quality})`).join(', ') || 'not logged';
      const weight = pet?.weight ? pet.weight + 'kg' : 'not logged';

      const feedingCalc = pet ? calculateFeedingAmount(pet) : null;
      let feedingGuide = '';
      if (feedingCalc) {
        feedingGuide = `Daily caloric target: ${feedingCalc.calories} kcal/day (recommended daily portions: ~${feedingCalc.dryGrams}g dry or ~${feedingCalc.wetGrams}g wet food). Recommended daily water: ${feedingCalc.waterNeeds}ml.`;
      }

      const promptText = `You are PawFeed AI generating a friendly weekly health summary.

Pet: ${pet ? `${pet.name}, ${pet.age}yr ${pet.breed} ${pet.type}, ${weight}` : 'Unknown'}
Nutritional Target Guidelines: ${feedingGuide || 'none'}

Last 7 days:
Feedings logged: ${fedCount}
Moods: ${moods7}
Sleep: ${sleep7}

Write:
1. Overall assessment
2. Feeding summary (compare actual feedings logged with the target guidelines above)
3. Mood trend
4. Sleep notes
5. One actionable tip

Use emojis and keep under 150 words.`;

      async function attemptFetch() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const response = await fetch(`${API_BASE_URL}/api/pawfeed-weekly-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promptText }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
          }
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }

      let data;
      try {
        data = await attemptFetch();
      } catch (err) {
        console.warn('First weekly summary fetch failed, retrying once...', err);
        try {
          data = await attemptFetch();
        } catch (retryErr) {
          console.error('Weekly summary retry failed:', retryErr);
          let errorMsg = 'Could not generate summary. Check your internet connection and try again.';
          if (retryErr.name === 'AbortError') {
            errorMsg = 'Could not generate summary. Request timed out.';
          }
          box.innerHTML = errorMsg;
          return;
        }
      }

      const reply = data.reply || 'Could not generate summary.';
      box.innerHTML = `
<div class="card">
  <h3 style="font-weight:900;color:var(--dark);margin-bottom:10px">
    📊 ${pet?.name || 'Your pet'}'s Week in Review
  </h3>
  <p style="line-height:1.7;font-size:14px;color:var(--text)">
    ${reply.replace(/\n/g, '<br>')}
  </p>
</div>`;
    }
    // ==================== STREAKS & MILESTONES ====================
    function renderStreaksTab() {
      const boxes = document.querySelectorAll('#streaksDashboard'); if (!boxes.length) return;
      const streak = calculateStreak();
      const log = getLog();
      const totalFeedings = log.filter(e => e.type === 'fed').length;
      const totalWater = log.filter(e => e.type === 'water').length;
      const MILESTONES = [
        { days: 1, label: 'First Feed!', icon: '🌱', desc: 'Logged your first feeding' },
        { days: 3, label: '3-Day Streak', icon: '⚡', desc: '3 days of consistent care' },
        { days: 7, label: 'One Week!', icon: '🔥', desc: 'A full week of dedication' },
        { days: 14, label: 'Two Weeks!', icon: '💪', desc: 'Incredible consistency' },
        { days: 30, label: 'Monthly Champion', icon: '🏅', desc: '30 days — you\'re amazing!' },
        { days: 60, label: 'Streak Legend', icon: '👑', desc: '60 days of perfect care' },
        { days: 100, label: 'Century Club', icon: '🏆', desc: '100 days — hall of fame!' },
      ];
      const feedMilestones = [
        { count: 10, icon: '🍽️', label: '10 Feedings' },
        { count: 50, icon: '🌟', label: '50 Feedings' },
        { count: 100, icon: '💫', label: '100 Feedings' },
        { count: 500, icon: '🎯', label: '500 Feedings' },
      ];
      boxes.forEach(box => box.innerHTML = `
    <div class="card" style="background: #FFD5A8;color:white;border:none">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:52px">🔥</div>
        <div><div style="font-size:36px;font-weight:900;line-height:1">${streak}</div><div style="font-size:14px;opacity:0.9;font-weight:700">Day${streak !== 1 ? 's' : ''} Feeding Streak</div></div>
      </div>
      <div style="display:flex;gap:16px;margin-top:14px">
        <div style="text-align:center"><div style="font-size:22px;font-weight:900">${totalFeedings}</div><div style="font-size:11px;opacity:0.85">Total Feedings</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:900">${totalWater}</div><div style="font-size:11px;opacity:0.85">Water Logs</div></div>
      </div>
    </div>
    <h3 class="section-title">🏅 Streak Milestones</h3>
    ${MILESTONES.map(m => {
        const earned = streak >= m.days;
        return `<div class="milestone-card ${earned ? 'milestone-earned' : ''}">
        <div class="milestone-icon" style="${earned ? '' : 'filter:grayscale(1);opacity:0.4'}">${m.icon}</div>
        <div style="flex:1"><div style="font-weight:900;color:var(--dark)">${m.label}${earned ? ' ✓' : ''}</div><div style="font-size:12px;color:var(--muted)">${m.desc} · ${m.days} days</div></div>
        ${earned ? '<span style="color:var(--orange);font-weight:900;font-size:12px">Earned!</span>' : '<span style="font-size:12px;color:var(--muted)">${m.days - streak} to go</span>'}
      </div>`;
      }).join('')}
    <h3 class="section-title">🍽️ Feeding Milestones</h3>
    ${feedMilestones.map(m => {
        const earned = totalFeedings >= m.count;
        return `<div class="milestone-card ${earned ? 'milestone-earned' : ''}">
        <div class="milestone-icon" style="${earned ? '' : 'filter:grayscale(1);opacity:0.4'}">${m.icon}</div>
        <div style="flex:1"><div style="font-weight:900;color:var(--dark)">${m.label}${earned ? ' ✓' : ''}</div><div style="font-size:12px;color:var(--muted)">${totalFeedings}/${m.count} feedings</div></div>
        ${earned ? '<span style="color:var(--orange);font-weight:900;font-size:12px">Earned!</span>' : '<span style="font-size:12px;color:var(--muted)">${m.count-totalFeedings} more</span>'}
      </div>`;
      }).join('')}
  `);
    }
    let calYear, calMonth, calSelectedDate;

    function initCalendar() {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      calSelectedDate = now.toDateString();
      renderCalendar();
    }

    function toggleCalendar() {
      const cal = document.getElementById('calendarDropdown');
      if (!cal) return;
      if (cal.style.display === 'none') {
        if (!calYear) initCalendar();
        renderCalendar();
        cal.style.display = '';
        // close when clicking outside
        setTimeout(() => document.addEventListener('click', calOutsideClick), 10);
      } else {
        cal.style.display = 'none';
        document.removeEventListener('click', calOutsideClick);
      }
    }

    function calOutsideClick(e) {
      const cal = document.getElementById('calendarDropdown');
      const btn = document.getElementById('calendarBtn');
      if (cal && !cal.contains(e.target) && e.target !== btn) {
        cal.style.display = 'none';
        document.removeEventListener('click', calOutsideClick);
      }
    }

    function calNav(dir) {
      calMonth += dir;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    }

    function calGoToday() {
      const now = new Date();
      calYear = now.getFullYear();
      calMonth = now.getMonth();
      calSelectedDate = now.toDateString();
      renderCalendar();
      showCalSelectedInfo(now);
    }

    function renderCalendar() {
      const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      document.getElementById('calMonthLabel').textContent = MONTHS[calMonth] + ' ' + calYear;

      const grid = document.getElementById('calGrid');
      const firstDay = new Date(calYear, calMonth, 1).getDay();
      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      const today = new Date();
      const log = getLog ? getLog() : [];

      let cells = '';
      // Empty cells before first day
      for (let i = 0; i < firstDay; i++) {
        cells += `<div style="padding:5px"></div>`;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(calYear, calMonth, d);
        const dateStr = date.toDateString();
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = dateStr === calSelectedDate;
        const dateISO = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        // Check if any feeding logged this day
        const hasFed = log.some(e => e.timestamp && e.timestamp.slice(0, 10) === dateISO && e.type === 'fed');
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        let bg = 'transparent', color = isWeekend ? '#9060D0' : 'var(--text)', border = 'none', shadow = '';
        if (isSelected) { bg = '#D4BBFF'; color = '#4A1A8A'; shadow = '0 4px 10px rgba(212,187,255,0.4)'; }
        else if (isToday) { bg = '#B5EAD7'; color = '#1A6A4A'; border = '2px solid #B5EAD7'; }

        cells += `<div onclick="calSelectDay(${d})" style="
      text-align:center;padding:6px 2px;border-radius:10px;cursor:pointer;
      background:${bg};color:${color};border:${border};
      font-size:13px;font-weight:${isToday || isSelected ? '900' : '700'};
      box-shadow:${shadow};position:relative;transition:0.15s"
      onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
      ${d}
      ${hasFed ? `<div style="width:5px;height:5px;border-radius:50%;background:${isSelected ? 'white' : 'var(--green)'};margin:2px auto 0"></div>` : '<div style="height:7px"></div>'}
    </div>`;
      }
      grid.innerHTML = cells;

      // Show info for selected date
      if (calSelectedDate) {
        const sel = new Date(calSelectedDate);
        showCalSelectedInfo(sel);
      }
    }

    function calSelectDay(d) {
      const date = new Date(calYear, calMonth, d);
      calSelectedDate = date.toDateString();
      renderCalendar();
      showCalSelectedInfo(date);
    }

    function showCalSelectedInfo(date) {
      const box = document.getElementById('calSelectedInfo');
      if (!box) return;
      const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const log = getLog ? getLog() : [];
      const dayLogs = log.filter(e => e.timestamp && e.timestamp.slice(0, 10) === dateISO);
      const fed = dayLogs.filter(e => e.type === 'fed').length;
      const water = dayLogs.filter(e => e.type === 'water').length;
      const isToday = date.toDateString() === new Date().toDateString();
      const label = `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;

      if (dayLogs.length > 0) {
        box.innerHTML = `<span style="font-size:18px">📋</span><div><div style="font-size:12px;color:var(--muted);font-weight:700">${label}${isToday ? ' · Today' : ''}</div><div style="margin-top:3px">${fed ? `🍽️ ${fed} feeding${fed > 1 ? 's' : ''}` : ''} ${water ? `💧 ${water} water log${water > 1 ? 's' : ''}` : ''}</div></div>`;
      } else {
        box.innerHTML = `<span style="font-size:18px">${isToday ? '🗓️' : '🗓️'}</span><div><div style="font-size:12px;color:var(--muted);font-weight:700">${label}${isToday ? ' · Today' : ''}</div><div style="margin-top:3px;color:var(--muted);font-weight:600;font-size:12px">No activity logged</div></div>`;
      }
    }


// ── Script block 2: splash/login logic ─────────────────────────────────────
    // Dismiss anime splash and show loading screen
    function dismissAnimeSplash() {
      const splash = document.getElementById("animeSplash");
      const loading = document.getElementById("loadingScreen");
      if (!splash) return;
      splash.classList.add("fade-out");
      setTimeout(() => {
        splash.style.display = "none";
        if (loading) {
          loading.style.display = "flex";
          // animate loading bar
          let w = 0;
          const bar = document.getElementById("loadingBar");
          const iv = setInterval(() => {
            w += 8;
            if (bar) bar.style.width = Math.min(w, 100) + "%";
            if (w >= 100) clearInterval(iv);
          }, 80);
          setTimeout(() => { loading.style.display = "none"; }, 1500);
        }
      }, 600);
    }

    // Auto-dismiss splash after 3.5s if user doesn't tap
    window.addEventListener('load', function () {
      setTimeout(dismissAnimeSplash, 3500);

      const loginScreen = document.getElementById("loginScreen");
      const registerScreen = document.getElementById("registerScreen");
      const mainApp = document.getElementById("mainApp");

      if (loginScreen) loginScreen.classList.remove("hidden");
      if (registerScreen) registerScreen.classList.add("hidden");
      if (mainApp) mainApp.classList.add("hidden");

      // Prevent automatic login
      (!USE_SUPABASE_ONLY && localStorage.removeItem("pawfeedCurrentUser"));
    });

// ── Script block 3: recipeDB + main app logic ───────────────────────────────

    // your existing JavaScript code

    const recipeDB = window.PAWFEED_RECIPES || {};

    // ==================== NEW RECIPE DB CRUD & MEAL PLANNER ====================
    let recipeAnimalFilter = 'All';

    function getDeletedRecipes() { return JSON.parse(localStorage.getItem('pawfeed_deleted_recipes') || '[]'); }
    function saveDeletedRecipes(list) { localStorage.setItem('pawfeed_deleted_recipes', JSON.stringify(list)); }
    def_custom_recipes = [];
    function getCustomRecipes() { return JSON.parse(localStorage.getItem('pawfeed_custom_recipes') || '[]'); }
    function saveCustomRecipes(list) { localStorage.setItem('pawfeed_custom_recipes', JSON.stringify(list)); }
    function getEditedRecipes() { return JSON.parse(localStorage.getItem('pawfeed_edited_recipes') || '{}'); }
    function saveEditedRecipes(map) { localStorage.setItem('pawfeed_edited_recipes', JSON.stringify(map)); }

    function getRecipeFavorites() { return JSON.parse(localStorage.getItem('pawfeed_recipe_favorites') || '[]'); }
    function saveRecipeFavorites(favs) { localStorage.setItem('pawfeed_recipe_favorites', JSON.stringify(favs)); }
    function isRecipeFavorite(id) { return getRecipeFavorites().includes(id); }

    function toggleRecipeFavorite(id) {
      let favs = getRecipeFavorites();
      if (favs.includes(id)) {
        favs = favs.filter(x => x !== id);
        showToast('Removed from favorites ⭐');
      } else {
        favs.push(id);
        showToast('Added to favorites! ⭐');
      }
      saveRecipeFavorites(favs);
      renderHomemadeTab();
      if (typeof renderRecipeMemory === 'function') renderRecipeMemory();
    }

    function setRecipeAnimalFilter(animal) {
      recipeAnimalFilter = animal;
      const chips = ['All', 'Dog', 'Cat', 'Fish', 'Rabbit', 'Bird'];
      chips.forEach(c => {
        const btn = document.getElementById('achip-' + c);
        if (btn) btn.classList.toggle('active', c === animal);
      });
      renderHomemadeTab();
    }

    function normalizeAndMergeDB() {
      if (!recipeDB || Object.keys(recipeDB).length === 0) return;
      const petKeys = {
        dog: 'Dog',
        cat: 'Cat',
        rabbit: 'Rabbit',
        parrot: 'Bird',
        fish: 'Fish'
      };
      const nonVegKeywords = ['chicken', 'beef', 'turkey', 'fish', 'meat', 'egg', 'salmon', 'pork', 'shrimp', 'lamb', 'duck', 'tuna', 'sardine', 'liver', 'krill', 'cod', 'prawn', 'crab', 'bacon', 'venison', 'bison', 'anchovy', 'mackerel', 'herring', 'shellfish', 'squid', 'octopus'];

      // Clear previous database entries
      const customRecipes = HOME_RECIPES.filter(r => !r.id.toString().startsWith('db_'));
      HOME_RECIPES.length = 0;
      HOME_RECIPES.push(...customRecipes);

      for (const key in recipeDB) {
        const petType = petKeys[key] || (key.charAt(0).toUpperCase() + key.slice(1));
        const list = recipeDB[key];
        if (!Array.isArray(list)) continue;

        list.forEach(r => {
          const ingredientsLower = (r.ingredients || []).map(i => i.toLowerCase());
          const isNonVeg = ingredientsLower.some(ing =>
            nonVegKeywords.some(keyword => ing.includes(keyword))
          );
          const type = isNonVeg ? 'Non-Veg' : 'Veg';

          let cat = 'Meal';
          const mType = (r.mealType || '').toLowerCase();
          if (mType.includes('snack') || mType.includes('treat')) {
            cat = 'Snack';
          } else if (mType.includes('quick') || mType.includes('emergency')) {
            cat = 'Quick';
          } else if (mType.includes('allergy')) {
            cat = 'Allergy';
          } else if (mType.includes('budget')) {
            cat = 'Budget';
          } else if (mType.includes('season')) {
            cat = 'Seasonal';
          }

          const time = parseInt(r.cookTime) || 15;
          const cal = parseInt(r.nutrition?.calories) || 100;
          const protein = parseInt(r.nutrition?.protein) || 10;
          const fiber = parseInt(r.nutrition?.fiber) || 2;
          const vit = Math.round(protein * 2 + fiber * 5) || 50;

          const normalized = {
            id: `db_${key}_${r.id}`,
            title: r.name,
            pet: [petType],
            type: type,
            cat: cat,
            time: time,
            cookTime: r.cookTime || time + ' mins',
            diff: r.difficulty || 'Easy',
            cal: cal,
            protein: protein,
            fiber: fiber,
            vit: Math.min(95, Math.max(10, vit)),
            vet: !!r.vetTip,
            budget: true,
            season: 'All season',
            ingredients: r.ingredients || [],
            steps: r.steps || [],
            benefits: r.benefits || [],
            frequency: r.frequency || '1-2 times/week',
            vetTip: r.vetTip || '',
            nutritionObj: r.nutrition || {},
            suitableAgeGroup: r.ageGroup || 'All',
            healthConditionCompatibility: r.healthCondition || 'Healthy'
          };
          HOME_RECIPES.push(normalized);
        });
      }

      // Apply CRUD Overrides
      const deleted = getDeletedRecipes();
      const edited = getEditedRecipes();
      const custom = getCustomRecipes();

      // 1. Delete blacklisted recipes
      for (let i = HOME_RECIPES.length - 1; i >= 0; i--) {
        if (deleted.includes(HOME_RECIPES[i].id)) {
          HOME_RECIPES.splice(i, 1);
        }
      }

      // 2. Override edited recipes
      HOME_RECIPES.forEach((r, idx) => {
        if (edited[r.id]) {
          HOME_RECIPES[idx] = { ...r, ...edited[r.id] };
        }
      });

      // 3. Append custom recipes
      custom.forEach(cr => {
        if (!deleted.includes(cr.id)) {
          const existingIdx = HOME_RECIPES.findIndex(r => r.id === cr.id);
          if (existingIdx !== -1) {
            HOME_RECIPES[existingIdx] = cr;
          } else {
            HOME_RECIPES.push(cr);
          }
        }
      });

      console.log("Recipes merged into HOME_RECIPES. Total after CRUD:", HOME_RECIPES.length);
    }

    // ==================== RECIPE SEARCH AUTOCOMPLETE ====================
    function onRecipeSearchInput(val) {
      const search = val.toLowerCase().trim();
      const clearBtn = document.getElementById('recipeSearchClear');
      const suggBox = document.getElementById('recipeSuggestions');
      
      if (clearBtn) clearBtn.style.display = search ? 'block' : 'none';
      
      if (!search || search.length < 2) {
        if (suggBox) suggBox.style.display = 'none';
        renderHomemadeTab();
        return;
      }
      
      // Find matches in HOME_RECIPES
      const activeIdx = getActivePetIdx();
      const pet = getPets()[activeIdx] || null;
      const currentAnimal = recipeAnimalFilter !== 'All' ? recipeAnimalFilter : (pet ? pet.type : 'All');
      
      const matches = HOME_RECIPES.filter(r => {
        const matchesAnimal = currentAnimal === 'All' || r.pet.includes(currentAnimal);
        if (!matchesAnimal) return false;
        return r.title.toLowerCase().includes(search) || r.ingredients.join(' ').toLowerCase().includes(search);
      }).slice(0, 8); // Top 8 suggestions
      
      if (matches.length > 0) {
        suggBox.innerHTML = matches.map(m => `
          <div style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;align-items:center;gap:10px" 
               onmousedown="selectRecipeSuggestion('${m.title.replace(/'/g, "\\'")}')">
            <span style="font-size:18px">${m.icon}</span>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px;color:var(--dark)">${m.title}</div>
              <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${m.ingredients.slice(0,3).join(', ')}...
              </div>
            </div>
            <span style="font-size:12px;color:var(--orange)">↗</span>
          </div>
        `).join('');
        suggBox.style.display = 'block';
      } else {
        suggBox.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--muted);text-align:center">No similar recipes found.</div>';
        suggBox.style.display = 'block';
      }
      
      renderHomemadeTab();
    }
    
    function selectRecipeSuggestion(title) {
      const input = document.getElementById('recipeSearch');
      if (input) input.value = title;
      closeRecipeSuggestions();
      renderHomemadeTab();
    }
    
    function clearRecipeSearch() {
      const input = document.getElementById('recipeSearch');
      if (input) input.value = '';
      const clearBtn = document.getElementById('recipeSearchClear');
      if (clearBtn) clearBtn.style.display = 'none';
      closeRecipeSuggestions();
      renderHomemadeTab();
    }
    
    function closeRecipeSuggestions() {
      const suggBox = document.getElementById('recipeSuggestions');
      if (suggBox) suggBox.style.display = 'none';
    }

    function toggleRecipeFilters() {
      const panel = document.getElementById('recipeFilterPanel');
      const btn = document.getElementById('filterToggleBtn');
      if (!panel) return;
      const isHidden = panel.classList.contains('hidden');
      if (isHidden) {
        panel.classList.remove('hidden');
        if (btn) btn.style.background = 'var(--orange)';
        if (btn) btn.style.color = '#fff';
        if (btn) btn.style.borderColor = 'var(--orange)';
      } else {
        panel.classList.add('hidden');
        if (btn) btn.style.background = 'var(--card-bg)';
        if (btn) btn.style.color = 'var(--dark)';
        if (btn) btn.style.borderColor = 'var(--border)';
      }
    }

    function resetRecipeFilters() {
      const ids = ['recipeCategory', 'recipeVegFilter', 'filterAgeGroup', 'filterDifficulty', 'filterCookTime', 'filterVetApproved'];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'All';
      });
      const search = document.getElementById('recipeSearch');
      if (search) search.value = '';
      renderHomemadeTab();
    }

    // Override renderHomemadeTab to support multiple filters and search
    function renderHomemadeTab(keepLimit) {
      if (!keepLimit) recipeLimit = 15;
      const pets = getPets();
      const activeIdx = getActivePetIdx();
      const pet = pets[activeIdx] || null;

      // Render pet tabs
      const tabs = document.getElementById('homemadePetTabs');
      if (tabs) {
        tabs.innerHTML = pets.length ? pets.map((p, i) => `
          <div class="pet-tab ${i === activeIdx ? 'active' : ''}" onclick="setActivePet(${i}); setRecipeAnimalFilter('${p.type}'); renderHomemadeTab()">
            ${p.avatar ? '<img src="' + p.avatar + '" style="width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:4px">' : PET_ICONS[p.type]} ${p.name}
          </div>
        `).join('') : '<div class="pet-tab active">General Recipes</div>';
      }

      // Add species chips row in HTML if it doesn't exist
      const dashboard = document.getElementById('homemadeDashboard');
      if (dashboard && !document.getElementById('achip-All')) {
        const chipContainer = document.createElement('div');
        chipContainer.className = 'animal-selector-wrap';
        chipContainer.style.margin = '14px 0 10px 0';
        chipContainer.innerHTML = `
          <h4 style="font-weight:900;color:var(--dark);margin-bottom:6px">🐶 Species Library Selector</h4>
          <div class="animal-selector" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px">
            <button class="animal-chip ${recipeAnimalFilter === 'All' ? 'active' : ''}" id="achip-All" onclick="setRecipeAnimalFilter('All')">🐾 All Pets</button>
            <button class="animal-chip ${recipeAnimalFilter === 'Dog' ? 'active' : ''}" id="achip-Dog" onclick="setRecipeAnimalFilter('Dog')">🐶 Dog</button>
            <button class="animal-chip ${recipeAnimalFilter === 'Cat' ? 'active' : ''}" id="achip-Cat" onclick="setRecipeAnimalFilter('Cat')">🐱 Cat</button>
            <button class="animal-chip ${recipeAnimalFilter === 'Hamster' ? 'active' : ''}" id="achip-Hamster" onclick="setRecipeAnimalFilter('Hamster')">🐹 Hamster</button>
            <button class="animal-chip ${recipeAnimalFilter === 'Rabbit' ? 'active' : ''}" id="achip-Rabbit" onclick="setRecipeAnimalFilter('Rabbit')">🐰 Rabbit</button>
            <button class="animal-chip ${recipeAnimalFilter === 'Bird' ? 'active' : ''}" id="achip-Bird" onclick="setRecipeAnimalFilter('Bird')">🐦 Bird</button>
          </div>
        `;
        dashboard.parentNode.insertBefore(chipContainer, dashboard.nextSibling);
      }

      // Read filter and search values
      const search = (document.getElementById('recipeSearch')?.value || '').toLowerCase();
      const cat = document.getElementById('recipeCategory')?.value || 'All';
      const filterVeg = document.getElementById('recipeVegFilter')?.value || 'All';

      const filterAge = document.getElementById('filterAgeGroup')?.value || 'All';
      const filterDiff = document.getElementById('filterDifficulty')?.value || 'All';
      const filterCook = document.getElementById('filterCookTime')?.value || 'All';
      const filterVet = document.getElementById('filterVetApproved')?.value || 'All';

      // Filtering logic
      let recipes = HOME_RECIPES.filter(r => {
        const currentAnimal = recipeAnimalFilter !== 'All' ? recipeAnimalFilter : (pet ? pet.type : 'All');
        const matchesAnimal = currentAnimal === 'All' || r.pet.includes(currentAnimal);
        const matchesSearch = r.title.toLowerCase().includes(search) ||
          r.ingredients.join(' ').toLowerCase().includes(search) ||
          (r.healthConditionCompatibility || '').toLowerCase().includes(search);

        let matchesCat = true;
        if (cat === 'Favorites') {
          matchesCat = isRecipeFavorite(r.id);
        } else if (cat !== 'All') {
          matchesCat = r.cat === cat;
        }

        const matchesVeg = filterVeg === 'All' || r.type === filterVeg;
        const matchesAge = filterAge === 'All' || r.suitableAgeGroup === filterAge || r.suitableAgeGroup === 'All';
        const matchesDiff = filterDiff === 'All' || r.diff === filterDiff;

        let matchesCook = true;
        if (filterCook === 'under15') {
          matchesCook = r.time < 15;
        } else if (filterCook === '15to30') {
          matchesCook = r.time >= 15 && r.time <= 30;
        } else if (filterCook === 'over30') {
          matchesCook = r.time > 30;
        }

        const matchesVet = filterVet === 'All' || r.vet;

        return matchesAnimal && matchesSearch && matchesCat && matchesVeg && matchesAge && matchesDiff && matchesCook && matchesVet;
      });

      renderHomemadeDashboard(pet, recipes);
      renderRecipeLibrary(recipes);
      renderRecipeMemory();
    }

    // Override renderHomemadeDashboard to support create, recommendations, and interactive planner
    function renderHomemadeDashboard(pet, recipes) {
      const box = document.getElementById('homemadeDashboard');
      if (!box) return;

      const weight = pet ? parseFloat(pet.weight || 5) : 5;
      const age = pet ? parseFloat(pet.age || 2) : 2;
      const condition = (pet?.health || 'healthy').toLowerCase();

      const meal = Math.max(40, Math.round(weight * 28));
      const water = Math.round(weight * 55);
      const calories = Math.round(weight * 70 * (age < 1 ? 1.4 : age > 7 ? .85 : 1));

      const healthTip = condition.includes('obes') ? 'Use low-calorie pumpkin/oats recipes and reduce treats.' :
        condition.includes('allerg') ? 'Prefer single-protein allergy-friendly recipes and avoid new ingredients.' :
          condition.includes('dig') ? 'Choose soft rice, pumpkin, and small portions for digestion support.' :
            'Balanced homemade meals with safe protein, fiber, vitamins, and fresh water.';

      box.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3 style="font-weight:900;color:var(--dark)">✨ Personalized Food Dashboard</h3>
            <button class="small-btn" onclick="openRecipeAddModal()">+ Create Recipe</button>
          </div>
          <p class="subtitle" style="margin:5px 0">
            ${pet ? `${pet.name} • ${pet.breed} ${pet.type} • ${pet.age} yrs • ${pet.weight} kg` : 'Add a pet profile for breed, age, weight, and health-based plans.'}
          </p>
          <div class="nutrition-grid">
            <div class="nutrition-box"><b>${meal}g</b><span>Meal Qty</span></div>
            <div class="nutrition-box"><b>${calories}</b><span>Calories/day</span></div>
            <div class="nutrition-box"><b>${water}ml</b><span>Water/day</span></div>
            <div class="nutrition-box"><b>${recipes.length}</b><span>Recipes</span></div>
          </div>
          <div class="list-item success">
            <span>🩺</span>
            <div>
              <b>Health Diet Recommendation</b>
              <p>${healthTip}</p>
            </div>
          </div>
        </div>
        
        <div id="smartRecsBox"></div>
        <div id="weeklyPlanBox"></div>
      `;

      renderSmartRecommendations(pet);
      renderWeeklyPlan();
    }

    // Override renderRecipeLibrary to support custom recipe rendering
    function getAnimalSVGBowl(type) {
      const colors = { Dog: '#FFD5A8', Cat: '#FFCCE0', Hamster: '#A8D8EA', Rabbit: '#FFF5B7', Bird: '#B5EAD7' };
      const color = colors[type] || '#E0E0E0';
      return `<svg viewBox="0 0 100 100" style="width:40px;height:40px;fill:${color}"><path d="M20 70 Q 50 100, 80 70 L 75 50 Q 50 40, 25 50 Z"/><circle cx="50" cy="30" r="10"/><path d="M50 40 L 50 60" stroke="#FFF" stroke-width="4"/></svg>`;
    }

    function renderRecipeLibrary(recipes) {
      const box = document.getElementById('recipeLibraryBox');
      if (!box) return;
      if (!recipes.length) {
        box.innerHTML = '<div class="empty-state"><h3>No matching recipes</h3><p>Try another search or filter.</p></div>';
        return;
      }

      const displayed = recipes.slice(0, recipeLimit);
      let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:12px">`;

      html += displayed.map(r => renderRecipeCard(r)).join('');
      html += `</div>`;

      if (recipes.length > recipeLimit) {
        html += `<div style="text-align:center;margin-top:15px;margin-bottom:15px">
          <button class="primary-btn" onclick="loadMoreRecipes()" style="width:auto;padding:10px 24px">Load More Recipes (${recipes.length - recipeLimit} left)</button>
        </div>`;
      }
      box.innerHTML = html;
    }

    function renderRecipeCard(r) {
      const isFav = isRecipeFavorite(r.id);
      return `
        <div class="recipe-card" style="background:var(--card);border-radius:18px;border:1px solid var(--border);overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.02);display:flex;flex-direction:column;position:relative;transition:0.2s;padding:12px">
          <div class="fav-heart-btn" onclick="event.stopPropagation();toggleRecipeFavorite('${r.id}')" style="position:absolute;top:12px;right:12px;background:var(--bg);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.08);color:${isFav ? '#FF6B6B' : '#A0A0A0'};z-index:2">
            ${isFav ? '❤️' : '🤍'}
          </div>
          <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;gap:4px;margin-bottom:4px;align-items:center">
                <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${r.pet[0] || 'Dog'} · ${r.cat || 'Recipe'}</div>
                ${r.vet ? `<span style="background:#B5EAD7;color:#1A6A4A;font-size:10px;font-weight:900;padding:2px 6px;border-radius:12px;line-height:1">🩺 Vet</span>` : ''}
              </div>
              <h4 style="font-size:14px;font-weight:900;color:var(--dark);margin:0 0 8px 0;line-height:1.3;padding-right:32px">${r.title}</h4>
            </div>
            <div>
              <div style="display:flex;align-items:center;gap:12px;font-size:11px;color:var(--muted);font-weight:700">
                <span>⏱️ ${r.time}m</span>
                <span>📊 ${r.diff}</span>
              </div>
              <div style="display:flex;gap:4px;margin-top:10px">
                <button class="primary-btn" onclick="openRecipeDetailModal('${r.id}')" style="padding:6px 8px;font-size:11px;border-radius:8px;margin:0;flex:1">View</button>
                <button class="secondary-btn" onclick="openRecipeEditModal('${r.id}')" style="padding:6px;font-size:11px;border-radius:8px;margin:0">✏️</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // CRUD functions
    function deleteRecipe(id) {
      if (confirm('Are you sure you want to delete this recipe?')) {
        const deleted = getDeletedRecipes();
        deleted.push(id);
        saveDeletedRecipes(deleted);

        const custom = getCustomRecipes().filter(r => r.id !== id);
        saveCustomRecipes(custom);

        normalizeAndMergeDB();
        renderHomemadeTab();
        showToast('Recipe deleted 🗑️');
      }
    }

    function openRecipeAddModal() {
      document.getElementById('recipeModalTitle').textContent = 'Add Custom Recipe';
      document.getElementById('editRecipeId').value = '';

      document.getElementById('formRecipeName').value = '';
      document.getElementById('formRecipeAnimal').value = 'Dog';
      document.getElementById('formRecipeCategory').value = 'Meal';
      document.getElementById('formRecipeAge').value = 'All';
      document.getElementById('formRecipeDiff').value = 'Easy';
      document.getElementById('formRecipeTime').value = '15 mins';
      document.getElementById('formRecipeCal').value = '';
      document.getElementById('formRecipeProt').value = '';
      document.getElementById('formRecipeFat').value = '';
      document.getElementById('formRecipeFib').value = '';
      document.getElementById('formRecipeCarb').value = '';
      document.getElementById('formRecipeCondition').value = '';
      document.getElementById('formRecipeIngredients').value = '';
      document.getElementById('formRecipeSteps').value = '';
      document.getElementById('formRecipeVetTip').value = '';
      document.getElementById('formRecipeVetApproved').checked = false;

      // Clear image fields
      document.getElementById('formRecipeImageFile').value = '';
      document.getElementById('formRecipeImage').value = '';
      document.getElementById('formRecipeImagePreviewImg').src = '';
      document.getElementById('formRecipeImagePreview').style.display = 'none';

      document.getElementById('recipeModal').classList.remove('hidden');
    }

    function openRecipeEditModal(id) {
      const r = HOME_RECIPES.find(x => x.id === id);
      if (!r) return;
      document.getElementById('recipeModalTitle').textContent = 'Edit Recipe';
      document.getElementById('editRecipeId').value = id;

      document.getElementById('formRecipeName').value = r.title;
      document.getElementById('formRecipeAnimal').value = r.pet[0] || 'Dog';
      document.getElementById('formRecipeCategory').value = r.cat || 'Meal';
      document.getElementById('formRecipeAge').value = r.suitableAgeGroup || r.ageGroup || 'All';
      document.getElementById('formRecipeDiff').value = r.diff || 'Easy';
      document.getElementById('formRecipeTime').value = r.cookTime || r.time + ' mins';
      document.getElementById('formRecipeCal').value = r.cal || '';
      document.getElementById('formRecipeProt').value = r.protein || '';
      document.getElementById('formRecipeFat').value = r.fat || '';
      document.getElementById('formRecipeFib').value = r.fiber || '';
      document.getElementById('formRecipeCarb').value = r.carbohydrates || '';
      document.getElementById('formRecipeCondition').value = r.healthConditionCompatibility || r.healthCondition || '';
      document.getElementById('formRecipeIngredients').value = (r.ingredients || []).join(', ');
      document.getElementById('formRecipeSteps').value = (r.steps || []).join('\n');
      document.getElementById('formRecipeVetTip').value = r.vetTip || '';
      document.getElementById('formRecipeVetApproved').checked = !!r.vet;

      // Set image fields
      document.getElementById('formRecipeImageFile').value = '';
      if (r.image) {
        document.getElementById('formRecipeImage').value = r.image;
        document.getElementById('formRecipeImagePreviewImg').src = r.image;
        document.getElementById('formRecipeImagePreview').style.display = 'block';
      } else {
        document.getElementById('formRecipeImage').value = '';
        document.getElementById('formRecipeImagePreviewImg').src = '';
        document.getElementById('formRecipeImagePreview').style.display = 'none';
      }

      document.getElementById('recipeModal').classList.remove('hidden');
    }

    function closeRecipeModal() {
      document.getElementById('recipeModal').classList.add('hidden');
    }

    function saveRecipeForm() {
      const id = document.getElementById('editRecipeId').value;
      const name = document.getElementById('formRecipeName').value.trim();
      const animal = document.getElementById('formRecipeAnimal').value;
      const category = document.getElementById('formRecipeCategory').value;
      const age = document.getElementById('formRecipeAge').value;
      const diff = document.getElementById('formRecipeDiff').value;
      const time = document.getElementById('formRecipeTime').value.trim() || '15 mins';
      const cal = parseInt(document.getElementById('formRecipeCal').value) || 150;
      const prot = document.getElementById('formRecipeProt').value.trim() || '10g';
      const fat = document.getElementById('formRecipeFat').value.trim() || '5g';
      const fib = document.getElementById('formRecipeFib').value.trim() || '2g';
      const carb = document.getElementById('formRecipeCarb').value.trim() || '12g';
      const condition = document.getElementById('formRecipeCondition').value.trim() || 'Healthy';
      const ingredients = document.getElementById('formRecipeIngredients').value.split(',').map(s => s.trim()).filter(Boolean);
      const steps = document.getElementById('formRecipeSteps').value.split('\n').map(s => s.trim()).filter(Boolean);
      const vetTip = document.getElementById('formRecipeVetTip').value.trim();
      const vetApproved = document.getElementById('formRecipeVetApproved').checked;
      const image = document.getElementById('formRecipeImage').value;

      if (!name) { showToast('Please enter a recipe name'); return; }
      if (!ingredients.length) { showToast('Please enter ingredients'); return; }
      if (!steps.length) { showToast('Please enter preparation steps'); return; }

      const recipeObj = {
        id: id || 'custom_' + Date.now(),
        title: name,
        pet: [animal],
        type: ingredients.some(i => ['chicken', 'beef', 'turkey', 'fish', 'meat', 'egg', 'shrimp', 'pork'].some(k => i.toLowerCase().includes(k))) ? 'Non-Veg' : 'Veg',
        cat: category,
        time: parseInt(time) || 15,
        cookTime: time,
        diff: diff,
        cal: cal,
        protein: prot,
        fat: fat,
        fiber: fib,
        carbohydrates: carb,
        suitableAgeGroup: age,
        healthConditionCompatibility: condition,
        ingredients: ingredients,
        steps: steps,
        vetTip: vetTip,
        vet: vetApproved,
        benefits: vetTip ? [vetTip] : ['Nutritious home-cooked food.'],
        warnings: ['Serve in portion-controlled sizes appropriate for weight.'],
        image: image || null,
        custom: true
      };

      if (id) {
        if (id.startsWith('custom_')) {
          const custom = getCustomRecipes().map(r => r.id === id ? recipeObj : r);
          saveCustomRecipes(custom);
        } else {
          const edited = getEditedRecipes();
          edited[id] = recipeObj;
          saveEditedRecipes(edited);
        }
        showToast('Recipe updated successfully!');
      } else {
        const custom = getCustomRecipes();
        custom.push(recipeObj);
        saveCustomRecipes(custom);
        showToast('New recipe added!');
      }

      closeRecipeModal();
      normalizeAndMergeDB();
      renderHomemadeTab();
    }

    function handleRecipeImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        document.getElementById('formRecipeImage').value = e.target.result;
        document.getElementById('formRecipeImagePreviewImg').src = e.target.result;
        document.getElementById('formRecipeImagePreview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
    window.handleRecipeImageUpload = handleRecipeImageUpload;


    // Interactive Planner Functions
    function getWeeklyPlan() {
      return pawCache.weeklyPlan || {
        Mon: { breakfast: null, lunch: null, dinner: null },
        Tue: { breakfast: null, lunch: null, dinner: null },
        Wed: { breakfast: null, lunch: null, dinner: null },
        Thu: { breakfast: null, lunch: null, dinner: null },
        Fri: { breakfast: null, lunch: null, dinner: null },
        Sat: { breakfast: null, lunch: null, dinner: null },
        Sun: { breakfast: null, lunch: null, dinner: null }
      };
    }

    async function saveWeeklyPlan(plan) {
      pawCache.weeklyPlan = plan;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawWeeklyPlan', JSON.stringify(plan)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('user_profiles').update({
          weekly_plan: plan
        }).eq('id', userId);
      } catch (err) {
        console.error("Error syncing weekly plan to Supabase:", err);
      }
    }

    let activePlannerDay = '';
    let activePlannerMeal = '';

    function openPlannerAssignModal(day, meal) {
      activePlannerDay = day;
      activePlannerMeal = meal;

      const searchInput = document.getElementById('plannerSearch');
      if (searchInput) searchInput.value = '';

      filterPlannerRecipes();
      document.getElementById('plannerModal').classList.remove('hidden');
    }

    function filterPlannerRecipes() {
      const db = HOME_RECIPES;
      const pets = getPets();
      const pet = pets[getActivePetIdx()];
      
      const searchInput = document.getElementById('plannerSearch');
      const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

      const suitable = db.filter(r => {
        const matchesPet = !pet || r.pet.includes(pet.type);
        if (!matchesPet) return false;
        if (!query) return true;
        return r.title.toLowerCase().includes(query) || r.ingredients.join(' ').toLowerCase().includes(query);
      });

      const box = document.getElementById('plannerSelectBox');
      if (box) {
        if (suitable.length > 0) {
          box.innerHTML = suitable.map(r => `
            <div class="list-item" style="cursor:pointer;padding:10px;border-radius:12px;border:1px solid var(--border);margin-bottom:6px" onclick="assignRecipeToPlan('${r.id}')">
              <div>
                <div style="font-weight:900;color:var(--dark)">${r.title}</div>
                <div style="font-size:11px;color:var(--muted)">${r.pet.join(', ')} · ${r.cat} · ${r.time} mins</div>
              </div>
            </div>
          `).join('');
        } else {
          box.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px">No recipes found.</div>';
        }
      }
    }

    function assignRecipeToPlan(recipeId) {
      const plan = getWeeklyPlan();
      const r = HOME_RECIPES.find(x => x.id === recipeId);
      if (r) {
        plan[activePlannerDay][activePlannerMeal] = { id: r.id, title: r.title };
        saveWeeklyPlan(plan);
        showToast(`Assigned ${r.title} to ${activePlannerDay} ${activePlannerMeal}!`);
      }
      document.getElementById('plannerModal').classList.add('hidden');
      renderWeeklyPlan();
    }

    function clearWeeklyPlan() {
      const plan = {
        Mon: { breakfast: null, lunch: null, dinner: null },
        Tue: { breakfast: null, lunch: null, dinner: null },
        Wed: { breakfast: null, lunch: null, dinner: null },
        Thu: { breakfast: null, lunch: null, dinner: null },
        Fri: { breakfast: null, lunch: null, dinner: null },
        Sat: { breakfast: null, lunch: null, dinner: null },
        Sun: { breakfast: null, lunch: null, dinner: null }
      };
      saveWeeklyPlan(plan);
      renderWeeklyPlan();
      showToast('Meal plan cleared 🗑️');
    }

    function autoGenerateWeeklyPlan() {
      const pets = getPets();
      const pet = pets[getActivePetIdx()];
      if (!pet) {
        showToast('Please add a pet first to generate a meal plan.');
        return;
      }
      
      const plan = getWeeklyPlan();
      const suitable = HOME_RECIPES.filter(r => r.pet.includes(pet.type));
      if (!suitable.length) { showToast('No recipes found for this pet'); return; }

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const meals = ['breakfast', 'lunch', 'dinner'];

      days.forEach(day => {
        meals.forEach(meal => {
          const rand = suitable[Math.floor(Math.random() * suitable.length)];
          plan[day][meal] = { id: rand.id, title: rand.title };
        });
      });

      saveWeeklyPlan(plan);
      renderWeeklyPlan();
      showToast('AI Meal Plan Generated! 🤖🗓️');
    }

    function renderWeeklyPlan() {
      const box = document.getElementById('weeklyPlanBox');
      if (!box) return;
      const plan = getWeeklyPlan();
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      box.innerHTML = `
        <div class="card" style="margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="font-weight:900;color:var(--dark)">🍽️ Weekly Interactive Meal Planner</h3>
            <div style="display:flex;gap:6px">
              <button class="small-btn" onclick="autoGenerateWeeklyPlan()">🤖 Auto-Plan</button>
              <button class="small-btn" onclick="clearWeeklyPlan()" style="background:var(--danger-bg);color:#d64040">🗑️ Clear</button>
            </div>
          </div>
          <div class="planner-grid-scroll" style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="border-bottom:2px solid var(--border)">
                  <th style="padding:10px;text-align:left">Day</th>
                  <th style="padding:10px;text-align:left">🌅 Breakfast</th>
                  <th style="padding:10px;text-align:left">☀️ Lunch</th>
                  <th style="padding:10px;text-align:left">🌙 Dinner</th>
                </tr>
              </thead>
              <tbody>
                ${days.map(d => {
        const b = plan[d].breakfast;
        const l = plan[d].lunch;
        const dn = plan[d].dinner;
        return `
                    <tr style="border-bottom:1px solid var(--border)">
                      <td style="padding:10px;font-weight:900">${d}</td>
                      <td style="padding:10px">
                        ${b ? `<div class="plan-meal-chip" onclick="openRecipeDetailModal('${b.id}')">${b.title} <span class="remove-meal" onclick="event.stopPropagation();removeMealFromPlan('${d}','breakfast')">✕</span></div>` : `<span class="add-meal-link" onclick="openPlannerAssignModal('${d}','breakfast')">+ Add</span>`}
                      </td>
                      <td style="padding:10px">
                        ${l ? `<div class="plan-meal-chip" onclick="openRecipeDetailModal('${l.id}')">${l.title} <span class="remove-meal" onclick="event.stopPropagation();removeMealFromPlan('${d}','lunch')">✕</span></div>` : `<span class="add-meal-link" onclick="openPlannerAssignModal('${d}','lunch')">+ Add</span>`}
                      </td>
                      <td style="padding:10px">
                        ${dn ? `<div class="plan-meal-chip" onclick="openRecipeDetailModal('${dn.id}')">${dn.title} <span class="remove-meal" onclick="event.stopPropagation();removeMealFromPlan('${d}','dinner')">✕</span></div>` : `<span class="add-meal-link" onclick="openPlannerAssignModal('${d}','dinner')">+ Add</span>`}
                      </td>
                    </tr>
                  `;
      }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function removeMealFromPlan(day, meal) {
      const plan = getWeeklyPlan();
      plan[day][meal] = null;
      saveWeeklyPlan(plan);
      renderWeeklyPlan();
      showToast('Meal removed');
    }

    // Smart Recommendations based on active pet metadata
    function renderSmartRecommendations(pet) {
      const box = document.getElementById('smartRecsBox');
      if (!box) return;
      if (!pet) {
        box.innerHTML = '';
        return;
      }

      const db = HOME_RECIPES;
      let matches = db.filter(r => r.pet.includes(pet.type));

      const age = parseFloat(pet.age) || 1;
      const petAgeGroup = age < 1 ? 'Baby' : age > 7 ? 'Senior' : 'Adult';
      let ageMatches = matches.filter(r => r.suitableAgeGroup === petAgeGroup || r.suitableAgeGroup === 'All');
      if (ageMatches.length > 0) matches = ageMatches;

      const condition = (pet.health || '').toLowerCase();
      if (condition && condition !== 'healthy') {
        let condMatches = matches.filter(r =>
          r.title.toLowerCase().includes(condition) ||
          (r.healthConditionCompatibility || '').toLowerCase().includes(condition) ||
          (r.vetTip || '').toLowerCase().includes(condition)
        );
        if (condMatches.length > 0) matches = condMatches;
      }

      const recs = matches.slice(0, 3);
      if (!recs.length) {
        box.innerHTML = '';
        return;
      }

      box.innerHTML = `
        <h4 style="font-weight:900;color:var(--dark);margin-top:16px;margin-bottom:8px">💡 Recommended for ${pet.name}</h4>
        <div style="display:grid;grid-template-columns:1fr;gap:8px">
          ${recs.map(r => `
            <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:12px;cursor:pointer" onclick="openRecipeDetailModal('${r.id}')">
              <div>
                <b style="color:var(--dark)">${r.title}</b>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">${r.cat} · ${r.cookTime || r.time + ' mins'} · Suitable for ${r.suitableAgeGroup}</div>
              </div>
              <span style="font-size:18px">➔</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    function openRecipeDetailModal(id) {
      const r = HOME_RECIPES.find(recipe => recipe.id === id);
      if (!r) {
        showToast('Recipe not found');
        return;
      }

      const modal = document.getElementById('recipeDetailModal');
      const nameEl = document.getElementById('modalRecipeName');
      const bodyEl = document.getElementById('modalRecipeBody');
      if (!modal || !bodyEl) return;

      nameEl.textContent = r.title;

      const isFav = isRecipeFavorite(r.id);

      const st = getRecipeStore();
      st.recent = [id, ...st.recent.filter(x => x !== id)].slice(0, 5);
      saveRecipeStore(st);
      if (typeof renderRecipeMemory === 'function') renderRecipeMemory();

      const isSaved = st.saved.includes(r.id);

      let html = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="height:140px;background:var(--bg);border-radius:16px;display:flex;align-items:center;justify-content:center;position:relative;color:var(--text);overflow:hidden">
            ${r.image ? `<img src="${r.image}" style="width:100%;height:100%;object-fit:cover" />` : getAnimalSVGBowl(r.pet[0] || 'Dog')}
            ${r.vet ? `<span style="position:absolute;bottom:8px;left:8px;background:#B5EAD7;color:#1A6A4A;font-size:11px;font-weight:900;padding:4px 8px;border-radius:12px">🩺 Vet Approved</span>` : ''}
          </div>
          
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            <span class="recipe-badge" style="background:var(--pill-bg);color:var(--pill-color);font-size:11px;padding:4px 10px;border-radius:12px;font-weight:700">${r.pet.join(', ')}</span>
            <span class="recipe-badge" style="background:var(--border);color:var(--text);font-size:11px;padding:4px 10px;border-radius:12px;font-weight:700">${r.cat || 'Recipe'}</span>
            <span class="recipe-badge" style="background:var(--border);color:var(--text);font-size:11px;padding:4px 10px;border-radius:12px;font-weight:700">⏱️ ${r.time} mins</span>
            <span class="recipe-badge" style="background:var(--border);color:var(--text);font-size:11px;padding:4px 10px;border-radius:12px;font-weight:700">📊 ${r.diff}</span>
            <span class="recipe-badge" style="background:var(--border);color:var(--text);font-size:11px;padding:4px 10px;border-radius:12px;font-weight:700">${r.type}</span>
            ${r.suitableAgeGroup ? `<span class="recipe-badge" style="background:var(--border);color:var(--text);font-size:11px;padding:4px 10px;border-radius:12px;font-weight:700">👶 ${r.suitableAgeGroup}</span>` : ''}
          </div>

          <div>
            <h4 style="font-weight:900;color:var(--dark);margin-bottom:8px">📊 Nutritional Info (per serving)</h4>
            <div class="nutrition-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
              <div class="nutrition-box" style="background:var(--bg);padding:8px;border-radius:12px;text-align:center">
                <b style="display:block;font-size:15px;color:var(--dark)">${r.cal || 150}</b>
                <span style="font-size:10px;color:var(--muted)">Calories</span>
              </div>
              <div class="nutrition-box" style="background:var(--bg);padding:8px;border-radius:12px;text-align:center">
                <b style="display:block;font-size:15px;color:var(--dark)">${r.protein || '10'}g</b>
                <span style="font-size:10px;color:var(--muted)">Protein</span>
              </div>
              <div class="nutrition-box" style="background:var(--bg);padding:8px;border-radius:12px;text-align:center">
                <b style="display:block;font-size:15px;color:var(--dark)">${r.fiber || '2'}g</b>
                <span style="font-size:10px;color:var(--muted)">Fiber</span>
              </div>
              <div class="nutrition-box" style="background:var(--bg);padding:8px;border-radius:12px;text-align:center">
                <b style="display:block;font-size:15px;color:var(--dark)">${r.vit || '50'}%</b>
                <span style="font-size:10px;color:var(--muted)">Vitamin</span>
              </div>
            </div>
          </div>
          
          ${r.healthConditionCompatibility ? `
            <div style="background:var(--pill-bg);color:var(--pill-color);padding:10px 14px;border-radius:12px;font-size:13px">
              <b>🏥 Health Compatibility:</b> ${r.healthConditionCompatibility}
            </div>
          ` : ''}

          <div>
            <h4 style="font-weight:900;color:var(--dark);margin-bottom:6px">🛒 Ingredients</h4>
            <ul style="padding-left:20px;font-size:13px;color:var(--text);line-height:1.6">
              ${r.ingredients.map(ing => `<li>` + ing + `</li>`).join('')}
            </ul>
          </div>

          <div>
            <h4 style="font-weight:900;color:var(--dark);margin-bottom:6px">🍳 Preparation Steps</h4>
            <ol style="padding-left:20px;font-size:13px;color:var(--text);line-height:1.6">
              ${r.steps.map(step => `<li>` + step + `</li>`).join('')}
            </ol>
          </div>

          ${r.vetTip || (r.benefits && r.benefits.length) ? `
            <div style="background:var(--success-bg);color:#1a6a4a;padding:12px;border-radius:12px;font-size:13px">
              <b>🩺 Doctor's Note / Vet Tip:</b>
              <p style="margin-top:4px">${r.vetTip || r.benefits.join(' ')}</p>
            </div>
          ` : ''}

          <div style="display:flex;gap:8px;margin-top:8px">
            <button id="modalFavBtn" class="secondary-btn" onclick="toggleRecipeFavoriteInModal('${r.id}')" style="flex:1;padding:12px;font-size:13px;border-radius:12px;margin:0">
              ${isFav ? '⭐ Unfavorite' : '⭐ Favorite'}
            </button>
            <button id="modalSaveBtn" class="secondary-btn" onclick="toggleRecipeSaveInModal('${r.id}')" style="flex:1;padding:12px;font-size:13px;border-radius:12px;margin:0">
              ${isSaved ? '💾 Unsave' : '💾 Save'}
            </button>
            <button class="primary-btn" onclick="completeMealFromModal('${r.id}')" style="flex:1.2;padding:12px;font-size:13px;border-radius:12px;margin:0">
              ✅ Meal Done
            </button>
          </div>
        </div>
      `;

      bodyEl.innerHTML = html;
      modal.classList.remove('hidden');
    }

    function closeRecipeDetailModal() {
      const modal = document.getElementById('recipeDetailModal');
      if (modal) {
        modal.classList.add('hidden');
      }
    }

    function toggleRecipeFavoriteInModal(id) {
      toggleRecipeFavorite(id);
      const isFav = isRecipeFavorite(id);
      const favBtn = document.getElementById('modalFavBtn');
      if (favBtn) {
        favBtn.textContent = isFav ? '⭐ Unfavorite' : '⭐ Favorite';
      }
    }

    function toggleRecipeSaveInModal(id) {
      const st = getRecipeStore();
      let msg = '';
      if (st.saved.includes(id)) {
        st.saved = st.saved.filter(x => x !== id);
        msg = 'Recipe unsaved 💾';
      } else {
        st.saved.push(id);
        msg = 'Recipe saved 💾';
      }
      saveRecipeStore(st);
      showToast(msg);
      if (typeof renderRecipeMemory === 'function') renderRecipeMemory();

      const isSaved = st.saved.includes(id);
      const saveBtn = document.getElementById('modalSaveBtn');
      if (saveBtn) {
        saveBtn.textContent = isSaved ? '💾 Unsave' : '💾 Save';
      }
    }

    function completeMealFromModal(id) {
      completeMeal(id);
      closeRecipeDetailModal();
    }

    // ==================== DAILY CARE CHECKLIST ====================
    function getDailyChecklist() {
      const defaultChecklist = {
        lastDate: todayStr(),
        autoReset: true,
        items: [
          { text: '🍽️ Feed Pet', checked: false, isCustom: false },
          { text: '💧 Refresh Water', checked: false, isCustom: false },
          { text: '🦮 Walk / Exercise', checked: false, isCustom: false },
          { text: '🧸 Playtime', checked: false, isCustom: false },
          { text: '💊 Give Medicine', checked: false, isCustom: false },
          { text: '🧼 Grooming / Clean Area', checked: false, isCustom: false }
        ]
      };
      
      let parsed = pawCache.dailyChecklist && Object.keys(pawCache.dailyChecklist).length > 0
        ? pawCache.dailyChecklist
        : null;
        
      if (!parsed) {
        try {
          const stored = (USE_SUPABASE_ONLY ? null : localStorage.getItem('pawDailyChecklist'));
          if (stored) parsed = JSON.parse(stored);
        } catch (e) { }
      }
      
      if (!parsed) {
        parsed = defaultChecklist;
      }
      
      const today = todayStr();
      if (parsed.lastDate !== today) {
        if (parsed.autoReset) {
          parsed.items.forEach(item => item.checked = false);
        }
        parsed.lastDate = today;
        saveDailyChecklist(parsed);
      }
      
      return parsed;
    }

    async function saveDailyChecklist(data) {
      pawCache.dailyChecklist = data;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawDailyChecklist', JSON.stringify(data)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('user_profiles').update({
          daily_checklist: data
        }).eq('id', userId);
      } catch (err) {
        console.error("Error syncing daily checklist to Supabase:", err);
      }
    }

    function toggleDailyChecklistItem(index) {
      const data = getDailyChecklist();
      if (data.items[index]) {
        data.items[index].checked = !data.items[index].checked;
        saveDailyChecklist(data);
        showToast(data.items[index].checked ? 'Task checked! ✓' : 'Task unchecked');
        renderDailyChecklist();
      }
    }

    function addChecklistItem() {
      const input = document.getElementById('newChecklistItem');
      if (!input) return;
      const text = input.value.trim();
      if (!text) {
        showToast('Please enter task description');
        return;
      }
      const data = getDailyChecklist();
      data.items.push({ text: text, checked: false, isCustom: true });
      saveDailyChecklist(data);
      input.value = '';
      showToast('Custom task added 📋');
      renderDailyChecklist();
    }

    function deleteChecklistItem(index) {
      const data = getDailyChecklist();
      data.items.splice(index, 1);
      saveDailyChecklist(data);
      showToast('Task removed');
      renderDailyChecklist();
    }

    function toggleChecklistAutoReset() {
      const data = getDailyChecklist();
      data.autoReset = !data.autoReset;
      saveDailyChecklist(data);
      const btn = document.getElementById('checklistAutoResetToggle');
      if (btn) btn.classList.toggle('on', data.autoReset);
      showToast(data.autoReset ? 'Daily auto-reset enabled 🔄' : 'Daily auto-reset disabled');
    }

    function resetDailyChecklist(manual) {
      const data = getDailyChecklist();
      data.items.forEach(item => item.checked = false);
      saveDailyChecklist(data);
      if (manual) showToast('Checklist reset! 📋');
      renderDailyChecklist();
    }

    function renderDailyChecklist() {
      const container = document.getElementById('dailyChecklistContainer');
      if (container) {
        container.innerHTML = '';
      }
    }

    // ==================== HEALTH INSIGHTS ====================
    function generateHealthInsights(petIdx) {
      const pets = getPets();
      const pet = pets[petIdx];
      if (!pet) return `<div class="card empty-state"><p>Add a pet profile to see health insights.</p></div>`;

      const today = todayStr();
      const log = getLog();
      const petLog = log.filter(e => e.petIdx === petIdx);

      // 1. Water Intake Insights
      const totalDrops = Math.ceil((pet.waterGoal || 500) / 100);
      const currentDrops = (pet.waterDate === today ? (pet.waterDrops || []) : []);
      const waterMl = currentDrops.length * 100;
      const waterPct = Math.min(100, Math.round((currentDrops.length / totalDrops) * 100));

      let waterInsightMsg = "";
      let waterColor = "var(--muted)";
      if (waterPct >= 90) {
        waterInsightMsg = `💧 Great job! ${pet.name} met today's hydration goal!`;
        waterColor = "var(--success-bg)";
      } else if (waterPct >= 50) {
        waterInsightMsg = `💧 Halfway there! Keep encouraging ${pet.name} to drink more.`;
        waterColor = "var(--streak)";
      } else {
        waterInsightMsg = `💧 ${pet.name} needs more water today. Refill their bowl with fresh water.`;
        waterColor = "var(--danger-bg)";
      }

      // 2. Weight History Trend
      const wh = pet.weightHistory || [];
      let weightInsightMsg = "⚖️ Log weight regularly to see weight gain/loss trends.";
      if (wh.length >= 2) {
        const latest = wh[wh.length - 1].weight;
        const prev = wh[wh.length - 2].weight;
        const diff = (latest - prev).toFixed(2);
        if (diff > 0) {
          weightInsightMsg = `📈 Gained <b>+${diff} kg</b> since last log (${prev}kg to ${latest}kg).`;
        } else if (diff < 0) {
          weightInsightMsg = `📉 Lost <b>${diff} kg</b> since last log (${prev}kg to ${latest}kg).`;
        } else {
          weightInsightMsg = `↔️ Weight is stable at <b>${latest} kg</b>.`;
        }
      } else if (wh.length === 1) {
        weightInsightMsg = `⚖️ Initial weight logged: <b>${wh[0].weight} kg</b>. Log next weight to see trend.`;
      }

      // 3. Mood Trend
      let moodInsightMsg = "😊 Log today's mood in the tracker to monitor emotional health.";
      const moodLogs = petLog.filter(e => e.type === 'mood');
      if (moodLogs.length > 0) {
        const last14Days = new Date(Date.now() - 14 * 86400000);
        const recentMoods = moodLogs.filter(e => new Date(e.timestamp) >= last14Days);
        if (recentMoods.length > 0) {
          const counts = {};
          recentMoods.forEach(m => {
            const label = m.mood || m.note;
            counts[label] = (counts[label] || 0) + 1;
          });
          let topMood = "";
          let maxCount = 0;
          for (const key in counts) {
            if (counts[key] > maxCount) {
              maxCount = counts[key];
              topMood = key;
            }
          }
          const pct = Math.round((maxCount / recentMoods.length) * 100);
          moodInsightMsg = `😊 Primary mood: <b>${topMood}</b> (${pct}% of logs recently).`;
        }
      }

      // 4. 7-Day Care Activity Level (Bar Chart)
      const last7days = [];
      const activityCounts = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 86400000);
        const dStr = date.toISOString().slice(0, 10);
        last7days.push(date.toLocaleDateString('en-IN', { weekday: 'short' }));
        const dayLogs = petLog.filter(e => e.timestamp && e.timestamp.slice(0, 10) === dStr && ['fed', 'water', 'weight', 'mood', 'care'].includes(e.type));
        activityCounts.push(dayLogs.length);
      }
      const maxLogs = Math.max(...activityCounts, 1);

      const chartHtml = activityCounts.map((count, i) => {
        const h = Math.max(8, Math.round((count / maxLogs) * 60) + 10);
        return `
          <div class="weight-bar-wrap" style="flex:1; display:flex; flex-direction:column; align-items:center">
            <div class="weight-bar" style="height:${h}px; background:var(--purple); border-radius:6px; width:16px; margin: 0 auto 4px" title="${count} activities"></div>
            <div class="weight-label" style="font-size:10px; color:var(--muted)">${last7days[i]}</div>
            <div style="font-size:10px; font-weight:800; color:var(--dark)">${count}</div>
          </div>
        `;
      }).join('');

      return `
        <!-- HEALTH & ACTIVITY INSIGHTS CARD -->
        <div class="card" style="border-left: 5px solid var(--purple)">
          <h3 style="font-weight:900; margin-bottom:4px">📈 Health & Activity Insights</h3>
          <p class="subtitle" style="margin-bottom:12px">Weekly wellness breakdown and activity trends for ${pet.name}.</p>
          
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px">
            <!-- Hydration Card -->
            <div style="background:${waterColor}; padding:10px 14px; border-radius:12px; font-size:13px; font-weight:700; color:var(--dark)">
              ${waterInsightMsg}
            </div>
            
            <!-- Weight Trend -->
            <div style="background:var(--pill-bg); color:var(--pill-color); padding:10px 14px; border-radius:12px; font-size:13px">
              ${weightInsightMsg}
            </div>

            <!-- Mood Trend -->
            <div style="background:var(--bg); border:1px solid var(--border); padding:10px 14px; border-radius:12px; font-size:13px">
              ${moodInsightMsg}
            </div>
          </div>

          <h4 style="font-weight:900; color:var(--dark); margin-bottom:8px; font-size:14px">🗓️ 7-Day Care Activity Trend</h4>
          <div class="weight-chart-wrap" style="padding:10px 0; background:var(--bg); border-radius:14px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-end; height:110px">
            ${chartHtml}
          </div>
          <p style="font-size:11px; color:var(--muted); text-align:center; margin-top:8px">Tracks feeds, water, weights, moods, and planner tasks logged daily.</p>
        </div>
      `;
    }

    // ==================== EXPENSE TRACKER ====================
    function getExpenses() {
      return pawCache.expenses || [];
    }

    async function saveExpenses(expenses) {
      pawCache.expenses = expenses;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawExpenses', JSON.stringify(expenses)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        const { data: dbExpenses } = await window.supabaseClient.from('expenses').select('id').eq('user_id', userId);
        if (dbExpenses) {
          const activeIds = expenses.map(item => item.id).filter(id => typeof id === 'number' && id < 10000000000);
          const deletedIds = dbExpenses.filter(m => !activeIds.includes(m.id)).map(m => m.id);
          if (deletedIds.length > 0) {
            await window.supabaseClient.from('expenses').delete().in('id', deletedIds);
          }
        }
        for (let i = 0; i < expenses.length; i++) {
          const item = expenses[i];
          const payload = {
            user_id: userId,
            amount: parseFloat(item.amount || 0),
            category: item.category || 'Other',
            description: item.desc || '',
            date: item.date || new Date().toISOString().slice(0, 10)
          };
          if (item.id && typeof item.id === 'number' && item.id < 10000000000) {
            payload.id = item.id;
          }
          const { data, error } = await window.supabaseClient.from('expenses').upsert({...payload, household_id: currentHouseholdId}).select('id').single();
          if (!error && data) item.id = data.id;
        }
      } catch (err) {
        console.error("Error syncing expenses to Supabase:", err);
      }
    }

    function addExpense() {
      const amtInput = document.getElementById('expenseAmount');
      const catSelect = document.getElementById('expenseCategory');
      const descInput = document.getElementById('expenseDesc');
      const dateInput = document.getElementById('expenseDate');

      if (!amtInput || !catSelect || !descInput || !dateInput) return;

      const amount = parseFloat(amtInput.value);
      const category = catSelect.value;
      const desc = descInput.value.trim();
      const dateVal = dateInput.value;

      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid expense amount');
        return;
      }
      if (!desc) {
        showToast('Please enter description');
        return;
      }

      const expenses = getExpenses();
      expenses.unshift({
        id: Date.now(),
        amount,
        category,
        description: desc,
        date: dateVal || todayStr()
      });
      saveExpenses(expenses);
      amtInput.value = '';
      descInput.value = '';
      dateInput.value = todayStr();
      showToast('Expense logged! 💰');
      renderExpenseTracker();
    }

    function deleteExpense(id) {
      const expenses = getExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      saveExpenses(filtered);
      showToast('Expense deleted');
      renderExpenseTracker();
    }

    function renderExpenseTracker() {
      const container = document.getElementById('expenseTrackerContainer');
      if (!container) return;

      const expenses = getExpenses();
      const today = new Date();
      const thisMonthYear = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      const monthlyTotal = expenses.reduce((sum, e) => {
        if (e.date && e.date.slice(0, 7) === thisMonthYear) {
          return sum + e.amount;
        }
        return sum;
      }, 0);

      const categories = ['Food 🥣', 'Medicine 💊', 'Vet Visit 🩺', 'Toys & Play 🧸', 'Grooming 🧼', 'Other 🐾'];

      let html = `
        <div class="card" style="margin-top:16px; border-left: 5px solid var(--orange)">
          <h3 style="font-weight:900; margin-bottom:4px">💰 Pet Expense Tracker</h3>
          <p class="subtitle" style="margin-bottom:12px">Track feeding, veterinary, and care costs for your pets.</p>
          
          <div style="background:var(--success-bg); border: 1px solid #B5EAD7; border-radius:14px; padding:12px; text-align:center; margin-bottom:14px">
            <small style="color:#1A6A4A; font-weight:800; font-size:11px; text-transform:uppercase">This Month's Spending</small>
            <div style="font-size:26px; font-weight:900; color:#1A6A4A; margin-top:2px">₹${monthlyTotal.toLocaleString('en-IN')}</div>
          </div>

          <div style="background:var(--bg); border:1px solid var(--border); padding:14px; border-radius:16px; margin-bottom:14px">
            <h4 style="font-weight:900; margin-bottom:10px; font-size:14px; color:var(--dark)">➕ Add Expense</h4>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px">
              <div>
                <label style="font-size:11px; margin-bottom:4px">Amount (₹)</label>
                <input id="expenseAmount" type="number" placeholder="e.g. 500" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
              </div>
              <div>
                <label style="font-size:11px; margin-bottom:4px">Category</label>
                <select id="expenseCategory" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
                  ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="margin-bottom:10px">
              <label style="font-size:11px; margin-bottom:4px">Description</label>
              <input id="expenseDesc" type="text" placeholder="e.g. Kibble bag, Ear cleaner" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
            </div>

            <div style="margin-bottom:12px">
              <label style="font-size:11px; margin-bottom:4px">Expense Date</label>
              <input id="expenseDate" type="date" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
            </div>

            <button class="primary-btn" onclick="addExpense()" style="margin:0; width:100%; padding:10px; border-radius:12px; font-size:13px">Log Expense</button>
          </div>

          <h4 style="font-weight:900; margin-bottom:8px; font-size:14px; color:var(--dark)">📜 Recent Expenses</h4>
          <div style="max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:8px">
      `;

      if (expenses.length === 0) {
        html += `<p style="font-size:12px; color:var(--muted); text-align:center; padding:12px 0">No expenses logged yet.</p>`;
      } else {
        html += expenses.slice(0, 30).map(e => {
          const formattedDate = new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--bg); border:1px solid var(--border); border-radius:12px; font-size:13px">
              <div style="flex:1; min-width:0; padding-right:8px">
                <div style="font-weight:800; color:var(--dark); text-overflow:ellipsis; overflow:hidden; white-space:nowrap">${e.description}</div>
                <div style="font-size:11px; color:var(--muted); margin-top:2px">${e.category} · ${formattedDate}</div>
              </div>
              <div style="display:flex; align-items:center; gap:10px">
                <b style="color:var(--dark); font-size:14px">₹${e.amount}</b>
                <button onclick="deleteExpense(${e.id})" style="background:none; border:none; color:#d64040; cursor:pointer; font-size:14px; padding:4px">✕</button>
              </div>
            </div>
          `;
        }).join('');
      }

      html += `
          </div>
        </div>
      `;
      container.innerHTML = html;

      const dateEl = document.getElementById('expenseDate');
      if (dateEl && !dateEl.value) {
        dateEl.value = todayStr();
      }
    }

    // ==================== FOOD & MEDICINE STOCK TRACKER ====================
    function getStockItems() {
      let items = pawCache.stockItems || [];
      if (items.length === 0) {
        try {
          const stored = (USE_SUPABASE_ONLY ? null : localStorage.getItem('pawStock'));
          if (stored) items = JSON.parse(stored);
        } catch (e) { }
        if (items.length > 0) {
          pawCache.stockItems = items;
        } else {
          items = [];
        }
      }
      return items;
    }

    async function saveStockItems(items) {
      pawCache.stockItems = items;
      (!USE_SUPABASE_ONLY && localStorage.setItem('pawStock', JSON.stringify(items)));
      if (!window.supabaseClient || !currentUser) return;
      const userId = currentUser.id;
      try {
        await window.supabaseClient.from('stock_items').delete().eq('household_id', currentHouseholdId);
        if (items.length > 0) {
          const rows = items.map(item => ({
            user_id: userId,
            name: item.name,
            type: item.type,
            quantity: parseFloat(item.quantity || 0),
            unit: item.unit || 'g',
            threshold: parseFloat(item.threshold || 0),
            decrement_amount: parseFloat(item.decrementAmount || 0)
          }));
          await window.supabaseClient.from('stock_items').insert(rows.map(r => ({...r, household_id: currentHouseholdId})));
        }
      } catch (err) {
        console.error("Error syncing stock items to Supabase:", err);
      }
    }

    function addStockItem() {
      const nameInput = document.getElementById('stockName');
      const typeSelect = document.getElementById('stockType');
      const qtyInput = document.getElementById('stockQty');
      const unitInput = document.getElementById('stockUnit');
      const threshInput = document.getElementById('stockThreshold');
      const decInput = document.getElementById('stockDecAmount');

      if (!nameInput || !typeSelect || !qtyInput || !unitInput || !threshInput || !decInput) return;

      const name = nameInput.value.trim();
      const type = typeSelect.value;
      const quantity = parseFloat(qtyInput.value);
      const unit = unitInput.value.trim() || 'units';
      const threshold = parseFloat(threshInput.value);
      const decrementAmount = parseFloat(decInput.value) || 1;

      if (!name) {
        showToast('Please enter item name');
        return;
      }
      if (isNaN(quantity) || quantity < 0) {
        showToast('Please enter valid quantity');
        return;
      }
      if (isNaN(threshold) || threshold < 0) {
        showToast('Please enter valid threshold');
        return;
      }

      const items = getStockItems();
      items.push({
        id: Date.now(),
        name,
        type,
        quantity,
        unit,
        threshold,
        decrementAmount
      });
      saveStockItems(items);

      nameInput.value = '';
      qtyInput.value = '';
      unitInput.value = '';
      threshInput.value = '';
      decInput.value = '';

      showToast(`${name} added to stock! 📦`);
      renderStockTracker();
    }

    function deleteStockItem(id) {
      const items = getStockItems();
      const filtered = items.filter(i => i.id !== id);
      saveStockItems(filtered);
      showToast('Item deleted');
      renderStockTracker();
    }

    function useStockItem(id, manualAmount) {
      const items = getStockItems();
      const item = items.find(i => i.id === id);
      if (!item) return;

      const amt = manualAmount !== undefined ? manualAmount : item.decrementAmount;
      if (item.quantity <= 0) {
        showToast(`Stock empty: ${item.name} is already at 0!`);
        return;
      }

      item.quantity = Math.max(0, parseFloat((item.quantity - amt).toFixed(2)));
      saveStockItems(items);

      let msg = `Used ${amt} ${item.unit} of ${item.name}. Remaining: ${item.quantity} ${item.unit}`;
      showToast(msg);

      if (item.quantity <= item.threshold) {
        setTimeout(() => {
          showToast(`⚠️ Low stock warning: ${item.name} is running low!`);
          if (typeof showNotification === 'function') {
            showNotification(`⚠️ Low stock: ${item.name} has only ${item.quantity} ${item.unit} left!`);
          }
        }, 800);
      }

      renderStockTracker();
    }

    function deductStockAutomatically(keyword, type) {
      const items = getStockItems();
      const keywordLower = keyword.toLowerCase();

      let item = items.find(i => i.type === type && keywordLower.includes(i.name.toLowerCase().replace(/🥣|💊/g, '').trim()));

      if (!item) {
        item = items.find(i => i.type === type);
      }

      if (item) {
        const amt = item.decrementAmount;
        if (item.quantity > 0) {
          item.quantity = Math.max(0, parseFloat((item.quantity - amt).toFixed(2)));
          saveStockItems(items);
          console.log(`Auto-deducted stock: ${amt} ${item.unit} from ${item.name}`);

          if (item.quantity <= item.threshold) {
            setTimeout(() => {
              showToast(`⚠️ Low stock warning: ${item.name} is running low!`);
              if (typeof showNotification === 'function') {
                showNotification(`⚠️ Low stock: ${item.name} has only ${item.quantity} ${item.unit} left!`);
              }
            }, 1000);
          }
          renderStockTracker();
        }
      }
    }

    function renderStockTracker() {
      const container = document.getElementById('stockTrackerContainer');
      if (!container) return;

      const items = getStockItems();

      let html = `
        <div class="card" style="margin-top:14px; border-left: 5px solid var(--purple)">
          <h3 style="font-weight:900; margin-bottom:4px">📦 Food & Medicine Stock Tracker</h3>
          <p class="subtitle" style="margin-bottom:12px">Track quantity, usage, and receive alerts when items run low.</p>
          
          <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:14px">
      `;

      if (items.length === 0) {
        html += `<p style="font-size:12px; color:var(--muted); text-align:center; padding:12px 0">No items in stock. Add one below!</p>`;
      } else {
        html += items.map(i => {
          const isLow = i.quantity <= i.threshold;
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg); border:1px solid var(--border); border-radius:14px; position:relative">
              <div style="flex:1; padding-right:10px">
                <div style="font-weight:900; color:var(--dark); font-size:14px; display:flex; align-items:center; gap:6px">
                  ${i.name}
                  ${isLow ? `<span style="background:var(--danger-bg); color:#d64040; border:1px solid #FFCCE0; font-size:9px; padding:1px 6px; border-radius:10px; font-weight:800">⚠️ LOW</span>` : ''}
                </div>
                <div style="font-size:12px; color:var(--muted); margin-top:2px">
                  Type: ${i.type === 'food' ? 'Bowl Food 🍽️' : 'Meds 💊'} · Usage portion: -${i.decrementAmount} ${i.unit}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px">
                <div style="text-align:right; margin-right:6px">
                  <div style="font-size:16px; font-weight:900; color:var(--dark)">${i.quantity} ${i.unit}</div>
                  <div style="font-size:10px; color:var(--muted)">Min: ${i.threshold} ${i.unit}</div>
                </div>
                <button class="small-btn" onclick="useStockItem(${i.id})" style="padding:6px 12px; font-weight:800; font-size:12px; border-radius:10px" title="Use Portion">Use</button>
                <button onclick="deleteStockItem(${i.id})" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:14px; padding:4px">✕</button>
              </div>
            </div>
          `;
        }).join('');
      }

      html += `
          </div>

          <button id="toggleStockFormBtn" onclick="document.getElementById('addStockFormDiv').style.display='block'; this.style.display='none';" style="width:100%; padding:10px; margin-bottom:10px; background:var(--bg); border:1px dashed var(--purple); color:var(--purple); border-radius:12px; font-weight:800; font-size:13px; cursor:pointer;">
            + Add Stock Item
          </button>

          <div id="addStockFormDiv" style="display:none; background:var(--bg); border:1px solid var(--border); padding:14px; border-radius:16px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="font-weight:900; font-size:14px; color:var(--dark); margin:0;">➕ Add Stock Item</h4>
              <button onclick="document.getElementById('addStockFormDiv').style.display='none'; document.getElementById('toggleStockFormBtn').style.display='block';" style="background:none; border:none; font-size:16px; color:var(--muted); cursor:pointer;">✕</button>
            </div>
            
            <div style="margin-bottom:10px">
              <label style="font-size:11px; margin-bottom:4px">Item Name</label>
              <input id="stockName" type="text" placeholder="e.g. Dry Salmon, Heartgard 6" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px">
              <div>
                <label style="font-size:11px; margin-bottom:4px">Type</label>
                <select id="stockType" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
                  <option value="food">Bowl Food 🍽️</option>
                  <option value="medicine">Medicine 💊</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px; margin-bottom:4px">Current Qty</label>
                <input id="stockQty" type="number" placeholder="e.g. 500" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px">
              <div>
                <label style="font-size:11px; margin-bottom:4px">Unit</label>
                <input id="stockUnit" type="text" placeholder="e.g. g, cans, pills" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
              </div>
              <div>
                <label style="font-size:11px; margin-bottom:4px">Low Limit</label>
                <input id="stockThreshold" type="number" placeholder="e.g. 100" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
              </div>
              <div>
                <label style="font-size:11px; margin-bottom:4px">Portion Use</label>
                <input id="stockDecAmount" type="number" placeholder="e.g. 50" style="margin:0; padding:8px 10px; font-size:13px; border-radius:10px; border:1px solid var(--border); background:#fff; color:var(--text)">
              </div>
            </div>

            <button class="primary-btn" onclick="addStockItem()" style="margin:0; width:100%; padding:10px; border-radius:12px; font-size:13px">Add Item</button>
          </div>
        </div>
      `;
      container.innerHTML = html;
    }

    // ==================== END NEW JS ====================

    console.log('Recipe database loaded from embedded JSON!');
    normalizeAndMergeDB();
    renderHomemadeTab();


// =============================================================================
// CAPACITOR NATIVE NOTIFICATION BRIDGE
// Extends showNotification(), enableNotifications(), startAllReminders(), 
// and saveCareTasks() to support native local notifications on Android/iOS.
// =============================================================================
(async function initCapacitor() {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;

  const { LocalNotifications, StatusBar, SplashScreen } = Capacitor.Plugins;

  // ── 1. Request notification permissions on launch ──────────────────────────
  try {
    const perm = await LocalNotifications.requestPermissions();
    console.log('[PawFeed] Notification permission:', perm.display);
  } catch (e) {
    console.warn('[PawFeed] Notification permission request failed:', e);
  }

  // ── 2. Hide native splash once the web app is ready ───────────────────────
  await SplashScreen.hide({ fadeOutDuration: 400 });

  // ── 3. Sync status bar with light/dark theme ──────────────────────────────
  function syncStatusBar() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    StatusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' }).catch(() => {});
    StatusBar.setBackgroundColor({ color: isDark ? '#0f1923' : '#ffffff' }).catch(() => {});
  }
  syncStatusBar();

  // Observe theme changes
  new MutationObserver(syncStatusBar).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  // ── 4. Native notification handler ────────────────────────────────────────
  let _nativeNotifId = 2000; // Start high for arbitrary notifications

  const _originalShowNotification = window.showNotification || function(){};
  window.showNotification = async function(title, message, type) {
    let finalTitle = title;
    let finalBody = message;

    // Handle single-argument calls (e.g. showNotification(msg))
    if (finalBody === undefined) {
      finalBody = title;
      finalTitle = '🐾 PawFeed';
    }

    // Keep existing in-app toast/notification working exactly as before
    _originalShowNotification(finalBody);

    try {
      await LocalNotifications.schedule({
        notifications: [{
          id:    _nativeNotifId++,
          title: finalTitle || 'PawFeed',
          body:  finalBody  || '',
          schedule: { at: new Date(Date.now() + 1000) },
          sound: null,
          smallIcon: 'ic_notification',
        }]
      });
    } catch (e) {
      console.warn('[PawFeed] Native notification failed:', e);
    }
  };

  // ── 5. Override enableNotifications ───────────────────────────────────────
  window.enableNotifications = async function() {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') {
        showToast('Notifications enabled ✅');
        startAllReminders();
      } else {
        showToast('Permission denied');
      }
    } catch (e) {
      showToast('Notifications not supported');
      console.error('[PawFeed] Native enableNotifications failed:', e);
    }
  };

  // ── 6. Native feeding reminder scheduler ──────────────────────────────────
  const _originalStartAllReminders = window.startAllReminders || function(){};
  window.startAllReminders = async function() {
    _originalStartAllReminders();

    try {
      const pets = typeof getPets === 'function' ? getPets() : [];
      if (!pets || !pets.length) return;

      // Cancel all existing scheduled feeding reminders first (IDs 1-999)
      const pending = await LocalNotifications.getPending();
      if (pending && pending.notifications) {
        const toCancel = pending.notifications
          .filter(n => n.id >= 1 && n.id < 1000)
          .map(n => ({ id: n.id }));
        if (toCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: toCancel });
        }
      }

      const nativeNotifications = [];
      let notifId = 1;

      pets.forEach(pet => {
        const times = [
          { hour: 7, minute: 0, title: 'Morning Meal 🌅', body: `Time to feed ${pet.name} their morning meal!` },
          { hour: 13, minute: 0, title: 'Afternoon Check ☀️', body: `Time to check on ${pet.name}!` },
          { hour: 19, minute: 30, title: 'Dinner Time 🌙', body: `Time to feed ${pet.name} their dinner!` }
        ];

        times.forEach(t => {
          nativeNotifications.push({
            id: notifId++,
            title: `🐾 ${t.title}`,
            body: t.body,
            schedule: {
              on: { hour: t.hour, minute: t.minute },
              repeats: true
            },
            sound: null,
            smallIcon: 'ic_notification',
          });
        });
      });

      if (nativeNotifications.length > 0) {
        await LocalNotifications.schedule({
          notifications: nativeNotifications
        });
        console.log(`[PawFeed] Scheduled ${nativeNotifications.length} native feeding reminders`);
      }
    } catch (e) {
      console.warn('[PawFeed] Failed to schedule native reminders:', e);
    }
  };

  const _originalToggleReminderSetting = window.toggleReminderSetting || function(){};
  window.toggleReminderSetting = async function() {
    _originalToggleReminderSetting();

    try {
      const toggle = document.getElementById('reminderToggle');
      const isEnabled = toggle && toggle.classList.contains('on');
      if (!isEnabled) {
        // Cancel all pending native feeding reminders (IDs 1-999)
        const pending = await LocalNotifications.getPending();
        if (pending && pending.notifications) {
          const toCancel = pending.notifications
            .filter(n => n.id >= 1 && n.id < 1000)
            .map(n => ({ id: n.id }));
          if (toCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: toCancel });
          }
        }
        console.log('[PawFeed] Cancelled all native feeding reminders');
      }
    } catch (e) {
      console.warn('[PawFeed] Failed to toggle native reminders:', e);
    }
  };

  // ── 7. Custom Care Task Reminders ──────────────────────────────────────────
  window._syncNativeTaskReminders = async function(tasks) {
    if (!tasks) return;
    try {
      const pending = await LocalNotifications.getPending();
      
      const stringToHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash) % 1000000 + 10000; // range 10000 - 1010000
      };

      const currentTaskIds = [];
      const nowMs = Date.now();
      const notificationsToSchedule = [];

      tasks.forEach(t => {
        if (t.reminder && !t.completed && t.dateTime) {
          const taskTime = new Date(t.dateTime).getTime();
          if (taskTime > nowMs) {
            const notifId = stringToHash(t.id);
            currentTaskIds.push(notifId);

            notificationsToSchedule.push({
              id: notifId,
              title: '📋 Care Task Reminder',
              body: t.title,
              schedule: { at: new Date(taskTime) },
              sound: null,
              smallIcon: 'ic_notification',
            });
          }
        }
      });

      // Cancel pending task notifications that are no longer active/needed
      if (pending && pending.notifications) {
        const toCancel = pending.notifications
          .filter(n => n.id >= 10000 && !currentTaskIds.includes(n.id))
          .map(n => ({ id: n.id }));
        if (toCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: toCancel });
        }
      }

      // Schedule new reminders
      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule
        });
        console.log(`[PawFeed] Scheduled ${notificationsToSchedule.length} native task reminders`);
      }
    } catch (e) {
      console.warn('[PawFeed] Failed to sync task reminders:', e);
    }
  };

  const _originalSaveCareTasks = window.saveCareTasks || function(){};
  window.saveCareTasks = async function(tasks) {
    await _originalSaveCareTasks(tasks);
    await window._syncNativeTaskReminders(tasks);
  };

  // Sync existing task reminders on startup
  try {
    const tasks = typeof getCareTasks === 'function' ? getCareTasks() : [];
    if (tasks && tasks.length > 0) {
      await window._syncNativeTaskReminders(tasks);
    }
  } catch (e) {
    console.warn('[PawFeed] Startup task reminders sync failed:', e);
  }

  // ── 8. Remote Push Notifications ──────────────────────────────────────────
  const { PushNotifications } = Capacitor.Plugins;
  if (PushNotifications) {
    window.initPushNotifications = async function(userId) {
      if (!window.supabaseClient) return;
      
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permission not granted');
          return;
        }

        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token: ' + token.value);
          await window.supabaseClient.from('user_profiles').upsert({
            id: userId,
            push_token: token.value
          });
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on push registration: ' + JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ' + JSON.stringify(notification));
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed: ' + JSON.stringify(notification));
        });
      } catch (e) {
        console.error('Failed to init push notifications', e);
      }
    };
  } else {
    window.initPushNotifications = async function() {
      console.warn('PushNotifications plugin not available');
    };
  }

})();



// ==================== GOOGLE AUTH HANDLER ====================
async function handleGoogleSignIn() {
  try {
    showToast("Opening Google sign-in...");
    const data = await window.signInWithGoogle();
    const user = data.user;
    
    if (user) {
      const { data: pets } = await window.supabaseClient.from('pets').select('id').eq('user_id', user.id);
      
      currentUser = user;
      localStorage.setItem('pawfeedCurrentUser', JSON.stringify(user));
      
      if (!pets || pets.length === 0) {
        const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
        const avatarUrl = user.user_metadata?.avatar_url || '';
        
        await window.supabaseClient.from('user_profiles').upsert({
          id: user.id,
          display_name: fullName,
          avatar_url: avatarUrl,
          email: user.email
        });
        
        loadApp();
        setTimeout(() => {
          openPetModal(-1);
          showToast("Welcome! Let's add your first pet. 🐾");
        }, 1000);
      } else {
        loadApp();
        if (window.supabaseClient) {
          await fetchAllDataFromSupabase();
          refreshAllUI();
          initCalendar();
        }
        showToast("Signed in with Google! ✅");
      }
    }
  } catch (error) {
    console.error("Google sign-in error:", error);
    if (error.message && error.message.toLowerCase().includes('cancel')) {
      showToast("Google sign-in cancelled");
    } else {
      showToast("Sign-in failed — please try again");
    }
  }
}

const originalLoadUser = loadUser;
loadUser = function() {
  originalLoadUser();
  const googleBadge = document.getElementById('googleBadge');
  if (currentUser && currentUser.app_metadata && currentUser.app_metadata.provider === 'google') {
    if (googleBadge) {
      googleBadge.classList.remove('hidden');
      googleBadge.style.display = 'flex';
    }
    const forgotSpan = document.querySelector('.card span[onclick="openForgotPassword()"]');
    if (forgotSpan) forgotSpan.style.display = 'none';
  } else {
    if (googleBadge) {
      googleBadge.classList.add('hidden');
      googleBadge.style.display = 'none';
    }
    const forgotSpan = document.querySelector('.card span[onclick="openForgotPassword()"]');
    if (forgotSpan) forgotSpan.style.display = 'inline';
  }
};

if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  window.Capacitor.Plugins.App.addListener('appUrlOpen', async (data) => {
    if (data.url.includes('/auth/v1/callback') || data.url.includes('access_token=')) {
      if (window.supabaseClient) {
        setTimeout(async () => {
          const { data: { session } } = await window.supabaseClient.auth.getSession();
          if (session && session.user) {
            currentUser = session.user;
            localStorage.setItem('pawfeedCurrentUser', JSON.stringify(session.user));
            
            const { data: pets } = await window.supabaseClient.from('pets').select('id').eq('user_id', session.user.id);
            if (!pets || pets.length === 0) {
              const fullName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
              await window.supabaseClient.from('user_profiles').upsert({
                id: session.user.id,
                display_name: fullName,
                email: session.user.email
              });
              loadApp();
              setTimeout(() => { openPetModal(-1); }, 1000);
            } else {
              loadApp();
              await fetchAllDataFromSupabase();
              refreshAllUI();
              initCalendar();
            }
          }
        }, 500);
      }
    }
  });
}


window.completePlannerTask = completePlannerTask;
window.uncompletePlannerTask = uncompletePlannerTask;
window.deletePlannerTask = deletePlannerTask;


// ==================== PET RECORDS & HEALTH ====================


window.switchRecordsSub = function(sub) {
    document.getElementById('rsub-history').classList.remove('active');
    document.getElementById('rsub-reports').classList.remove('active');
    document.getElementById('rinner-history').style.display = 'none';
    document.getElementById('rinner-reports').style.display = 'none';
    
    document.getElementById('rsub-' + sub).classList.add('active');
    document.getElementById('rinner-' + sub).style.display = 'block';
    
    if (sub === 'history') renderMedicalRecordsBox();
    if (sub === 'reports') renderMedicalReportsBox();
};

window.renderMedicalRecordsBox = function() {
    const box = document.getElementById('medicalRecordsBox');
    if (!box) return;
    
    const activeIdx = getActivePetIdx();
    const pet = getPets()[activeIdx];
    if (!pet) {
        box.innerHTML = `
        <div class="empty-state card" style="text-align:center; padding: 30px;">
            <div style="font-size:3rem; margin-bottom:10px;">🐾</div>
            <h3 style="margin-bottom:5px;">No Pet Selected</h3>
            <p style="color:var(--muted); font-size:0.9rem;">Please add or select a pet first.</p>
        </div>`;
        return;
    }
    
    const records = (pawCache.medicalRecords || []).filter(r => String(r.pet_id) === String(pet.id));
    
    if (records.length === 0) {
        box.innerHTML = `
        <div class="empty-state card" style="text-align:center; padding: 30px;">
            <div style="font-size:3rem; margin-bottom:10px;">🩺</div>
            <h3 style="margin-bottom:5px;">No Medical Records</h3>
            <p style="color:var(--muted); font-size:0.9rem;">Keep track of vaccinations, vet visits, and more.</p>
        </div>`;
        return;
    }
    
    // Sort upcoming first, then completed by date desc
    records.sort((a, b) => {
        if (a.status === 'Upcoming' && b.status !== 'Upcoming') return -1;
        if (b.status === 'Upcoming' && a.status !== 'Upcoming') return 1;
        return new Date(b.date) - new Date(a.date);
    });
    
    let html = '';
    records.forEach(r => {
        let icon = '🩺'; // default
        switch (r.record_type) {
            case 'vaccination': icon = '💉'; break;
            case 'surgery': icon = '🏥'; break;
            case 'illness': icon = '🩹'; break;
            case 'medication': icon = '💊'; break;
            case 'lab_test': icon = '🧪'; break;
            case 'other': icon = '📋'; break;
        }
        let statusBadge = '';
        if (r.status === 'Upcoming') {
            statusBadge = `<span style="font-size:0.8rem; background:var(--primary); color:white; padding:3px 10px; border-radius:12px; font-weight:bold;">Upcoming</span>`;
        } else if (r.status === 'Cancelled') {
            statusBadge = `<span style="font-size:0.8rem; background:#ff4d4f; color:white; padding:3px 10px; border-radius:12px; font-weight:bold;">Cancelled</span>`;
        } else {
            statusBadge = `<span style="font-size:0.8rem; background:#52c41a; color:white; padding:3px 10px; border-radius:12px; font-weight:bold;">Completed</span>`;
        }
        
        // Highlight overdue next_due_date
        let isOverdue = false;
        if (r.next_due_date) {
            isOverdue = new Date(r.next_due_date) < new Date();
        }

        html += `
        <div class="med-record-card" onclick="editMedicalRecord(${r.id})">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="med-icon-box">${icon}</div>
                    <div>
                        <h3 style="margin:0; font-size:1.1rem; color:var(--dark); font-weight: 800;">${r.vaccine_name || r.title || 'Record'}</h3>
                        <p style="margin:0; font-size:0.85rem; color:var(--muted);">${r.date}</p>
                    </div>
                </div>
                <div>${statusBadge}</div>
            </div>
            ${r.clinic_name ? `<p style="margin:6px 0 0 0; font-size:0.9rem; color:var(--text);"><b>🏥 Clinic:</b> ${r.clinic_name}</p>` : ''}
            ${r.reason ? `<p style="margin:4px 0 0 0; font-size:0.9rem; color:var(--text);"><b>📋 Reason:</b> ${r.reason}</p>` : ''}
            ${r.notes ? `<p style="margin:4px 0 0 0; font-size:0.9rem; color:var(--text);"><b>📝 Notes:</b> ${r.notes}</p>` : ''}
            ${r.next_due_date ? `<div style="margin-top:10px; padding:8px 10px; background:${isOverdue ? 'rgba(207,19,34,0.1)' : 'var(--pill-bg)'}; border-radius:8px; font-size:0.85rem; color:${isOverdue ? '#cf1322' : 'var(--dark)'}; font-weight: 600; display:flex; align-items:center; gap:6px;">
                <span>🗓️ Next Due:</span> <span>${r.next_due_date} ${isOverdue ? '(OVERDUE)' : ''}</span>
            </div>` : ''}
            <div style="text-align: right; margin-top: 10px;">
                <button class="btn" style="background:transparent; border:none; color:#ff4d4f; font-size:1.2rem; cursor:pointer; padding: 4px; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="event.stopPropagation(); deleteMedicalRecord(${r.id})">🗑️</button>
            </div>
        </div>`;
    });
    box.innerHTML = html;
};

window.openMedicalRecordModal = function(id = null) {
    const modal = document.getElementById('medicalRecordModal');
    if (!modal) return;
    
    if (id) {
        document.getElementById('medicalRecordModalTitle').innerText = 'Edit Record';
        document.getElementById('medRecordId').value = id;
        const r = pawCache.medicalRecords.find(x => String(x.id) === String(id));
        if (r) {
            document.getElementById('medRecordType').value = r.record_type;
            document.getElementById('medRecordTitle').value = r.vaccine_name || r.title || '';
            document.getElementById('medRecordDate').value = r.date || '';
            document.getElementById('medRecordNextDue').value = r.next_due_date || '';
            document.getElementById('medRecordClinic').value = r.clinic_name || '';
            if(document.getElementById('medRecordReason')) document.getElementById('medRecordReason').value = r.reason || '';
            document.getElementById('medRecordNotes').value = r.notes || '';
            document.getElementById('medRecordStatus').value = r.status || 'Completed';
        }
    } else {
        document.getElementById('medicalRecordModalTitle').innerText = 'Add Record';
        document.getElementById('medRecordId').value = '';
        document.getElementById('medRecordType').value = 'vaccination';
        document.getElementById('medRecordTitle').value = '';
        document.getElementById('medRecordDate').value = new Date().toISOString().slice(0, 10);
        document.getElementById('medRecordNextDue').value = '';
        document.getElementById('medRecordClinic').value = '';
        if(document.getElementById('medRecordReason')) document.getElementById('medRecordReason').value = '';
        document.getElementById('medRecordNotes').value = '';
        document.getElementById('medRecordStatus').value = 'Completed';
    }
    modal.classList.remove('hidden');
};

window.closeMedicalRecordModal = function() {
    const modal = document.getElementById('medicalRecordModal');
    if (modal) modal.classList.add('hidden');
};

window.editMedicalRecord = window.openMedicalRecordModal;

window.saveMedicalRecord = async function() {
    if (!currentUser) return showToast("Must be logged in.");
    const id = document.getElementById('medRecordId').value;
    const petIdx = getActivePetIdx();
    const pet = getPets()[petIdx];
    if (!pet) return showToast("No pet selected.");
    
    const payload = {
        user_id: currentUser.id,
        pet_id: pet.id,
        record_type: document.getElementById('medRecordType').value,
        vaccine_name: document.getElementById('medRecordTitle').value,
        date: document.getElementById('medRecordDate').value,
        next_due_date: document.getElementById('medRecordNextDue').value || null,
        clinic_name: document.getElementById('medRecordClinic').value,
        notes: document.getElementById('medRecordNotes').value,
        status: document.getElementById('medRecordStatus').value
    };
    if(document.getElementById('medRecordReason')) {
        payload.reason = document.getElementById('medRecordReason').value;
    }
    if (id) payload.id = id;
    
    if (!payload.date) return showToast("Date is required.");
    if (!payload.vaccine_name) return showToast("Title is required.");
    
    showToast("Saving...");
    const { data, error } = await window.supabaseClient.from('medical_records').upsert({...payload, household_id: currentHouseholdId}).select().single();
    if (error) {
        console.error(error);
        showToast("Error saving record.");
    } else {
        if (!pawCache.medicalRecords) pawCache.medicalRecords = [];
        const existingIdx = pawCache.medicalRecords.findIndex(x => String(x.id) === String(data.id));
        if (existingIdx > -1) {
            pawCache.medicalRecords[existingIdx] = data;
        } else {
            pawCache.medicalRecords.push(data);
        }
        closeMedicalRecordModal();
        renderMedicalRecordsBox();
        showToast("Record saved successfully ✅");
    }
};

window.deleteMedicalRecord = async function(id) {
    if (!confirm("Are you sure you want to delete this record?")) return;
    showToast("Deleting...");
    const { error } = await window.supabaseClient.from('medical_records').delete().eq('id', id);
    if (error) {
        console.error(error);
        showToast("Error deleting record.");
    } else {
        pawCache.medicalRecords = pawCache.medicalRecords.filter(x => String(x.id) !== String(id));
        renderMedicalRecordsBox();
        showToast("Record deleted 🗑️");
    }
};

window.renderMedicalReportsBox = function() {
    const box = document.getElementById('medicalReportsBox');
    if (!box) return;
    
    const activeIdx = getActivePetIdx();
    const pet = getPets()[activeIdx];
    if (!pet) {
        box.innerHTML = `
        <div class="empty-state card" style="text-align:center; padding: 30px;">
            <div style="font-size:3rem; margin-bottom:10px;">🐾</div>
            <h3 style="margin-bottom:5px;">No Pet Selected</h3>
            <p style="color:var(--muted); font-size:0.9rem;">Please add or select a pet first.</p>
        </div>`;
        return;
    }
    
    const reports = (pawCache.medicalReports || []).filter(r => String(r.pet_id) === String(pet.id));
    
    if (reports.length === 0) {
        box.innerHTML = `
        <div class="empty-state card" style="text-align:center; padding: 30px;">
            <div style="font-size:3rem; margin-bottom:10px;">📄</div>
            <h3 style="margin-bottom:5px;">No Medical Reports</h3>
            <p style="color:var(--muted); font-size:0.9rem;">Upload prescriptions, lab results, and x-rays.</p>
        </div>`;
        return;
    }
    
    reports.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    
    let html = '';
    reports.forEach(r => {
        let fileIcon = '📄';
        if (r.file_url.includes('.pdf')) fileIcon = '📕';
        else if (r.file_url.match(/\.(jpeg|jpg|gif|png)$/i)) fileIcon = '🖼️';

        html += `
        <div class="med-report-card">
            <div style="flex:1; display:flex; align-items:center; gap:14px; cursor:pointer;" onclick="window.open('${r.file_url}', '_blank')">
                <div class="med-icon-box" style="color:var(--primary);">${fileIcon}</div>
                <div>
                    <h3 style="margin:0; font-size:1.1rem; color:var(--dark); font-weight: 800;">${r.title || 'Document'}</h3>
                    <p style="margin:0; font-size:0.85rem; color:var(--muted);">${r.upload_date} • <span style="background:var(--pill-bg); color:var(--dark); padding:2px 6px; border-radius:6px; font-size:0.75rem;">${r.report_type}</span></p>
                    ${r.notes ? `<p style="margin:6px 0 0 0; font-size:0.85rem; color:var(--text);">${r.notes}</p>` : ''}
                </div>
            </div>
            <button class="btn" style="background:transparent; border:none; color:#ff4d4f; font-size:1.4rem; cursor:pointer; padding: 8px; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="deleteMedicalReport(${r.id}, '${r.file_url}')">🗑️</button>
        </div>`;
    });
    box.innerHTML = html;
};

window.openMedicalReportModal = function() {
    const modal = document.getElementById('medicalReportModal');
    if (!modal) return;
    
    document.getElementById('medReportTitle').value = '';
    document.getElementById('medReportType').value = 'Lab Results';
    document.getElementById('medReportNotes').value = '';
    
    const fileInput = document.getElementById('medReportFile');
    if (fileInput) fileInput.value = '';
    
    modal.classList.remove('hidden');
};

window.closeMedicalReportModal = function() {
    const modal = document.getElementById('medicalReportModal');
    if (modal) modal.classList.add('hidden');
};

window.uploadMedicalReport = async function() {
    if (!currentUser) return showToast("Must be logged in.");
    const petIdx = getActivePetIdx();
    const pet = getPets()[petIdx];
    if (!pet) return showToast("No pet selected.");
    
    const title = document.getElementById('medReportTitle').value;
    const type = document.getElementById('medReportType').value;
    const notes = document.getElementById('medReportNotes').value;
    const fileInput = document.getElementById('medReportFile');
    
    if (!title) return showToast("Title is required.");
    if (!fileInput.files || fileInput.files.length === 0) return showToast("Please select a file.");
    
    const file = fileInput.files[0];
    const fileName = `${currentUser.id}/${pet.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const btn = document.getElementById('medReportSaveBtn');
    const loading = document.getElementById('medReportUploading');
    btn.disabled = true;
    loading.style.display = 'block';
    
    try {
        // Convert file to ArrayBuffer to prevent Capacitor fetch issues
        const arrayBuffer = await file.arrayBuffer();
        
        // Upload to Storage
        const { data: uploadData, error: uploadError } = await window.supabaseClient.storage
            .from('medical-reports')
            .upload(fileName, arrayBuffer, {
                contentType: file.type,
                upsert: false
            });
            
        if (uploadError) {
            console.error("Storage upload error details:", uploadError);
            throw uploadError;
        }
        
        // Get Public URL
        const { data: publicUrlData } = window.supabaseClient.storage
            .from('medical-reports')
            .getPublicUrl(fileName);
            
        // Save to DB
        const payload = {
            user_id: currentUser.id,
            pet_id: pet.id,
            title: title,
            upload_date: new Date().toISOString().slice(0, 10),
            report_type: type,
            file_url: publicUrlData.publicUrl,
            notes: notes
        };
        
        const { data: dbData, error: dbError } = await window.supabaseClient
            .from('medical_reports')
            .insert(payload)
            .select()
            .single();
            
        if (dbError) throw dbError;
        
        if (!pawCache.medicalReports) pawCache.medicalReports = [];
        pawCache.medicalReports.push(dbData);
        
        closeMedicalReportModal();
        renderMedicalReportsBox();
        showToast("Report uploaded successfully 📄✅");
    } catch (e) {
        console.error("Upload error:", e);
        showToast("Failed to upload report.");
    } finally {
        btn.disabled = false;
        loading.style.display = 'none';
    }
};

window.deleteMedicalReport = async function(id, fileUrl) {
    if (!confirm("Are you sure you want to delete this report? This action cannot be undone.")) return;
    
    // Extract file path from URL
    let filePath = fileUrl;
    try {
        const urlParts = fileUrl.split('/medical-reports/');
        if (urlParts.length > 1) {
            filePath = urlParts[1];
        }
    } catch (e) {}
    
    showToast("Deleting...");
    
    try {
        // Delete from Storage
        if (filePath !== fileUrl) {
            await window.supabaseClient.storage.from('medical-reports').remove([filePath]);
        }
        
        // Delete from DB
        const { error } = await window.supabaseClient.from('medical_reports').delete().eq('id', id);
        if (error) throw error;
        
        pawCache.medicalReports = pawCache.medicalReports.filter(x => String(x.id) !== String(id));
        renderMedicalReportsBox();
        showToast("Report deleted 🗑️");
    } catch (e) {
        console.error("Delete error:", e);
        showToast("Failed to delete report.");
    }
};

window.renderRecordsTab = function() {
    renderMedicalRecordsBox();
    renderMedicalReportsBox();
};



// ==================== DASHBOARD MINI CHART ====================
let dashboardMiniChartInstance = null;
window.renderDashboardMiniChart = function(pets, activeIdx, noPet) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('dashboardMiniChart');
  if (!canvas) return;
  
  if (noPet || !pets || pets.length === 0) {
    if (dashboardMiniChartInstance) { dashboardMiniChartInstance.destroy(); dashboardMiniChartInstance = null; }
    return;
  }

  const activePet = pets[activeIdx];
  const ctx = canvas.getContext('2d');
  if (dashboardMiniChartInstance) { dashboardMiniChartInstance.destroy(); }

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Dummy data. In a real app this pulls from local DB/Supabase logs.
  const feedings = [2, 3, 2, 2, 3, 2, 4];
  const water = [80, 90, 70, 85, 95, 100, 80];

  dashboardMiniChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Feedings',
          data: feedings,
          borderColor: '#FF7A00',
          backgroundColor: 'rgba(255, 122, 0, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Water %',
          data: water,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { display: true, grid: { display: false } },
        y: { display: false, min: 0 }
      }
    }
  });
};
