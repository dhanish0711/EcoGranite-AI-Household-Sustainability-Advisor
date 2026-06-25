import requests

apikey = "YOUR_API_KEY"
project_id = "YOUR_PROJECT_ID"
service_url = "https://us-south.ml.cloud.ibm.com"
model_id = "ibm/granite-3-8b-instruct"

print("1. Testing IBM Cloud Token Generation...")
try:
    token_url = "https://iam.cloud.ibm.com/identity/token"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
    }
    payload = {
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": apikey
    }
    r = requests.post(token_url, headers=headers, data=payload, timeout=15)
    r.raise_for_status()
    token_data = r.json()
    access_token = token_data.get("access_token")
    print("SUCCESS: Token generated successfully!")
except Exception as e:
    print(f"ERROR: Token generation failed: {e}")
    exit(1)

print("\n2. Testing watsonx.ai Text Generation...")
try:
    chat_url = f"{service_url}/ml/v1/text/chat?version=2024-05-31"
    chat_headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    chat_payload = {
        "model_id": model_id,
        "project_id": project_id,
        "messages": [
            {"role": "user", "content": "Hello, this is a test from the Household Sustainability Advisor."}
        ],
        "parameters": {
            "max_tokens": 100
        }
    }
    r_chat = requests.post(chat_url, headers=chat_headers, json=chat_payload, timeout=20)
    print(f"Status Code: {r_chat.status_code}")
    print(f"Response Body: {r_chat.text}")
    r_chat.raise_for_status()
    print("SUCCESS: watsonx.ai connection successful!")
except Exception as e:
    print(f"ERROR: watsonx.ai call failed: {e}")
