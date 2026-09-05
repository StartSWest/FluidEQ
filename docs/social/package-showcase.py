"""Package the reviewed PNG pages as a social PDF and a self-contained kit."""

import json
import re
from pathlib import Path
from shutil import copy2
from zipfile import ZipFile, ZIP_DEFLATED

from PIL import Image
from pypdf import PdfReader
from reportlab.pdfgen import canvas


root = Path.cwd()
kit = root / "output/social/FluidEQ-Social-Kit"
pages = sorted(kit.glob("[0-9][0-9]-FluidEQ.png"))
assert len(pages) == 9, "Expected nine social pages"
composition = json.loads((root / "build/social-showcase/composition.json").read_text())
pdf = root / "output/pdf/FluidEQ-Social-Showcase.pdf"
doc = canvas.Canvas(str(pdf), pagesize=(810, 1012.5), pageCompression=1)
doc.setTitle("FluidEQ - Your sound, finally worth watching")
doc.setAuthor("Ivan Carmenates Garcia")
doc.setSubject("FluidEQ product showcase: EQ, local music playback and karaoke for Windows")
for i, image_path in enumerate(pages):
    with Image.open(image_path) as image:
        assert image.size == (1080, 1350), (image_path.name, image.size)
    doc.drawImage(str(image_path), 0, 0, width=810, height=1012.5)
    doc.bookmarkPage(f"page-{i + 1}")
    doc.addOutlineEntry(composition[i]["title"], f"page-{i + 1}")
    doc.linkURL("https://fluideq.com", (40, 20, 240, 65), relative=0)
    if i == 8:
        doc.linkURL("https://fluideq.com", (40, 280, 650, 380), relative=0)
    doc.showPage()
doc.save()
reader = PdfReader(pdf)
assert len(reader.pages) == 9
assert all(len(page.get("/Annots", [])) >= 1 for page in reader.pages)

copy2(pdf, kit / pdf.name)
pptx = root / "output/presentations/FluidEQ-Social-Showcase.pptx"
copy2(pptx, kit / pptx.name)
copy2(root / "docs/social/POST-COPY.md", kit / "POST-COPY.md")
copy2(root / "docs/social/POST-COPY.md", kit / "POST-COPY.txt")

copy = (root / "docs/social/POST-COPY.md").read_text(encoding="utf-8")
single = copy.split("## X: single post\n", 1)[1].split("\n## ", 1)[0].strip()
thread = copy.split("## X: optional three-post thread\n", 1)[1].split("\n## ", 1)[0]
posts = [single] + [part.split("\n", 1)[1].strip()
                    for part in thread.split("### ")[1:]]
assert len(posts) == 4
counts = [len(re.sub(r"https://\S+", "x" * 23, post)) for post in posts]
assert all(count <= 280 for count in counts), counts
print(f"X caption lengths, counting links as 23 characters: {counts}")

# Plain text is supplied separately so the visual PDF is not the only way
# to read the story, and each social image has a ready-to-use description.
with (kit / "SLIDE-TEXT-AND-ALT-TEXT.txt").open("w", encoding="utf-8") as out:
    for page in composition:
        out.write(f"\nPAGE {page['number']}: {page['title']}\n\n")
        for element in page["elements"]:
            if element["type"] == "text":
                out.write(element["value"] + "\n")
        screenshots = [element["alt"] for element in page["elements"]
                       if element["type"] == "image" and element["file"].startswith("docs/")
                       and "background" not in element["file"]]
        out.write("\nImage description: " + (". ".join(screenshots) or
                  "FluidEQ logo with an abstract aqua glass wave on a dark background.") + "\n")

archive = root / "output/social/FluidEQ-Social-Kit.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
    for item in sorted(kit.iterdir()):
        if item.is_file():
            bundle.write(item, "FluidEQ-Social-Kit/" + item.name)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert len(bundle.namelist()) == 14
print(f"Verified {len(pages)} PNGs, {len(reader.pages)} PDF pages, clickable download links and 14 kit files.")
print(f"PDF: {pdf.stat().st_size:,} bytes; ZIP: {archive.stat().st_size:,} bytes")
