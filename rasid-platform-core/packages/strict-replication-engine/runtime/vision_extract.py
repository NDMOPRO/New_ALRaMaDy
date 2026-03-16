from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

from paddleocr import PPStructureV3


os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")


def parse_html_table_rows(html: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_match in re.findall(r"<tr>(.*?)</tr>", html, flags=re.IGNORECASE | re.DOTALL):
        cells = [re.sub(r"<[^>]+>", "", cell).strip() for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_match, flags=re.IGNORECASE | re.DOTALL)]
        if cells:
            rows.append(cells)
    return rows


def to_int_bbox(bbox: list[Any] | None) -> list[int]:
    if not bbox:
        return [0, 0, 0, 0]
    return [int(round(float(value))) for value in bbox[:4]]


def build_output(result: dict[str, Any]) -> dict[str, Any]:
    parsing_blocks = [
        {
            "block_id": block.get("block_id"),
            "label": block.get("block_label"),
            "content": block.get("block_content", ""),
            "bbox": to_int_bbox(block.get("block_bbox")),
        }
        for block in result.get("parsing_res_list", [])
    ]
    semantic_sections = [
        {
            "section_id": f"section-{index}",
            "title": block["content"],
            "bbox": block["bbox"],
        }
        for index, block in enumerate(parsing_blocks)
        if block["label"] in {"header", "title"} and block["content"]
    ]
    form_fields = []
    for block in parsing_blocks:
        content = block["content"]
        if ":" not in content:
            continue
        label, value = content.split(":", 1)
        form_fields.append(
            {
                "label": label.strip(),
                "value": value.strip(),
                "bbox": block["bbox"],
                "field_type": "boolean" if value.strip().lower() in {"yes", "no", "true", "false"} else "text",
            }
        )
    tables = []
    for index, table in enumerate(result.get("table_res_list", [])):
        html = table.get("pred_html", "")
        tables.append(
            {
                "table_id": f"table-{index}",
                "bbox": to_int_bbox(table.get("bbox")),
                "rows": parse_html_table_rows(html),
                "html": html,
                "cell_boxes": [to_int_bbox(cell) for cell in table.get("cell_box_list", [])],
            }
        )
    charts = []
    for index, block in enumerate(parsing_blocks):
        if block["label"] != "chart":
            continue
        numeric_points = [int(value) for value in re.findall(r"\d+", block["content"])]
        charts.append(
            {
                "chart_id": f"chart-{index}",
                "bbox": block["bbox"],
                "content": block["content"],
                "numeric_points": numeric_points,
                "labels": re.findall(r"Q\d+", block["content"]),
            }
        )
    return {
        "runtime": "paddleocr-ppstructurev3",
        "active": True,
        "page_size": {"width": int(result.get("width", 0)), "height": int(result.get("height", 0))},
        "layout_boxes": [
            {
                "label": box.get("label"),
                "score": float(box.get("score", 0.0)),
                "bbox": to_int_bbox(box.get("coordinate")),
            }
            for box in result.get("layout_det_res", {}).get("boxes", [])
        ],
        "regions": [
            {
                "label": box.get("label"),
                "score": float(box.get("score", 0.0)),
                "bbox": to_int_bbox(box.get("coordinate")),
            }
            for box in result.get("region_det_res", {}).get("boxes", [])
        ],
        "parsing_blocks": parsing_blocks,
        "semantic_sections": semantic_sections,
        "form_fields": form_fields,
        "tables": tables,
        "charts": charts,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pipeline = PPStructureV3(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_chart_recognition=False,
        use_table_recognition=True,
        use_region_detection=True,
    )
    result = list(pipeline.predict(str(args.input)))[0].json["res"]
    sys.stdout.buffer.write(json.dumps(build_output(result), ensure_ascii=False).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
