import React from "react";
import { ResumeData } from "@/types/resume";
import { renderWithMinchoDigits } from "@/lib/utils/text";

interface RecommendationInput {
    targetCompany: string;
    targetPosition: string;
    summary: string;
    strengths: string;
    concerns: string;
    matchReason: string;
}

interface Props {
    formData: ResumeData;
    recommendationInput: RecommendationInput;
    recommendationText: string;
    id?: string;
}

export const RecommendationPreview = React.forwardRef<HTMLDivElement, Props>(
    ({ formData, recommendationInput, recommendationText, id }, ref) => {
        return (
            <div
                ref={ref}
                id={id}
                className="w-[210mm] min-h-[297mm] bg-white text-black font-serif text-sm p-[20mm] box-border mx-auto"
            >
                <style>
                    {`
          @page { size: A4; margin: 0; }
          @media print {
            body { -webkit-print-color-adjust: exact; }
            .recommendation-page { font-family: "MS Mincho", "MS PMincho", "Hiragino Mincho ProN", serif !important; }
          }
          .recommendation-page {
            font-family: "MS Mincho", "MS PMincho", "Hiragino Mincho ProN", serif !important;
          }
        `}
                </style>

                <div className="recommendation-page w-full h-full">
                    {/* Header – centered title */}
                    <div className="mb-8 text-center text-black">
                        <h1 className="text-2xl font-bold tracking-wider">推　薦　文</h1>
                    </div>

                    {/* Body – recommendation text */}
                    <div className="text-xs leading-relaxed whitespace-pre-wrap">
                        {renderWithMinchoDigits(
                            recommendationText && recommendationText.trim().length > 0
                                ? recommendationText
                                : "　"
                        )}
                    </div>
                </div>
            </div>
        );
    }
);

RecommendationPreview.displayName = "RecommendationPreview";
export default RecommendationPreview;
