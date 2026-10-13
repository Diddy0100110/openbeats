"""Build the demo catalogue from Internet Archive items.

Run once, commit the produced JSON, and the API ships with a ready-made library:

    python tools/build_demo_catalog.py

Why Internet Archive? Everything here is public domain or Creative Commons, the
metadata is machine-readable (real titles, composers, performers, durations,
genres) and it serves direct MP3s with HTTP Range support, so the API can proxy
them and seeking still works.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import httpx

OUT = Path(__file__).resolve().parent.parent / "app" / "demo_catalog.json"
UA = {"User-Agent": "OpenBeats/1.0 (demo catalogue builder)"}

KM = "Kevin MacLeod — incompetech.com — CC BY 3.0"
MO = "Musopen Kickstarter Project — public domain"

# Kevin MacLeod samplers — one genre per item, flat metadata.
SAMPLERS = [
    ("Jazz_Sampler-9619", "Jazz Sampler", "Jazz"),
    ("Blues_Sampler-9614", "Blues Sampler", "Blues"),
    ("Classical_Sampler-9615", "Classical Sampler", "Classical"),
    ("Global_Sampler-9620", "Global Sampler", "World"),
    ("Oddities-17185", "Oddities", "Eclectic"),
]

MUSOPEN_ID = "MusopenCollectionAsFlac"
MUSOPEN_CAP = 64


def humanize(token: str) -> str:
    """``GoldbergVariations`` -> ``Goldberg Variations``; ``Op.74pathtique`` -> ``Op. 74 pathtique``."""
    text = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", token)  # camelCase
    text = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", text)  # letter -> digit
    text = re.sub(r"(?<=\d)(?=[A-Za-z])", " ", text)  # digit  -> letter
    text = re.sub(r"\.(?=\d)", ". ", text)  # Op.84 -> Op. 84
    text = text.replace("_", " ").replace("-", " ").strip()
    return re.sub(r"\s+", " ", text)


def _repair_once(value: str) -> str:
    for codec in ("cp1252", "latin-1"):
        try:
            repaired = value.encode(codec).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired != value:
            return repaired
    return value


def repair_mojibake(value: str, rounds: int = 3) -> str:
    """Fix text that was mis-decoded as cp1252/Latin-1 but really is UTF-8 bytes.

    Archive.org's catalogue is inconsistent: some records carry a correct
    ``Pathétique`` while others carry the double-encoded ``PathÃ©tique`` — and
    some of those were decoded with cp1252, so byte 0x99 arrives as ``™`` rather
    than a control character.

    Re-encoding with cp1252 (falling back to Latin-1) and decoding as UTF-8
    repairs the broken records. Genuinely correct text is left alone because a
    real accented character such as ``é`` (U+00E9) encodes to a byte that is not
    valid UTF-8, so the decode fails and the original string is returned. The
    operation is idempotent, and repeating it handles doubly-encoded records.
    """
    current = value
    for _ in range(rounds):
        repaired = _repair_once(current)
        if repaired == current:
            break
        current = repaired
    return current


def work_from_folder(name: str) -> str:
    """``Bach_GoldbergVariations/x.mp3`` -> ``Goldberg Variations``."""
    folder = name.split("/")[0]
    parts = folder.split("_")
    return humanize("_".join(parts[1:])) if len(parts) > 1 else ""


def seconds(value) -> float | None:
    """Archive.org reports durations as seconds or as MM:SS / HH:MM:SS."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if ":" in text:
        parts = [float(p) for p in text.split(":")]
        while len(parts) < 3:
            parts.insert(0, 0.0)
        return round(parts[0] * 3600 + parts[1] * 60 + parts[2], 2)
    try:
        return round(float(text), 2)
    except ValueError:
        return None


def download_url(identifier: str, name: str) -> str:
    return f"https://archive.org/download/{identifier}/{quote(name)}"


def fetch_metadata(identifier: str, client: httpx.Client) -> list[dict]:
    payload = client.get(f"https://archive.org/metadata/{identifier}").json()
    files = payload.get("files", [])
    return [f for f in files if str(f.get("name", "")).lower().endswith(".mp3")]


