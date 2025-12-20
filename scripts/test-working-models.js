const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function testWorkingModels() {
    const envPath = path.join(process.cwd(), ".env.local");
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const apiKeyMatch = envContent.match(/GEMINI_API_KEY=([^\s]+)/);
    const apiKey = process.env.GEMINI_API_KEY || (apiKeyMatch ? apiKeyMatch[1] : null);

    if (!apiKey) {
        console.error("API Key not found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const candidates = [
        "gemini-flash-lite-latest",
        "gemini-pro-latest",
        "gemini-2.0-flash-exp"
    ];

    console.log("Testing model candidates...");
    for (const name of candidates) {
        try {
            console.log(`Checking ${name}...`);
            const model = genAI.getGenerativeModel({ model: name });
            const result = await model.generateContent("Hello");
            console.log(`PASS: ${name}`);
            console.log("Response:", result.response.text());
            process.exit(0);
        } catch (e) {
            console.log(`FAIL: ${name} - ${e.message}`);
        }
    }
}

testWorkingModels();
