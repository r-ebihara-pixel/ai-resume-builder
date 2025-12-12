/**
 * 郵便番号から住所を取得
 */

export interface AddressData {
    prefecture: string;
    city: string;
    town: string;
    prefectureKana: string;
    cityKana: string;
    townKana: string;
}

/**
 * 郵便番号APIを使用して住所を取得
 * zipcloud APIを使用（無料、登録不要）
 */
export async function fetchAddressByPostalCode(postalCode: string): Promise<AddressData | null> {
    // ハイフンを削除
    const cleanedCode = postalCode.replace(/-/g, "");

    // 7桁の数字かチェック
    if (!/^\d{7}$/.test(cleanedCode)) {
        return null;
    }

    try {
        const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanedCode}`);
        const data = await response.json();

        if (data.status === 200 && data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                prefecture: result.address1,
                city: result.address2,
                town: result.address3,
                prefectureKana: result.kana1,
                cityKana: result.kana2,
                townKana: result.kana3,
            };
        }

        return null;
    } catch (error) {
        console.error("Failed to fetch address:", error);
        return null;
    }
}
