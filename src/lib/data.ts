"use client";

import useSWR, { mutate } from "swr";
import { applyAccent, DEFAULT_ACCENT } from "@/lib/accent";
import { DEFAULT_PREFERENCES } from "@/lib/constants";
import { getSupabase } from "@/lib/supabase/client";
import type { Preferences, Profile, QuestionResult, Report, SessionConfig, SessionRow } from "@/types";

/**
 * Client-side data. Reads go straight to Supabase as the signed-in user (RLS
 * scopes every query); anything that needs the LLM or the eval agent goes
 * through our /api/sessions routes.
 */

const KEYS = {
  profile: "profile",
  completed: "sessions:completed",
  session: (id: string) => `session:${id}`,
};

async function fetchProfile(): Promise<Profile> {
  const supabase = getSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("not signed in");
  const { data, error } = await supabase
    .from("lms_profiles")
    .select("id, name, preferences")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
    name: data?.name || auth.user.email?.split("@")[0] || "there",
    preferences: { ...DEFAULT_PREFERENCES, ...(data?.preferences ?? {}) },
  };
}

/** Completed sessions with their reports, newest first. */
export interface CompletedSession {
  id: string;
  config: SessionConfig;
  total: number;
  report: Report;
  completed_at: string;
}

async function fetchCompleted(): Promise<CompletedSession[]> {
  const { data, error } = await getSupabase()
    .from("lms_sessions")
    .select("id, config, total, report, completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as CompletedSession[];
}

async function fetchSession(id: string): Promise<SessionRow | null> {
  const { data, error } = await getSupabase().from("lms_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as SessionRow | null;
}

const swrOptions = { revalidateOnFocus: false };

export const useProfile = () => useSWR(KEYS.profile, fetchProfile, swrOptions);
export const useCompletedSessions = () => useSWR(KEYS.completed, fetchCompleted, swrOptions);
export const useSessionRow = (id: string) => useSWR(KEYS.session(id), () => fetchSession(id), swrOptions);

export async function updatePreferences(profile: Profile, patch: Partial<Preferences>) {
  const preferences = { ...profile.preferences, ...patch };
  await mutate(KEYS.profile, { ...profile, preferences }, false);
  const { error } = await getSupabase().from("lms_profiles").upsert({ id: profile.id, name: profile.name, preferences });
  if (error) throw error;
}

export async function updateName(profile: Profile, name: string) {
  const { error } = await getSupabase()
    .from("lms_profiles")
    .upsert({ id: profile.id, name, preferences: profile.preferences });
  if (error) throw error;
  await mutate(KEYS.profile, { ...profile, name }, false);
}

export async function signOut() {
  await getSupabase().auth.signOut();
  await mutate(() => true, undefined, { revalidate: false });
  // The accent belongs to the account, not the browser; don't leave it for the next person.
  applyAccent(DEFAULT_ACCENT);
}

// ---- session API ----

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `request failed (${res.status})`);
  return body;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** Creates a session with fresh questions; returns its id. */
export async function createSession(config: SessionConfig) {
  const { id } = await api<{ id: string }>("/api/sessions", json(config));
  await mutate(KEYS.profile);
  return id;
}

export async function sendAnswer(
  sessionId: string,
  input: {
    index: number;
    target: "main" | "followup";
    text: string;
    mode: "voice" | "text";
    durationSec: number;
    audio?: Blob | null;
  },
) {
  const body = new FormData();
  body.set("index", String(input.index));
  body.set("target", input.target);
  body.set("text", input.text);
  body.set("mode", input.mode);
  body.set("durationSec", String(input.durationSec));
  if (input.audio) body.set("audio", input.audio, "answer");
  const { result } = await api<{ result: QuestionResult }>(`/api/sessions/${sessionId}/answers`, {
    method: "POST",
    body,
  });
  return result;
}

export async function sendSkip(sessionId: string, index: number, target: "main" | "followup") {
  const { result } = await api<{ result: QuestionResult }>(`/api/sessions/${sessionId}/skip`, json({ index, target }));
  return result;
}

export async function completeSession(sessionId: string) {
  await api(`/api/sessions/${sessionId}/complete`, { method: "POST" });
  await Promise.all([mutate(KEYS.completed), mutate(KEYS.session(sessionId))]);
}

export async function abandonSession(sessionId: string) {
  await api(`/api/sessions/${sessionId}/abandon`, { method: "POST" });
}
