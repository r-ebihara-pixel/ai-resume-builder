const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function testModels() {
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
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-exp",
        "gemini-pro",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro-latest"
    ];

    console.log("Testing model candidates...");
    for (const name of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: name });
            const result = await model.generateContent("Hello");
            console.log(`PASS: ${name}`);
            process.exit(0); // Stop at first success
        } catch (e) {
            console.log(`FAIL: ${name} - ${e.message}`);
        }
    }
}

testModels();
