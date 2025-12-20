const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Manually load .env.local if possible
const envPath = path.join(process.cwd(), ".env.local");
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/GEMINI_API_KEY=([^ \n]+)/);
    if (match) apiKey = match[1];
}

async function listModels() {
    if (!apiKey) {
        console.error("GEMINI_API_KEY not found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).getProperties();
        console.log("Gemini 1.5 Flash properties found.");
    } catch (e) {
        console.log("Could not get gemini-1.5-flash properties directly.");
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        console.log("Gemini models found:");
        if (data.models) {
            data.models
                .filter(m => m.name.includes("gemini"))
                .forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods.join(", ")})`));
        } else {
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Failed to list models:", error);
    }
}

listModels();
