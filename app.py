import os
import requests
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv

load_dotenv(override=True)

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    messages = data.get('messages', [])
    
    client_apikey = data.get('apikey')
    server_apikey = os.getenv('WATSONX_APIKEY')
    
    print(f"[DEBUG] Incoming request to /api/chat", flush=True)
    print(f"[DEBUG] Client API Key: {client_apikey[:8]}...{client_apikey[-8:] if client_apikey else ''} (len: {len(client_apikey) if client_apikey else 0})", flush=True)
    print(f"[DEBUG] Server API Key: {server_apikey[:8]}...{server_apikey[-8:] if server_apikey else ''} (len: {len(server_apikey) if server_apikey else 0})", flush=True)

    # Retrieve credentials (prefer client-provided, fallback to server env)
    apikey = client_apikey if client_apikey else server_apikey
    project_id = data.get('project_id') or os.getenv('WATSONX_PROJECT_ID')
    service_url = data.get('service_url') or os.getenv('WATSONX_SERVICE_URL') or 'https://us-south.ml.cloud.ibm.com'
    model_id = data.get('model_id') or 'ibm/granite-3-8b-instruct'
    
    # Check if we should run in mock/simulation mode
    if not apikey or not project_id:
        return jsonify({
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': generate_mock_response(messages)
                }
            }],
            'simulated': True
        })
    
    try:
        # 1. Get access token from IBM IAM
        token_url = "https://iam.cloud.ibm.com/identity/token"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        payload = {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": apikey
        }
        token_response = requests.post(token_url, headers=headers, data=payload, timeout=15)
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        
        # 2. Call watsonx.ai text chat endpoint
        # Remove trailing slash from service_url if present
        service_url = service_url.rstrip('/')
        chat_url = f"{service_url}/ml/v1/text/chat?version=2024-05-31"
        
        chat_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}"
        }
        
        system_prompt = {
            "role": "system",
            "content": (
                "You are EcoGranite, an expert Household Sustainability Advisor. "
                "Your role is to help users reduce their carbon footprint, save energy, "
                "minimize waste (by recycling and composting), and conserve water. "
                "Provide highly actionable, encouraging, and clear household optimization advice. "
                "Do not output disclaimers saying you are not an advisor or cannot access real-time data. "
                "Speak with authority as the EcoGranite advisor."
            )
        }
        
        # Prepend system prompt if not already present in message list
        full_messages = messages
        if not any(m.get('role') == 'system' for m in messages):
            full_messages = [system_prompt] + messages

        chat_payload = {
            "model_id": model_id,
            "project_id": project_id,
            "messages": full_messages,
            "parameters": {
                "max_tokens": 1200,
                "temperature": 0.7
            }
        }
        
        chat_response = requests.post(chat_url, headers=chat_headers, json=chat_payload, timeout=30)
        chat_response.raise_for_status()
        
        return jsonify(chat_response.json())
        
    except Exception as e:
        print(f"Error calling watsonx.ai API: {e}")
        return jsonify({
            'error': str(e),
            'choices': [{
                'message': {
                    'role': 'assistant',
                    'content': f"⚠️ **Error connecting to watsonx.ai API:** {str(e)}\n\n*Falling back to Simulation Mode for this response:*\n\n" + generate_mock_response(messages)
                }
            }],
            'simulated': True
        }), 200

