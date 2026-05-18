# AgentPay OS — Demo Agent

Simulates a vendor payment AI agent submitting payment requests through AgentPay OS governance layer.

## Setup

```bash
npm install node-fetch
```

## Configure

Set these before running — either as env vars or edit the defaults at the top of the file:

```bash
export API_BASE="http://localhost:4000/api"
export AGENT_EMAIL="your@email.com"
export AGENT_PASSWORD="yourpassword"
export AGENT_ID="your_agent_id_from_dashboard"
```

Get your `AGENT_ID` from the agent detail page URL:
`http://localhost:3000/agents/YOUR_AGENT_ID`

## Run

```bash
node agent.demo.js
```

## What happens

The script submits 4 vendor payment requests of increasing amounts:

| Payment | Amount | Expected outcome |
|---|---|---|
| SaaS subscription | $50 | Depends on your approval threshold |
| Cloud infrastructure | $250 | Depends on your approval threshold |
| Contractor invoice | $750 | Likely pending approval |
| Legal retainer | $1,200 | Likely pending approval |

Requests **below** your agent's `approvalThreshold` → auto-approved  
Requests **above** your agent's `approvalThreshold` → pending in dashboard

## Review approvals

Open `http://localhost:3000/workflows` to approve or reject pending requests.

