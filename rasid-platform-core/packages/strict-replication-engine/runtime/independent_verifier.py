from __future__ import annotations

import argparse
import io
import json
import subprocess
import time
from pathlib import Path

import fitz
from PIL import Image, ImageChops


OFFICE_EXECUTABLES = {
    "pptx": Path(r"C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE"),
    "docx": Path(r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE"),
    "xlsx": Path(r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE"),
}
LIBREOFFICE_CANDIDATES = [
    Path(r"C:\Program Files\LibreOffice\program\soffice.com"),
    Path(r"C:\Program Files\LibreOffice\program\soffice.exe"),
]
BROWSER_CANDIDATES = [
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
]
FIREFOX_CANDIDATES = [
    Path(r"C:\Program Files\Mozilla Firefox\firefox.exe"),
]


def run_process(command: list[str]) -> None:
    subprocess.run(command, check=True, capture_output=True, text=True)


def first_existing_path(candidates: list[Path]) -> Path | None:
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def rasterize_pdf(path: Path) -> Image.Image:
    document = fitz.open(path)
    pages: list[Image.Image] = []
    for page in document:
        pixmap = page.get_pixmap(alpha=False, matrix=fitz.Matrix(1.0, 1.0))
        pages.append(Image.open(io.BytesIO(pixmap.tobytes("png"))).convert("RGB"))
    document.close()
    if len(pages) == 1:
        return pages[0]
    width = max(page.width for page in pages)
    height = sum(page.height for page in pages)
    canvas = Image.new("RGB", (width, height), "#FFFFFF")
    y = 0
    for page in pages:
        canvas.paste(page, (0, y))
        y += page.height
    return canvas


def export_office_to_pdf(target_kind: str, source_path: Path, output_pdf: Path) -> None:
    libreoffice = first_existing_path(LIBREOFFICE_CANDIDATES)
    if libreoffice is not None:
        if output_pdf.exists():
            output_pdf.unlink()
        generated_pdf = output_pdf.parent / f"{source_path.stem}.pdf"
        if generated_pdf.exists():
            generated_pdf.unlink()
        run_process(
            [
                str(libreoffice),
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output_pdf.parent),
                str(source_path),
            ]
        )
        for _ in range(50):
            if generated_pdf.exists() and generated_pdf.stat().st_size > 0:
                if generated_pdf != output_pdf:
                    generated_pdf.replace(output_pdf)
                return
            time.sleep(0.2)
        raise FileNotFoundError(f"LibreOffice export failed for {source_path}")

    executable = OFFICE_EXECUTABLES[target_kind]
    if not executable.exists():
        raise FileNotFoundError(f"Missing Office executable for {target_kind}: {executable}")
    if output_pdf.exists():
        output_pdf.unlink()
    if target_kind == "pptx":
        script = f"""
$src = '{source_path}'
$out = '{output_pdf}'
$app = New-Object -ComObject PowerPoint.Application
try {{
  $presentation = $app.Presentations.Open($src, $false, $false, $false)
  $presentation.SaveAs($out, 32)
  $presentation.Close()
}} finally {{
  $app.Quit()
}}
"""
    elif target_kind == "docx":
        script = f"""
$src = '{source_path}'
$out = '{output_pdf}'
$app = New-Object -ComObject Word.Application
$app.Visible = $false
try {{
  $document = $app.Documents.Open($src, $false, $true)
  $document.ExportAsFixedFormat($out, 17)
  $document.Close()
}} finally {{
  $app.Quit()
}}
"""
    else:
        script = f"""
$src = '{source_path}'
$out = '{output_pdf}'
$app = New-Object -ComObject Excel.Application
$app.Visible = $false
$app.DisplayAlerts = $false
try {{
  $workbook = $app.Workbooks.Open($src)
  $workbook.ExportAsFixedFormat(0, $out)
  $workbook.Close($false)
}} finally {{
  $app.Quit()
}}
"""
    run_process(["powershell", "-NoProfile", "-Command", script])
    if not output_pdf.exists():
        raise FileNotFoundError(f"Independent Office export failed for {source_path}")


def capture_browser(url: str, output_png: Path) -> None:
    firefox = first_existing_path(FIREFOX_CANDIDATES)
    if firefox is not None:
        if output_png.exists():
            output_png.unlink()
        run_process(
            [
                str(firefox),
                "--headless",
                "--window-size",
                "960,540",
                "--screenshot",
                str(output_png),
                url,
            ]
        )
        for _ in range(20):
            if output_png.exists() and output_png.stat().st_size > 0:
                return
            time.sleep(0.1)
        raise FileNotFoundError(f"Independent Firefox screenshot failed for {url}")

    browser = first_existing_path(BROWSER_CANDIDATES)
    if browser is None:
        raise FileNotFoundError("No Chromium-class browser found for independent verification")
    if output_png.exists():
        output_png.unlink()
    run_process(
        [
            str(browser),
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=960,540",
            "--force-device-scale-factor=1",
            f"--screenshot={output_png}",
            url,
        ]
    )
    for _ in range(20):
        if output_png.exists() and output_png.stat().st_size > 0:
            return
        time.sleep(0.1)
    raise FileNotFoundError(f"Independent browser screenshot failed for {url}")


def pixel_diff(left: Image.Image, right: Image.Image) -> tuple[float, Image.Image]:
    left_rgb = left.convert("RGB")
    right_rgb = right.convert("RGB")
    if left_rgb.size != right_rgb.size:
        width = max(left_rgb.width, right_rgb.width)
        height = max(left_rgb.height, right_rgb.height)
        aligned_left = Image.new("RGB", (width, height), "#FFFFFF")
        aligned_right = Image.new("RGB", (width, height), "#FFFFFF")
        aligned_left.paste(left_rgb, (0, 0))
        aligned_right.paste(right_rgb, (0, 0))
        left_rgb = aligned_left
        right_rgb = aligned_right
    diff = ImageChops.difference(left_rgb, right_rgb)
    histogram = diff.histogram()
    channel_count = len(histogram) // 256
    changed = 0
    for channel_index in range(channel_count):
        start = channel_index * 256
        changed += sum(histogram[start + 1:start + 256])
    ratio = changed / float(left_rgb.width * left_rgb.height * channel_count)
    return ratio, diff


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-kind", required=True)
    parser.add_argument("--target-path", type=Path, required=True)
    parser.add_argument("--reference-png", type=Path, required=True)
    parser.add_argument("--threshold", type=float, required=True)
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--output-png", type=Path, required=True)
    parser.add_argument("--output-diff", type=Path, required=True)
    parser.add_argument("--output-pdf", type=Path)
    parser.add_argument("--browser-url")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    try:
        if args.target_kind in {"pptx", "docx", "xlsx"}:
            if args.output_pdf is None:
                raise ValueError("output_pdf is required for Office targets")
            export_office_to_pdf(args.target_kind, args.target_path, args.output_pdf)
            rendered = rasterize_pdf(args.output_pdf)
            rendered.save(args.output_png)
            renderer = "independent-libreoffice-pdf" if first_existing_path(LIBREOFFICE_CANDIDATES) else "independent-office-com-pdf"
        elif args.target_kind == "dashboard":
            if not args.browser_url:
                raise ValueError("browser_url is required for dashboard verification")
            capture_browser(args.browser_url, args.output_png)
            rendered = Image.open(args.output_png).convert("RGB")
            renderer = "independent-firefox-headless" if first_existing_path(FIREFOX_CANDIDATES) else "independent-chromium-headless"
        else:
            raise ValueError(args.target_kind)

        reference = Image.open(args.reference_png).convert("RGB")
        ratio, diff = pixel_diff(reference, rendered)
        diff.save(args.output_diff)
        payload = {
            "passed": ratio <= args.threshold,
            "threshold": args.threshold,
            "ratio": ratio,
            "renderer": renderer,
            "authoritative": True,
            "independent": True,
            "render_path": str(args.output_png),
            "diff_path": str(args.output_diff),
            "reference_path": str(args.reference_png),
            "pdf_path": str(args.output_pdf) if args.output_pdf else None,
            "browser_url": args.browser_url,
        }
    except Exception as error:
        payload = {
            "passed": False,
            "threshold": args.threshold,
            "ratio": None,
            "renderer": "failed",
            "authoritative": True,
            "independent": True,
            "error": str(error),
            "render_path": str(args.output_png),
            "diff_path": str(args.output_diff),
            "reference_path": str(args.reference_png),
            "pdf_path": str(args.output_pdf) if args.output_pdf else None,
            "browser_url": args.browser_url,
        }
    args.output_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
