/**
 * 卒業年月早見表データ生成
 */

export interface GraduationYear {
    age: number;
    birthYear: number;
    elementarySchool: string;
    juniorHighSchool: string;
    highSchool: string;
    university: string;
}

/**
 * 現在の年から卒業年月早見表を生成
 */
export function generateGraduationTable(currentYear: number = new Date().getFullYear()): GraduationYear[] {
    const table: GraduationYear[] = [];

    // 18歳から60歳まで
    for (let age = 18; age <= 60; age++) {
        const birthYear = currentYear - age;

        table.push({
            age,
            birthYear,
            elementarySchool: `${birthYear + 6}年3月`,
            juniorHighSchool: `${birthYear + 15}年3月`,
            highSchool: `${birthYear + 18}年3月`,
            university: `${birthYear + 22}年3月`,
        });
    }

    return table;
}

/**
 * 生年月日から卒業年を計算
 */
export function calculateGraduationYears(birthYear: number) {
    return {
        elementarySchool: birthYear + 12,
        juniorHighSchool: birthYear + 15,
        highSchool: birthYear + 18,
        university: birthYear + 22,
    };
}
