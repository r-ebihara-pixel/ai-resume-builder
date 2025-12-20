const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function diag() {
    console.log("--- Gemini API Diagnostics ---");

    // Load .env.local manually
    const envPath = path.join(process.cwd(), ".env.local");
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const apiKeyMatch = envContent.match(/GEMINI_API_KEY=([^\s]+)/);
    const apiKey = process.env.GEMINI_API_KEY || (apiKeyMatch ? apiKeyMatch[1] : null);

    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY not found in process.env or .env.local");
        return;
    }

    console.log(`API Key found (length: ${apiKey.length}, starts with: ${apiKey.substring(0, 4)}...)`);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            console.error(`ERROR: Fetch failed with status ${response.status}`);
            const errBody = await response.text();
            console.error(errBody);
            return;
        }
        const data = await response.json();
        console.log("Model Listing Result:");
        if (data.models) {
            const generateModels = data.models
                .filter(m => m.supportedGenerationMethods.includes("generateContent"))
                .map(m => m.name);
            fs.writeFileSync("models.txt", generateModels.join("\n"));
            console.log("Wrote " + generateModels.length + " models to models.txt");
        }
        else {
            console.log("No models found in response.");
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("ERROR during diagnostics:", e);
    }
}

diag();
