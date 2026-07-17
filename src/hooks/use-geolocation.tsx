import { useEffect, useState } from "react";

const STORAGE_KEY = "dm:geo";

export type GeoPosition = { lat: number; lng: number; ts: number };

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GeoPosition;
        // cache 1h
        if (Date.now() - parsed.ts < 60 * 60 * 1000) {
          setPosition(parsed);
        }
      }
    } catch {
      /* noop */
    }
  }, []);

  const request = () => {
    if (!("geolocation" in navigator)) {
      setError("Seu navegador não suporta geolocalização.");
      return;
    }
    setRequesting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: GeoPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
        setPosition(p);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {
          /* noop */
        }
        setRequesting(false);
      },
      (err) => {
        setError(err.message || "Não consegui obter sua localização.");
        setRequesting(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 },
    );
  };

  const clear = () => {
    setPosition(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  return { position, requesting, error, request, clear };
}