# ---------------------------------------------------------------------------
def build_samplers(client: httpx.Client) -> list[dict]:
    tracks: list[dict] = []
    for identifier, album, genre in SAMPLERS:
        entries = fetch_metadata(identifier, client)
        for index, entry in enumerate(entries, start=1):
            raw = repair_mojibake(str(entry.get("title") or Path(entry["name"]).stem))
            title = re.sub(r"^Kevin[\s_]MacLeod[\s_]*[-_]\s*", "", raw).replace("_", " ").strip()
            tracks.append(
                {
                    "title": title or f"{album} {index}",
                    "artist": "Kevin MacLeod",
                    "album": album,
                    "genre": genre,
                    "track_number": index,
                    "duration": seconds(entry.get("length")),
                    "url": download_url(identifier, entry["name"]),
                    "attribution": KM,
                }
            )
        print(f"  {album:<20} {len(entries):>3} tracks")
    return tracks


def build_musopen(client: httpx.Client, cap: int = MUSOPEN_CAP) -> list[dict]:
    entries = [f for f in fetch_metadata(MUSOPEN_ID, client) if f.get("title")]

    # Round-robin across works so every one is represented.
    buckets: dict[str, list[dict]] = {}
    for entry in entries:
        buckets.setdefault(str(entry["name"]).split("/")[0], []).append(entry)

    picked: list[dict] = []
    depth = 0
    while len(picked) < cap:
        progressed = False
        for bucket in buckets.values():
            if depth < len(bucket) and len(picked) < cap:
                picked.append(bucket[depth])
                progressed = True
        if not progressed:
            break
        depth += 1

    tracks: list[dict] = []
    for entry in picked:
        title = repair_mojibake(str(entry["title"]))
        segments = [s.strip() for s in title.split(" - ")]
        words = [s for s in segments if s and not re.fullmatch(r"\d+", s)]

        composer = words[0] if words else "Various composers"
        rest = words[1:]
        piece = rest[-1] if rest else title
        # Only the first remaining segment is the work; anything after it is a
        # movement/tempo marking, e.g. "… - Op. 68 - Un poco sostenuto - Allegro".
        work = (rest[0] if len(rest) >= 2 else "") or work_from_folder(str(entry["name"])) or piece

        try:
            number = int(str(entry.get("track") or "").strip() or 0) or None
        except ValueError:
            number = None

        performer = repair_mojibake(str(entry.get("creator") or "").strip())
        tracks.append(
            {
                "title": piece,
                "artist": composer,
                "album": work,
                "genre": "Classical",
                "track_number": number,
                "duration": seconds(entry.get("length")),
                "url": download_url(MUSOPEN_ID, entry["name"]),
                "attribution": f"{performer} — {MO}" if performer else MO,
            }
        )
    print(f"  {'Musopen':<20} {len(tracks):>3} tracks across {len(buckets)} works")
    return tracks


# ---------------------------------------------------------------------------
def validate(tracks: list[dict], client: httpx.Client) -> list[dict]:
    """Drop tracks whose audio really cannot be fetched (3 attempts each)."""
    good: list[dict] = []
    for index, track in enumerate(tracks, start=1):
        ok = False
        for attempt in range(3):
            try:
                response = client.get(track["url"], headers={"Range": "bytes=0-1023"})
                if response.status_code in (200, 206):
                    ok = True
                    break
            except httpx.HTTPError:
                pass
            time.sleep(1.5 * (attempt + 1))
        if ok:
            good.append(track)
        else:
            print(f"  !! unreachable, dropping: {track['artist']} — {track['title']}")
        if index % 25 == 0:
            print(f"  validated {index}/{len(tracks)}…")
    return good


def main() -> None:
    skip_validation = "--skip-validate" in sys.argv

    with httpx.Client(timeout=90, follow_redirects=True, headers=UA) as client:
        tracks = build_samplers(client) + build_musopen(client)
        if skip_validation:
            print(f"\n{len(tracks)} tracks (validation skipped)")
        else:
            print(f"\n{len(tracks)} candidate tracks; validating audio URLs…")
            tracks = validate(tracks, client)

    OUT.write_text(
        json.dumps(
            {
                "source": "Internet Archive (archive.org) — public domain / Creative Commons",
                "track_count": len(tracks),
                "tracks": tracks,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    genres: dict[str, int] = {}
    for track in tracks:
        genres[track["genre"]] = genres.get(track["genre"], 0) + 1
    print(f"\nWrote {len(tracks)} tracks -> {OUT}")
    print(f"Genres: {genres}")


if __name__ == "__main__":
    main()
