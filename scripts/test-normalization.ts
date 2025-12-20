import { extractResumeDataFromText } from "../lib/extract/extractResumeDataFromText";

const sampleRawText = `
根本 大介(ネモト ダイスケ)
1996/05/17 生まれ
男性
〒171-0022 東京都豊島区南池袋1-8-24 302
08030117996
test@example.com

学歴
2015年4月〜2019年3月 2019年東洋大学 文学部史学科 卒業

職歴
2019年4月〜2022年3月 株式会社サンプル 在籍期間：3年 雇用形態：正社員
営業職に従事。
2022年4月〜現在 株式会社デモ
現在在職中です。

資格
2020年10月 TOEIC（10～495）
2021年12月 普通自動車第一種運転免許

本人希望
希望年収：350万円以上
希望勤務地：東京都
`;

async function test() {
    console.log("Starting enhanced normalization test...");
    const result = await extractResumeDataFromText(sampleRawText);

    if (result.ok) {
        const data = result.resumeData;
        console.log("Extraction successful!");
        console.log("Profile:", JSON.stringify(data.profile, null, 2));

        // Assertions
        const city = data.profile.address.city;
        const postalInCity = city.includes("〒") || /\d{3}-\d{4}/.test(city);
        console.log(`[CHECK] Postal in City: ${postalInCity ? "❌ FAIL" : "✅ PASS"} (${city})`);

        const eduName = data.education[0]?.schoolName || "";
        const yearInEdu = /20\d{2}/.test(eduName);
        console.log(`[CHECK] Year in School Name: ${yearInEdu ? "❌ FAIL" : "✅ PASS"} (${eduName})`);

        const companyName = data.workHistory[0]?.companyName || "";
        const labelInCompany = ["在籍期間", "雇用形態"].some(l => companyName.includes(l));
        console.log(`[CHECK] Labels in Company Name: ${labelInCompany ? "❌ FAIL" : "✅ PASS"} (${companyName})`);

        console.log("\nWarnings:", result.warnings);
        console.log("\nFull Data:", JSON.stringify(data, null, 2));
    } else {
        console.error("--- FAILED ---");
        console.error("Error:", result.error);
        if (result.debug) {
            console.error("Debug Info (Raw):", result.debug.raw);
        }
    }
}

test();
