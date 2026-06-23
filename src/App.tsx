import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  Search,
  Music2,
  ArrowUpRight,
  X,
  Headphones,
  Disc3,
  Mic2,
  Play,
  Pause,
  Heart,
  Github,
  Youtube,
  ExternalLink,
} from "lucide-react";
import { suggestSongs, fetchLyrics, type Suggestion } from "@/lib/lyrics-api";
import { searchYouTube } from "@/lib/youtube-api";
import { VinylLoader } from "@/components/VinylLoader";
import { Equalizer } from "@/components/Equalizer";

const TRENDING = [
  "Bohemian Rhapsody",
  "Blinding Lights",
  "Hotel California",
  "Espresso Sabrina Carpenter",
  "Imagine John Lennon",
  "Vampire Olivia Rodrigo",
  "As It Was Harry Styles",
  "Wonderwall",
];

const MOODS = [
  { label: "Late night", q: "lofi chill", from: "300", to: "260" },
  { label: "Heartbreak", q: "Adele", from: "20", to: "350" },
  { label: "Hype", q: "Kanye West", from: "55", to: "20" },
  { label: "Sunrise", q: "Coldplay", from: "65", to: "300" },
];

const COPYRIGHT_YEAR = 2026;

export default function App() {
  useEffect(() => {
    document.title = "Lyrical.ly | Find lyrics, feel the song";

    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]') ??
      document.head.appendChild(document.createElement("meta"));

    description.name = "description";
    description.content =
      "Search lyrics for any song in seconds. A beautiful, fluid lyrics finder with a musical vibe.";
  }, []);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Suggestion[]>([]);
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio() : null));
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [showFullSong, setShowFullSong] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const discRot = useTransform(scrollYProgress, [0, 1], [0, 360]);

  // Load favorites
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lyrical.ly:favs");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      // Ignore unavailable or invalid localStorage data.
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("lyrical.ly:favs", JSON.stringify(favorites));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [favorites]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await suggestSongs(query, ctrl.signal);
        setSuggestions(res.slice(0, 8));
        if (res.length === 0) {
          setSearchError("No matching tracks found. Try adding the artist name.");
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([]);
          setSearchError("Search is having trouble. Try again in a moment.");
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedQuery = query.trim();

    if (!cleanedQuery) return;

    if (suggestions[0]) {
      openTrack(suggestions[0]);
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const res = await suggestSongs(cleanedQuery);
      const nextSuggestions = res.slice(0, 8);
      setSuggestions(nextSuggestions);

      if (nextSuggestions[0]) {
        openTrack(nextSuggestions[0]);
      } else {
        setSearchError("No matching tracks found. Try adding the artist name.");
      }
    } catch {
      setSearchError("Search is having trouble. Try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  async function openTrack(s: Suggestion) {
    setSelected(s);
    setLyrics(null);
    setError(null);
    setLoadingLyrics(true);
    setYtVideoId(null);
    setShowFullSong(false);
    setYtLoading(true);
    setTimeout(
      () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
    // Lyrics + YouTube in parallel
    searchYouTube(`${s.artist.name} ${s.title}`)
      .then((r) => setYtVideoId(r.videoId))
      .catch(() => setYtVideoId(null))
      .finally(() => setYtLoading(false));
    try {
      const text = await fetchLyrics(s.artist.name, s.title);
      setLyrics(text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingLyrics(false);
    }
  }

  function togglePlay(s: Suggestion) {
    if (!audio || !s.preview) return;
    if (playingId === s.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      audio.src = s.preview;
      audio.play().catch(() => {});
      setPlayingId(s.id);
      audio.onended = () => setPlayingId(null);
    }
  }

  function toggleFav(s: Suggestion) {
    setFavorites((f) =>
      f.find((x) => x.id === s.id) ? f.filter((x) => x.id !== s.id) : [s, ...f].slice(0, 20),
    );
  }

  const isFav = (id: number) => favorites.some((f) => f.id === id);

  const marqueeWords = useMemo(
    () => [
      "lyrics",
      "melody",
      "verse",
      "chorus",
      "bridge",
      "hook",
      "beat",
      "soul",
      "rhythm",
      "anthem",
    ],
    [],
  );

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="mx-auto mt-3 sm:mt-5 max-w-6xl px-3 sm:px-6">
          <nav className="glass rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-soft">
            <a href="#top" className="flex items-center gap-2 group">
              <span className="relative grid place-items-center h-8 w-8 rounded-full bg-gradient-primary shadow-glow">
                <Disc3 className="h-4 w-4 text-primary-foreground animate-spin-slow" />
              </span>
              <span className="font-display text-xl tracking-tight">
                Lyrical<span className="text-gradient">.ly</span>
              </span>
            </a>
            <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
              <a
                href="#search"
                className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
              >
                Search
              </a>
              <a
                href="#moods"
                className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
              >
                Moods
              </a>
              <a
                href="#favorites"
                className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
              >
                Favorites
              </a>
              <a
                href="#about"
                className="px-3 py-1.5 rounded-full hover:text-foreground hover:bg-white/5 transition"
              >
                About
              </a>
            </div>
            <a
              href="#search"
              className="rounded-full bg-gradient-primary px-4 py-1.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.04] transition"
            >
              Find lyrics
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section id="top" ref={heroRef} className="relative pt-32 sm:pt-26 pb-20 sm:pb-32 noise">
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto max-w-6xl px-4 sm:px-6"
        >
          <div className="mt-6 grid md:grid-cols-[1.4fr_1fr] gap-8 items-end">
            <h1 className="font-display text-[clamp(3rem,11vw,8.5rem)] leading-[0.92] tracking-tight">
              <motion.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="block"
              >
                Find the
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="block italic text-gradient"
              >
                lyrics
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="block"
              >
                that move you.
              </motion.span>
            </h1>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <motion.div
                style={{ rotate: discRot }}
                className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64"
              >
                <div className="absolute inset-0 rounded-full bg-gradient-primary blur-3xl opacity-40" />
                <div className="relative h-full w-full rounded-full bg-[radial-gradient(circle_at_50%_50%,oklch(0.22_0.04_295)_0%,oklch(0.08_0.02_295)_50%,oklch(0.04_0.02_295)_100%)] shadow-glow">
                  {[0.88, 0.75, 0.62, 0.5, 0.38].map((s, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full border border-white/5"
                      style={{ inset: `${(1 - s) * 50}%` }}
                    />
                  ))}
                  <div className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-gradient-primary grid place-items-center">
                    <span className="font-display italic text-2xl text-primary-foreground">L.</span>
                  </div>
                  <div className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-background" />
                </div>
              </motion.div>
              <div className="absolute -top-3 -right-3 glass rounded-2xl px-3 py-2 text-xs flex items-center gap-2 animate-float">
                <Equalizer bars={4} />
                <span className="text-muted-foreground">now playing your search</span>
              </div>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="mt-8 max-w-xl text-base sm:text-lg text-muted-foreground"
          >
            Type a song, an artist, or a half-remembered lyric. Lyrical.ly pulls the words straight
            from the studio floor so you can sing along, study, or just feel.
          </motion.p>
        </motion.div>

        {/* Marquee */}
        <div className="mt-16 sm:mt-24 overflow-hidden border-y border-white/5 py-5 bg-white/[0.015]">
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {[...marqueeWords, ...marqueeWords, ...marqueeWords].map((w, i) => (
              <span
                key={i}
                className="font-display italic text-3xl sm:text-5xl text-muted-foreground/40"
              >
                {w} <span className="text-amber-glow">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <section id="search" className="relative mx-auto max-w-5xl px-4 sm:px-6 -mt-8 sm:-mt-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass shadow-glow rounded-3xl p-3 sm:p-4 relative"
        >
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 sm:gap-3">
            <div className="grid place-items-center h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-gradient-primary shrink-0">
              <Search className="h-5 w-5 text-primary-foreground" />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try “Blinding Lights” or “Adele Hello”..."
              className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-lg placeholder:text-muted-foreground/60 py-2"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                  setSearchError(null);
                }}
                className="shrink-0 grid place-items-center h-9 w-9 rounded-full hover:bg-white/5 text-muted-foreground"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {searching && <Equalizer className="mr-2" />}
          </form>

          {/* Suggestions */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                <ul className="divide-y divide-white/5">
                  {suggestions.map((s, i) => (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="group flex items-center gap-3 p-2 sm:p-3 rounded-2xl hover:bg-white/[0.03] cursor-pointer"
                      onClick={() => openTrack(s)}
                    >
                      <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                        {s.album?.cover_medium && (
                          <img
                            src={s.album.cover_medium}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
                        {s.preview && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlay(s);
                            }}
                            className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover:opacity-100 transition"
                            aria-label="Preview"
                          >
                            {playingId === s.id ? (
                              <Pause className="h-5 w-5 text-white" />
                            ) : (
                              <Play className="h-5 w-5 text-white" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.title}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {s.artist.name} · {s.album?.title}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(s);
                        }}
                        className={`shrink-0 grid place-items-center h-9 w-9 rounded-full hover:bg-white/5 ${isFav(s.id) ? "text-coral-glow" : "text-muted-foreground"}`}
                        aria-label="Favorite"
                      >
                        <Heart className={`h-4 w-4 ${isFav(s.id) ? "fill-current" : ""}`} />
                      </button>
                      <ArrowUpRight className="shrink-0 h-4 w-4 text-muted-foreground group-hover:text-foreground transition" />
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
          {searchError && query.trim() && !searching && suggestions.length === 0 && (
            <div className="mt-3 rounded-2xl bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
              {searchError}
            </div>
          )}
        </motion.div>

        {/* Trending chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground self-center mr-1">
            Trending
          </span>
          {TRENDING.map((t) => (
            <button
              key={t}
              onClick={() => setQuery(t)}
              className="rounded-full glass px-3 py-1.5 text-sm hover:bg-white/10 transition hover:scale-[1.03]"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* RESULTS */}
      <section ref={resultsRef} className="mx-auto max-w-6xl px-4 sm:px-6 mt-16 sm:mt-24">
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="grid lg:grid-cols-[1fr_1.4fr] gap-6"
            >
              {/* Track card */}
              <div className="glass rounded-3xl p-6 sm:p-8 shadow-soft relative overflow-hidden">
                <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
                <div className="relative">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-muted shadow-glow relative">
                    {selected.album?.cover_big || selected.album?.cover_medium ? (
                      <img
                        src={selected.album.cover_big ?? selected.album.cover_medium}
                        alt={selected.album?.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-primary" />
                    )}
                    {selected.preview && (
                      <button
                        onClick={() => togglePlay(selected)}
                        className="absolute bottom-4 right-4 grid place-items-center h-14 w-14 rounded-full bg-gradient-primary shadow-glow hover:scale-110 transition animate-pulse-glow"
                        aria-label="Preview"
                      >
                        {playingId === selected.id ? (
                          <Pause className="h-6 w-6 text-primary-foreground" />
                        ) : (
                          <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-3xl sm:text-4xl leading-tight truncate">
                        {selected.title}
                      </h2>
                      <p className="text-muted-foreground mt-1 truncate">
                        <Mic2 className="inline h-3.5 w-3.5 mr-1 -mt-1" />
                        {selected.artist.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {selected.album?.title}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleFav(selected)}
                      className={`shrink-0 grid place-items-center h-10 w-10 rounded-full glass ${isFav(selected.id) ? "text-coral-glow" : ""}`}
                      aria-label="Favorite"
                    >
                      <Heart className={`h-4 w-4 ${isFav(selected.id) ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  {/* Full song / deep links */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Youtube className="h-3.5 w-3.5" /> Full song
                      </div>
                      {ytLoading && <Equalizer bars={4} />}
                    </div>

                    {!ytLoading && ytVideoId && !showFullSong && (
                      <button
                        onClick={() => {
                          if (playingId) {
                            audio?.pause();
                            setPlayingId(null);
                          }
                          setShowFullSong(true);
                        }}
                        className="w-full group relative overflow-hidden rounded-2xl bg-gradient-primary p-[1px] shadow-glow hover:scale-[1.01] transition"
                      >
                        <div className="rounded-2xl bg-background/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-3 text-sm font-medium">
                            <span className="grid place-items-center h-9 w-9 rounded-full bg-gradient-primary">
                              <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
                            </span>
                            Play full track
                          </span>
                          <span className="text-xs text-muted-foreground">via YouTube</span>
                        </div>
                      </button>
                    )}

                    {showFullSong && ytVideoId && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="relative aspect-video rounded-2xl overflow-hidden shadow-glow ring-1 ring-white/10"
                      >
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&rel=0&modestbranding=1`}
                          title={`${selected.title} — ${selected.artist.name}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 h-full w-full"
                        />
                      </motion.div>
                    )}

                    {!ytLoading && !ytVideoId && (
                      <div className="rounded-2xl glass px-4 py-3 text-xs text-muted-foreground">
                        Couldn't auto-match a video. Try the deep links below.
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        {
                          label: "Spotify",
                          url: `https://open.spotify.com/search/${encodeURIComponent(`${selected.artist.name} ${selected.title}`)}`,
                        },
                        {
                          label: "Apple",
                          url: `https://music.apple.com/search?term=${encodeURIComponent(`${selected.artist.name} ${selected.title}`)}`,
                        },
                        {
                          label: "YouTube",
                          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${selected.artist.name} ${selected.title}`)}`,
                        },
                      ].map((d) => (
                        <a
                          key={d.label}
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="glass rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-1.5 hover:bg-white/10 transition"
                        >
                          {d.label} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lyrics */}
              <div className="glass rounded-3xl p-6 sm:p-10 shadow-soft min-h-[400px] relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <Headphones className="h-3.5 w-3.5" /> Lyrics
                  </div>
                  {loadingLyrics && <Equalizer bars={5} />}
                </div>
                {loadingLyrics && <VinylLoader />}
                {error && !loadingLyrics && (
                  <div className="py-16 text-center">
                    <div className="font-display text-3xl text-gradient italic">
                      No words tonight
                    </div>
                    <p className="text-muted-foreground mt-2">{error}</p>
                  </div>
                )}
                {lyrics && !loadingLyrics && (
                  <motion.pre
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.02 } } }}
                    className="font-sans whitespace-pre-wrap text-base sm:text-lg leading-relaxed text-foreground/90"
                  >
                    {lyrics.split("\n").map((line, i) => (
                      <motion.span
                        key={i}
                        variants={{
                          hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
                          show: { opacity: 1, y: 0, filter: "blur(0)" },
                        }}
                        className="block"
                      >
                        {line || "\u00A0"}
                      </motion.span>
                    ))}
                  </motion.pre>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* MOODS */}
      <section id="moods" className="mx-auto max-w-6xl px-4 sm:px-6 mt-28 sm:mt-40">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display text-5xl sm:text-7xl leading-none"
        >
          Pick a <span className="italic text-gradient">mood</span>,<br /> we'll cue the track.
        </motion.h2>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {MOODS.map((m, i) => (
            <motion.button
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              onClick={() => {
                setQuery(m.q);
                document.getElementById("search")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group relative aspect-[3/4] rounded-3xl overflow-hidden text-left p-5 glass noise"
              style={{
                background: `linear-gradient(160deg, oklch(0.35 0.18 ${m.from}), oklch(0.18 0.06 ${m.to}))`,
              }}
            >
              <Music2 className="h-6 w-6 opacity-80" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="font-display text-3xl sm:text-4xl leading-none">{m.label}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/60 mt-2 flex items-center gap-2">
                  Tap to tune <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-[radial-gradient(circle_at_50%_120%,white,transparent_60%)]" />
            </motion.button>
          ))}
        </div>
      </section>

      {/* FAVORITES */}
      <section id="favorites" className="mx-auto max-w-6xl px-4 sm:px-6 mt-28 sm:mt-40">
        <div className="flex items-end justify-between gap-4 mb-8">
          <h2 className="font-display text-5xl sm:text-7xl leading-none">
            Your <span className="italic text-gradient">rotation</span>.
          </h2>
          <span className="text-sm text-muted-foreground">{favorites.length} saved</span>
        </div>
        {favorites.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center">
            <Disc3 className="h-10 w-10 mx-auto text-muted-foreground animate-spin-slow" />
            <p className="mt-4 text-muted-foreground">
              Tap the heart on any song to start your collection.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map((f, i) => (
              <motion.button
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openTrack(f)}
                className="glass rounded-2xl p-3 flex items-center gap-3 text-left hover:bg-white/[0.06] transition"
              >
                <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                  {f.album?.cover_medium && (
                    <img src={f.album.cover_medium} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.title}</div>
                  <div className="truncate text-sm text-muted-foreground">{f.artist.name}</div>
                </div>
                <Heart className="h-4 w-4 text-coral-glow fill-current shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-6xl px-4 sm:px-6 mt-28 sm:mt-40">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: Search,
              title: "Instant search",
              body: "Live suggestions as you type. Pulls covers, artists, and 30-second previews.",
            },
            {
              icon: Headphones,
              title: "Read & vibe",
              body: "Lyrics fade in line by line so you can follow along like a karaoke screen.",
            },
            {
              icon: Heart,
              title: "Your rotation",
              body: "Save favorites locally. Your taste, your device, no account needed.",
            },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-3xl p-6"
            >
              <div className="grid place-items-center h-11 w-11 rounded-2xl bg-gradient-primary shadow-glow">
                <c.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-2xl mt-4">{c.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mx-auto max-w-6xl px-4 sm:px-6 mt-28 sm:mt-40 pb-10">
        <div className="glass rounded-3xl p-8 sm:p-12 relative overflow-hidden noise">
          <div className="absolute -top-32 -left-20 h-80 w-80 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
          <div className="relative grid md:grid-cols-2 gap-8 items-end">
            <div>
              <div className="font-display text-5xl sm:text-7xl leading-[0.95]">
                Built for <span className="italic text-gradient">listeners.</span>
              </div>
              <p className="mt-4 text-muted-foreground max-w-md">
                Lyrical.ly is an open lyrics finder powered by the lyrics.ovh community API. Install
                it on your phone or desktop for one-tap access.
              </p>
            </div>
            <div className="flex md:justify-end items-center gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="glass rounded-full px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition"
              >
                <Github className="h-4 w-4" /> Open source spirit
              </a>
              <a
                href="#search"
                className="rounded-full bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:scale-[1.04] transition"
              >
                Find a song
              </a>
            </div>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Disc3 className="h-4 w-4 animate-spin-slow" />
              <span>© {COPYRIGHT_YEAR} Lyrical.ly - every word, every verse.</span>
            </div>
            <div>
              Made by{" "}
              <a
                href="https://github.com/kxngzero329"
                className="text-foreground hover:text-primary transition"
              >
                Zuhayr Smith
              </a>
              . All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
