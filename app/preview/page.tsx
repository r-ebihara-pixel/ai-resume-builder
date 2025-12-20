"use client";

import React, { useEffect, useState } from "react";
import { ResumeData } from "@/types/resume";
import { ResumePreview } from "@/components/ResumePreview";
import { CareerSheetPreview } from "@/components/CareerSheetPreview";
import { RecommendationPreview } from "@/components/RecommendationPreview";
import { initialResumeData } from "@/lib/initialResumeData";

export default function PreviewPage() {
    const [data, setData] = useState<ResumeData>(initialResumeData);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "RESUME_DATA_UPDATE") {
                setData(event.data.payload);
            }
        };

        window.addEventListener("message", handleMessage);
        // Request initial data if needed
        window.parent.postMessage({ type: "PREVIEW_READY" }, "*");

        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return (
        <div className="bg-zinc-100 min-h-screen p-4 flex flex-col gap-8 print:p-0 print:bg-white">
            <div className="mx-auto shadow-2xl print:shadow-none">
                <ResumePreview formData={data} />
            </div>
            <div className="mx-auto shadow-2xl print:shadow-none">
                <CareerSheetPreview formData={data} />
            </div>
            <div className="mx-auto shadow-2xl print:shadow-none">
                <RecommendationPreview
                    formData={data}
                    recommendationInput={{
                        targetCompany: "",
                        targetPosition: "",
                        summary: "",
                        strengths: "",
                        concerns: "",
                        matchReason: ""
                    }}
                    recommendationText={data.motivation || ""}
                />
            </div>
        </div>
    );
}
