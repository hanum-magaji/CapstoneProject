import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Support both Vite-prefixed envs (for dev) and plain envs (for serverless)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log("Supabase URL:", process.env.SUPABASE_URL ? "OK" : "MISSING");
console.log("Supabase Service Role Key:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING");
console.log("OpenAI API Key:", process.env.OPENAI_API_KEY ? "OK" : "MISSING");

//console.log("Supabase env present:", { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY });

let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.error("Error creating Supabase client:", e);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Fail fast with clear JSON if required env/runtime pieces are missing
  if (!supabase) {
    const msg =
      "Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY (for dev) or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for server).";
    console.error(msg);
    return res.status(500).json({ error: msg });
  }
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY is not set in environment.";
    console.error(msg);
    return res.status(500).json({ error: msg });
  }

  const { project_id, prompt } = req.body;
  if (!project_id || !prompt)
    return res.status(400).json({ error: "Missing project_id or prompt" });

  // Fetch existing requirements
  const { data: reqs } = await supabase
    .from("requirements")
    .select("*")
    .eq("project_id", project_id)
    .order("created_at");

  const aiPrompt = `
You are an expert software analyst and product manager.
The user wants to modify a project's requirements using natural language.

### Existing Requirements ###
${JSON.stringify(reqs, null, 2)}

### User Request ###
"${prompt}"

### Your Task ###
Return ONLY JSON in the following format:

{
  "add": [
    { "text": "", "priority": 1|2|3 }
  ],
  "update": [
    { "id": "", "text": "", "priority": 1|2|3, "status": "pending|done" }
  ],
  "delete": [
    { "id": "" }
  ]
}

- "add" includes NEW requirements.
- "update" modifies an existing requirement.
- "delete" removes requirements specified.
- Do not include any text outside the JSON object.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: aiPrompt }],
      temperature: 0.6,
    });

    const raw = completion.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse AI JSON:", raw);
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    // Apply ADD operations
    if (parsed.add) {
      for (const r of parsed.add) {
        await supabase.from("requirements").insert([
          {
            project_id,
            text: r.text,
            priority: r.priority || 2,
            status: "pending",
          },
        ]);
      }
    }

    // Apply UPDATE operations
    if (parsed.update) {
      for (const r of parsed.update) {
        await supabase
          .from("requirements")
          .update({
            text: r.text,
            priority: r.priority,
            status: r.status,
          })
          .eq("id", r.id);
      }
    }

    // Apply DELETE operations
    if (parsed.delete) {
      for (const r of parsed.delete) {
        await supabase.from("requirements").delete().eq("id", r.id);
      }
    }

    res.status(200).json({ success: true, changes: parsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "OpenAI request failed" });
  }
}
