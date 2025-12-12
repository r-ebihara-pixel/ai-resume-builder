"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { generateGraduationTable, GraduationYear } from "@/lib/graduationTable";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function GraduationTableModal({ isOpen, onClose }: Props) {
    const [currentYear] = useState(new Date().getFullYear());
    const tableData = generateGraduationTable(currentYear);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-bold">卒業年月早見表</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* テーブル */}
                <div className="overflow-auto max-h-[calc(90vh-80px)]">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="px-4 py-2 text-left border">年齢</th>
                                <th className="px-4 py-2 text-left border">生まれ年</th>
                                <th className="px-4 py-2 text-left border">小学校卒業</th>
                                <th className="px-4 py-2 text-left border">中学校卒業</th>
                                <th className="px-4 py-2 text-left border">高校卒業</th>
                                <th className="px-4 py-2 text-left border">大学卒業</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row) => (
                                <tr key={row.age} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border">{row.age}歳</td>
                                    <td className="px-4 py-2 border">{row.birthYear}年</td>
                                    <td className="px-4 py-2 border">{row.elementarySchool}</td>
                                    <td className="px-4 py-2 border">{row.juniorHighSchool}</td>
                                    <td className="px-4 py-2 border">{row.highSchool}</td>
                                    <td className="px-4 py-2 border">{row.university}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* フッター */}
                <div className="p-4 border-t bg-gray-50 text-xs text-gray-600">
                    ※ {currentYear}年時点での年齢を基準にしています
                </div>
            </div>
        </div>
    );
}
