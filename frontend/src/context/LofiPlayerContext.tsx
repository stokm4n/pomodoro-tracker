import {
  createContext,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface SoundCloudWidget {
  bind: (eventName: string, listener: (data?: SoundCloudPlayProgress) => void) => void;
  getCurrentSound: (callback: (sound: SoundCloudSound) => void) => void;
  getCurrentSoundIndex: (callback: (trackIndex: number) => void) => void;
  getPosition: (callback: (position: number) => void) => void;
  getSounds: (callback: (sounds: SoundCloudSound[]) => void) => void;
  next: () => void;
  pause: () => void;
  play: () => void;
  prev: () => void;
  seekTo: (milliseconds: number) => void;
  setVolume: (volume: number) => void;
  skip: (trackIndex: number) => void;
}

interface SoundCloudWidgetFactory {
  (iframe: HTMLIFrameElement): SoundCloudWidget;
  Events: {
    FINISH: string;
    PAUSE: string;
    PLAY: string;
    PLAY_PROGRESS: string;
    READY: string;
  };
}

interface SoundCloudSound {
  id?: number | string;
  permalink_url?: string;
}

interface SoundCloudPlayProgress {
  currentPosition?: number;
}

declare global {
  interface Window {
    SC?: { Widget: SoundCloudWidgetFactory };
  }
}

interface LofiPlayerContextValue {
  isOpen: boolean;
  toggle: () => void;
}

interface PlayerPosition {
  x: number;
  y: number;
}

const soundCloudPlaylistUrl = "https://soundcloud.com/sc-playlists/sets/lo-fi-chill-beats";
const soundCloudWidgetScript = "https://w.soundcloud.com/player/api.js";
const lofiVolumeStorageKey = "pomodoro-lofi-volume";
const lofiPlaybackStorageKey = "pomodoro-lofi-playback";

interface PersistedPlayback {
  isOpen: boolean;
  positionMs: number;
  trackId: string | null;
  trackIndex: number;
  wasPlaying: boolean;
}

const LofiPlayerContext = createContext<LofiPlayerContextValue | null>(null);

export function LofiPlayerProvider({ children }: { children: ReactNode }) {
  const initialPlayback = useRef(readPlayback()).current;
  const [isOpen, setIsOpen] = useState(initialPlayback.isOpen);
  const [embedUrl, setEmbedUrl] = useState(() => buildEmbedUrl(initialPlayback));
  const [volume, setVolume] = useState(() => {
    const savedVolume = Number(window.localStorage.getItem(lofiVolumeStorageKey));
    return Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100
      ? savedVolume
      : 40;
  });
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const player = useRef<HTMLElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const widget = useRef<SoundCloudWidget | null>(null);
  const volumeRef = useRef(volume);
  const dragOffset = useRef<PlayerPosition | null>(null);
  const lastPositionSave = useRef(0);

  useEffect(() => {
    const keepPlayerOnScreen = () => {
      setPosition((currentPosition) => {
        if (!currentPosition || !player.current) return currentPosition;
        return clampPosition(currentPosition.x, currentPosition.y, player.current);
      });
    };

    window.addEventListener("resize", keepPlayerOnScreen);
    return () => window.removeEventListener("resize", keepPlayerOnScreen);
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    window.localStorage.setItem(lofiVolumeStorageKey, String(volume));
    widget.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!isOpen) {
      widget.current = null;
      setIsPlayerReady(false);
      return;
    }

    let cancelled = false;
    let script = document.querySelector<HTMLScriptElement>(`script[src="${soundCloudWidgetScript}"]`);

    const connectWidget = () => {
      if (cancelled || !window.SC || !frame.current) return;
      const connectedWidget = window.SC.Widget(frame.current);
      let pendingRestore: PersistedPlayback | null = null;
      widget.current = connectedWidget;
      connectedWidget.bind(window.SC.Widget.Events.READY, () => {
        if (cancelled) return;

        const playback = readPlayback();
        connectedWidget.setVolume(volumeRef.current);
        setIsPlayerReady(true);
        connectedWidget.getSounds((sounds) => {
          if (cancelled) return;

          const savedTrackIndex = findSavedTrackIndex(sounds, playback);
          if (savedTrackIndex > 0) {
            pendingRestore = { ...playback, trackIndex: savedTrackIndex };
            connectedWidget.skip(savedTrackIndex);
            return;
          }

          if (playback.positionMs > 0) connectedWidget.seekTo(playback.positionMs);
          if (playback.wasPlaying) connectedWidget.play();
        });
      });
      connectedWidget.bind(window.SC.Widget.Events.PLAY, () => {
        if (cancelled) return;

        if (pendingRestore) {
          const playback = pendingRestore;
          pendingRestore = null;
          if (playback.positionMs > 0) connectedWidget.seekTo(playback.positionMs);
          if (!playback.wasPlaying) connectedWidget.pause();
          persistPlayback({
            isOpen: true,
            trackIndex: playback.trackIndex,
            wasPlaying: playback.wasPlaying,
          });
          saveCurrentTrack(connectedWidget);
          return;
        }

        persistPlayback({ isOpen: true, wasPlaying: true });
        saveCurrentTrack(connectedWidget);
      });
      connectedWidget.bind(window.SC.Widget.Events.PAUSE, () => {
        if (cancelled) return;
        connectedWidget.getPosition((positionMs) => {
          persistPlayback({ positionMs, wasPlaying: false });
        });
      });
      connectedWidget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (progress) => {
        if (cancelled || typeof progress?.currentPosition !== "number") return;
        const now = Date.now();
        if (now - lastPositionSave.current < 1500) return;
        lastPositionSave.current = now;
        persistPlayback({
          isOpen: true,
          positionMs: progress.currentPosition,
          wasPlaying: true,
        });
        saveCurrentTrack(connectedWidget);
      });
      connectedWidget.bind(window.SC.Widget.Events.FINISH, () => {
        if (!cancelled) persistPlayback({ positionMs: 0 });
      });
    };

    if (window.SC) {
      connectWidget();
    } else if (script) {
      script.addEventListener("load", connectWidget);
    } else {
      script = document.createElement("script");
      script.src = soundCloudWidgetScript;
      script.async = true;
      script.addEventListener("load", connectWidget);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", connectWidget);
      widget.current = null;
      setIsPlayerReady(false);
    };
  }, [isOpen]);

  function changeTrack(direction: "previous" | "next") {
    const connectedWidget = widget.current;
    if (!connectedWidget || !isPlayerReady) return;

    persistPlayback({ positionMs: 0, wasPlaying: true });
    if (direction === "previous") connectedWidget.prev();
    else connectedWidget.next();
  }

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button") || !player.current) return;
    const bounds = player.current.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    setPosition({ x: bounds.left, y: bounds.top });
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePlayer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOffset.current || !player.current) return;
    setPosition(clampPosition(
      event.clientX - dragOffset.current.x,
      event.clientY - dragOffset.current.y,
      player.current,
    ));
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragOffset.current) return;
    dragOffset.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const playerStyle: CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined;

  function togglePlayer() {
    if (isOpen) {
      widget.current?.getPosition((positionMs) => persistPlayback({ positionMs }));
      persistPlayback({ isOpen: false, wasPlaying: false });
      setIsOpen(false);
      return;
    }

    const playback = { ...readPlayback(), isOpen: true };
    persistPlayback(playback);
    setEmbedUrl(buildEmbedUrl(playback));
    setIsOpen(true);
  }

  return (
    <LofiPlayerContext.Provider value={{ isOpen, toggle: togglePlayer }}>
      {children}
      {isOpen && (
        <aside
          ref={player}
          className={`lofi-player ${isDragging ? "is-dragging" : ""}`}
          style={playerStyle}
          aria-label="Lo-fi плеер"
        >
          <div
            className="lofi-player-heading"
            title="Перетащите плеер"
            onPointerDown={startDragging}
            onPointerMove={movePlayer}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <div className="lofi-player-title">
              <span className="lofi-drag-grip" aria-hidden="true">⠿</span>
              <div className="lofi-player-copy">
                <strong>Lo-fi для концентрации</strong>
                <span>Разные треки из плейлиста SoundCloud</span>
              </div>
            </div>
            <button className="text-button" type="button" onClick={togglePlayer}>
              Закрыть
            </button>
          </div>
          <iframe
            ref={frame}
            title="Lo-fi плейлист SoundCloud"
            src={embedUrl}
            allow="autoplay"
            loading="lazy"
          />
          <div className="lofi-track-controls" aria-label="Переключение треков">
            <button
              type="button"
              onClick={() => changeTrack("previous")}
              disabled={!isPlayerReady}
            >
              ← Предыдущий
            </button>
            <button
              type="button"
              onClick={() => changeTrack("next")}
              disabled={!isPlayerReady}
            >
              Следующий →
            </button>
          </div>
          <label className="lofi-volume">
            <span>Громкость</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
            <output>{volume}%</output>
          </label>
        </aside>
      )}
    </LofiPlayerContext.Provider>
  );
}

