"use client";

import useSWR, { mutate } from "swr";
import { applyAccent, DEFAULT_ACCENT } from "@/lib/accent";
import { DEFAULT_PREFERENCES } from "@/lib/constants";
import { type Attempt, type ByDifficulty, type TopicMastery, topicMastery } from "@/lib/mastery";
import { getSupabase } from "@/lib/supabase/client";
import type {
  AnswerMode,
  Difficulty,
  Domain,
  FriendOverview,
  FriendRelation,
  FriendRequest,
  Preferences,
  Profile,
  Question,
  QuestionResult,
  Report,
  SavedQuestion,
  SessionConfig,
  SessionRow,
  UserSearchResult,
} from "@/types";

/**
 * Client-side data. Reads go straight to Supabase as the signed-in user (RLS
 * scopes every query); anything that needs the LLM or the eval agent goes
 * through our /api/sessions routes.
 */

const KEYS = {
  profile: "profile",
  completed: "sessions:completed",
  session: (id: string) => `session:${id}`,
  saved: "saved",
  friends: "friends:overview",
  friendRequests: "friends:requests",
  friend: (id: string) => `friends:profile:${id}`,
  attempts: "attempts",
  bankCounts: "bank:counts",
};

async function fetchProfile(): Promise<Profile> {
  const supabase = getSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("not signed in");
  const { data, error } = await supabase
    .from("lms_profiles")
    .select("id, name, preferences, avatar_url")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    id: auth.user.id,
    email: auth.user.email ?? "",
    name: data?.name || auth.user.email?.split("@")[0] || "there",
    avatarUrl: data?.avatar_url ?? null,
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

async function fetchSaved(): Promise<SavedQuestion[]> {
  const { data, error } = await getSupabase()
    .from("lms_saved_questions")
    .select("id, session_id, question_index, text, domain, difficulty, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as SavedQuestion[];
}

/** The user's answered bank questions, newest first (see src/lib/mastery.ts). */
async function fetchAttempts(): Promise<Attempt[]> {
  const { data, error } = await getSupabase()
    .from("lms_question_attempts")
    .select("question_id, session_id, domain, difficulty, topics, score, skipped, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as Attempt[];
}

interface BankCount {
  domain: Domain;
  difficulty: Difficulty;
  count: number;
}

const swrOptions = { revalidateOnFocus: false };

export const useProfile = () => useSWR(KEYS.profile, fetchProfile, swrOptions);
export const useCompletedSessions = () => useSWR(KEYS.completed, fetchCompleted, swrOptions);
export const useSessionRow = (id: string) => useSWR(KEYS.session(id), () => fetchSession(id), swrOptions);
export const useSavedQuestions = () => useSWR(KEYS.saved, fetchSaved, swrOptions);
export const useAttempts = () => useSWR(KEYS.attempts, fetchAttempts, swrOptions);
/** Attempts rolled up per topic. Shares the attempts request with useAttempts. */
export function useTopicMastery(): { data: TopicMastery[] | undefined } {
  const { data } = useAttempts();
  return { data: data && topicMastery(data) };
}
/** Active questions per domain + difficulty. Needs migration 0008; absent, the ring shows counts only. */
export const useBankCounts = () =>
  useSWR(KEYS.bankCounts, () => rpc<BankCount[]>("lms_bank_counts"), { ...swrOptions, shouldRetryOnError: false });

export interface SaveTarget {
  sessionId: string;
  index: number;
  text: string;
  config: Pick<SessionConfig, "domain" | "difficulty">;
}

export const isSaved = (saved: SavedQuestion[], t: Pick<SaveTarget, "sessionId" | "index">) =>
  saved.some((q) => q.session_id === t.sessionId && q.question_index === t.index);

/** Saves or unsaves a question; the list updates at once and rolls back on failure. */
export async function toggleSaved(target: SaveTarget, saved: SavedQuestion[]) {
  const supabase = getSupabase();
  const was = isSaved(saved, target);
  const next = was
    ? saved.filter((q) => !(q.session_id === target.sessionId && q.question_index === target.index))
    : [
        {
          id: `pending:${target.sessionId}:${target.index}`,
          session_id: target.sessionId,
          question_index: target.index,
          text: target.text,
          domain: target.config.domain,
          difficulty: target.config.difficulty,
          created_at: new Date().toISOString(),
        },
        ...saved,
      ];
  await mutate(KEYS.saved, next, false);
  try {
    const { error } = was
      ? await supabase
          .from("lms_saved_questions")
          .delete()
          .eq("session_id", target.sessionId)
          .eq("question_index", target.index)
      : await supabase.from("lms_saved_questions").upsert(
          {
            session_id: target.sessionId,
            question_index: target.index,
            text: target.text,
            domain: target.config.domain,
            difficulty: target.config.difficulty,
          },
          { onConflict: "user_id,session_id,question_index", ignoreDuplicates: true },
        );
    if (error) throw error;
  } catch (err) {
    await mutate(KEYS.saved, saved, false);
    throw err;
  }
  // Pick up the real row ids.
  await mutate(KEYS.saved);
}

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

// ---- profile photo ----
// Stored in the public "avatars" bucket at <user id>/<random>.webp
// (supabase/migrations/0009_avatars.sql); only the owner can write their folder.

const AVATAR_BUCKET = "avatars";

/** The storage path of one of our own avatar URLs, so the old file can be deleted. */
function avatarPath(url: string | null) {
  const marker = `/${AVATAR_BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null;
}

async function setAvatarUrl(profile: Profile, avatarUrl: string | null) {
  const { error } = await getSupabase().from("lms_profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
  if (error) throw error;
  await mutate(KEYS.profile, { ...profile, avatarUrl }, false);
  // Friends lists show your photo too.
  await mutate(KEYS.friends);
}

/** Resizes the photo, uploads it, points the profile at it and deletes the previous one. */
export async function uploadAvatar(profile: Profile, file: File) {
  const { resizeAvatar } = await import("@/lib/avatar");
  const blob = await resizeAvatar(file);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
  const storage = getSupabase().storage.from(AVATAR_BUCKET);

  const { error } = await storage.upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw error;
  const { data } = storage.getPublicUrl(path);

  const previous = avatarPath(profile.avatarUrl);
  await setAvatarUrl(profile, data.publicUrl);
  if (previous) await storage.remove([previous]).catch(() => {});
}

export async function removeAvatar(profile: Profile) {
  const previous = avatarPath(profile.avatarUrl);
  await setAvatarUrl(profile, null);
  if (previous) await getSupabase().storage.from(AVATAR_BUCKET).remove([previous]).catch(() => {});
}

// ---- friends ----
// Everything about other people goes through SQL functions that check the
// friendship and leave out answers (see supabase/migrations/0003_friends.sql).

interface FriendProfile {
  name: string;
  avatar_url: string | null;
  /** Questions solved per difficulty (migration 0011); absent before it's run. */
  solved?: ByDifficulty;
  sessions: CompletedSession[];
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const useFriendsOverview = () =>
  useSWR(KEYS.friends, () => rpc<FriendOverview[]>("lms_friends_overview"), swrOptions);
export const useFriendRequests = () =>
  useSWR(KEYS.friendRequests, () => rpc<FriendRequest[]>("lms_friend_requests"), swrOptions);
export const useFriendProfile = (id: string) =>
  useSWR(KEYS.friend(id), () => rpc<FriendProfile>("lms_friend_profile", { friend: id }), {
    ...swrOptions,
    shouldRetryOnError: false,
  });

export const searchUsers = (q: string) => rpc<UserSearchResult[]>("lms_search_users", { q });

const refreshFriends = () => Promise.all([mutate(KEYS.friends), mutate(KEYS.friendRequests)]);

export async function sendFriendRequest(id: string) {
  const relation = await rpc<FriendRelation>("lms_send_friend_request", { target: id });
  await refreshFriends();
  return relation;
}

export async function respondFriendRequest(id: string, accept: boolean) {
  await rpc("lms_respond_friend_request", { from_user: id, accept });
  await refreshFriends();
}

export async function removeFriend(id: string) {
  await rpc("lms_remove_friend", { other: id });
  await Promise.all([refreshFriends(), mutate(KEYS.friend(id), undefined, false)]);
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
  const { id, questions } = await api<{ id: string; questions: Question[] }>("/api/sessions", json(config));
  return seedSession(id, config, questions);
}

/** Creates a session with the same settings and questions as a finished one; returns its id. */
export async function retrySession(sessionId: string) {
  const { id, config, questions } = await api<{ id: string; config: SessionConfig; questions: Question[] }>(
    "/api/sessions",
    json({ retryOf: sessionId }),
  );
  return seedSession(id, config, questions);
}

/** Creates a session from the user's unsolved questions at this level; returns its id. */
export async function practiceSession(domain: Domain, difficulty: Difficulty, mode: AnswerMode) {
  const { id, config, questions } = await api<{ id: string; config: SessionConfig; questions: Question[] }>(
    "/api/sessions",
    json({ practice: { domain, difficulty }, mode }),
  );
  return seedSession(id, config, questions);
}

async function seedSession(id: string, config: SessionConfig, questions: Question[]) {
  // Hand the new row to the session screen so it can show the first question
  // without fetching it again. (The saved preferences catch up in the background.)
  const row: SessionRow = {
    id,
    config,
    questions,
    results: [],
    status: "in_progress",
    report: null,
    total: null,
    created_at: new Date().toISOString(),
    completed_at: null,
  };
  await mutate(KEYS.session(id), row, false);
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
  await Promise.all([mutate(KEYS.completed), mutate(KEYS.session(sessionId)), mutate(KEYS.attempts)]);
}

export async function abandonSession(sessionId: string) {
  await api(`/api/sessions/${sessionId}/abandon`, { method: "POST" });
}
