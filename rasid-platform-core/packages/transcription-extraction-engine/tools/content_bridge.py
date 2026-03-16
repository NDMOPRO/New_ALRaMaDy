from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request
import wave
import zipfile
from pathlib import Path
from typing import Any

import fitz
import imageio_ffmpeg
from paddleocr import PPStructureV3
from PIL import Image
from vosk import KaldiRecognizer, Model


os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

ROOT = Path(__file__).resolve().parents[3]
MODEL_ROOT = ROOT / ".runtime" / "transcription-models"
VOSK_MODEL_NAME = "vosk-model-small-en-us-0.15"
VOSK_MODEL_URL = f"https://alphacephei.com/vosk/models/{VOSK_MODEL_NAME}.zip"
ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
CONTROL_RE = re.compile(r"[\u200e\u200f\u202a-\u202e]")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[\.\!\?\n])\s+")
DATE_PATTERNS = [
    re.compile(r"\b\d{4}-\d{2}-\d{2}\b"),
    re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"),
]

_OCR_PIPELINE: PPStructureV3 | None = None
_VOSK_MODEL: Model | None = None


def normalize_text(text: str) -> str:
    cleaned = CONTROL_RE.sub("", text or "")
    cleaned = unicodedata.normalize("NFKC", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def detect_language(text: str) -> str:
    sample = text or ""
    if ARABIC_RE.search(sample):
        return "ar"
    return "en"


def guess_input_kind(file_path: Path) -> str:
    extension = file_path.suffix.lower()
    lower_name = file_path.name.lower()
    if extension in {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}:
        return "audio_file"
    if extension in {".mp4", ".mov", ".avi", ".webm", ".mkv"}:
        return "video_file"
    if extension in {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"}:
        if any(token in lower_name for token in ("table", "grid", "sheet")):
            return "image_table"
        return "image_text"
    if extension == ".pdf":
        return "scanned_document" if "scan" in lower_name else "pdf"
    if extension in {".xlsx", ".xlsm", ".csv"}:
        return "spreadsheet_file"
    return "mixed_attachment"


def tokenise(text: str) -> list[str]:
    return [token for token in re.split(r"[^a-z0-9\u0600-\u06FF]+", normalize_text(text).lower()) if len(token) > 1]


def classify_visual_text_role(text: str, bbox: list[int] | None, frame_height: int, overlap: float) -> str:
    tokens = tokenise(text)
    is_top_banner = bool(bbox and frame_height and bbox[1] <= int(frame_height * 0.3))
    if overlap >= 0.35:
        return "corroborating_overlay"
    if is_top_banner and len(tokens) <= 3:
        return "informational_overlay"
    return "unresolved_visual_text"


def get_ocr_pipeline() -> PPStructureV3:
    global _OCR_PIPELINE
    if _OCR_PIPELINE is None:
        _OCR_PIPELINE = PPStructureV3(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_chart_recognition=False,
            use_table_recognition=True,
            use_region_detection=True,
        )
    return _OCR_PIPELINE


def ensure_vosk_model() -> Model:
    global _VOSK_MODEL
    if _VOSK_MODEL is not None:
        return _VOSK_MODEL
    model_dir = MODEL_ROOT / VOSK_MODEL_NAME
    if not model_dir.exists():
        MODEL_ROOT.mkdir(parents=True, exist_ok=True)
        archive_path = MODEL_ROOT / f"{VOSK_MODEL_NAME}.zip"
        if not archive_path.exists():
            urllib.request.urlretrieve(VOSK_MODEL_URL, archive_path)
        with zipfile.ZipFile(archive_path) as archive:
            archive.extractall(MODEL_ROOT)
    _VOSK_MODEL = Model(str(model_dir))
    return _VOSK_MODEL


def parse_html_table_rows(html: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_match in re.findall(r"<tr>(.*?)</tr>", html, flags=re.IGNORECASE | re.DOTALL):
        cells = [
            re.sub(r"<[^>]+>", "", cell).strip()
            for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_match, flags=re.IGNORECASE | re.DOTALL)
        ]
        if cells:
            rows.append(cells)
    return rows


def to_bbox(bbox: list[Any] | tuple[Any, ...] | None) -> list[int] | None:
    if not bbox:
        return None
    values = list(bbox)[:4]
    return [int(round(float(value))) for value in values]


def ocr_image(image_path: Path, page_number: int | None = None) -> dict[str, Any]:
    pipeline = get_ocr_pipeline()
    result = list(pipeline.predict(str(image_path)))[0].json["res"]
    parsing_blocks = []
    segments = []
    sections = []
    tables = []
    full_text_parts: list[str] = []
    for index, block in enumerate(result.get("parsing_res_list", [])):
        content = normalize_text(block.get("block_content", ""))
        label = block.get("block_label", "text")
        bbox = to_bbox(block.get("block_bbox"))
        parsing_blocks.append({"block_id": f"ocr-block-{index + 1}", "label": label, "content": content, "bbox": bbox})
        if content:
            full_text_parts.append(content)
            if label in {"header", "title"}:
                section_id = f"section-{len(sections) + 1}"
                sections.append(
                    {
                        "section_id": section_id,
                        "title": content,
                        "section_kind": "body",
                        "page_number": page_number,
                        "bbox": bbox,
                    }
                )
            segments.append(
                {
                    "segment_id": f"segment-{len(segments) + 1}",
                    "segment_kind": "ocr_block",
                    "section_id": sections[-1]["section_id"] if sections else None,
                    "speaker_id": None,
                    "text": content,
                    "normalized_text": content,
                    "language": detect_language(content),
                    "confidence": float(block.get("score", 0.78) or 0.78),
                    "start_ms": None,
                    "end_ms": None,
                    "paragraph_index": len(segments),
                    "page_number": page_number,
                    "bbox": bbox,
                }
            )
    for index, table in enumerate(result.get("table_res_list", [])):
        rows = parse_html_table_rows(table.get("pred_html", ""))
        tables.append(
            {
                "table_id": f"table-{index + 1}",
                "title": f"OCR Table {index + 1}",
                "page_number": page_number,
                "row_count": len(rows),
                "column_count": len(rows[0]) if rows and rows[0] else 0,
                "headers": rows[0] if rows else [],
                "rows": rows,
                "bbox": to_bbox(table.get("bbox")),
                "extraction_method": "ocr_table",
            }
        )
    return {
        "full_text": "\n".join(full_text_parts).strip(),
        "detected_language": detect_language("\n".join(full_text_parts)),
        "sections": sections,
        "segments": segments,
        "tables": tables,
        "metadata": {
            "ocr_applied": True,
            "parsing_blocks": parsing_blocks,
            "layout_boxes": result.get("layout_det_res", {}).get("boxes", []),
        },
    }


def split_paragraphs(text: str) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    parts = [part.strip() for part in re.split(r"\n\s*\n|(?<=[\.\!\?])\s+", normalized) if part.strip()]
    return parts


def analyze_pdf(file_path: Path, work_dir: Path) -> dict[str, Any]:
    document = fitz.open(file_path)
    segments: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    page_images: list[str] = []
    full_text_parts: list[str] = []
    ocr_used = False
    for page_index, page in enumerate(document):
        page_number = page_index + 1
        page_text = normalize_text(page.get_text("text"))
        if page_text:
            full_text_parts.append(page_text)
            paragraphs = split_paragraphs(page_text)
            current_section_id = None
            for paragraph in paragraphs:
                if len(paragraph) <= 120 and paragraph == paragraph.title():
                    current_section_id = f"section-{len(sections) + 1}"
                    sections.append(
                        {
                            "section_id": current_section_id,
                            "title": paragraph,
                            "section_kind": "body",
                            "page_number": page_number,
                            "bbox": None,
                        }
                    )
                    continue
                segments.append(
                    {
                        "segment_id": f"segment-{len(segments) + 1}",
                        "segment_kind": "paragraph",
                        "section_id": current_section_id,
                        "speaker_id": None,
                        "text": paragraph,
                        "normalized_text": paragraph,
                        "language": detect_language(paragraph),
                        "confidence": 0.92,
                        "start_ms": None,
                        "end_ms": None,
                        "paragraph_index": len(segments),
                        "page_number": page_number,
                        "bbox": None,
                    }
                )
        try:
            found_tables = getattr(page.find_tables(), "tables", [])
        except Exception:
            found_tables = []
        for table_index, table in enumerate(found_tables):
            try:
                rows = [[("" if cell is None else str(cell).strip()) for cell in row] for row in table.extract()]
            except Exception:
                rows = []
            tables.append(
                {
                    "table_id": f"table-{len(tables) + 1}",
                    "title": f"PDF Table {table_index + 1}",
                    "page_number": page_number,
                    "row_count": len(rows),
                    "column_count": len(rows[0]) if rows and rows[0] else 0,
                    "headers": rows[0] if rows else [],
                    "rows": rows,
                    "bbox": to_bbox(table.bbox),
                    "extraction_method": "pdf_text",
                }
            )
        needs_ocr = len(page_text) < 40 or len(found_tables) == 0
        if needs_ocr:
            ocr_used = True
            page_image = work_dir / f"page-{page_number}.png"
            page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(str(page_image))
            page_images.append(str(page_image))
            ocr_payload = ocr_image(page_image, page_number=page_number)
            if len(page_text) < 40:
                full_text_parts.append(ocr_payload["full_text"])
                segments.extend(ocr_payload["segments"])
                sections.extend(
                    section
                    for section in ocr_payload["sections"]
                    if section["title"] not in {existing["title"] for existing in sections}
                )
            if ocr_payload["tables"]:
                tables.extend(ocr_payload["tables"])
    full_text = normalize_text("\n\n".join(part for part in full_text_parts if part))
    return {
        "full_text": full_text,
        "detected_language": detect_language(full_text),
        "sections": sections,
        "segments": segments,
        "tables": tables,
        "page_count": document.page_count,
        "metadata": {"ocr_applied": ocr_used, "rendered_pages": page_images},
    }


def ensure_wave(source_path: Path, work_dir: Path) -> Path:
    target = work_dir / f"{source_path.stem}.wav"
    extension = source_path.suffix.lower()
    if extension == ".wav":
        with wave.open(str(source_path), "rb") as wav:
            if wav.getframerate() == 16000 and wav.getnchannels() == 1 and wav.getsampwidth() == 2:
                shutil.copy2(source_path, target)
                return target
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(
        [ffmpeg, "-y", "-i", str(source_path), "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", str(target)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return target


def build_media_segments(words: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    segments: list[dict[str, Any]] = []
    speakers: list[dict[str, Any]] = []
    if not words:
        return segments, speakers
    speaker_index = 1
    current_words: list[dict[str, Any]] = []
    last_end = 0.0
    for word in words:
        start = float(word.get("start", 0.0))
        end = float(word.get("end", start))
        pause = start - last_end if current_words else 0.0
        if current_words and (pause > 0.8 or len(current_words) >= 16):
            if pause > 1.5:
                speaker_index += 1
            segments.append(segment_from_words(current_words, speaker_index, len(segments)))
            current_words = []
        current_words.append(word)
        last_end = end
    if current_words:
        segments.append(segment_from_words(current_words, speaker_index, len(segments)))
    speaker_ids = sorted({segment["speaker_id"] for segment in segments if segment["speaker_id"]})
    if not speaker_ids:
        speaker_ids = ["speaker-1"]
    for speaker_id in speaker_ids:
        speakers.append(
            {
                "speaker_id": speaker_id,
                "display_name": speaker_id.replace("-", " ").title(),
                "detection_method": "heuristic" if len(speaker_ids) > 1 else "single_speaker",
                "confidence": 0.62 if len(speaker_ids) > 1 else 0.99,
            }
        )
    return segments, speakers


def segment_from_words(words: list[dict[str, Any]], speaker_index: int, order_index: int) -> dict[str, Any]:
    text = normalize_text(" ".join(str(word.get("word", "")).strip() for word in words))
    confidence_values = [float(word.get("conf", 0.0) or 0.0) for word in words]
    average_confidence = sum(confidence_values) / max(1, len(confidence_values))
    return {
        "segment_id": f"segment-{order_index + 1}",
        "segment_kind": "speech",
        "section_id": "section-1",
        "speaker_id": f"speaker-{speaker_index}",
        "text": text,
        "normalized_text": text,
        "language": detect_language(text),
        "confidence": round(max(0.01, average_confidence), 4),
        "start_ms": int(round(float(words[0].get("start", 0.0)) * 1000)),
        "end_ms": int(round(float(words[-1].get("end", 0.0)) * 1000)),
        "paragraph_index": order_index,
        "page_number": None,
        "bbox": None,
    }


def analyze_media(file_path: Path, work_dir: Path) -> dict[str, Any]:
    wav_path = ensure_wave(file_path, work_dir)
    model = ensure_vosk_model()
    recognizer = KaldiRecognizer(model, 16000)
    recognizer.SetWords(True)
    words: list[dict[str, Any]] = []
    transcript_parts: list[str] = []
    with wave.open(str(wav_path), "rb") as wav_file:
        frame_rate = wav_file.getframerate()
        frame_count = wav_file.getnframes()
        duration_ms = int(round(frame_count / max(1, frame_rate) * 1000))
        while True:
            data = wav_file.readframes(4000)
            if len(data) == 0:
                break
            if recognizer.AcceptWaveform(data):
                result = json.loads(recognizer.Result())
                transcript_parts.append(result.get("text", ""))
                words.extend(result.get("result", []))
        final = json.loads(recognizer.FinalResult())
        transcript_parts.append(final.get("text", ""))
        words.extend(final.get("result", []))
    segments, speakers = build_media_segments(words)
    full_text = normalize_text(" ".join(part for part in transcript_parts if part))
    if not full_text and segments:
        full_text = normalize_text(" ".join(segment["text"] for segment in segments))
    word_timestamps = [
        {
            "text": normalize_text(str(word.get("word", "")).strip()),
            "start_ms": int(round(float(word.get("start", 0.0)) * 1000)),
            "end_ms": int(round(float(word.get("end", 0.0)) * 1000)),
            "confidence": round(float(word.get("conf", 0.0) or 0.0), 4),
        }
        for word in words
        if normalize_text(str(word.get("word", "")).strip())
    ]
    on_screen_text: list[dict[str, Any]] = []
    disagreements: list[dict[str, Any]] = []
    subtitle_detection = {"detected": False, "candidate_count": 0, "frame_count": 0}
    visual_segments: list[dict[str, Any]] = []
    visual_sections: list[dict[str, Any]] = []
    visual_tables: list[dict[str, Any]] = []
    extracted_frames: list[dict[str, Any]] = []
    if guess_input_kind(file_path) == "video_file":
        visual_payload = analyze_video_visuals(file_path, work_dir, duration_ms, full_text)
        on_screen_text = visual_payload["on_screen_text"]
        disagreements = visual_payload["disagreements"]
        subtitle_detection = visual_payload["subtitle_detection"]
        visual_segments = visual_payload["segments"]
        visual_sections = visual_payload["sections"]
        visual_tables = visual_payload["tables"]
        extracted_frames = visual_payload["frames"]
        if visual_payload["full_text"]:
            full_text = normalize_text("\n".join(part for part in [full_text, visual_payload["full_text"]] if part))
    return {
        "full_text": full_text,
        "detected_language": "en",
        "sections": [{"section_id": "section-1", "title": "Transcript", "section_kind": "transcript", "page_number": None, "bbox": None}, *visual_sections],
        "segments": [*segments, *visual_segments],
        "speakers": speakers,
        "word_timestamps": word_timestamps,
        "alignment_pass": len(word_timestamps) > 0,
        "alignment": {
            "word_count": len(word_timestamps),
            "segment_count": len(segments),
            "duration_ms": duration_ms,
        },
        "on_screen_text": on_screen_text,
        "subtitle_detection": subtitle_detection,
        "disagreements": disagreements,
        "tables": visual_tables,
        "duration_ms": duration_ms,
        "metadata": {
            "transcription_engine": "vosk",
            "audio_wave_path": str(wav_path),
            "ffmpeg_path": imageio_ffmpeg.get_ffmpeg_exe(),
            "video_to_audio": {"audio_asset": str(wav_path), "track_metadata": {"duration_ms": duration_ms}},
            "video_frames": extracted_frames,
        },
    }


def extract_video_frame(video_path: Path, target_path: Path, offset_seconds: float) -> bool:
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run(
        [ffmpeg, "-y", "-ss", f"{offset_seconds:.3f}", "-i", str(video_path), "-frames:v", "1", str(target_path)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return target_path.exists()


def analyze_video_visuals(video_path: Path, work_dir: Path, duration_ms: int, transcript_text: str) -> dict[str, Any]:
    offsets = [0.0]
    if duration_ms > 6000:
        offsets.append(round((duration_ms / 1000) / 2, 3))
    frames: list[dict[str, Any]] = []
    observations: list[dict[str, Any]] = []
    segments: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    disagreements: list[dict[str, Any]] = []
    transcript_tokens = set(tokenise(transcript_text))
    visual_full_text_parts: list[str] = []
    for frame_index, offset_seconds in enumerate(dict.fromkeys(offsets)):
        frame_path = work_dir / f"video-frame-{frame_index + 1}.png"
        if not extract_video_frame(video_path, frame_path, offset_seconds):
            continue
        with Image.open(frame_path) as image:
            width, height = image.size
        frames.append(
            {
                "frame_ref": f"frame-{frame_index + 1}",
                "frame_path": str(frame_path),
                "offset_seconds": offset_seconds,
                "width": width,
                "height": height,
            }
        )
        ocr_payload = ocr_image(frame_path)
        for segment_index, ocr_segment in enumerate(ocr_payload.get("segments", [])):
            text = normalize_text(str(ocr_segment.get("text", "")))
            if not text:
                continue
            bbox = ocr_segment.get("bbox")
            subtitle_candidate = bool(bbox and height and bbox[1] >= int(height * 0.6))
            start_ms = int(round(offset_seconds * 1000))
            end_ms = min(duration_ms, start_ms + 2000) if duration_ms else None
            observation_id = f"on-screen-{len(observations) + 1}"
            observations.append(
                {
                    "observation_id": observation_id,
                    "frame_ref": f"frame-{frame_index + 1}",
                    "text": text,
                    "normalized_text": text,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "confidence": float(ocr_segment.get("confidence", 0.78) or 0.78),
                    "subtitle_candidate": subtitle_candidate,
                    "bbox": bbox,
                }
            )
            visual_full_text_parts.append(text)
            segments.append(
                {
                    "segment_id": f"visual-segment-{len(segments) + 1}",
                    "segment_kind": "caption" if subtitle_candidate else "ocr_block",
                    "section_id": "section-visual-1",
                    "speaker_id": None,
                    "text": text,
                    "normalized_text": text,
                    "language": detect_language(text),
                    "confidence": float(ocr_segment.get("confidence", 0.78) or 0.78),
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                    "paragraph_index": segment_index,
                    "page_number": None,
                    "bbox": bbox,
                }
            )
            observation_tokens = tokenise(text)
            overlap = (
                len([token for token in observation_tokens if token in transcript_tokens]) / len(observation_tokens)
                if observation_tokens
                else 0.0
            )
            visual_role = classify_visual_text_role(text, bbox, height, overlap)
            if observation_tokens and visual_role == "unresolved_visual_text":
                disagreements.append(
                    {
                        "disagreement_id": f"disagreement-{len(disagreements) + 1}",
                        "disagreement_type": "asr_vs_ocr",
                        "text": text,
                        "start_ms": start_ms,
                        "end_ms": end_ms,
                        "page_number": None,
                        "severity": "medium" if subtitle_candidate else "low",
                        "resolution_status": "open",
                    }
                )
        for table_index, table in enumerate(ocr_payload.get("tables", [])):
            tables.append(
                {
                    **table,
                    "table_id": f"visual-table-{frame_index + 1}-{table_index + 1}",
                    "title": f"Video OCR {table.get('title', table_index + 1)}",
                }
            )
    return {
        "full_text": normalize_text("\n".join(visual_full_text_parts)),
        "sections": [{"section_id": "section-visual-1", "title": "On-screen text", "section_kind": "body", "page_number": None, "bbox": None}] if observations else [],
        "segments": segments,
        "tables": tables,
        "on_screen_text": observations,
        "subtitle_detection": {
            "detected": any(observation["subtitle_candidate"] for observation in observations),
            "candidate_count": len([observation for observation in observations if observation["subtitle_candidate"]]),
            "frame_count": len(frames),
        },
        "disagreements": disagreements,
        "frames": frames,
    }


def analyze_csv(file_path: Path) -> dict[str, Any]:
    with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    text = "\n".join(" | ".join(row) for row in rows if any(cell.strip() for cell in row))
    return {
        "full_text": normalize_text(text),
        "detected_language": detect_language(text),
        "sections": [{"section_id": "section-1", "title": file_path.stem, "section_kind": "table", "page_number": None, "bbox": None}],
        "segments": [
            {
                "segment_id": "segment-1",
                "segment_kind": "table",
                "section_id": "section-1",
                "speaker_id": None,
                "text": normalize_text(text),
                "normalized_text": normalize_text(text),
                "language": detect_language(text),
                "confidence": 1.0,
                "start_ms": None,
                "end_ms": None,
                "paragraph_index": 0,
                "page_number": None,
                "bbox": None,
            }
        ],
        "tables": [
            {
                "table_id": "table-1",
                "title": file_path.stem,
                "page_number": None,
                "row_count": len(rows),
                "column_count": len(rows[0]) if rows and rows[0] else 0,
                "headers": rows[0] if rows else [],
                "rows": rows,
                "bbox": None,
                "extraction_method": "spreadsheet_parser",
            }
        ],
        "metadata": {"ocr_applied": False},
    }


def analyze_text_document(file_path: Path) -> dict[str, Any]:
    text = file_path.read_text(encoding="utf-8-sig", errors="replace")
    normalized = normalize_text(text)
    paragraphs = split_paragraphs(normalized)
    section_id = "section-1"
    segment_texts = paragraphs or ([normalized] if normalized else [])
    return {
        "full_text": normalized,
        "detected_language": detect_language(normalized),
        "sections": [
            {
                "section_id": section_id,
                "title": file_path.stem,
                "section_kind": "body",
                "page_number": None,
                "bbox": None,
            }
        ]
        if normalized
        else [],
        "segments": [
            {
                "segment_id": f"segment-{index + 1}",
                "segment_kind": "paragraph",
                "section_id": section_id if normalized else None,
                "speaker_id": None,
                "text": paragraph,
                "normalized_text": paragraph,
                "language": detect_language(paragraph),
                "confidence": 1.0,
                "start_ms": None,
                "end_ms": None,
                "paragraph_index": index,
                "page_number": None,
                "bbox": None,
            }
            for index, paragraph in enumerate(segment_texts)
        ],
        "tables": [],
        "metadata": {
            "ocr_applied": False,
            "text_document": True,
            "line_count": len([line for line in text.splitlines() if line.strip()]),
        },
    }


def analyze_file(request: dict[str, Any]) -> dict[str, Any]:
    input_path = Path(request["input_path"]).resolve()
    work_dir = Path(request["work_dir"]).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    input_kind = request.get("input_kind") or guess_input_kind(input_path)
    if input_kind in {"audio_file", "video_file"}:
        payload = analyze_media(input_path, work_dir)
    elif input_kind in {"pdf", "scanned_document"}:
        payload = analyze_pdf(input_path, work_dir)
    elif input_kind in {"image_text", "image_table", "scanned_document"}:
        payload = ocr_image(input_path)
    elif input_kind == "spreadsheet_file" and input_path.suffix.lower() == ".csv":
        payload = analyze_csv(input_path)
    elif input_path.suffix.lower() in {".txt", ".md", ".text", ".log"}:
        payload = analyze_text_document(input_path)
    else:
        payload = ocr_image(input_path)
    full_text = normalize_text(payload.get("full_text", ""))
    payload.setdefault("segments", [])
    payload.setdefault("sections", [])
    payload.setdefault("tables", [])
    payload.setdefault("speakers", [])
    payload.setdefault("metadata", {})
    payload["status"] = "success"
    payload["input_path"] = str(input_path)
    payload["input_kind"] = input_kind
    payload["file_name"] = input_path.name
    payload["normalized_text"] = full_text
    payload["full_text"] = full_text
    payload["detected_language"] = payload.get("detected_language") or detect_language(full_text)
    payload["warning_codes"] = []
    if not full_text and not payload["tables"]:
        payload["warning_codes"].append("content_sparse")
    if payload["detected_language"] == "en" and ARABIC_RE.search(full_text):
        payload["detected_language"] = "ar"
    return payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["analyze"])
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    request = json.loads(args.request.read_text(encoding="utf-8"))
    try:
        payload = analyze_file(request)
    except Exception as exc:  # pragma: no cover - runtime safeguard
        payload = {
            "status": "failed",
            "error": {"type": exc.__class__.__name__, "message": str(exc)},
            "input_path": request.get("input_path"),
            "input_kind": request.get("input_kind"),
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)


if __name__ == "__main__":
    raise SystemExit(main())
