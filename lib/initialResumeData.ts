import type { ResumeData } from "@/types/resume";

export const initialResumeData: ResumeData = {
    profile: {
        lastName: "", firstName: "",
        lastNameKana: "", firstNameKana: "",
        birthday: { year: "", month: "", day: "" },
        gender: "",
        phone: "",
        email: "",
        address: { postalCode: "", prefecture: "", city: "", block: "", building: "", kana: "" },
        contactAddress: { postalCode: "", prefecture: "", city: "", block: "", building: "", kana: "", phone: "", email: "" },
    },
    education: [],
    workHistory: [],
    certifications: [],
    selfPromotion: "",
    motivation: "",
    requests: "",
    submissionDate: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
    photoUrl: "",
} as ResumeData;