export function useLofiPlayer() {
  const context = useContext(LofiPlayerContext);
  if (!context) throw new Error("useLofiPlayer must be used inside LofiPlayerProvider");
  return context;
}

function clampPosition(x: number, y: number, player: HTMLElement): PlayerPosition {
  const bounds = player.getBoundingClientRect();
  const edge = 8;
  const maxX = Math.max(edge, window.innerWidth - bounds.width - edge);
  const maxY = Math.max(edge, window.innerHeight - bounds.height - edge);
  return {
    x: Math.min(Math.max(edge, x), maxX),
    y: Math.min(Math.max(edge, y), maxY),
  };
}

function buildEmbedUrl(playback: PersistedPlayback) {
  const params = new URLSearchParams({
    url: soundCloudPlaylistUrl,
    color: "#d94f3d",
    // Восстанавливаем воспроизведение через Widget API после выбора сохранённого трека.
    // Иначе SoundCloud успевает запустить первый трек плейлиста.
    auto_play: "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "true",
    show_reposts: "false",
    show_teaser: "false",
    start_track: String(playback.trackIndex),
    visual: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

function readPlayback(): PersistedPlayback {
  const fallback: PersistedPlayback = {
    isOpen: false,
    positionMs: 0,
    trackId: null,
    trackIndex: 0,
    wasPlaying: false,
  };

  try {
    const saved = JSON.parse(window.localStorage.getItem(lofiPlaybackStorageKey) ?? "null");
    if (!saved || typeof saved !== "object") return fallback;
    return {
      isOpen: saved.isOpen === true,
      positionMs: Number.isFinite(saved.positionMs) && saved.positionMs >= 0
        ? saved.positionMs
        : 0,
      trackId: typeof saved.trackId === "string" ? saved.trackId : null,
      trackIndex: Number.isInteger(saved.trackIndex) && saved.trackIndex >= 0
        ? saved.trackIndex
        : 0,
      wasPlaying: saved.wasPlaying === true,
    };
  } catch {
    return fallback;
  }
}

function persistPlayback(changes: Partial<PersistedPlayback>) {
  window.localStorage.setItem(
    lofiPlaybackStorageKey,
    JSON.stringify({ ...readPlayback(), ...changes }),
  );
}

function saveCurrentTrack(widget: SoundCloudWidget) {
  widget.getCurrentSoundIndex((trackIndex) => {
    if (Number.isInteger(trackIndex) && trackIndex >= 0) {
      persistPlayback({ trackIndex });
    }
  });

  widget.getCurrentSound((currentSound) => {
    persistPlayback({ trackId: soundIdentifier(currentSound) });
  });
}

function soundIdentifier(sound: SoundCloudSound) {
  if (sound.id !== undefined) return String(sound.id);
  return sound.permalink_url ?? "";
}

function findSavedTrackIndex(sounds: SoundCloudSound[], playback: PersistedPlayback) {
  if (playback.trackId) {
    const matchedIndex = sounds.findIndex(
      (sound) => soundIdentifier(sound) === playback.trackId,
    );
    if (matchedIndex >= 0) return matchedIndex;
  }

  return playback.trackIndex < sounds.length ? playback.trackIndex : 0;
}
