# IoT Honeypot GUI
Flask + HTML/CSS Control Center for your IoT Honeypot project.

## Features
- Start / Stop Cowrie honeypot
- Live log viewer (real-time attack stream)
- Upload cowrie.json and analyze with AI
- Dashboard with charts and stats
- Download full AI-generated report

## Setup

### 1. Install dependencies
```bash
pip install flask 
```

### 2. Run the app
```bash
python app.py
```

### 3. Open browser
```
http://localhost:5000
```

## How to Use

1. **Dashboard tab** — See attack stats and charts
2. **Live Logs tab** — Watch attacks in real time (start Cowrie first)
3. **AI Analyze tab** — Upload cowrie.json → enter API key → click Analyze
4. **Report tab** — View and download the full AI report

## Getting Anthropic API Key
1. Go to https://aistudio.google.com
2. Sign up / Login
3. Create an API key
4. Paste it in the AI Analyze tab

## Cowrie Log Location
```
/home/cowrie/cowrie/var/log/cowrie/cowrie.json
```
Copy it to Desktop:
```bash
cp /home/cowrie/cowrie/var/log/cowrie/cowrie.json ~/Desktop/
```
Then upload it in the AI Analyze tab.
