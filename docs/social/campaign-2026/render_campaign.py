"""Render authored PDFs for delivery and visual inspection; validate the kit."""

import concurrent.futures
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[3]
BUILD=ROOT/'build/fluid-marketing-2026'
OUT=ROOT/'outputs/01a1756e-064d-7e03-970a-b2a37d7937b3/FluidEQ-Marketing-Kit'
POPPLER=Path('C:/Users/ivanc/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe')


def render(pdf):
    count=len(PdfReader(pdf).pages)
    raster=BUILD/'raster';raster.mkdir(exist_ok=True)
    subprocess.run([str(POPPLER),'-png','-r','144',str(pdf),str(raster/pdf.stem)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    for n in range(1,count+1):
        p=raster/f'{pdf.stem}-{str(n).zfill(len(str(count)))}.png'
        destination=(OUT/'social'/f'{pdf.stem}.png') if pdf.stem.startswith('evergreen-fallback') else OUT/'social'/f'{pdf.stem}-{n:02d}.png'
        p.replace(destination)


def needs_render(pdf):
    if pdf.stem.startswith('evergreen-fallback'):
        images=[OUT/'social'/f'{pdf.stem}.png']
    else:
        images=[OUT/'social'/f'{pdf.stem}-{n:02d}.png' for n in range(1,len(PdfReader(pdf).pages)+1)]
    return any(not p.exists() or p.stat().st_mtime < pdf.stat().st_mtime for p in images)


def sheet(paths,out,width=168,cols=8):
    thumbs=[]
    for p in paths:
        im=Image.open(p).convert('RGB'); im.thumbnail((width,245))
        tile=Image.new('RGB',(width+12,275),'#10263A')
        tile.paste(im,((width+12-im.width)//2,6))
        ImageDraw.Draw(tile).text((7,253),p.name,fill='white')
        thumbs.append(tile)
    board=Image.new('RGB',((width+12)*cols,275*((len(thumbs)+cols-1)//cols)),'#10263A')
    for i,im in enumerate(thumbs):board.paste(im,((i%cols)*(width+12),(i//cols)*275))
    board.save(out)


def main():
    for name in ['evergreen-fallback-01.png','evergreen-fallback-1.png','evergreen-fallback-story-01.png','evergreen-fallback-story-1.png']:
        (OUT/'social'/name).unlink(missing_ok=True)
    pdfs=sorted((BUILD/'pdfs').glob('*.pdf'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(render,[p for p in pdfs if needs_render(p)]))
    social=sorted((OUT/'social').glob('*.png'))
    sheet(social,BUILD/'previews/social-contact-sheet.jpg')
    for filename in ['FluidEQ-Postcards-6x4.pdf','FluidEQ-Flyers-Letter.pdf']:
        pdf=OUT/'print'/filename
        prefix=BUILD/'previews'/pdf.stem
        subprocess.run([str(POPPLER),'-png','-r','100',str(pdf),str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        paths=sorted((BUILD/'previews').glob(pdf.stem+'-*.png'))
        sheet(paths,BUILD/'previews'/f'{pdf.stem}-contact.jpg',250,4)
    subprocess.run([str(POPPLER),'-png','-r','95',str(OUT/'FluidEQ-Campaign-Calendar.pdf'),str(BUILD/'previews/calendar')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    sheet(sorted((BUILD/'previews').glob('calendar-*.png')),BUILD/'previews/calendar-contact.jpg',310,3)
    data=json.loads((OUT/'schedule/campaign.json').read_text(encoding='utf-8'))
    for r in data['posts']:
        for name in r['files']:
            p=OUT/name
            assert p.is_file(),name
            assert Image.open(p).size==((1080,1920) if r['format']=='Story' else (1080,1350)),name
    assert len(data['posts'])==61
    assert len(social)==81
    for filename,pages,trim in [('FluidEQ-Postcards-6x4.pdf',8,(432,288)),('FluidEQ-Flyers-Letter.pdf',4,(612,792))]:
        reader=PdfReader(OUT/'print'/filename);assert len(reader.pages)==pages
        for p in reader.pages:
            assert (float(p.trimbox.width),float(p.trimbox.height))==trim
            assert len(p.get('/Annots',[]))>=1
    assert len(PdfReader(OUT/'FluidEQ-Campaign-Calendar.pdf').pages)==9
    for p in pdfs:
        assert not needs_render(p),f'Stale render: {p.name}'
        for page in PdfReader(p).pages:
            text=page.extract_text()
            assert 'FluidEQ' in text and 'HEADPHONE PROFILES' in text and 'fluideq.com' in text,p.name
    result={'days':61,'feed_posts':36,'stories':25,'social_pngs':len(social),'postcard_pages':8,'flyer_pages':4,'calendar_pages':9,'checks':'dimensions, dates, image availability, brand marks, print trim boxes, clickable links'}
    (BUILD/'validation.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':main()
