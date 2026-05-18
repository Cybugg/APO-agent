/**
 * AgentPay OS — Demo Vendor Payment Agent
 *
 * Simulates an AI agent that autonomously decides to make vendor payments
 * and submits them through AgentPay OS for governance and approval.
 *
 * Run:
 *   node agent.demo.js
 *
 * What this demonstrates:
 * - Agents operate autonomously and submit payment requests programmatically
 * - AgentPay OS intercepts every request and evaluates against the spend policy
 * - Requests below threshold → PENDING (human approval required)
 * - Real-world: this script would be replaced by an LLM agent (LangChain, AutoGPT, etc.)
 *   calling the same API when it decides to make a payment
 */

import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();


// ### Config ###################################################################

const API_BASE = process.env.API_BASE;
const AGENT_EMAIL = process.env.AGENT_EMAIL;
const AGENT_PASSWORD = process.env.AGENT_PASSWORD;
const AGENT_ID = process.env.AGENT_ID;

// ### Vendor payment scenarios #################################################

/**
 * Simulated vendor payments the agent "decides" to make.
 * In production: an LLM would generate these based on business logic,
 * invoices, procurement rules, or market conditions.
 */
const VENDOR_PAYMENTS = [
  {
    recipient: "1000216185",              // Circle sandbox vendor wallet
    amount: 5,
    reason: "Monthly SaaS subscription - Notion Pro (auto-renewal)",
  },
  {
    recipient: "1000216185",
    amount: 6,
    reason: "Cloud infrastructure invoice - AWS October billing cycle",
  },
  {
    recipient: "1000216185",
    amount: 10,
    reason: "Contractor invoice - UI/UX design sprint week 3",
  },
  {
    recipient: "1000216185",
    amount: 15,
    reason: "Legal retainer - Q4 compliance review and filing",
  },
];

// ### HTTP helpers #############################################################

async function post(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message ?? `Request failed: ${path}`);
  }

  return json.data;
}

async function get(path, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message ?? `Request failed: ${path}`);
  }

  return json.data;
}

// ### Agent logic ##############################################################

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(emoji, msg) {
  console.log(`${emoji}  ${msg}`);
}

function divider() {
  console.log("\n" + "─".repeat(60) + "\n");
}

async function run() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║         AgentPay OS : Demo Vendor Payment Agent           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // ### Step 1: Authenticate ###################################################

  log("🔐", "Authenticating with AgentPay OS...");

  let token;
  try {
    const auth = await post("/auth/login", {
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
    });
    token = auth.token;
    log("✅", `Authenticated as ${auth.user.email}`);
  } catch (err) {
    console.error("❌  Authentication failed:", err.message);
    console.error("    Set AGENT_EMAIL and AGENT_PASSWORD env vars and retry.");
    process.exit(1);
  }

  divider();

  // ### Step 2: Verify agent + policy ##########################################

  log("🤖", `Loading agent ${AGENT_ID}...`);

  let agent;
  try {
    agent = await get(`/agents/${AGENT_ID}`, token);
    log("✅", `Agent: ${agent.name}`);
    log("💳", `Wallet: ${agent.circleWalletId ?? "NOT LINKED"}`);

    if (!agent.circleWalletId) {
      console.error("❌  Agent has no Circle wallet. Link one in the dashboard first.");
      process.exit(1);
    }

    if (!agent.policy) {
      console.error("❌  Agent has no spend policy. Set one in the dashboard first.");
      process.exit(1);
    }

    log("📋", `Policy: max $${agent.policy.maxAmountPerTx} per tx · daily limit $${agent.policy.dailyLimit}`);
    log("🔔", `Approval required above: $${agent.policy.approvalThreshold}`);
  } catch (err) {
    console.error("❌  Failed to load agent:", err.message);
    console.error("    Check AGENT_ID is correct and the agent belongs to your org.");
    process.exit(1);
  }

  divider();

  // ### Step 3: Submit payment requests ########################################

  log("💸", `Agent is processing ${VENDOR_PAYMENTS.length} vendor payments...\n`);

  const results = [];

  for (const payment of VENDOR_PAYMENTS) {
    console.log(`  📄 ${payment.reason}`);
    console.log(`     Amount: $${payment.amount} USDC`);
    console.log(`     Recipient: ${payment.recipient}`);

    try {
      const request = await post(
        `/approvalWorkflows`,
        {
          agentId: AGENT_ID,
          amount: payment.amount,
          recipient: payment.recipient,
          reason: payment.reason,
        },
        token
      );

      const status = request.status;
      const emoji =
        status === "APPROVED" ? "✅" :
        status === "PENDING"  ? "⏳" :
        status === "REJECTED" ? "❌" : "❓";

      console.log(`     Status: ${emoji} ${status}`);

      if (status === "PENDING") {
        console.log(`     → Review in AgentPay OS dashboard: http://localhost:3000/workflows`);
      }

      results.push({ payment, request, status });
    } catch (err) {
      console.error(`     ❌ Failed: ${err.message}`);
      results.push({ payment, error: err.message });
    }

    console.log();
    await sleep(800); // Slight delay between requests for readability
  }

  // ### Step 4: Summary ########################################################

  divider();

  const approved = results.filter((r) => r.status === "APPROVED");
  const pending  = results.filter((r) => r.status === "PENDING");
  const failed   = results.filter((r) => r.error);

  console.log("📊  SUMMARY");
  console.log(`    ✅ Auto-approved : ${approved.length}`);
  console.log(`    ⏳ Pending review: ${pending.length}`);
  console.log(`    ❌ Failed        : ${failed.length}`);

  const totalPending = pending.reduce((s, r) => s + r.payment.amount, 0);
  const totalApproved = approved.reduce((s, r) => s + r.payment.amount, 0);

  if (pending.length > 0) {
    console.log(`\n    $${totalPending} USDC awaiting approval in dashboard`);
    console.log(`    → http://localhost:3000/workflows`);
  }

  if (approved.length > 0) {
    console.log(`\n    $${totalApproved} USDC auto-approved within policy limits`);
  }

  console.log("\n" + "─".repeat(60));
  console.log("  Agent run complete. AgentPay OS governed every request.");
  console.log("─".repeat(60) + "\n");
}

run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});