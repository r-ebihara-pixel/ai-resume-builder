const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

async function testProLatest() {
    const envPath = path.join(process.cwd(), ".env.local");
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const apiKeyMatch = envContent.match(/GEMINI_API_KEY=([^\s]+)/);
    const apiKey = process.env.GEMINI_API_KEY || (apiKeyMatch ? apiKeyMatch[1] : null);

    if (!apiKey) {
        console.error("API Key not found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const name = "gemini-pro-latest";

    console.log(`Testing ${name}...`);
    try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent("Hello");
        console.log(`PASS: ${name}`);
        console.log("Response:", result.response.text());
    } catch (e) {
        console.log(`FAIL: ${name} - ${e.message}`);
    }
}

testProLatest();
