// 簡易検証用JS
const { extractResumeDataFromText } = require("../lib/extract/extractResumeDataFromText");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const sampleRawText = `
根本 大介(ネモト ダイスケ)
1996/05/17 生まれ
〒171-0022 東京都豊島区南池袋1-8-24 302
08030117996
test@example.com

学歴
2015年4月〜2019年3月 東洋大学 文学部史学科 卒業

職歴
2019年4月〜2022年3月 株式会社サンプル
正社員として営業職に従事。
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
    console.log("Starting normalization test (JS)...");
    try {
        const result = await extractResumeDataFromText(sampleRawText);
        if (result.ok) {
            console.log("Success!");
            console.log(JSON.stringify(result.data, null, 2));
        } else {
            console.error("Failed:", result.error);
        }
    } catch (e) {
        console.error("Crash:", e);
    }
}

test();
