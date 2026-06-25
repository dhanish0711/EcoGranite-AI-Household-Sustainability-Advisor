// ==========================================================================
// EcoGranite - Application Logic & State Management
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    let state = {
        assessment: {
            monthlyKwh: 0,
            energySource: 'mixed',
            cookingFuel: 'lpg',
            monthlyWater: 0,
            waterHabits: 'medium',
            wasteGeneration: 0,
            recyclingLevel: 'none',
            monthlyKm: 0,
            vehicleType: 'petrol',
            isCalculated: false,
            totalCarbon: 0.0
        },
        habits: {
            shower: false,
            lights: false,
            plastic: false,
            transport: false,
            compost: false,
            streakCount: 0,
            lastCheckedDate: null,
            completedDates: [] // Array of 'YYYY-MM-DD'
        },
        apiSettings: {
            apikey: '',
            projectId: '',
            serviceUrl: 'https://us-south.ml.cloud.ibm.com',
            modelId: 'ibm/granite-3-8b-instruct'
        },
        chatHistory: [], // Array of {role, content}
        theme: 'emerald',
        offsetPlanner: {
            target: 4.0,
            trees: 0,
            solar: false
        }
    };

    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');
    
    // Status Indicators
    const apiStatusBanner = document.getElementById('api-status-banner');
    const apiStatusText = document.getElementById('api-status-text');

    // --- 1. Client-Side Routing & Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    function switchTab(tabName) {
        // Update active nav button
        navItems.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update view visibility
        views.forEach(view => view.classList.remove('active'));
        const activeView = document.getElementById(`view-${tabName}`);
        if (activeView) activeView.classList.add('active');

        // Update page header title
        const titles = {
            dashboard: 'Eco Dashboard',
            assessment: 'Household Carbon & Eco Audit',
            simulators: 'Interactive Resource Simulators',
            habits: 'Habits & Streaks Tracker',
            advisor: 'IBM Granite Advisor',
            quiz: 'Eco-Trivia Arena',
            settings: 'IBM watsonx.ai Credentials'
        };
        pageTitle.textContent = titles[tabName] || 'EcoGranite';
        
        // Scroll to top
        document.querySelector('.view-container').scrollTop = 0;
        
        // Auto-initialize first quiz question when opening the quiz view
        if (tabName === 'quiz' && !quizState.currentQuestion) {
            generateQuestion();
        }
    }

    // --- 2. Settings Management ---
    const settingsForm = document.getElementById('settings-form');
    const btnClearSettings = document.getElementById('btn-clear-settings');

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.apiSettings.apikey = document.getElementById('setting-apikey').value.trim();
        state.apiSettings.projectId = document.getElementById('setting-project-id').value.trim();
        state.apiSettings.serviceUrl = document.getElementById('setting-service-url').value.trim();
        state.apiSettings.modelId = document.getElementById('setting-model').value;

        saveStateToStorage();
        updateAPIStatusIndicator();
        showToast('Configuration saved successfully!', 'success');
        switchTab('dashboard');
    });

    btnClearSettings.addEventListener('click', () => {
        state.apiSettings = {
            apikey: '',
            projectId: '',
            serviceUrl: 'https://us-south.ml.cloud.ibm.com',
            modelId: 'ibm/granite-3-8b-instruct'
        };
        settingsForm.reset();
        document.getElementById('setting-service-url').value = 'https://us-south.ml.cloud.ibm.com';
        document.getElementById('setting-model').value = 'ibm/granite-3-8b-instruct';
        
        saveStateToStorage();
        updateAPIStatusIndicator();
        showToast('API Credentials cleared. Switched back to Simulation Mode.', 'info');
    });

    function updateAPIStatusIndicator() {
        const hasCredentials = state.apiSettings.apikey && state.apiSettings.projectId;
        if (hasCredentials) {
            apiStatusBanner.className = 'status-indicator live';
            apiStatusText.textContent = 'Live API Active';
            document.getElementById('chat-model-indicator').textContent = `Model: ${state.apiSettings.modelId}`;
        } else {
            apiStatusBanner.className = 'status-indicator simulated';
            apiStatusText.textContent = 'Simulation Mode';
            document.getElementById('chat-model-indicator').textContent = `Model: ibm/granite-3-8b-instruct`;
        }
    }

    // --- 3. Sustainability Assessment Calculator ---
    const assessmentForm = document.getElementById('assessment-form');
    const btnOptimizeAI = document.getElementById('btn-optimize-ai');

    assessmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Grab values
        state.assessment.monthlyKwh = parseFloat(document.getElementById('monthly-kwh').value) || 0;
        state.assessment.energySource = document.getElementById('energy-source').value;
        state.assessment.cookingFuel = document.getElementById('cooking-fuel').value;
        state.assessment.monthlyWater = parseFloat(document.getElementById('monthly-water').value) || 0;
        state.assessment.waterHabits = document.getElementById('water-habits').value;
        state.assessment.wasteGeneration = parseFloat(document.getElementById('waste-generation').value) || 0;
        state.assessment.recyclingLevel = document.getElementById('recycling-level').value;
        state.assessment.monthlyKm = parseFloat(document.getElementById('monthly-km').value) || 0;
        state.assessment.vehicleType = document.getElementById('vehicle-type').value;
        state.assessment.isCalculated = true;

        saveStateToStorage();
        calculateAndDisplayScores();
        btnOptimizeAI.removeAttribute('disabled');
        
        showToast('Assessment calculated! Go to the Dashboard to review your score.', 'success');
        switchTab('dashboard');
    });

    btnOptimizeAI.addEventListener('click', () => {
        if (!state.assessment.isCalculated) return;
        
        // Create an optimization prompt
        const prompt = `Please analyze my household metrics and give me a custom action plan. Here is my profile:
- Monthly electricity usage: ${state.assessment.monthlyKwh} kWh (Grid: ${state.assessment.energySource}, Cooking: ${state.assessment.cookingFuel})
- Monthly water usage: ${state.assessment.monthlyWater} Liters (Habits rating: ${state.assessment.waterHabits})
- Weekly solid waste: ${state.assessment.wasteGeneration} kg (Recycling/Composting status: ${state.assessment.recyclingLevel})
- Monthly vehicle driving distance: ${state.assessment.monthlyKm} km (Vehicle fuel type: ${state.assessment.vehicleType})

Give me specific action items to optimize my household sustainability index and carbon footprint.`;
        
        switchTab('advisor');
        sendUserChatMessage(prompt);
    });

    function calculateAndDisplayScores() {
        if (!state.assessment.isCalculated) return;

        // --- Metric 1: Carbon Footprint (tons CO2e/year) ---
        let gridCoeff = 0.00045; // Mixed grid
        if (state.assessment.energySource === 'coal') gridCoeff = 0.0008;
        if (state.assessment.energySource === 'solar') gridCoeff = 0.00005;

        const electricityCarbon = state.assessment.monthlyKwh * 12 * gridCoeff;
        
        let cookingCoeff = 0.0022; // LPG
        if (state.assessment.cookingFuel === 'electric') cookingCoeff = 0.0002;
        if (state.assessment.cookingFuel === 'biomass') cookingCoeff = 0.0035;
        const cookingCarbon = cookingCoeff * 12 * 20; // Assume constant cooking volume model

        const waterCarbon = state.assessment.monthlyWater * 12 * 0.000000298; // Water treatment carbon is very low but present
        const wasteCarbon = state.assessment.wasteGeneration * 52 * 0.00189; // Landfill gas emissions (CH4 equivalent CO2)
        
        let vehicleCoeff = 0.00021; // Petrol
        if (state.assessment.vehicleType === 'diesel') vehicleCoeff = 0.00025;
        if (state.assessment.vehicleType === 'electric') vehicleCoeff = 0.00006;
        if (state.assessment.vehicleType === 'none') vehicleCoeff = 0.0;
        const vehicleCarbon = state.assessment.monthlyKm * 12 * vehicleCoeff;

        const totalCarbon = electricityCarbon + cookingCarbon + waterCarbon + wasteCarbon + vehicleCarbon;
        
        // Save gross carbon in state
        state.assessment.totalCarbon = totalCarbon;
        
        // Display Carbon Footprint
        document.getElementById('dashboard-carbon').textContent = totalCarbon.toFixed(1);
        
        // Recalculate offsets & target planner
        recalculateOffsets();
        
        // Carbon Progress Bar (max scale 15 tons CO2e for normal home)
        const carbonPercentage = Math.min((totalCarbon / 15) * 100, 100);
        const carbonBar = document.getElementById('carbon-progress-bar');
        carbonBar.style.width = `${carbonPercentage}%`;
        
        // Color transition for carbon bar based on footprint size
        if (totalCarbon < 4.0) {
            carbonBar.style.background = 'linear-gradient(90deg, #10b981, #14b8a6)';
            document.getElementById('carbon-comparison').textContent = 'Amazing! Your emissions are well below the global average (4.5t).';
        } else if (totalCarbon < 10.0) {
            carbonBar.style.background = 'linear-gradient(90deg, #f59e0b, #10b981)';
            document.getElementById('carbon-comparison').textContent = 'Moderate. Your carbon impact could be reduced by ~20%.';
        } else {
            carbonBar.style.background = 'linear-gradient(90deg, #f43f5e, #f59e0b)';
            document.getElementById('carbon-comparison').textContent = 'High emissions! Review your energy and travel habits.';
        }

        // --- Dynamic Carbon Emissions Source Breakdown Update ---
        if (totalCarbon > 0) {
            const pctEnergy = (electricityCarbon / totalCarbon) * 100;
            const pctCooking = (cookingCarbon / totalCarbon) * 100;
            const pctWater = (waterCarbon / totalCarbon) * 100;
            const pctWaste = (wasteCarbon / totalCarbon) * 100;
            const pctTransport = (vehicleCarbon / totalCarbon) * 100;

            document.getElementById('breakdown-energy').style.width = `${pctEnergy}%`;
            document.getElementById('breakdown-cooking').style.width = `${pctCooking}%`;
            document.getElementById('breakdown-water').style.width = `${pctWater}%`;
            document.getElementById('breakdown-waste').style.width = `${pctWaste}%`;
            document.getElementById('breakdown-transport').style.width = `${pctTransport}%`;

            document.getElementById('leg-energy').textContent = `${pctEnergy.toFixed(0)}%`;
            document.getElementById('leg-cooking').textContent = `${pctCooking.toFixed(0)}%`;
            document.getElementById('leg-water').textContent = `${pctWater.toFixed(0)}%`;
            document.getElementById('leg-waste').textContent = `${pctWaste.toFixed(0)}%`;
            document.getElementById('leg-transport').textContent = `${pctTransport.toFixed(0)}%`;
        } else {
            document.getElementById('breakdown-energy').style.width = '0%';
            document.getElementById('breakdown-cooking').style.width = '0%';
            document.getElementById('breakdown-water').style.width = '0%';
            document.getElementById('breakdown-waste').style.width = '0%';
            document.getElementById('breakdown-transport').style.width = '0%';
        }

        // --- Metric 2: Sustainability Index (0-100) ---
        // Energy Score: Base 100, deduct based on kWh
        let energyScore = 100 - (state.assessment.monthlyKwh / 10);
        if (state.assessment.energySource === 'coal') energyScore -= 15;
        if (state.assessment.energySource === 'solar') energyScore += 10;
        if (state.assessment.cookingFuel === 'biomass') energyScore -= 10;
        energyScore = Math.max(Math.min(energyScore, 100), 10);

        // Water Score: Base 100, deduct based on consumption
        let waterScore = 100 - (state.assessment.monthlyWater / 300);
        if (state.assessment.waterHabits === 'low') waterScore -= 15;
        if (state.assessment.waterHabits === 'high') waterScore += 15;
        waterScore = Math.max(Math.min(waterScore, 100), 10);

        // Waste Score: Base 100, deduct based on trash volume
        let wasteScore = 100 - (state.assessment.wasteGeneration * 4.5);
        if (state.assessment.recyclingLevel === 'recycle') wasteScore += 10;
        if (state.assessment.recyclingLevel === 'compost') wasteScore += 20;
        if (state.assessment.recyclingLevel === 'none') wasteScore -= 15;
        wasteScore = Math.max(Math.min(wasteScore, 100), 10);

        // Transport Score: Base 100, deduct based on driving distance
        let transportScore = 100 - (state.assessment.monthlyKm / 12);
        if (state.assessment.vehicleType === 'petrol' || state.assessment.vehicleType === 'diesel') transportScore -= 15;
        if (state.assessment.vehicleType === 'none') transportScore += 20;
        transportScore = Math.max(Math.min(transportScore, 100), 10);

        // Calculate average index
        let totalScore = Math.round((energyScore + waterScore + wasteScore + transportScore) / 4);

        // Apply bonus from unchecked daily habits (+1 per checked habit)
        let activeHabitsCount = 0;
        ['shower', 'lights', 'plastic', 'transport', 'compost'].forEach(h => {
            if (state.habits[h]) activeHabitsCount++;
        });
        totalScore += activeHabitsCount * 2;
        totalScore = Math.min(totalScore, 100);

        // Display Score Ring & Feedback
        document.getElementById('dashboard-score').textContent = totalScore;
        const dashScoreRing = document.getElementById('dashboard-score-ring');
        // Dashoffset calculations: 251.2 * (1 - score/100)
        const offset = 251.2 - (totalScore / 100) * 251.2;
        dashScoreRing.style.strokeDashoffset = offset;

        // Apply interactive glow based on score range
        const progressCircleSvg = document.querySelector('.progress-circle');
        if (progressCircleSvg) {
            progressCircleSvg.classList.remove('glow-green', 'glow-yellow', 'glow-red');
            if (totalScore >= 80) {
                progressCircleSvg.classList.add('glow-green');
            } else if (totalScore >= 50) {
                progressCircleSvg.classList.add('glow-yellow');
            } else {
                progressCircleSvg.classList.add('glow-red');
            }
        }

        // Feedback strings
        let feedback = '';
        let statusClass = 'green';
        if (totalScore >= 80) {
            feedback = 'Outstanding green home profile! Keep practicing your daily habits.';
            statusClass = 'green';
        } else if (totalScore >= 50) {
            feedback = 'Good score. You have simple opportunities to save resources and costs.';
            statusClass = 'yellow';
        } else {
            feedback = 'Low score. We recommend prioritizing solar upgrades, leak checks, and composting.';
            statusClass = 'red';
        }
        document.getElementById('dashboard-score-feedback').textContent = feedback;

        // Update dashboard widget values
        document.getElementById('dash-energy-val').textContent = state.assessment.monthlyKwh;
        document.getElementById('dash-water-val').textContent = state.assessment.monthlyWater.toLocaleString();
        
        const energyStatusBadge = document.getElementById('dash-energy-status');
        energyStatusBadge.textContent = energyScore >= 80 ? 'Efficient' : (energyScore >= 50 ? 'Average' : 'High Load');
        energyStatusBadge.className = `badge ${energyScore >= 80 ? 'green' : (energyScore >= 50 ? 'yellow' : 'red')}`;

        const waterStatusBadge = document.getElementById('dash-water-status');
        waterStatusBadge.textContent = waterScore >= 80 ? 'Steward' : (waterScore >= 50 ? 'Moderate' : 'Excessive');
        waterStatusBadge.className = `badge ${waterScore >= 80 ? 'green' : (waterScore >= 50 ? 'yellow' : 'red')}`;

        // Populate quick high priority recommendation lists
        populateQuickTasks(energyScore, waterScore, wasteScore, transportScore);
        
        // Update achievements badges
        checkHabitAchievements(totalScore);
    }

    function populateQuickTasks(energyScore, waterScore, wasteScore, transportScore) {
        const list = document.getElementById('quick-tasks-list');
        list.innerHTML = '';
        
        let tasks = [];
        if (energyScore < 70) {
            tasks.push('Audit household appliances for vampire power draw (switch off outlets).');
            tasks.push('Swap standard lights with 9W energy-efficient LEDs.');
        }
        if (waterScore < 70) {
            tasks.push('Check toilet valves and pipe junctions for leaks.');
            tasks.push('Fit low-flow aerators on bathroom and kitchen faucets.');
        }
        if (wasteScore < 70) {
            tasks.push('Initiate a backyard or indoor composting system for wet food scraps.');
            tasks.push('Establish distinct waste bins to sort dry recycling paper, glass, and plastic.');
        }
        if (transportScore < 70) {
            tasks.push('Substitute walking or bike rides for vehicle trips under 3 kilometers.');
        }

        if (tasks.length === 0) {
            tasks.push('Maintain your current habits and query Granite for advanced sustainability options.');
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'task-item';
            li.innerHTML = `<span class="task-bullet"></span><span class="task-text">${task}</span>`;
            list.appendChild(li);
        });
    }

    // --- 4. Interactive Resource Simulators ---
    
    // Appliance Simulator Event Listeners
    const simAppliance = document.getElementById('sim-appliance');
    const simHours = document.getElementById('sim-hours');
    const simHoursVal = document.getElementById('sim-hours-val');
    const simRate = document.getElementById('sim-rate');

    function runApplianceSimulator() {
        const selectedOpt = simAppliance.options[simAppliance.selectedIndex];
        const watts = parseFloat(selectedOpt.getAttribute('data-watts')) || 0;
        const hours = parseFloat(simHours.value) || 0;
        const rate = parseFloat(simRate.value) || 0.15;
        
        simHoursVal.textContent = hours;

        // Calculations
        // Refrigerator runs roughly 50% cycle duty time
        const dutyCycle = selectedOpt.value === 'fridge' ? 0.5 : 1.0;
        const monthlyKwh = (watts * hours * 30 * dutyCycle) / 1000;
        const monthlyCost = monthlyKwh * rate;
        const monthlyCo2 = monthlyKwh * 0.44; // 0.44 kg CO2 per kWh average grid intensity

        // Display results
        document.getElementById('sim-energy-kwh').textContent = monthlyKwh.toFixed(1);
        document.getElementById('sim-energy-cost').textContent = `$${monthlyCost.toFixed(2)}`;
        document.getElementById('sim-energy-co2').textContent = monthlyCo2.toFixed(1);

        // Bulb comparison tip update
        const tipDiv = document.getElementById('bulb-comparison-tip');
        if (selectedOpt.value === 'incandescent') {
            tipDiv.style.display = 'block';
            tipDiv.innerHTML = `💡 **Efficiency Tip:** Running this 60W Incandescent bulb consumes **${monthlyKwh.toFixed(1)} kWh** per month. Upgrading to a 9W LED would use just **${((9 * hours * 30) / 1000).toFixed(1)} kWh**, saving **$${((monthlyKwh - ((9 * hours * 30) / 1000)) * rate).toFixed(2)}**!`;
        } else if (selectedOpt.value === 'ac') {
            tipDiv.style.display = 'block';
            tipDiv.innerHTML = `💡 **AC Efficiency Tip:** Keeping thermostat at 24°C rather than 18°C reduces AC power draw by ~18%, saving you about **$${(monthlyCost * 0.18).toFixed(2)}** per month!`;
        } else {
            tipDiv.style.display = 'none';
        }
    }

    simAppliance.addEventListener('change', runApplianceSimulator);
    simHours.addEventListener('input', runApplianceSimulator);
    simRate.addEventListener('input', runApplianceSimulator);

    // Water Leak Simulator Event Listeners
    const simDrips = document.getElementById('sim-drips');
    const simDripsVal = document.getElementById('sim-drips-val');
    const simLeakCost = document.getElementById('sim-leak-cost');

    function runWaterLeakSimulator() {
        const drips = parseInt(simDrips.value) || 0;
        const costRate = parseFloat(simLeakCost.value) || 1.50;
        
        simDripsVal.textContent = drips;

        // Calculations: 1 drip = ~0.2 milliliters (ml)
        const mlPerDrip = 0.2;
        const dailyLiters = (drips * mlPerDrip * 60 * 24) / 1000;
        const annualLiters = dailyLiters * 365;
        const annualCost = (annualLiters / 1000) * costRate;

        // Display results
        document.getElementById('sim-leak-daily').textContent = dailyLiters.toFixed(1);
        document.getElementById('sim-leak-annual').textContent = Math.round(annualLiters).toLocaleString();
        document.getElementById('sim-leak-cost-val').textContent = `$${annualCost.toFixed(2)}`;
    }

    simDrips.addEventListener('input', runWaterLeakSimulator);
    simLeakCost.addEventListener('input', runWaterLeakSimulator);

    // Initialize Simulators on Load
    runApplianceSimulator();
    runWaterLeakSimulator();

    // --- New AI-Based Features ---
    
    // 1. Appliance Audit AI trigger
    const btnAuditAppliance = document.getElementById('btn-audit-appliance');
    if (btnAuditAppliance) {
        btnAuditAppliance.addEventListener('click', () => {
            const selectedOpt = simAppliance.options[simAppliance.selectedIndex];
            const applianceLabel = selectedOpt.getAttribute('data-label') || selectedOpt.text;
            const hours = simHours.value;
            const kwh = document.getElementById('sim-energy-kwh').textContent;
            const cost = document.getElementById('sim-energy-cost').textContent;
            const co2 = document.getElementById('sim-energy-co2').textContent;
            
            const prompt = `Act as an expert energy auditor. I am running the following appliance:
- Appliance: ${applianceLabel}
- Daily Runtime: ${hours} hours
- Monthly consumption: ${kwh} kWh
- Monthly cost: ${cost}
- Monthly CO2 emissions: ${co2} kg

Provide a detailed energy audit for this appliance. Explain if this consumption is considered high, suggest energy-saving behavioral tips, and suggest alternative efficient models or upgrades (like energy star equivalents).`;
            
            switchTab('advisor');
            sendUserChatMessage(prompt);
        });
    }

    // 2. AI Weekly Challenge Generator
    const btnGenerateChallenge = document.getElementById('btn-generate-challenge');
    const aiChallengeContent = document.getElementById('ai-challenge-content');
    
    if (btnGenerateChallenge && aiChallengeContent) {
        btnGenerateChallenge.addEventListener('click', () => {
            btnGenerateChallenge.setAttribute('disabled', 'true');
            btnGenerateChallenge.textContent = 'Generating...';
            aiChallengeContent.innerHTML = '<div style="text-align:center;padding:10px;color:var(--accent-teal);">⌛ *EcoGranite is drafting your custom challenge...*</div>';
            
            // Gather habits
            let activeHabits = [];
            ['shower', 'lights', 'plastic', 'transport', 'compost'].forEach(h => {
                const cb = document.getElementById(`habit-${h}`);
                if (cb && cb.checked) {
                    const label = document.querySelector(`label[for="habit-${h}"]`);
                    const title = label ? label.querySelector('.habit-title') : null;
                    if (title) activeHabits.push(title.textContent);
                }
            });
            
            const score = document.getElementById('dashboard-score').textContent || '0';
            
            // Call API
            const prompt = `Based on my current completed eco habits ([${activeHabits.join(', ')}]) and my household Sustainability Index score of ${score}/100, generate a personal Weekly Eco-Challenge for me. 
Include:
1. Title (with an emoji)
2. Simple goal
3. 3 actionable steps
4. Environmental benefits

Format it cleanly with bold text and lists. Do not include any intro or conversational filler, start directly with the challenge title.`;

            // Call proxy chat API in background (without adding to standard chat history)
            const payload = {
                messages: [{ role: 'user', content: prompt }],
                apikey: state.apiSettings.apikey,
                project_id: state.apiSettings.projectId,
                service_url: state.apiSettings.serviceUrl,
                model_id: state.apiSettings.modelId
            };

            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                btnGenerateChallenge.removeAttribute('disabled');
                btnGenerateChallenge.textContent = 'Generate Custom Challenge';
                
                let reply = '';
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    reply = data.choices[0].message.content;
                } else {
                    reply = getRandomMockChallenge();
                }
                
                aiChallengeContent.innerHTML = formatMarkdown(reply);
            })
            .catch(err => {
                btnGenerateChallenge.removeAttribute('disabled');
                btnGenerateChallenge.textContent = 'Generate Custom Challenge';
                console.error("Challenge gen error:", err);
                aiChallengeContent.innerHTML = formatMarkdown(getRandomMockChallenge());
            });
        });
    }

    function getRandomMockChallenge() {
        const mockChallenges = [
            `### 🍱 The Zero-Waste Lunchbox Challenge
**Goal:** Eliminate all single-use packaging from your lunches for 5 consecutive days.
* **Step 1:** Prepare meals in reusable glass or stainless steel containers.
* **Step 2:** Wrap sandwiches in beeswax wraps instead of plastic cling wrap.
* **Step 3:** Pack a cloth napkin and metal cutlery instead of plastic disposables.
* **Environmental Impact:** Saves an average of 15 plastic bags/wraps and 5 plastic utensils per person weekly, reducing landfill waste.`,
            `### 🚿 The Shower Speedster Challenge
**Goal:** Limit all showers to exactly 4 minutes using a phone timer.
* **Step 1:** Set a playlist with 4-minute songs and finish bathing before the song ends.
* **Step 2:** Install a low-flow showerhead to save even more water.
* **Step 3:** Turn off the tap while lathering soap or shampoo.
* **Environmental Impact:** Saves up to 150 Liters of water per household daily, reducing energy used to heat water.`,
            `### 🔌 The Phantom Load Detective
**Goal:** Unplug 5 major inactive standby appliances before going to sleep.
* **Step 1:** Identify standby appliances (Microwave, TV, Console, Router, chargers).
* **Step 2:** Plug them into a power strip and flick the master switch off at night.
* **Step 3:** Check that no standby LED lights are glowing in the dark.
* **Environmental Impact:** Decreases home standby electricity load by up to 10%, reducing coal-powered grid demand.`
        ];
        const idx = Math.floor(Math.random() * mockChallenges.length);
        return mockChallenges[idx];
    }

    // --- 5. Eco Habits Checklist & Streak Tracker ---
    const habitCheckboxes = document.querySelectorAll('.habit-checkbox');
    const habitStreakDisplay = document.getElementById('habit-streak-display');
    const dashStreakCount = document.getElementById('dash-streak-count');
    const dashHabitsDone = document.getElementById('dash-habits-done');

    habitCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const habitId = cb.id.replace('habit-', '');
            state.habits[habitId] = cb.checked;
            
            saveStateToStorage();
            updateDailyHabitCount();
            calculateAndDisplayScores(); // Refreshes overall index score
            handleStreakValidation();
        });
    });

    function updateDailyHabitCount() {
        let count = 0;
        ['shower', 'lights', 'plastic', 'transport', 'compost'].forEach(h => {
            if (state.habits[h]) count++;
        });
        
        dashHabitsDone.textContent = `${count}/5`;
    }

    function handleStreakValidation() {
        const today = new Date().toISOString().split('T')[0];
        
        // Count total checked items today
        let itemsChecked = 0;
        ['shower', 'lights', 'plastic', 'transport', 'compost'].forEach(h => {
            if (state.habits[h]) itemsChecked++;
        });

        if (itemsChecked > 0) {
            // If user has checked something today
            if (state.habits.lastCheckedDate !== today) {
                // If checking for the first time today
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                if (state.habits.lastCheckedDate === yesterdayStr) {
                    // Habit completed yesterday too, increment streak!
                    state.habits.streakCount++;
                } else if (state.habits.lastCheckedDate === null || state.habits.streakCount === 0) {
                    state.habits.streakCount = 1;
                } else {
                    // Streak was broken, reset to 1
                    state.habits.streakCount = 1;
                }
                
                state.habits.lastCheckedDate = today;
                if (!state.habits.completedDates.includes(today)) {
                    state.habits.completedDates.push(today);
                }
                saveStateToStorage();
            }
        } else {
            // If they unchecked everything, they might lose their daily check-in
            if (state.habits.lastCheckedDate === today) {
                // Remove today's date and revert streak
                state.habits.lastCheckedDate = state.habits.completedDates.length > 1 
                    ? state.habits.completedDates[state.habits.completedDates.length - 2]
                    : null;
                
                state.habits.completedDates = state.habits.completedDates.filter(d => d !== today);
                if (state.habits.streakCount > 0) {
                    state.habits.streakCount--;
                }
                saveStateToStorage();
            }
        }

        // Display Streaks
        habitStreakDisplay.textContent = state.habits.streakCount;
        dashStreakCount.textContent = state.habits.streakCount;
        
        checkHabitAchievements();
    }

    function checkHabitAchievements(currentScore = 0) {
        const badgeStreak3 = document.getElementById('badge-streak-3');
        const badgeStreak7 = document.getElementById('badge-streak-7');
        const badgeScore80 = document.getElementById('badge-score-80');
        const badgeAllChecked = document.getElementById('badge-all-checked');

        const totalHabitDays = state.habits.completedDates.length;
        const currentStreak = state.habits.streakCount;

        // Badge 1: Green Recruit (total days >= 3)
        if (totalHabitDays >= 3) {
            badgeStreak3.classList.remove('locked');
            badgeStreak3.classList.add('unlocked');
        } else {
            badgeStreak3.classList.remove('unlocked');
            badgeStreak3.classList.add('locked');
        }

        // Badge 2: Carbon Warrior (streak >= 7)
        if (currentStreak >= 7) {
            badgeStreak7.classList.remove('locked');
            badgeStreak7.classList.add('unlocked');
        } else {
            badgeStreak7.classList.remove('unlocked');
            badgeStreak7.classList.add('locked');
        }

        // Badge 3: Eco Sage (index >= 80)
        const score = currentScore || parseInt(document.getElementById('dashboard-score').textContent) || 0;
        if (score >= 80) {
            badgeScore80.classList.remove('locked');
            badgeScore80.classList.add('unlocked');
        } else {
            badgeScore80.classList.remove('unlocked');
            badgeScore80.classList.add('locked');
        }

        // Badge 4: Perfect Day (all 5 checked)
        let activeCount = 0;
        ['shower', 'lights', 'plastic', 'transport', 'compost'].forEach(h => {
            if (state.habits[h]) activeCount++;
        });
        if (activeCount === 5) {
            badgeAllChecked.classList.remove('locked');
            badgeAllChecked.classList.add('unlocked');
        } else {
            badgeAllChecked.classList.remove('unlocked');
            badgeAllChecked.classList.add('locked');
        }

        // Update dashboard badges widget row
        updateDashboardBadgesRow();
    }

    function updateDashboardBadgesRow() {
        const row = document.getElementById('dash-badges-row');
        row.innerHTML = '';

        const badgeList = [
            { id: 'badge-streak-3', label: '🥉 Green Recruit' },
            { id: 'badge-streak-7', label: '🥈 Carbon Warrior' },
            { id: 'badge-score-80', label: '🥇 Eco Sage' },
            { id: 'badge-all-checked', label: '🏆 Perfect Day' }
        ];

        let unlockedCount = 0;
        badgeList.forEach(b => {
            const badgeEl = document.getElementById(b.id);
            if (badgeEl && badgeEl.classList.contains('unlocked')) {
                const span = document.createElement('span');
                span.className = 'earned-mini-badge';
                span.textContent = b.label;
                row.appendChild(span);
                unlockedCount++;
            }
        });

        if (unlockedCount === 0) {
            row.innerHTML = '<span class="badge-placeholder">Complete daily actions and score 80+ to earn badges</span>';
        }
    }

    // --- 6. IBM Granite Chat Advisor ---
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessagesWindow = document.getElementById('chat-messages-window');
    const chatTypingIndicator = document.getElementById('chat-typing');
    const btnClearChat = document.getElementById('btn-clear-chat');
    const chipPrompts = document.querySelectorAll('.chip-prompt');

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        
        chatInput.value = '';
        sendUserChatMessage(text);
    });

    btnClearChat.addEventListener('click', () => {
        state.chatHistory = [];
        chatMessagesWindow.innerHTML = `
            <div class="message assistant">
                <div class="message-content">
                    <p>Hello! I am your **IBM Granite** sustainability advisor. How can I assist you with your green household goals today?</p>
                    <div class="quick-prompts">
                        <button class="chip-prompt" data-prompt="Give me 5 simple hacks to save electricity this summer">⚡ Save Electricity</button>
                        <button class="chip-prompt" data-prompt="How do I set up a composting bin in a small kitchen?">🍂 Compost Tips</button>
                        <button class="chip-prompt" data-prompt="Explain the connection between home carbon emissions and SDG 12">🌍 SDG 12 Connection</button>
                    </div>
                </div>
            </div>
        `;
        // Re-attach listeners to newly created chip buttons
        attachChipPromptListeners();
        saveStateToStorage();
    });

    function attachChipPromptListeners() {
        const currentChips = chatMessagesWindow.querySelectorAll('.chip-prompt');
        currentChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                sendUserChatMessage(prompt);
            });
        });
    }

    // Call initially for default chips
    attachChipPromptListeners();

    function sendUserChatMessage(text) {
        // Append user bubble
        appendChatBubble('user', text);
        
        // Push to history
        state.chatHistory.push({ role: 'user', content: text });
        saveStateToStorage();

        // Show typing indicator
        chatTypingIndicator.style.display = 'block';
        chatMessagesWindow.scrollTop = chatMessagesWindow.scrollHeight;

        // API payload config
        const payload = {
            messages: state.chatHistory,
            apikey: state.apiSettings.apikey,
            project_id: state.apiSettings.projectId,
            service_url: state.apiSettings.serviceUrl,
            model_id: state.apiSettings.modelId
        };

        // Call backend server
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            chatTypingIndicator.style.display = 'none';
            
            const reply = data.choices && data.choices[0] && data.choices[0].message
                ? data.choices[0].message.content
                : "⚠️ I received an invalid reply structure. Check your watsonx.ai settings.";
            
            // Check if mock mode warning flag
            if (data.simulated) {
                // If it is simulated and we have API key set, it means an error occurred
                if (state.apiSettings.apikey) {
                    console.warn("watsonx.ai request failed; fell back to simulated template.");
                }
            }

            appendChatBubble('assistant', reply);
            state.chatHistory.push({ role: 'assistant', content: reply });
            saveStateToStorage();
        })
        .catch(err => {
            chatTypingIndicator.style.display = 'none';
            console.error("Chat error:", err);
            
            const errorMsg = `⚠️ **Failed to contact server:** ${err.message}\n\nMake sure your Flask server is running locally on port 5000.`;
            appendChatBubble('assistant', errorMsg);
        });
    }

    function appendChatBubble(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        
        // Create premium avatar element
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.textContent = sender === 'user' ? '👤' : '🤖';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Render Markdown format
        contentDiv.innerHTML = formatMarkdown(text);
        
        msgDiv.appendChild(avatarDiv);
        msgDiv.appendChild(contentDiv);
        chatMessagesWindow.appendChild(msgDiv);
        chatMessagesWindow.scrollTop = chatMessagesWindow.scrollHeight;
    }

    // Markdown Parser (Line-by-line)
    function formatMarkdown(text) {
        const lines = text.split('\n');
        let htmlResult = [];
        let inList = false;
        
        for (let line of lines) {
            let trimmed = line.trim();
            
            // Headers
            if (trimmed.startsWith('### ')) {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push(`<h3>${trimmed.substring(4)}</h3>`);
                continue;
            }
            if (trimmed.startsWith('## ')) {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push(`<h2>${trimmed.substring(3)}</h2>`);
                continue;
            }
            if (trimmed.startsWith('# ')) {
                if (inList) { htmlResult.push('</ul>'); inList = false; }
                htmlResult.push(`<h1>${trimmed.substring(2)}</h1>`);
                continue;
            }
            
            // Bullet list items
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                if (!inList) { htmlResult.push('<ul>'); inList = true; }
                let itemContent = trimmed.substring(2);
                itemContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                itemContent = itemContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
                htmlResult.push(`<li>${itemContent}</li>`);
                continue;
            }
            
            // Close list if line is not bullet
            if (inList && !trimmed.startsWith('* ') && !trimmed.startsWith('- ') && trimmed !== '') {
                htmlResult.push('</ul>');
                inList = false;
            }
            
            // Handle raw break lines
            if (trimmed === '') {
                // Limit consecutive breaks
                htmlResult.push('<br>');
                continue;
            }
            
            // Paragraph line (with bold and italics styling)
            let pContent = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            pContent = pContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
            htmlResult.push(`<p>${pContent}</p>`);
        }
        
        if (inList) {
            htmlResult.push('</ul>');
        }
        
        return htmlResult.join('\n');
    }

    // --- 7. LocalStorage Operations ---
    function saveStateToStorage() {
        localStorage.setItem('ecogranite_state', JSON.stringify(state));
    }

    function loadStateFromStorage() {
        const stored = localStorage.getItem('ecogranite_state');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.assessment) state.assessment = parsed.assessment;
                if (parsed.habits) state.habits = parsed.habits;
                if (parsed.apiSettings) state.apiSettings = parsed.apiSettings;
                if (parsed.chatHistory) state.chatHistory = parsed.chatHistory;
                if (parsed.theme) state.theme = parsed.theme;
                if (parsed.offsetPlanner) state.offsetPlanner = parsed.offsetPlanner;
            } catch (e) {
                console.error("Error loading localStorage state:", e);
            }
        }

        // Apply loaded state to DOM elements
        
        // 1. Settings view fields
        document.getElementById('setting-apikey').value = state.apiSettings.apikey || '';
        document.getElementById('setting-project-id').value = state.apiSettings.projectId || '';
        document.getElementById('setting-service-url').value = state.apiSettings.serviceUrl || 'https://us-south.ml.cloud.ibm.com';
        document.getElementById('setting-model').value = state.apiSettings.modelId || 'ibm/granite-3-8b-instruct';
        updateAPIStatusIndicator();

        // Apply theme choice
        applyThemeAccent(state.theme);

        // Load offset planner inputs
        document.getElementById('offset-target').value = state.offsetPlanner?.target || 4.0;
        document.getElementById('offset-trees').value = state.offsetPlanner?.trees || 0;
        document.getElementById('offset-trees-val').textContent = state.offsetPlanner?.trees || 0;
        document.getElementById('offset-solar').checked = state.offsetPlanner?.solar || false;
        recalculateOffsets();

        // 2. Assessment fields
        if (state.assessment.isCalculated) {
            document.getElementById('monthly-kwh').value = state.assessment.monthlyKwh;
            document.getElementById('energy-source').value = state.assessment.energySource;
            document.getElementById('cooking-fuel').value = state.assessment.cookingFuel;
            document.getElementById('monthly-water').value = state.assessment.monthlyWater;
            document.getElementById('water-habits').value = state.assessment.waterHabits;
            document.getElementById('waste-generation').value = state.assessment.wasteGeneration;
            document.getElementById('recycling-level').value = state.assessment.recyclingLevel;
            document.getElementById('monthly-km').value = state.assessment.monthlyKm;
            document.getElementById('vehicle-type').value = state.assessment.vehicleType;
            
            btnOptimizeAI.removeAttribute('disabled');
            calculateAndDisplayScores();
        } else {
            // Recalculate offsets even if not assessed to display starter zeros
            recalculateOffsets();
        }

        // 3. Habits fields
        ['shower', 'lights', 'plastic', 'transport', 'compost'].forEach(h => {
            const cb = document.getElementById(`habit-${h}`);
            if (cb) cb.checked = state.habits[h] || false;
        });
        
        updateDailyHabitCount();
        habitStreakDisplay.textContent = state.habits.streakCount || 0;
        dashStreakCount.textContent = state.habits.streakCount || 0;

        // Reset and re-render loaded chat bubbles if chat history exists
        if (state.chatHistory && state.chatHistory.length > 0) {
            chatMessagesWindow.innerHTML = '';
            state.chatHistory.forEach(item => {
                appendChatBubble(item.role, item.content);
            });
        }
        
        checkHabitAchievements();
    }

    // --- 8. Eco-Trivia Arena Quiz Logic (New Feature) ---
    let quizState = {
        score: 0,
        streak: 0,
        currentQuestion: null
    };

    const btnGetQuestion = document.getElementById('btn-get-question');
    const quizQuestionCard = document.getElementById('quiz-question-card');
    const quizExplanationBox = document.getElementById('quiz-explanation-box');
    const quizExplanationTitle = document.getElementById('quiz-explanation-title');
    const quizExplanationText = document.getElementById('quiz-explanation-text');
    const quizCorrectCount = document.getElementById('quiz-correct-count');
    const quizStreakCount = document.getElementById('quiz-streak-count');

    const defaultQuizQuestions = [
        {
            question: "Which of the following household practices contributes most to conserving indoor water usage?",
            options: [
                "Running the dishwasher only when half empty",
                "Installing low-flow aerators on faucets",
                "Using hot water to clean outdoor pavements",
                "Taking 15-minute baths instead of 5-minute showers"
            ],
            answerIndex: 1,
            explanation: "Low-flow aerators mix air into the water stream, reducing tap water flow by up to 50% while maintaining high pressure, saving thousands of liters annually."
        },
        {
            question: "What is considered a 'phantom load' (vampire draw) in household energy usage?",
            options: [
                "Power consumed by appliances when switched off but left plugged into outlets",
                "Electricity used by solar panels at night",
                "Energy draw when an air conditioner starts its compressor cycle",
                "Spikes in utility bills due to grid power surges"
            ],
            answerIndex: 0,
            explanation: "Many electronic devices (chargers, TVs, microwaves) draw standby power even when turned off if plugged in. Unplugging them or using smart strips saves 5-10% electricity."
        },
        {
            question: "Why is composting organic wet waste critical for climate action (SDG 13)?",
            options: [
                "It turns waste into plastic feedstock",
                "Composting makes solid waste burn faster in incinerators",
                "Composting organic waste aerobically prevents it from producing methane (a potent greenhouse gas) in landfills",
                "Compost absorbs heat directly from the soil, cooling the earth"
            ],
            answerIndex: 2,
            explanation: "When organic waste is buried in landfills, it decomposes anaerobically (without oxygen), releasing methane—which is 28x more potent than CO2. Composting decomposes it aerobically, avoiding methane."
        },
        {
            question: "Which type of light bulb is the most energy-efficient for residential lighting?",
            options: [
                "Compact Fluorescent Lamp (CFL)",
                "Halogen Bulb",
                "Incandescent Bulb",
                "Light Emitting Diode (LED)"
            ],
            answerIndex: 3,
            explanation: "LED bulbs use up to 80% less energy than standard incandescent bulbs, release almost no heat, and last up to 25,000 hours."
        },
        {
            question: "How does walking or biking instead of driving short distances directly impact sustainability?",
            options: [
                "It reduces tire microplastic wear and tailpipe greenhouse emissions",
                "It filters surrounding particulate matter out of the air",
                "It increases regional fuel tax revenue",
                "It raises the thermal mass of asphalt roads"
            ],
            answerIndex: 0,
            explanation: "Vehicles emit CO2 and fine particulates. Walking or biking for trips under 3km completely eliminates these emissions and reduces microplastic pollution from tire wear."
        }
    ];

    if (btnGetQuestion) {
        btnGetQuestion.addEventListener('click', generateQuestion);
    }

    function generateQuestion() {
        quizExplanationBox.style.display = 'none';
        quizQuestionCard.innerHTML = '<div style="text-align:center;width:100%;color:var(--accent-teal);">⌛ *EcoGranite AI is drafting a new question...*</div>';
        
        // Trigger prompt to watsonx.ai
        const prompt = `Generate a single multiple-choice question about ecology, recycling, water conservation, climate change, or energy efficiency. 
You MUST format the response strictly as a raw valid JSON object (with no markdown, backticks, wrapping or preamble) containing these exact fields: 
{
  "question": "Question text?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "answerIndex": 0,
  "explanation": "Explanation text."
}
where answerIndex is 0-3. Ensure options are short and clear.`;

        const payload = {
            messages: [{ role: 'user', content: prompt }],
            apikey: state.apiSettings.apikey,
            project_id: state.apiSettings.projectId,
            service_url: state.apiSettings.serviceUrl,
            model_id: state.apiSettings.modelId
        };

        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            let qObj;
            try {
                let reply = data.choices[0].message.content;
                let cleanedText = reply.replace(/```json|```/g, '').trim();
                qObj = JSON.parse(cleanedText);
                
                if (!qObj.question || !Array.isArray(qObj.options) || typeof qObj.answerIndex !== 'number') {
                    throw new Error("Invalid structure");
                }
            } catch (e) {
                console.warn("Could not parse AI question, pulling fallback question.", e);
                qObj = getRandomFallbackQuestion();
            }
            renderQuestion(qObj);
        })
        .catch(err => {
            console.error("Quiz API error:", err);
            renderQuestion(getRandomFallbackQuestion());
        });
    }

    function getRandomFallbackQuestion() {
        const idx = Math.floor(Math.random() * defaultQuizQuestions.length);
        return defaultQuizQuestions[idx];
    }

    function renderQuestion(qObj) {
        quizState.currentQuestion = qObj;
        
        quizQuestionCard.innerHTML = `
            <div style="width:100%;">
                <h3 style="font-size:16px; font-weight:700; margin-bottom:18px; color:#ffffff; line-height:1.5;">${qObj.question}</h3>
                <div class="quiz-options-list">
                    ${qObj.options.map((opt, idx) => `
                        <button class="quiz-option-btn" data-idx="${idx}">${opt}</button>
                    `).join('')}
                </div>
                <div id="quiz-footer" style="display:flex; justify-content:flex-end; margin-top: 15px; display:none;">
                    <button class="btn btn-primary btn-sm" id="btn-next-question">
                        Next Question
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-left:6px;"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </div>
            </div>
        `;

        const optionBtns = quizQuestionCard.querySelectorAll('.quiz-option-btn');
        optionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const clickedIdx = parseInt(btn.getAttribute('data-idx'));
                const correctIdx = qObj.answerIndex;
                
                optionBtns.forEach(b => b.setAttribute('disabled', 'true'));
                
                if (clickedIdx === correctIdx) {
                    btn.classList.add('correct');
                    quizState.score++;
                    quizState.streak++;
                    
                    quizExplanationTitle.textContent = "Correct! 🎉";
                    quizExplanationTitle.style.color = "var(--accent-emerald)";
                    quizExplanationBox.style.borderLeftColor = "var(--accent-emerald)";
                    
                    // Trigger interactive particle burst
                    triggerParticles(btn);
                } else {
                    btn.classList.add('wrong');
                    optionBtns[correctIdx].classList.add('correct');
                    quizState.streak = 0;
                    
                    quizExplanationTitle.textContent = "Incorrect ⚠️";
                    quizExplanationTitle.style.color = "var(--accent-rose)";
                    quizExplanationBox.style.borderLeftColor = "var(--accent-rose)";
                }
                
                quizCorrectCount.textContent = quizState.score;
                quizStreakCount.textContent = `${quizState.streak} 🔥`;
                
                quizExplanationText.textContent = qObj.explanation;
                quizExplanationBox.style.display = 'block';
                
                const quizFooter = document.getElementById('quiz-footer');
                quizFooter.style.display = 'flex';
                
                document.getElementById('btn-next-question').addEventListener('click', generateQuestion);
            });
        });
    }

    // --- Custom Toast Notification Helper ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';
        if (type === 'warning') icon = '🔔';
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => removeToast(toast));
        }
        
        const autoTimer = setTimeout(() => {
            removeToast(toast);
        }, 4000);
        
        function removeToast(el) {
            clearTimeout(autoTimer);
            el.classList.add('fade-out');
            el.addEventListener('transitionend', () => {
                el.remove();
            });
        }
    }

    // --- Interactive Quiz Particles Helper ---
    function triggerParticles(element) {
        const rect = element.getBoundingClientRect();
        const parent = document.body;
        const colors = ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b', '#f43f5e'];
        
        const centerX = rect.left + rect.width / 2 + window.scrollX;
        const centerY = rect.top + rect.height / 2 + window.scrollY;
        
        for (let i = 0; i < 35; i++) {
            const p = document.createElement('div');
            p.className = 'particle-burst';
            
            const angle = Math.random() * Math.PI * 2;
            const distance = 40 + Math.random() * 80;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            
            p.style.setProperty('--tx', `${tx}px`);
            p.style.setProperty('--ty', `${ty}px`);
            
            p.style.left = `${centerX}px`;
            p.style.top = `${centerY}px`;
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            p.style.boxShadow = `0 0 6px ${p.style.backgroundColor}`;
            
            parent.appendChild(p);
            
            p.addEventListener('animationend', () => {
                p.remove();
            });
        }
    }

    // --- Theme Switcher Logic ---
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            state.theme = theme;
            saveStateToStorage();
            applyThemeAccent(theme);
            showToast(`Theme switched to ${btn.title}!`, 'success');
        });
    });

    function applyThemeAccent(themeName) {
        document.body.classList.remove('theme-ocean-active', 'theme-solar-active');
        themeBtns.forEach(b => b.classList.remove('active'));
        
        const activeBtn = document.querySelector(`.theme-btn[data-theme="${themeName}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        if (themeName === 'ocean') {
            document.body.classList.add('theme-ocean-active');
        } else if (themeName === 'solar') {
            document.body.classList.add('theme-solar-active');
        }
    }

    // --- Goal Offset Recalculator ---
    const offsetTargetInput = document.getElementById('offset-target');
    const offsetTreesInput = document.getElementById('offset-trees');
    const offsetTreesVal = document.getElementById('offset-trees-val');
    const offsetSolarInput = document.getElementById('offset-solar');

    function updateGoalPlannerState() {
        state.offsetPlanner.target = parseFloat(offsetTargetInput.value) || 4.0;
        state.offsetPlanner.trees = parseInt(offsetTreesInput.value) || 0;
        state.offsetPlanner.solar = offsetSolarInput.checked;
        offsetTreesVal.textContent = state.offsetPlanner.trees;
        saveStateToStorage();
        recalculateOffsets();
    }

    if (offsetTargetInput && offsetTreesInput && offsetSolarInput) {
        offsetTargetInput.addEventListener('input', updateGoalPlannerState);
        offsetTreesInput.addEventListener('input', updateGoalPlannerState);
        offsetSolarInput.addEventListener('change', updateGoalPlannerState);
    }

    function recalculateOffsets() {
        const gross = state.assessment.isCalculated ? (state.assessment.totalCarbon || 0.0) : 0.0;
        const target = state.offsetPlanner?.target !== undefined ? state.offsetPlanner.target : 4.0;
        const trees = state.offsetPlanner?.trees || 0;
        const solar = state.offsetPlanner?.solar || false;
        
        const offsetDeductions = (solar ? 1.5 : 0.0) + (trees * 0.022);
        const net = Math.max(gross - offsetDeductions, 0.0);
        
        // Render UI
        const grossValEl = document.getElementById('goal-gross-val');
        const offsetsValEl = document.getElementById('goal-offsets-val');
        const netValEl = document.getElementById('goal-net-val');
        const badge = document.getElementById('goal-status-badge');
        const netHeroBadge = document.getElementById('net-zero-badge-display');

        if (grossValEl) grossValEl.textContent = `${gross.toFixed(1)} t`;
        if (offsetsValEl) offsetsValEl.textContent = `-${offsetDeductions.toFixed(1)} t`;
        if (netValEl) {
            netValEl.textContent = `${net.toFixed(1)} t`;
            netValEl.style.color = net === 0 ? 'var(--accent-emerald)' : 'var(--text-primary)';
        }
        
        if (badge && netHeroBadge) {
            if (!state.assessment.isCalculated) {
                badge.textContent = 'No assessment';
                badge.className = 'badge red';
                netHeroBadge.className = 'badge-item locked';
                netHeroBadge.style.opacity = 0.35;
            } else if (net <= target) {
                badge.textContent = 'On Target';
                badge.className = 'badge green';
                if (net === 0) {
                    badge.textContent = 'Net-Zero Carbon';
                }
                netHeroBadge.className = 'badge-item unlocked';
                netHeroBadge.style.opacity = 1;
            } else {
                badge.textContent = 'Above Target';
                badge.className = 'badge red';
                netHeroBadge.className = 'badge-item locked';
                netHeroBadge.style.opacity = 0.35;
            }
        }
    }

    // --- Waste Sorter Arcade Game Logic ---
    let sorterState = {
        score: 0,
        lives: 3,
        currentItem: null
    };

    const sorterItems = [
        { name: "Banana Peel", emoji: "🍌", bin: "compost", explanation: "Banana peels are organic wet waste. Composting them yields natural fertilizers." },
        { name: "Plastic Drink Bottle", emoji: "🧴", bin: "recycle", explanation: "Clean plastic bottles can be melted down and repurposed into new containers." },
        { name: "Aluminium Drink Can", emoji: "🥫", bin: "recycle", explanation: "Metal cans are infinitely recyclable. Sorting them saves 95% of energy compared to raw metal processing." },
        { name: "Dead Batteries", emoji: "🔋", bin: "ewaste", explanation: "Batteries leak toxic chemicals in landfills and present fire hazards. Recycle them as E-waste." },
        { name: "Old Laptop Charger", emoji: "🔌", bin: "ewaste", explanation: "Electronic cabling contains copper and outer plastic linings that need specialized recycling." },
        { name: "Broken Ceramic Mug", emoji: "☕", bin: "landfill", explanation: "Ceramics are heated to high temperatures and cannot melt in typical glass bottle ovens. Sort as trash." },
        { name: "Potato Chip Packet", emoji: "🍿", bin: "landfill", explanation: "Made of composite foil-plastic layers that cannot be separated. Must be tossed in the landfill bin." },
        { name: "Apple Core", emoji: "🍎", bin: "compost", explanation: "Apples decompose quickly when composted aerobically, avoiding landfill methane generation." },
        { name: "Cardboard Delivery Box", emoji: "📦", bin: "recycle", explanation: "Dry clean paper and cardboard products are valuable recyclables." },
        { name: "Burnt Out LED Bulb", emoji: "💡", bin: "ewaste", explanation: "LED lights contain electronic ballast components. Do not throw in regular trash." }
    ];

    const btnSubtabTrivia = document.getElementById('btn-subtab-trivia');
    const btnSubtabSorter = document.getElementById('btn-subtab-sorter');
    const quizTriviaSubview = document.getElementById('quiz-trivia-subview');
    const quizSorterSubview = document.getElementById('quiz-sorter-subview');

    // Subtab selectors
    if (btnSubtabTrivia && btnSubtabSorter) {
        btnSubtabTrivia.addEventListener('click', () => {
            btnSubtabTrivia.classList.add('active-subtab');
            btnSubtabSorter.classList.remove('active-subtab');
            quizTriviaSubview.style.display = 'block';
            quizSorterSubview.style.display = 'none';
        });

        btnSubtabSorter.addEventListener('click', () => {
            btnSubtabSorter.classList.add('active-subtab');
            btnSubtabTrivia.classList.remove('active-subtab');
            quizSorterSubview.style.display = 'block';
            quizTriviaSubview.style.display = 'none';
            
            // Auto start sorter game if no item is loaded yet
            if (!sorterState.currentItem) {
                startSorterGame();
            }
        });
    }

    const sorterItemEmoji = document.getElementById('sorter-item-emoji');
    const sorterItemName = document.getElementById('sorter-item-name');
    const sorterScoreCount = document.getElementById('sorter-score-count');
    const sorterLivesDisplay = document.getElementById('sorter-lives-display');
    const sorterFeedbackBox = document.getElementById('sorter-feedback-box');
    const sorterFeedbackTitle = document.getElementById('sorter-feedback-title');
    const sorterFeedbackText = document.getElementById('sorter-feedback-text');
    const conveyorCard = document.getElementById('sorter-conveyor-card');
    const binButtons = document.querySelectorAll('.bin-btn');

    function startSorterGame() {
        sorterState.score = 0;
        sorterState.lives = 3;
        if (sorterScoreCount) sorterScoreCount.textContent = '0';
        updateLivesDisplay();
        if (sorterFeedbackBox) sorterFeedbackBox.style.display = 'none';
        
        // Remove gameover overlay if it exists
        const existingOverlay = document.getElementById('sorter-gameover-overlay');
        if (existingOverlay) existingOverlay.remove();
        
        loadNextSorterItem();
    }

    function updateLivesDisplay() {
        if (!sorterLivesDisplay) return;
        let hearts = '';
        for (let i = 0; i < 3; i++) {
            hearts += i < sorterState.lives ? '❤️ ' : '🤍 ';
        }
        sorterLivesDisplay.textContent = hearts;
    }

    function loadNextSorterItem() {
        if (sorterState.lives <= 0) {
            showSorterGameOver();
            return;
        }

        // Enable bin buttons
        binButtons.forEach(btn => btn.removeAttribute('disabled'));

        // Pick random item
        const randIndex = Math.floor(Math.random() * sorterItems.length);
        const item = sorterItems[randIndex];
        sorterState.currentItem = item;

        // Render card
        const cardContent = document.getElementById('sorter-card-content');
        if (cardContent) cardContent.style.display = 'block';
        if (sorterItemEmoji) sorterItemEmoji.textContent = item.emoji;
        if (sorterItemName) sorterItemName.textContent = item.name;

        // Apply slide in animation
        if (conveyorCard) {
            conveyorCard.classList.remove('item-slide-in', 'item-slide-out-correct', 'item-slide-out-wrong');
            void conveyorCard.offsetWidth; // Trigger reflow
            conveyorCard.classList.add('item-slide-in');
        }
    }

    binButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (sorterState.lives <= 0 || !sorterState.currentItem) return;

            const selectedBin = btn.getAttribute('data-bin');
            const correctBin = sorterState.currentItem.bin;
            
            // Disable all bins during animation feedback
            binButtons.forEach(b => b.setAttribute('disabled', 'true'));

            if (selectedBin === correctBin) {
                // Correct choice
                sorterState.score += 10;
                if (sorterScoreCount) sorterScoreCount.textContent = sorterState.score;
                
                if (sorterFeedbackTitle) {
                    sorterFeedbackTitle.textContent = "Correct! +10 Points 🎉";
                    sorterFeedbackTitle.style.color = "var(--accent-emerald)";
                }
                if (sorterFeedbackBox) {
                    sorterFeedbackBox.style.borderLeftColor = "var(--accent-emerald)";
                    sorterFeedbackText.textContent = sorterState.currentItem.explanation;
                }
                
                // Explode confetti particles
                triggerParticles(btn);

                if (conveyorCard) {
                    conveyorCard.classList.remove('item-slide-in');
                    void conveyorCard.offsetWidth;
                    conveyorCard.classList.add('item-slide-out-correct');
                }
            } else {
                // Wrong choice
                sorterState.lives--;
                updateLivesDisplay();

                if (sorterFeedbackTitle) {
                    sorterFeedbackTitle.textContent = "Wrong Bin! ⚠️";
                    sorterFeedbackTitle.style.color = "var(--accent-rose)";
                }
                if (sorterFeedbackBox) {
                    sorterFeedbackBox.style.borderLeftColor = "var(--accent-rose)";
                    sorterFeedbackText.textContent = `Oops! ${sorterState.currentItem.name} belongs in the ${correctBin.toUpperCase()} bin. ${sorterState.currentItem.explanation}`;
                }

                if (conveyorCard) {
                    conveyorCard.classList.remove('item-slide-in');
                    void conveyorCard.offsetWidth;
                    conveyorCard.classList.add('item-slide-out-wrong');
                }
            }

            if (sorterFeedbackBox) sorterFeedbackBox.style.display = 'block';

            // Wait 1.8 seconds then proceed
            setTimeout(() => {
                if (sorterFeedbackBox) sorterFeedbackBox.style.display = 'none';
                loadNextSorterItem();
            }, 1800);
        });
    });

    function showSorterGameOver() {
        sorterState.currentItem = null;
        const cardContent = document.getElementById('sorter-card-content');
        if (cardContent) cardContent.style.display = 'none';
        
        if (conveyorCard) {
            conveyorCard.classList.remove('item-slide-in', 'item-slide-out-correct', 'item-slide-out-wrong');
            
            const gameOverDiv = document.createElement('div');
            gameOverDiv.id = 'sorter-gameover-overlay';
            gameOverDiv.style.textAlign = 'center';
            gameOverDiv.innerHTML = `
                <h3 style="font-size: 22px; font-weight: 800; color: var(--accent-rose); margin-bottom: 8px;">Game Over 🎮</h3>
                <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px;">You ran out of lives! Final Score: <strong>${sorterState.score} points</strong>.</p>
                <button class="btn btn-accent btn-sm" id="btn-restart-sorter" style="margin: 0 auto;">Play Again</button>
            `;
            
            const existingOverlay = document.getElementById('sorter-gameover-overlay');
            if (existingOverlay) existingOverlay.remove();
            
            conveyorCard.appendChild(gameOverDiv);
            
            document.getElementById('btn-restart-sorter').addEventListener('click', () => {
                gameOverDiv.remove();
                startSorterGame();
            });
        }
    }

    // Load saved settings & state from localStorage
    loadStateFromStorage();
});
