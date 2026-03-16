import argparse
import json
import re
from pathlib import Path

import fitz

ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
DIACRITICS_RE = re.compile(r"[\u064B-\u065F\u0670]")
LATIN_RE = re.compile(r"[A-Za-z]")
ARABIC_DIGIT_RE = re.compile(r"[٠-٩]")


def has_arabic(value: str) -> bool:
    return bool(ARABIC_RE.search(value or ""))


def has_mixed(value: str) -> bool:
    text = value or ""
    return has_arabic(text) and bool(LATIN_RE.search(text))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    document = fitz.open(str(input_path))
    spans = []
    arabic_lines = []
    font_names = set()
    right_margin_hits = 0
    stable_baselines = 0
    total_arabic_lines = 0
    screenshot_path = output_dir / "page-1.png"

    for page_index, page in enumerate(document):
        page_png = output_dir / f"page-{page_index + 1}.png"
        page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(str(page_png))
        if page_index == 0:
            screenshot_path = page_png
        page_dict = page.get_text("dict", sort=True)
        for block in page_dict.get("blocks", []):
            for line in block.get("lines", []):
                line_spans = []
                for span in line.get("spans", []):
                    text = (span.get("text") or "").strip()
                    if not text:
                        continue
                    font = span.get("font") or ""
                    bbox = span.get("bbox") or [0, 0, 0, 0]
                    font_names.add(font)
                    entry = {
                        "text": text,
                        "font": font,
                        "size": span.get("size"),
                        "bbox": bbox,
                        "page_index": page_index,
                        "has_arabic": has_arabic(text),
                        "has_mixed": has_mixed(text),
                        "has_diacritics": bool(DIACRITICS_RE.search(text)),
                        "has_arabic_digits": bool(ARABIC_DIGIT_RE.search(text)),
                    }
                    spans.append(entry)
                    line_spans.append(entry)
                if not line_spans:
                    continue
                line_text = " ".join(item["text"] for item in line_spans)
                if has_arabic(line_text):
                    total_arabic_lines += 1
                    line_bbox = line.get("bbox") or [0, 0, 0, 0]
                    page_width = float(page.rect.width)
                    line_x0 = float(line_bbox[0])
                    line_x1 = float(line_bbox[2])
                    if line_x0 >= page_width * 0.45 or page_width - line_x1 <= 110:
                        right_margin_hits += 1
                    y_values = [float(item["bbox"][1]) for item in line_spans]
                    baseline_variance = (max(y_values) - min(y_values)) if y_values else 0.0
                    if baseline_variance <= 3.0:
                        stable_baselines += 1
                    arabic_lines.append(
                        {
                            "text": line_text,
                            "bbox": line_bbox,
                            "page_index": page_index,
                            "baseline_variance": round(baseline_variance, 3),
                        }
                    )

    professional_font_hits = sorted(
        {font for font in font_names if any(token in font.lower() for token in ["amiri", "noto", "tahoma", "arial"])}
    )
    mixed_segments = [entry["text"] for entry in spans if entry["has_mixed"]]
    arabic_digit_segments = [entry["text"] for entry in spans if entry["has_arabic_digits"]]
    diacritics_segments = [entry["text"] for entry in spans if entry["has_diacritics"]]
    all_text = "\n".join(entry["text"] for entry in spans)

    result = {
        "input_path": str(input_path),
        "screenshot_path": str(screenshot_path),
        "page_count": document.page_count,
        "font_names": sorted(font_names),
        "professional_font_hits": professional_font_hits,
        "mixed_segments": mixed_segments,
        "arabic_digit_segments": arabic_digit_segments,
        "diacritics_segments": diacritics_segments,
        "contains_hijri_terms": any(token in all_text for token in ["رمضان", "هـ"]),
        "contains_gregorian_terms": any(token in all_text for token in ["يناير", "فبراير", "مارس", "أبريل", "مايو"]),
        "contains_currency_terms": any(token in all_text for token in ["دولار", "ريال", "SAR", "USD"]),
        "rtl_line_ratio": round(right_margin_hits / max(1, total_arabic_lines), 4),
        "baseline_stability_ratio": round(stable_baselines / max(1, total_arabic_lines), 4),
        "arabic_line_count": total_arabic_lines,
        "arabic_lines": arabic_lines[:40],
    }

    (output_dir / "probe.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
