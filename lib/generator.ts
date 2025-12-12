import { Template } from "@/lib/data/jobTemplates";

export type UserInput = {
    previousJob?: string;
    studyContent?: string;
    learningLanguage?: string;
    episode?: string;
    result?: string;
    studyTime?: string;
    portfolio?: string;
    targetProduct?: string;
};

const NG_WORDS = [
    "在宅勤務",
    "リモートワーク",
    "フルリモート",
    "転勤なし",
    "残業なし",
    "副業可",
];

export const generateText = (templateText: string, input: UserInput): string => {
    let text = templateText;

    if (input.previousJob) text = text.replace(/【前職】/g, input.previousJob);
    if (input.studyContent) {
        text = text.replace(/【勉強内容】/g, input.studyContent);
        text = text.replace(/【学習内容】/g, input.studyContent);
    }
    if (input.learningLanguage) text = text.replace(/【学習言語】/g, input.learningLanguage);
    if (input.episode) {
        text = text.replace(/【具体的な業務／エピソード】/g, input.episode);
        text = text.replace(/【具体的なエピソード】/g, input.episode);
        text = text.replace(/【前職での目標・数字・行動のエピソード】/g, input.episode);
        text = text.replace(/【前職の顧客対応エピソード】/g, input.episode);
    }
    if (input.result) text = text.replace(/【成果】/g, input.result);
    if (input.studyTime) text = text.replace(/【学習時間】/g, input.studyTime);
    if (input.portfolio) {
        text = text.replace(/【ポートフォリオ内容】/g, input.portfolio);
        text = text.replace(/【簡単な成果】/g, input.portfolio);
        text = text.replace(/【ポートフォリオの簡単な内容】/g, input.portfolio);
    }
    if (input.targetProduct) text = text.replace(/【商材・サービス】/g, input.targetProduct);

    NG_WORDS.forEach((word) => {
        const regex = new RegExp(word, "g");
        text = text.replace(regex, "");
    });

    return text;
};
