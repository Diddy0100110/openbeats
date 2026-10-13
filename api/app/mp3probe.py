"""Estimate the duration of a remote MP3 without downloading all of it.

Two strategies, in order of accuracy:

1. **Xing / Info header** (written by LAME and most encoders): contains the exact
   frame count, so ``duration = frames * samples_per_frame / sample_rate``.
2. **CBR estimate** from the first frame's bitrate and the total file size.

Only the first ~64 KiB of the file (plus ``Content-Length``) is needed.
"""
from __future__ import annotations

import struct

# (version, layer, bitrate_index, sample_rate_index) -> value
_BITRATE_TABLE = {
    # MPEG 1, Layer III
    (1, 3): [None, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, None],
    # MPEG 1, Layer II
    (1, 2): [None, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, None],
    # MPEG 1, Layer I
    (1, 1): [None, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, None],
    # MPEG 2 / 2.5, Layer III
    (2, 3): [None, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, None],
    (2, 2): [None, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, None],
    (2, 1): [None, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, None],
}

_SAMPLE_RATES = {
    3: [44100, 48000, 32000, None],  # MPEG 1
    2: [22050, 24000, 16000, None],  # MPEG 2
    0: [11025, 12000, 8000, None],  # MPEG 2.5
}

_SIDE_INFO = {
    # (version_group, channels) -> bytes of side information
    (1, 2): 32,
    (1, 1): 17,
    (2, 2): 17,
    (2, 1): 9,
}


def id3v2_size(data: bytes) -> int:
    """Return the byte length of the leading ID3v2 tag (0 when absent)."""
    if len(data) < 10 or data[:3] != b"ID3":
        return 0
    size = (
        ((data[6] & 0x7F) << 21)
        | ((data[7] & 0x7F) << 14)
        | ((data[8] & 0x7F) << 7)
        | (data[9] & 0x7F)
    )
    footer = 10 if (data[5] & 0x10) else 0
    return 10 + size + footer


def _parse_header(data: bytes, offset: int) -> dict | None:
    if offset + 4 > len(data):
        return None
    h = data[offset : offset + 4]
    if h[0] != 0xFF or (h[1] & 0xE0) != 0xE0:
        return None

    version_bits = (h[1] >> 3) & 0x03  # 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    layer_bits = (h[1] >> 1) & 0x03  # 1=Layer3, 2=Layer2, 3=Layer1
    bitrate_index = (h[2] >> 4) & 0x0F
    sample_rate_index = (h[2] >> 2) & 0x03
    padding = (h[2] >> 1) & 0x01
    channel_mode = (h[3] >> 6) & 0x03  # 3=mono

    if version_bits not in _SAMPLE_RATES or bitrate_index in (0, 15) or sample_rate_index == 3:
        return None
    if layer_bits == 0:
        return None

    version_group = 1 if version_bits == 3 else 2
    layer = 4 - layer_bits  # 3 -> 1, 2 -> 2, 1 -> 3

    bitrate = _BITRATE_TABLE.get((version_group, layer), [None] * 16)[bitrate_index]
    sample_rate = _SAMPLE_RATES[version_bits][sample_rate_index]
    if not bitrate or not sample_rate:
        return None

    mono = channel_mode == 3
    if version_group == 1:
        samples_per_frame = 1152 if layer == 3 else 1152
    else:
        samples_per_frame = 576 if layer == 3 else 1152

    frame_length = int((samples_per_frame / 8 * bitrate * 1000) / sample_rate) + padding

    return {
        "version_group": version_group,
        "layer": layer,
        "bitrate": bitrate,
        "sample_rate": sample_rate,
        "samples_per_frame": samples_per_frame,
        "frame_length": frame_length,
        "mono": mono,
        "frame_offset": offset,
    }


def _find_first_frame(data: bytes, start: int) -> dict | None:
    limit = min(len(data) - 4, start + 200_000)
    offset = start
    while offset < limit:
        info = _parse_header(data, offset)
        if info:
            return info
        offset += 1
    return None


def _xing_frame_count(data: bytes, info: dict) -> int | None:
    side = _SIDE_INFO.get((info["version_group"], 1 if info["mono"] else 2))
    if side is None:
        return None
    tag_offset = info["frame_offset"] + 4 + side
    tag = data[tag_offset : tag_offset + 4]
    if tag not in (b"Xing", b"Info"):
        return None
    flags = struct.unpack(">I", data[tag_offset + 4 : tag_offset + 8])[0]
    if not (flags & 0x0001):
        return None
    frames = struct.unpack(">I", data[tag_offset + 8 : tag_offset + 12])[0]
    return frames or None


def estimate_duration(head: bytes, total_size: int | None) -> tuple[float | None, str]:
    """Return ``(seconds, method)``; seconds is ``None`` when it cannot be told."""
    tag_size = id3v2_size(head)
    info = _find_first_frame(head, tag_size)
    if not info:
        return None, "unknown"

    frames = _xing_frame_count(head, info)
    if frames:
        seconds = frames * info["samples_per_frame"] / info["sample_rate"]
        return round(seconds, 2), "xing"

    if total_size and total_size > tag_size:
        audio_bytes = total_size - tag_size
        seconds = audio_bytes * 8 / (info["bitrate"] * 1000)
        return round(seconds, 2), "cbr-estimate"

    return None, "unknown"