def generate_mock_response(messages):
    last_msg = messages[-1]['content'].lower() if messages else ""
    
    if "compost" in last_msg or "waste" in last_msg or "recycle" in last_msg:
        return """### 🌱 Smart Waste Management Advice (IBM Granite Simulated)

Based on your household parameters, here is how you can optimize your waste footprint:

1. **Start a Kitchen Compost Pile:**
   * **What to add:** Fruit peels, vegetable scraps, coffee grounds, eggshells, dried leaves, and cardboard shreds.
   * **What to avoid:** Meat, dairy, fats, oils, and pet waste (to prevent odors and pests).
2. **Setup a 3-Bin Segregation System:**
   * **Dry Waste:** Clean papers, dry plastic bottles, cardboard, metals.
   * **Wet Waste:** Food scraps, tea bags, leftover food (ideal for compost).
   * **Hazardous/E-Waste:** Batteries, old chargers, expired medicines (store separately for drop-off).
3. **Minimize Single-Use Plastics:**
   * Replace plastic wrap with beeswax wraps.
   * Switch to soap bars instead of plastic bottled body washes.

*Keep tracking your waste habits in the **Eco-Streaks Tracker** to see your score rise!*"""

    elif "electricity" in last_msg or "energy" in last_msg or "power" in last_msg or "appliance" in last_msg:
        return """### ⚡ Energy Conservation Strategy (IBM Granite Simulated)

To lower your utility bills and carbon footprint, try these practical steps:

1. **Address Phantom Loads:**
   * Many appliances (TV, chargers, microwave) consume power even when turned off but plugged in.
   * Use **smart power strips** to cut power completely when not in use.
2. **Optimize Heating & Cooling:**
   * Adjust your AC/Heater thermostat by just 1°C. In summer, keeping it at 24-25°C can save up to 6% of cooling electricity.
   * Clean AC filters monthly to improve airflow efficiency by 15%.
3. **Upgrade to Smart LEDs:**
   * LED bulbs use 75-80% less energy than old incandescent bulbs and last 25 times longer.
4. **Utilize Natural Lighting:**
   * Rearrange your workspace closer to windows to avoid turning on lights during daylight.

*Use the **Appliance Energy Calculator** in the menu to inspect which of your home appliances is consuming the most power!*"""

    elif "water" in last_msg or "leak" in last_msg or "drip" in last_msg:
        return """### 💧 Household Water Stewardship Plan (IBM Granite Simulated)

Your water audit highlights key areas for conservation:

1. **Fix Leaks Immediately:**
   * A single dripping faucet (60 drops/min) wastes over 2,000 liters of water annually.
   * Check toilet tank valves using food coloring: drop a few drops in the tank, wait 15 minutes, and if color leaks into the bowl without flushing, your valve seal needs replacing.
2. **Install Low-Flow Aerators:**
   * Adding inexpensive aerators to bathroom and kitchen faucets reduces flow from 9L/min to 3.5L/min while maintaining high pressure.
3. **Smart Irrigation & Rain Harvesting:**
   * Water outdoor plants in the early morning or late evening to minimize evaporation.
   * Consider installing a simple rain barrel system to catch roof runoff for garden watering.

*Try the **Water Leak Estimator** tool in our sidebar to see the direct financial impact of drips!*"""

    elif "optimize" in last_msg or "calculator" in last_msg or "my score" in last_msg or "score" in last_msg:
        return """### 📊 Tailored Household Sustainability Audit (IBM Granite Simulated)

Thank you for completing your sustainability assessment. Here is an overview of your index:

* **Energy Rating:** Moderate efficiency. There are significant opportunities to reduce your heating and appliance base loads.
* **Water Stewardship:** Good, but fixture upgrades could improve your score by another 12 points.
* **Waste Minimization:** Can be improved. Implementing organic composting will divert up to 40% of your household trash from landfills.
* **Transport Emissions:** High carbon footprint. Walking/biking for short trips (<3km) or combining errands would yield the fastest environmental gains.

#### Next Action Items:
1. Turn off the water while brushing teeth (saves ~15L/day).
2. Swap out the 3 most-used incandescent bulbs for LEDs.
3. Keep track of daily actions in the **Eco-Streaks Tracker** to reinforce these green habits.
"""

    else:
        return """### 🏡 Welcome to the Household Sustainability Advisor! (IBM Granite Simulated)

I am your AI Sustainability Guide, powered by **IBM Granite**. I can help you save money, reduce waste, and live more sustainably.

Here are a few things you can ask me:
* *"How can I start composting in a small apartment?"*
* *"What are some easy ways to reduce my electricity bill?"*
* *"How much water does a leaking tap waste?"*
* *"Explain the connection between home sustainability and SDG 12 (Responsible Consumption)."*

**💡 Pro Tip:** Go to the **Assessment Calculator** first to measure your footprint, and then click **"Optimize with Granite"** to get a custom plan for your home! You can also configure your custom watsonx.ai API keys in **Settings** for live Granite responses.
"""

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)
