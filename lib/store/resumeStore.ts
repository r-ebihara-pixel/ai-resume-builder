import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ResumeData } from "@/types/resume";
import { initialResumeData } from "@/lib/initialResumeData";

type ResumeState = {
    resume: ResumeData;
    updatedAt: number; // 最終保存時刻（epoch ms）
    hasHydrated: boolean;

    // actions
    setAll: (data: Partial<ResumeData>) => void;
    setValue: <K extends keyof ResumeData>(key: K, value: ResumeData[K]) => void;

    // ネスト対応（"basic.name" みたいな path で更新したい時用）
    setByPath: (path: string, value: unknown) => void;

    clearDraft: () => void;
    setHydrated: (v: boolean) => void;
};



function setObjectByPath(obj: any, path: string, value: unknown) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cur[k] == null || typeof cur[k] !== "object") cur[k] = {};
        cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
}

function deepMerge<T>(base: T, patch: any): T {
    if (patch == null) return base;

    // 配列は draft を優先（初期の空配列を上書きする）
    if (Array.isArray(base) && Array.isArray(patch)) return patch as T;

    if (typeof base !== "object" || base === null) return patch as T;
    if (typeof patch !== "object" || patch === null) return base;

    const out: any = { ...(base as any) };
    for (const k of Object.keys(patch)) {
        out[k] = k in out ? deepMerge(out[k], patch[k]) : patch[k];
    }
    return out;
}

export const useResumeStore = create<ResumeState>()(
    persist(
        (set, get) => ({
            resume: initialResumeData,
            updatedAt: 0,
            hasHydrated: false,

            setAll: (data) =>
                set((s) => ({
                    resume: { ...s.resume, ...data },
                    updatedAt: Date.now(),
                })),

            setValue: (key, value) =>
                set((s) => ({
                    resume: { ...s.resume, [key]: value },
                    updatedAt: Date.now(),
                })),

            setByPath: (path, value) =>
                set((s) => {
                    const next = structuredClone(s.resume);
                    setObjectByPath(next, path, value);
                    return { resume: next, updatedAt: Date.now() };
                }),

            clearDraft: () =>
                set(() => ({
                    resume: initialResumeData,
                    updatedAt: 0,
                })),

            setHydrated: (v) => set({ hasHydrated: v }),
        }),
        {
            name: "resume-draft-v3",
            storage: createJSONStorage(() => localStorage),
            // 保存するものを絞る（不要なstateは保存しない）
            partialize: (s) => ({ resume: s.resume, updatedAt: s.updatedAt } as any),
            merge: (persisted, current) => {
                const p: any = persisted ?? {};
                return {
                    ...(current as any),
                    ...(p as any),
                    resume: deepMerge((current as any).resume, p.resume),
                    updatedAt: p.updatedAt ?? (current as any).updatedAt,
                };
            },
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
            },
            version: 1,
        }
    )
);
