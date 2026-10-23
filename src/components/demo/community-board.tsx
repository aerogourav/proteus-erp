"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, MapPin, MessageSquareText, Newspaper, Plus, Send, Users, X } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useDemoCommunity, type CommunityCategory } from "@/components/demo/community-context";
import { PageHeader } from "@/components/demo/demo-ui";
import styles from "@/components/demo/demo.module.css";

const filters = ["All posts", "Company news", "Events", "Team updates"] as const;
const authors = [
  { name: "Demo employee", role: "Team member" },
  { name: "M. Keller", role: "Engineering" },
  { name: "J. Novak", role: "Operations" },
  { name: "T. Hahn", role: "Quality" },
  { name: "L. Weber", role: "Production planning" },
];

export function CommunityBoard() {
  const { posts, ready, addPost } = useDemoCommunity();
  const { locale } = useLanguage();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All posts");
  const [composerOpen, setComposerOpen] = useState(false);
  const [category, setCategory] = useState<CommunityCategory>("Company news");
  const [author, setAuthor] = useState(authors[0].name);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [notice, setNotice] = useState("");

  const visiblePosts = useMemo(() => [...posts]
    .filter((post) => filter === "All posts" || post.category === filter)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)), [filter, posts]);
  const upcomingEvents = useMemo(() => posts.filter((post) => post.category === "Events" && post.eventDate)
    .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? "")).slice(0, 3), [posts]);
  const dateLabel = (value: string) => new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
  const closeComposer = () => {
    setComposerOpen(false);
    setTitle(""); setBody(""); setEventDate(""); setLocation(""); setNotice("");
  };
  const openComposer = (nextCategory?: CommunityCategory) => {
    if (!ready) { setNotice("The community board is still loading. Try again in a moment."); return; }
    setNotice("");
    if (nextCategory) setCategory(nextCategory);
    setComposerOpen(true);
  };

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedAuthor = authors.find((item) => item.name === author) ?? authors[0];
    addPost({ category, title: title.trim(), body: body.trim(), author: selectedAuthor.name, role: selectedAuthor.role, ...(category === "Events" ? { eventDate, location: location.trim() } : {}) });
    setFilter(category);
    setNotice("Your post was saved in this browser.");
    setComposerOpen(false);
    setTitle(""); setBody(""); setEventDate(""); setLocation("");
  }

  return <>
    <PageHeader eyebrow="TEAM SPACE · SYNTHETIC POSTS" title="Community" description="A place for company news, upcoming events, useful ideas, and team updates." meta={<button type="button" className={styles.primaryButton} onClick={() => openComposer()}><Plus size={14} /> Create post</button>} />
    <section className={styles.communityBanner}>
      <span className={styles.communityBannerIcon}><MessageSquareText size={20} /></span>
      <div className={styles.communityBannerCopy}><span className={styles.visualEyebrow}>COMPANY COMMUNITY</span><h2>Keep the team in the loop.</h2><p>Share an interesting update, celebrate a small win, or let colleagues know about an upcoming event.</p></div>
      <div className={styles.communityLocalNote}><Users size={15} /><span>Demo board only. Posts stay in this browser and are not shared with other users.</span></div>
    </section>

    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.communityLayout}>
      <section className={styles.communityFeed} aria-label="Community posts">
        <div className={styles.communityFilterBar} role="tablist" aria-label="Filter community posts">
          {filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? styles.communityFilterActive : ""} onClick={() => setFilter(item)}>{item}<span>{item === "All posts" ? posts.length : posts.filter((post) => post.category === item).length}</span></button>)}
        </div>
        <div className={styles.communityPosts}>
          {visiblePosts.map((post) => <article className={styles.communityPost} key={post.id}>
            <header className={styles.communityPostHeader}>
              <span className={styles.communityAvatar} aria-hidden="true">{post.author.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <span className={styles.communityAuthor}><strong>{post.author}</strong><small>{post.role} · {dateLabel(post.publishedAt)}</small></span>
              <span className={`${styles.communityCategory} ${post.category === "Events" ? styles.communityCategoryEvent : post.category === "Company news" ? styles.communityCategoryNews : styles.communityCategoryUpdate}`}>{post.category === "Events" ? <CalendarDays size={12} /> : post.category === "Company news" ? <Newspaper size={12} /> : <MessageSquareText size={12} />}{post.category}</span>
            </header>
            <div className={styles.communityPostBody}><h2>{post.title}</h2><p>{post.body}</p></div>
            {post.category === "Events" && post.eventDate && <div className={styles.communityEventDetails}><span><CalendarDays size={13} />{dateLabel(post.eventDate)}</span>{post.location && <span><MapPin size={13} />{post.location}</span>}</div>}
            <footer className={styles.communityPostFooter}><span>Fictional demonstration post</span><span>PROTEUS team space</span></footer>
          </article>)}
          {visiblePosts.length === 0 && <div className={styles.communityEmpty}><MessageSquareText size={20} /><strong>No posts in this view yet</strong><span>Start the conversation with a synthetic demo update.</span><button type="button" className={styles.secondaryButton} onClick={() => openComposer()}><Plus size={13} /> Create post</button></div>}
        </div>
      </section>

      <aside className={styles.communityAside}>
        <section className={styles.communityAsideCard}><div className={styles.communityAsideHead}><CalendarDays size={15} /><h2>Upcoming events</h2></div>{upcomingEvents.length ? upcomingEvents.map((event) => <article className={styles.communityUpcoming} key={event.id}><time>{dateLabel(event.eventDate ?? "")}</time><strong>{event.title}</strong><span>{event.location || "Location to be confirmed"}</span></article>) : <p className={styles.communityAsideEmpty}>No upcoming events have been posted.</p>}</section>
        <section className={styles.communityAsideCard}><div className={styles.communityAsideHead}><MessageSquareText size={15} /><h2>Share with context</h2></div><p>Post useful team news, event details, or a practical idea colleagues can discuss.</p><div className={styles.communityGuidance}>Use fictional names and information in this demo. Posts are not emailed, published, or shared with other employees.</div><button type="button" className={styles.secondaryButton} onClick={() => openComposer("Team updates")}><Plus size={13} /> Share an update</button></section>
      </aside>
    </div>

    {composerOpen && <div className={styles.dialogOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="community-compose-title">
      <div className={styles.dialogHead}><div><span className={styles.eyebrow}>Synthetic community post</span><h2 id="community-compose-title">Create a post</h2><p>Write a short update for the fictional demo team.</p></div><button type="button" className={styles.dialogClose} onClick={closeComposer} aria-label="Close"><X size={16} /></button></div>
      <form className={styles.dialogForm} onSubmit={publish}>
        <div className={styles.formGrid}>
          <div className={styles.formField}><label htmlFor="community-category">Post category</label><select id="community-category" className={styles.formControl} value={category} onChange={(event) => setCategory(event.target.value as CommunityCategory)}><option>Company news</option><option>Events</option><option>Team updates</option></select></div>
          <div className={styles.formField}><label htmlFor="community-author">Post as</label><select id="community-author" className={styles.formControl} value={author} onChange={(event) => setAuthor(event.target.value)}>{authors.map((item) => <option value={item.name} key={item.name}>{item.name} · {item.role}</option>)}</select></div>
        </div>
        <div className={styles.formField}><label htmlFor="community-title">Title</label><input id="community-title" className={styles.formControl} value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="What would you like the team to know?" required /></div>
        <div className={styles.formField}><label htmlFor="community-body">Message</label><textarea id="community-body" className={styles.formControl} value={body} maxLength={1200} onChange={(event) => setBody(event.target.value)} placeholder="Share a useful update or idea…" rows={5} required /><small>{body.length}/1200 characters</small></div>
        {category === "Events" && <div className={styles.formGrid}><div className={styles.formField}><label htmlFor="community-event-date">Event date</label><input id="community-event-date" className={styles.formControl} type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required /></div><div className={styles.formField}><label htmlFor="community-location">Location</label><input id="community-location" className={styles.formControl} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Demo meeting room" /></div></div>}
        <p className={styles.noticeBar}>Synthetic content only. This post is saved in this browser and is not sent to a server, newsletter, or other employees.</p>
        <div className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={closeComposer}>Cancel</button><button type="submit" className={styles.primaryButton}><Send size={13} /> Publish to demo board</button></div>
      </form>
    </section></div>}
  </>;
}
