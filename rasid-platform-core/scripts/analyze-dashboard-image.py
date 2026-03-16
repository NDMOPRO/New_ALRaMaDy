import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image


def rgb_to_hex(rgb):
    return "#%02x%02x%02x" % rgb


def main():
    image_path = Path(sys.argv[1])
    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    sample = image.resize((64, 64))
    colors = Counter(sample.getdata()).most_common(5)
    palette = [rgb_to_hex(color) for color, _ in colors]
    inferred_layout = "wide" if width >= height else "stacked"
    if any(channel > 180 for color, _ in colors for channel in color):
      inferred_layout = f"{inferred_layout}-light"
    print(json.dumps({
        "palette": palette,
        "width": width,
        "height": height,
        "inferred_layout": inferred_layout
    }))


if __name__ == "__main__":
    main()
