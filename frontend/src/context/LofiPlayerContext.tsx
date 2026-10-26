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
  bind: (eventName: string, listener: () => void) => void;
  setVolume: (volume: number) => void;
}

interface SoundCloudWidgetFactory {
  (iframe: HTMLIFrameElement): SoundCloudWidget;
  Events: { READY: string };
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
const soundCloudEmbedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundCloudPlaylistUrl)}&color=%23d94f3d&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`;
const soundCloudWidgetScript = "https://w.soundcloud.com/player/api.js";
const lofiVolumeStorageKey = "pomodoro-lofi-volume";

const LofiPlayerContext = createContext<LofiPlayerContextValue | null>(null);

export function LofiPlayerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [volume, setVolume] = useState(() => {
    const savedVolume = Number(window.localStorage.getItem(lofiVolumeStorageKey));
    return Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100
      ? savedVolume
      : 40;
  });
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const player = useRef<HTMLElement | null>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const widget = useRef<SoundCloudWidget | null>(null);
  const volumeRef = useRef(volume);
  const dragOffset = useRef<PlayerPosition | null>(null);

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
      return;
    }

    let cancelled = false;
    let script = document.querySelector<HTMLScriptElement>(`script[src="${soundCloudWidgetScript}"]`);

    const connectWidget = () => {
      if (cancelled || !window.SC || !frame.current) return;
      const connectedWidget = window.SC.Widget(frame.current);
      widget.current = connectedWidget;
      connectedWidget.bind(window.SC.Widget.Events.READY, () => {
        if (!cancelled) connectedWidget.setVolume(volumeRef.current);
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
    };
  }, [isOpen]);

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

  return (
    <LofiPlayerContext.Provider value={{ isOpen, toggle: () => setIsOpen((open) => !open) }}>
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
            <button className="text-button" type="button" onClick={() => setIsOpen(false)}>
              Закрыть
            </button>
          </div>
          <iframe
            ref={frame}
            title="Lo-fi плейлист SoundCloud"
            src={soundCloudEmbedUrl}
            allow="autoplay"
            loading="lazy"
          />
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
