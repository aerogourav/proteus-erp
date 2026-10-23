"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CommunityCategory = "Company news" | "Events" | "Team updates";
export type CommunityPost = {
  id: string;
  category: CommunityCategory;
  title: string;
  body: string;
  author: string;
  role: string;
  publishedAt: string;
  eventDate?: string;
  location?: string;
};

const STORAGE_KEY = "proteus-demo-community-v1";
const seedPosts: CommunityPost[] = [
  { id: "post-sample-news", category: "Company news", title: "A small improvement to our handoff notes", body: "We are trying a clearer summary at the top of each sample order: what changed, which record is linked, and who should review it next. Add a note if this format would help your team.", author: "M. Keller", role: "Engineering", publishedAt: "2026-10-23T08:10:00+02:00" },
  { id: "post-sample-event", category: "Events", title: "Sample team workshop: smoother shop-floor handoffs", body: "A fictional event example for the community feed. Bring one everyday handoff that could be easier to follow.", author: "J. Novak", role: "Operations", publishedAt: "2026-10-22T15:25:00+02:00", eventDate: "2026-10-29", location: "Apex demo workshop" },
  { id: "post-sample-update", category: "Team updates", title: "What is one useful thing you learned this week?", body: "Share a practical tip, a process question, or a small team win. This sample post demonstrates the kind of update employees could share.", author: "T. Hahn", role: "Quality", publishedAt: "2026-10-20T11:40:00+02:00" },
];

type NewPost = Omit<CommunityPost, "id" | "publishedAt">;
type CommunityContextValue = { posts: CommunityPost[]; ready: boolean; addPost: (post: NewPost) => void };
const CommunityContext = createContext<CommunityContextValue | null>(null);

function isPost(value: unknown): value is CommunityPost {
  if (typeof value !== "object" || value === null) return false;
  const post = value as Record<string, unknown>;
  return typeof post.id === "string" && ["Company news", "Events", "Team updates"].includes(String(post.category)) && typeof post.title === "string" && typeof post.body === "string" && typeof post.author === "string" && typeof post.role === "string" && typeof post.publishedAt === "string" && (post.eventDate === undefined || typeof post.eventDate === "string") && (post.location === undefined || typeof post.location === "string");
}

function isPostList(value: unknown): value is CommunityPost[] {
  return Array.isArray(value) && value.every(isPost);
}

export function DemoCommunityProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<CommunityPost[]>(seedPosts);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isPostList(parsed)) setPosts(parsed);
      }
    } catch {
      console.warn("PROTEUS community posts could not be read from this browser.");
    } finally {
      setReady(true);
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        if (!event.newValue) setPosts(seedPosts);
        else {
          const parsed: unknown = JSON.parse(event.newValue);
          if (isPostList(parsed)) setPosts(parsed);
        }
      } catch { /* Keep the last valid browser-local posts. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }
    catch { console.warn("PROTEUS community posts could not be saved to this browser."); }
  }, [posts, ready]);

  const addPost = useCallback((post: NewPost) => {
    setPosts((current) => [{ ...post, id: `post-${crypto.randomUUID()}`, publishedAt: new Date().toISOString() }, ...current]);
  }, []);
  const value = useMemo(() => ({ posts, ready, addPost }), [posts, ready, addPost]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useDemoCommunity() {
  const context = useContext(CommunityContext);
  if (!context) throw new Error("useDemoCommunity must be used inside DemoCommunityProvider");
  return context;
}
