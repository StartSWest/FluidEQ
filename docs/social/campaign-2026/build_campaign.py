"""Build FluidEQ's organic campaign from authored copy and real brand assets.

Run with Codex's bundled Python from the repository root. Decorative AI art is
kept separate from real app screenshots. No account, token or paid API is used.
"""

from __future__ import annotations

import csv
import json
import math
import shutil
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).parent
OUT = ROOT / 'outputs/01a1756e-064d-7e03-970a-b2a37d7937b3/FluidEQ-Marketing-Kit'
BUILD = ROOT / 'build/fluid-marketing-2026'
START = date(2026, 10, 26)
END = date(2026, 12, 25)
SITE = 'https://fluideq.com/'
PAGE = 'https://www.facebook.com/fluideqaudio/'
NAVY, WHITE, MINT, BLUE, MUTED = '#071321', '#F4F9FF', '#6FF3D6', '#83AAFF', '#B8CBDF'
FONT_DIR = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Brand', str(FONT_DIR / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('BrandBold', str(FONT_DIR / 'arialbd.ttf')))

# day, headline, short image text, full caption, visual, feature gate
# The first two days only describe the current public application. Launch is
# tentative: every "live" claim has an explicit verification gate and fallback.
WEEKS = [
 ('Meet FluidEQ', [
  ('One EQ. Everything you play.', 'Games. Music. Videos. Your sound, across Windows.', 'Your browser, your games, your music. FluidEQ brings system-wide EQ to Windows 10 and 11, so your tuning reaches everything your PC plays. Free and open source. What would you tune first?', 'wave', 'Current'),
  ('Find your headphones. Find your sound.', 'Explore headphone corrections, then make the sound your own.', 'Start with a correction for your headphones, then adjust the sound to your taste. FluidEQ includes a searchable headphone correction library alongside your own EQ. Tell us which headphones are on your desk.', 'headphones', 'Current'),
  ('Your next sound is taking shape.', 'A closer look at what is coming to FluidEQ.', 'A new FluidEQ update is on the way. We are preparing a closer look at output-specific sound, personal curves and more control over each ear. Follow the Page for the upcoming walkthroughs; we will share availability when it is live.', 'desk', 'Preview'),
  ('Headphones or speakers?', 'What do you reach for when your favorite song starts?', 'Headphones for detail or speakers for the room? Tell us how you listen. The next FluidEQ update is being built around making each output feel like your own.', 'desk', 'Preview'),
  ('A curve worth keeping.', 'A preview of My curves: your own collection of headphone tuning.', 'Coming to FluidEQ: My curves. Keep your own corrections together, including imports from Squiglink or a text file. This is a preview of the upcoming update; we will post the download when it is available.', 'headphones', 'Preview'),
  ('Music you can see.', 'EQ for listening. Plus visualizers for the atmosphere.', 'Your music can set the scene as well as the mood. FluidEQ pairs a free Windows equalizer with optional Plus visualizers. Which atmosphere would you pick: a quiet night sky or a bright city?', 'scene', 'Current'),
  ('FluidEQ 2.1 is here.', 'Every output gets a sound of its own.', 'FluidEQ 2.1 is here. Keep a different sound for each output, tune left and right ears separately, collect your own curves and explore the new De-esser. The core app is free and open source for Windows. Start with one feature and make it yours.', 'wave', '2.1 live'),
 ]),
 ('Make each output yours', [
  ('Different output. Your sound.', 'Your EQ, preset, Tone and DSP return with the device.', 'Headphones at your desk. Speakers across the room. In FluidEQ 2.1, each output remembers its own EQ, preset, Tone, DSP rack and Room settings. Switch the output and its sound comes back with it.', 'desk', '2.1 live'),
  ('What would you save first?', 'A headphone sound, a speaker sound, or one of each?', 'If each output could remember one sound, what would yours be? A little extra bass on speakers, a calmer treble on headphones, or something completely different?', 'desk', 'Current'),
  ('Make both ears feel at home.', 'Split a band into left and right, then tune each side.', 'FluidEQ 2.1 lets a band become separate left- and right-ear bands in the EQ and DSP EQ. Use it to shape your listening preference one side at a time. Start gently and compare with the original.', 'headphones', '2.1 live'),
  ('Small move. Fresh listen.', 'Try a little less treble before adding more bass.', 'Quick listening idea: if a recording feels sharp, try a small treble cut before a large bass boost. Compare at a comfortable, similar volume. A small adjustment can be easier to judge.', 'wave', 'Current'),
  ('Keep the voice. Tame the sharp S.', 'Meet the De-esser in FluidEQ 2.1.', 'Sharp S sounds can pull your attention away from a voice. The new De-esser in FluidEQ 2.1 is designed to reduce sibilance while leaving more of the rest of the recording alone. Explore its music and speech starting profiles.', 'wave', '2.1 live'),
  ('One song to test them all?', 'Which track tells you whether your tuning feels right?', 'Everyone has a reference track. Which song do you know well enough to notice a small change in your headphones? Share the title and artist; keep the music in the original service.', 'headphones', 'Current'),
  ('Your sound, on the second output.', 'A second device with a sound of its own.', 'In FluidEQ 2.1, the second output plays directly from the FluidEQ Engine and keeps its own sound. Explore a headset and speakers with separate tuning for each. Timing depends on your devices; adjust and listen to your setup.', 'desk', '2.1 live'),
 ]),
 ('Headphone week', [
  ('Your headphones have a starting point.', 'Search the correction library. Listen. Adjust to taste.', 'A headphone correction is a starting point, not a rule. Find your model in FluidEQ, compare the available correction and adjust the strength to your preference. What feels right to you matters.', 'headphones', 'Current'),
  ('Closed back or open back?', 'Tell us which kind of headphones you use most.', 'Closed back, open back or in-ear? Tell us what you use and where you listen. We are collecting ideas for future FluidEQ tips.', 'headphones', 'Current'),
  ('My curves. Your collection.', 'Import. Name. Compare. Keep.', 'Your favorite correction should be easy to find again. My curves in FluidEQ 2.1 brings your imports and saved corrections into one personal list. Give each a useful name, compare its shape and apply it when you want.', 'wave', '2.1 live'),
  ('Name the sound you like.', 'A useful curve name beats another Untitled file.', 'Try naming a saved curve by the headphone and the character you wanted: warmer, relaxed or vocal-focused. It makes comparisons easier when you return later.', 'headphones', '2.1 live'),
  ('From Squiglink to your listening.', 'Bring a correction into My curves.', 'Found a correction you want to try? FluidEQ 2.1 can bring supported Squiglink or text corrections into My curves. Review the imported curve before applying it and keep the original for comparison.', 'headphones', '2.1 live'),
  ('A little brighter or a little warmer?', 'Which direction do you usually take your sound?', 'When you adjust your headphones, do you usually go warmer, brighter or closer to neutral? There is no single answer for every listener and every recording.', 'wave', 'Current'),
  ('Compare curves in one press.', 'Spend less time in menus and more time listening.', 'The correction picker in FluidEQ 2.1 puts your curves and the current headphone corrections together. Step through them and listen to the difference. Keep the listening level comfortable while you compare.', 'headphones', '2.1 live'),
 ]),
 ('Make the everyday session better', [
  ('Your song. Remembered your way.', 'Turn on Remember each song\'s sound when you want it.', 'Some songs ask for a different touch. Turn on Remember each song\'s sound in FluidEQ 2.1 and a song can return with the tuning you chose for it on that output. The option starts off, so you choose when to use it.', 'wave', '2.1 live'),
  ('What starts your morning?', 'A playlist, a podcast or a little silence?', 'What is the first thing you listen to when you sit at your computer: a playlist, a podcast or nothing until the coffee is ready?', 'desk', 'Current'),
  ('Start with three controls.', 'Bass. Mid. Treble. Then listen again.', 'You do not need to move every band to get started. Try FluidEQ\'s Bass, Mid and Treble controls with a song you know, one small change at a time. Your detailed EQ bands stay available when you want them.', 'wave', 'Current'),
  ('Try one change at a time.', 'Keep the original nearby for an honest comparison.', 'A useful EQ habit: make one small adjustment, listen, then switch it off and on. If you cannot tell what improved, return to the original and try a smaller step.', 'headphones', 'Current'),
  ('Let the music set the room.', 'Optional Plus visualizers bring the session to life.', 'A late listening session deserves a little atmosphere. Explore FluidEQ\'s optional Plus visualizers alongside the free equalizer. The scene changes what you see; your own tuning shapes what you hear.', 'scene', 'Current'),
  ('Show us your listening corner.', 'Headphones, speakers or a tiny desk setup?', 'What does your listening corner look like? Share a photo if you like, keeping private information and anything on your screen out of view.', 'desk', 'Current'),
  ('A playlist without the re-tuning.', 'Let individual songs return with the sound you chose.', 'When Remember each song\'s sound is enabled in FluidEQ 2.1, you can give different songs different touches on the same output. Try it with a small playlist and decide which songs are better left unchanged.', 'wave', '2.1 live'),
 ]),
 ('Across your desk', [
  ('Two computers. One listening setup.', 'Share Audio over your private local network.', 'Working between two PCs? Share Audio lets FluidEQ connect computers on the same private local network. Bring the sound into the listening setup you already use. Start with the guide and check the connection on both computers.', 'desk', 'Current'),
  ('How many PCs on your desk?', 'One, two, or a setup that needs its own diagram?', 'One PC for everything, or separate computers for work, games and music? Tell us what your desk has to handle.', 'desk', 'Current'),
  ('Send it. Hear it. Either way.', 'Share Audio in both directions with FluidEQ 2.1.', 'FluidEQ 2.1 lets linked computers send and receive audio in both directions, with separate switches and volume controls for the links. Keep the connection on your private local network and choose what you want to hear.', 'desk', '2.1 live'),
  ('Keep the important sound close.', 'Check each computer\'s send and receive controls.', 'Share Audio tip for FluidEQ 2.1: check both sides of a link before your session. Each direction has its own control, so you can choose what travels and what stays quiet.', 'desk', '2.1 live'),
  ('Your headset and speakers. Individually.', 'Separate devices. Separate tuning.', 'A headset and a speaker pair do not need the same EQ. FluidEQ 2.1 gives the main and second outputs their own sound. Start with a gentle correction on each and listen to the devices separately before combining them.', 'headphones', '2.1 live'),
  ('One quiet listening upgrade?', 'What would make your setup easier to live with?', 'If you could improve one thing about your audio setup without buying hardware, what would it be: easier switching, calmer treble, more control or fewer menus?', 'wave', 'Current'),
  ('Save the setup you actually use.', 'Make your everyday outputs easy to return to.', 'Your everyday listening setup should be easy to return to. In FluidEQ 2.1, tune each output once and let its settings come back with the device. Your speakers and headphones can keep different characters.', 'desk', '2.1 live'),
 ]),
 ('See the music', [
  ('Your sound, finally worth watching.', 'Free EQ. Optional Plus scenes.', 'FluidEQ combines a free Windows equalizer with optional visualizer scenes. Explore a living scene while you listen, or keep the graph clear and focus on the curve. Your session can be as quiet or as vivid as you like.', 'scene', 'Current'),
  ('City lights or northern lights?', 'Pick the mood for your next session.', 'Choose the atmosphere: city lights, northern lights or a clean spectrum? Tell us what you would put behind your next playlist.', 'scene', 'Current'),
  ('An idea can become a visualizer.', 'Explore the Studio with your own AI assistant.', 'FluidEQ\'s Studio is a place to build a scene that moves with your music, using your own AI assistant. In 2.1 the Studio is open to every account. Your AI service may have its own plan or charges; start with what you already use.', 'scene', '2.1 live'),
  ('Start with the mood.', 'What should move when the bass arrives?', 'A scene idea starts with a mood. A calm lake, a rainy street or a glowing city: what should move when the bass arrives? Share the scene you would like to build.', 'scene', 'Current'),
  ('A scene you keep.', 'Optional Plus scenes use credits, separate from the free EQ.', 'In FluidEQ 2.1, a Plus scene costs one credit and stays in your looks, with the maker\'s updates. Scenes are optional content; the core equalizer stays free. Explore the gallery before choosing any extras.', 'scene', '2.1 live'),
  ('Keep it calm or turn it up visually?', 'What makes a visualizer comfortable to watch?', 'Do you prefer a subtle background or a scene that follows every beat? Tell us what makes a visualizer enjoyable for a long session.', 'scene', 'Current'),
  ('One desk. Different moods.', 'Match the picture to the listening session.', 'A clean graph for a focused afternoon. A living scene for the evening playlist. Explore how FluidEQ can fit both, with optional Plus visualizers alongside the free audio tools.', 'scene', 'Current'),
 ]),
 ('A little more control', [
  ('Shape the sound, not the whole day.', 'Start gently with the EQ and DSP rack.', 'You do not have to rebuild your sound to improve a session. Start with a small EQ adjustment, then explore the DSP rack one stage at a time. Compare with the original before keeping a change.', 'wave', 'Current'),
  ('Bass, voices or treble?', 'Which part of a recording do you notice first?', 'When a recording feels wrong, where do you notice it first: bass, voices or treble? Your answer can be the starting point for a small, useful adjustment.', 'headphones', 'Current'),
  ('Sharp voices need a lighter touch.', 'Try a De-esser profile for speech in FluidEQ 2.1.', 'If spoken voices feel sharp, try a speech starting profile in the FluidEQ 2.1 De-esser. Adjust gently and listen to both the voice and the sounds around it. Keep the original one switch away.', 'wave', '2.1 live'),
  ('Read the curve. Trust the listening.', 'The graph helps explain the adjustment.', 'A graph can show where you changed the sound; a familiar recording helps you judge whether the change feels right. Use both, and compare at a comfortable volume.', 'wave', 'Current'),
  ('Every band, easier to read.', 'Frequency, gain and Q can sit right on the graph.', 'FluidEQ 2.1 can show a band\'s frequency, gain and Q on the graph. Turn on the detailed view when you want to inspect a curve, then return to a cleaner view when you just want to listen.', 'wave', '2.1 live'),
  ('The best preset is the one you use.', 'What would you name your everyday sound?', 'Warm evening, desk speakers or late-night headphones: what would you call the sound you return to most often?', 'desk', 'Current'),
  ('Keep a profile for the session.', 'Your outputs can fit the way you actually listen.', 'Work calls, a focused playlist and an evening game do not always need the same sound. Explore FluidEQ\'s output profiles and keep useful settings easy to return to.', 'desk', 'Current'),
 ]),
 ('Pass on the good sound', [
  ('A better place to start listening.', 'Free, open-source EQ for Windows 10 and 11.', 'Know someone who has never tried a Windows equalizer? FluidEQ is free and open source. Send them a starting point: pick a familiar song, find their headphones and make one small adjustment.', 'headphones', 'Current'),
  ('What surprised you most?', 'A favorite correction, a useful control or a new scene?', 'What surprised you when you first tuned your setup: a headphone correction, a small treble cut, a different preset or seeing the music move?', 'wave', 'Current'),
  ('Three steps to your sound.', 'Choose your output. Find your correction. Listen.', 'A simple FluidEQ start: choose the output you actually use, look for your headphone correction, then listen before changing anything else. Make small adjustments from there. Save this post for a quieter moment.', 'headphones', 'Current'),
  ('What should we explain next?', 'Tell us which control deserves a short guide.', 'Which FluidEQ topic would you like a short guide for: headphone corrections, My curves, Share Audio, the Room or visualizers? Tell us one and we will use the answers to shape future posts.', 'wave', 'Current'),
  ('A listening room in your headphones.', 'Explore the Room and compare the atmosphere.', 'FluidEQ\'s Room gives headphone listening a sense of a room around you. Explore the different rooms, listen to a familiar recording and keep the one that suits your session.', 'headphones', 'Current'),
  ('What is on your weekend playlist?', 'One track you keep coming back to.', 'What is one track you keep returning to this weekend? Share the title and artist. We are always curious what you use to test your sound.', 'scene', 'Current'),
  ('Your curves can travel with you.', 'Export your My curves collection in FluidEQ 2.1.', 'Keep a copy of your personal corrections. FluidEQ 2.1 can export the My curves collection and import it on another FluidEQ installation. Review the names and curves when you import, then make the new setup your own.', 'wave', '2.1 live'),
 ]),
 ('Your next listening session', [
  ('Make the next playlist yours.', 'Start with a familiar song and a comfortable level.', 'A good listening session starts with something familiar. Choose a song you know, open FluidEQ and make one small adjustment. The free Windows app is ready whenever you want to explore your sound.', 'desk', 'Current'),
  ('A quiet night or a full room?', 'What does your ideal listening session look like?', 'Your ideal listening session: a quiet night with headphones or speakers and a room full of friends? Tell us what you would put on first.', 'desk', 'Current'),
  ('One favorite. Three ways to listen.', 'Headphones. Speakers. Your own saved curves.', 'Try a familiar track on your headphones and speakers, each with its own tuning in FluidEQ 2.1. Compare what suits each device, and keep the curves you want to return to.', 'headphones', '2.1 live'),
  ('Thank you for listening with us.', 'Keep exploring. Keep your sound your own.', 'Thanks for spending a little of your listening time with FluidEQ. Tell us the one feature you use most, and the one you want to understand better.', 'scene', 'Current'),
  ('Good music. Your own sound.', 'Wishing you a great listening session.', 'However you spend today, we hope there is room for a favorite song. FluidEQ is here when you want to make your Windows listening setup feel a little more like your own. Thanks for being part of the community.', 'scene', 'Current'),
 ]),
]


def color(value):
    return HexColor(value)


def label(c, text, x, y, size=9, fill=MINT):
    c.setFillColor(color(fill))
    c.setFont('BrandBold', size)
    c.drawString(x, y, text)


def paragraph(c, text, x, y, width, size=14, leading=None, fill=WHITE, bold=False):
    leading = leading or size * 1.25
    font = 'BrandBold' if bold else 'Brand'
    words, lines, line = text.split(), [], ''
    for word in words:
        candidate = f'{line} {word}'.strip()
        if pdfmetrics.stringWidth(candidate, font, size) > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    c.setFont(font, size)
    c.setFillColor(color(fill))
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def brand(c, x, y, scale=1, dark=False):
    c.drawImage(str(ROOT / 'assets/icon.png'), x, y, 25 * scale, 25 * scale, mask='auto')
    label(c, 'FluidEQ', x + 33 * scale, y + 6 * scale, 19 * scale, NAVY if dark else WHITE)


def curve_stamp(c, x, y, width, height=34, dark=False):
    """An illustrative EQ curve and headphone-profile badge, never a measurement."""
    c.saveState()
    c.setStrokeColor(color('#294157' if not dark else '#C8D7E5'))
    c.setLineWidth(.4)
    for n in range(7):
        xx = x + width * n / 6
        c.line(xx, y, xx, y + height)
    for n in range(3):
        c.line(x, y + height * n / 2, x + width, y + height * n / 2)
    p = c.beginPath()
    for n in range(101):
        t = n / 100
        yy = y + height * (.48 + .27 * math.exp(-((t-.15)/.15)**2) - .20 * math.exp(-((t-.48)/.14)**2) + .20 * math.exp(-((t-.85)/.16)**2))
        (p.moveTo if n == 0 else p.lineTo)(x + t * width, yy)
    c.setStrokeColor(color(MINT if not dark else '#008C82'))
    c.setLineWidth(1.7)
    c.drawPath(p)
    c.setStrokeColor(color(BLUE))
    c.setLineWidth(.8)
    c.line(x, y + height * .5, x + width, y + height * .5)
    c.restoreState()


def headphone_badge(c, x, y, scale=1, dark=False):
    c.saveState()
    c.setStrokeColor(color('#008C82' if dark else MINT))
    c.setLineWidth(1.8 * scale)
    c.arc(x, y, x + 20 * scale, y + 23 * scale, 0, 180)
    c.roundRect(x, y-2*scale, 5*scale, 12*scale, 2*scale, fill=0, stroke=1)
    c.roundRect(x+15*scale, y-2*scale, 5*scale, 12*scale, 2*scale, fill=0, stroke=1)
    label(c, 'HEADPHONE PROFILES', x+29*scale, y+5*scale, 7.5*scale, NAVY if dark else MUTED)
    c.restoreState()


def image_fill(c, path, x, y, w, h):
    iw, ih = Image.open(path).size
    k = max(w/iw, h/ih)
    c.saveState()
    p = c.beginPath(); p.rect(x, y, w, h); c.clipPath(p, stroke=0)
    c.drawImage(str(path), x+(w-iw*k)/2, y+(h-ih*k)/2, iw*k, ih*k)
    c.restoreState()


def art_path(visual):
    return (ROOT / 'assets/tour/scene-aurora.jpg') if visual == 'scene' else SOURCE / 'artwork' / {'wave':'sound-wave.png', 'headphones':'headphones.png', 'desk':'listening-desk.png'}[visual]


def social_page(c, row, story=False, slide=None):
    w, h = (540, 960) if story else (540, 675)
    c.setPageSize((w,h))
    c.setFillColor(color(NAVY)); c.rect(0,0,w,h,fill=1,stroke=0)
    # Artwork remains a background/illustration; interfaces below are real captures.
    image_fill(c, art_path(row['visual']), 0, 90 if story else 80, w, 520 if story else 340)
    c.saveState(); c.setFillColor(Color(7/255,19/255,33/255,alpha=.28)); c.rect(0,0,w,h,fill=1,stroke=0); c.restoreState()
    top = 855 if story else 615
    brand(c, 34, top)
    label(c, row['kicker'].upper(), 34, top-36, 9)
    title = row['headline'] if slide is None else slide[0]
    subtitle = row['short'] if slide is None else slide[1]
    font_size = 37 if len(title) < 40 else 33
    y = paragraph(c, title, 32, top-80, 465, font_size, font_size*1.06, bold=True)
    y = paragraph(c, subtitle, 34, y-12, 445, 14.5, 20, MUTED)
    if row['visual'] == 'scene':
        # Real visualizer screenshot, not a fabricated application screen.
        label(c, 'OPTIONAL PLUS VISUALIZERS', 34, 225 if story else 210, 8)
    if story:
        curve_stamp(c, 34, 235, 240, 65)
        headphone_badge(c, 34, 185, 1.05)
        label(c, row.get('story_prompt','EXPLORE YOUR SOUND'), 34, 128, 12, WHITE)
    else:
        curve_stamp(c, 34, 142, 240, 35)
        headphone_badge(c, 34, 108, .9)
    c.setFillColor(color('#10263A')); c.rect(0,0,w,80 if not story else 96,fill=1,stroke=0)
    label(c, 'fluideq.com', 34, 38 if not story else 48, 22, WHITE)
    label(c, 'FREE EQ FOR WINDOWS', 310, 43 if not story else 53, 8, MINT)
    if slide:
        label(c, slide[2], 480, top-34, 9, MUTED)
    c.linkURL(row['url'], (28,22,500,75), relative=0)
    c.showPage()


def qr_code(c, x, y, size, url=SITE):
    widget = qr.QrCodeWidget(url, barLevel='M')
    bounds = widget.getBounds(); a = bounds[2]-bounds[0]
    d = Drawing(size,size,transform=[size/a,0,0,size/a,0,0]); d.add(widget)
    c.setFillColor(color(WHITE)); c.rect(x-4,y-4,size+8,size+8,fill=1,stroke=0)
    renderPDF.draw(d,c,x,y)


PRINT_DESIGNS = [
 {'key':'01-everything-you-play','headline':'One EQ. Everything you play.', 'short':'Free, open-source sound equalizer for Windows 10 and 11.', 'visual':'wave', 'benefits':['Shape music, games and videos across Windows.','Find a starting point for your headphones.','Keep your own sound close at hand.'], 'kicker':'MAKE IT YOUR SOUND'},
 {'key':'02-headphone-profiles','headline':'Find your headphones. Find your sound.', 'short':'Start with a headphone correction. Make it your own.', 'visual':'headphones','benefits':['Explore the headphone correction library.','Compare before you keep a change.','Tune gently, at a comfortable level.'], 'kicker':'A BETTER PLACE TO START'},
 {'key':'03-music-you-can-see','headline':'Your sound, finally worth watching.', 'short':'Free Windows EQ. Optional Plus visualizer scenes.', 'visual':'scene','benefits':['Shape the listening with a free equalizer.','Explore optional music-reactive scenes.','Bring a little atmosphere to your desktop.'], 'kicker':'LISTEN. LOOK. MAKE IT YOURS.'},
 {'key':'04-every-output','headline':'Every output. Its own sound.', 'short':'Headphones and speakers, each tuned your way.', 'visual':'desk','benefits':['A sound saved with each output.','Personal curves, easy to return to.','More control over each listening session.'], 'kicker':'FLUIDEQ 2.1 - AFTER RELEASE'},
]

CAROUSEL_STEPS = [
 [('Each output, its own character.', 'A preview: your EQ, Tone and DSP can return with the device.'), ('A personal curve collection.', 'My curves is coming. Keep an eye here for the public update.')],
 [('Choose one band. Split the ears.', 'In 2.1, open the band menu and choose Left + right.'), ('Adjust gently. Compare again.', 'Move each ear separately. Per-ear sound needs the offered Engine update.')],
 [('Import a curve you want to keep.', 'Use a supported Squiglink correction or text file, then review the result.'), ('Give it a name. Make it easy to find.', 'Save in My curves, then compare it with the correction you used before.')],
 [('Move one Tone control a little.', 'Start with Bass, Mid or Treble on a familiar recording.'), ('Switch it off. Listen again.', 'Compare with the original before you keep the change.')],
 [('Link the computers on your LAN.', 'Use Share Audio on the same private local network.'), ('Choose each direction separately.', 'In 2.1, send and receive have their own switches and volume controls.')],
 [('Start with a scene idea.', 'Choose a mood and decide what should react to the music.'), ('Explore it in the Studio.', 'Use your own AI assistant. Its service may have its own plan or charges.')],
 [('Try a speech starting profile.', 'The De-esser in 2.1 can help with sharp S sounds in a voice.'), ('Keep the rest of the voice.', 'Listen gently and compare with bypass. Update the Engine when offered.')],
 [('Choose the output you use.', 'Headphones and speakers are different starting points.'), ('Find a correction. Then listen.', 'Try your headphone model, compare gently and adjust to taste.')],
 [('Listen on each output separately.', 'In 2.1, headphones and speakers can remember different settings.'), ('Keep the curve that fits each device.', 'Save useful corrections in My curves and return when you want them.')],
]


def print_page(c, design, flyer=False, back=False):
    # US Letter flyers and 6 x 4 inch postcards, both with 0.125 inch bleed.
    tw, th = (612,792) if flyer else (432,288)
    w,h = tw+18,th+18
    c.setPageSize((w,h))
    c.setFillColor(color(NAVY if not back else WHITE)); c.rect(0,0,w,h,fill=1,stroke=0)
    if back:
        brand(c,31,th-42,.9,True)
        paragraph(c, 'Make your next session yours.', 31, th-72, tw-50, 20,24,NAVY,True)
        yy = th-107
        for b in design['benefits']:
            label(c,'+',32,yy,13,'#008C82')
            yy=paragraph(c,b,50,yy,tw-140,10,13,NAVY)-10
        curve_stamp(c,32,32,170,25,True)
        headphone_badge(c,32,70,.7,True)
        qr_code(c,tw-85,37,66)
        label(c,'fluideq.com',tw-91,24,9,NAVY)
    elif flyer:
        image_fill(c,art_path(design['visual']),0,0,w,h)
        c.saveState(); c.setFillColor(Color(7/255,19/255,33/255,alpha=.7)); c.rect(0,0,w,h,fill=1,stroke=0); c.restoreState()
        brand(c,43,th-43,1.3)
        label(c,design['kicker'],43,th-87,10)
        yy=paragraph(c,design['headline'],40,th-143,tw-70,47,51,WHITE,True)
        yy=paragraph(c,design['short'],43,yy-16,tw-80,17,23,MUTED)
        # Full real screenshot offers product proof while the large art carries mood.
        shot=ROOT/'assets/tour/look-backdrop.jpg'
        if design['visual']=='scene': shot=ROOT/'assets/tour/scene-aurora.jpg'
        c.drawImage(str(shot),43,245,tw-68,210,preserveAspectRatio=True,anchor='c')
        curve_stamp(c,43,174,250,37)
        headphone_badge(c,43,135,1.05)
        label(c,'Get FluidEQ',43,88,25,WHITE)
        label(c,'fluideq.com',43,60,17,MINT)
        label(c,'Free EQ for Windows 10 & 11',43,36,10,MUTED)
        qr_code(c,tw-101,46,72)
    else:
        image_fill(c,art_path(design['visual']),0,0,w,h)
        c.saveState(); c.setFillColor(Color(7/255,19/255,33/255,alpha=.80)); c.rect(0,0,tw*.73,h,fill=1,stroke=0); c.restoreState()
        brand(c,29,th-35,.86)
        label(c,design['kicker'],29,th-63,6.7)
        yy=paragraph(c,design['headline'],27,th-97,tw*.66,27,29,WHITE,True)
        paragraph(c,design['short'],29,yy-5,tw*.64,10,13,MUTED)
        curve_stamp(c,29,65,185,27)
        headphone_badge(c,29,38,.70)
        label(c,'fluideq.com',tw-112,27,12,WHITE)
    c.linkURL(SITE,(20,20,w-20,100),relative=0)
    c.showPage()


def add_print_boxes(path):
    reader=PdfReader(path); writer=PdfWriter()
    for page in reader.pages:
        page.trimbox=RectangleObject([9,9,float(page.mediabox.width)-9,float(page.mediabox.height)-9])
        page.bleedbox=page.mediabox
        writer.add_page(page)
    writer.add_metadata({'/Title':path.stem,'/Author':'FluidEQ','/Subject':'Organic campaign; 0.125 inch bleed; RGB artwork'})
    with path.open('wb') as f: writer.write(f)


def create_calendar(rows):
    p=OUT/'FluidEQ-Campaign-Calendar.pdf'
    c=canvas.Canvas(str(p),pagesize=(842,595))
    for wi,(theme,week) in enumerate(WEEKS):
        c.setFillColor(color(NAVY));c.rect(0,0,842,595,fill=1,stroke=0)
        brand(c,32,536,1)
        label(c,f'WEEK {wi+1:02d}',655,548,11)
        paragraph(c,theme,32,496,750,28,33,WHITE,True)
        label(c,'ORGANIC ONLY  /  AMERICA/NEW_YORK  /  NO AD SPEND',33,462,9,MUTED)
        weekrows=rows[wi*7:(wi+1)*7]
        yy=424
        for r in weekrows:
            c.setStrokeColor(color('#294157'));c.line(32,yy+12,810,yy+12)
            label(c,datetime.fromisoformat(r['date']).strftime('%a %b %d'),33,yy-5,10)
            label(c,r['time'],33,yy-22,9,MUTED)
            paragraph(c,r['headline'],155,yy-5,475,13,15,WHITE,True)
            label(c,r['format'],653,yy-5,9,MUTED)
            label(c,r['gate'],653,yy-22,8,'#FFD18D' if r['gate']=='2.1 live' else MINT)
            yy-=51
        label(c,'Launch is planned for Nov 1; publish live claims only after the public 2.1 download is verified.',33,44,9,MUTED)
        label(c,'Complete captions, files, fallback copy and tracking fields are in the editable schedule.',33,27,9,MUTED)
        c.showPage()
    c.save()


def main():
    for folder in [OUT,OUT/'social',OUT/'print',OUT/'schedule',BUILD,BUILD/'pdfs',BUILD/'previews']:
        folder.mkdir(parents=True,exist_ok=True)
    rows=[]
    for wi,(theme,week) in enumerate(WEEKS):
        for di,entry in enumerate(week):
            day=START+timedelta(days=len(rows))
            headline,short,caption,visual,gate=entry
            story=di in (1,3,5) and len(rows)!=1
            fmt='Story' if story else ('Carousel' if di==2 else ('Flyer' if di==4 else 'Postcard'))
            ident=f'FEQ-{len(rows)+1:03d}'
            utm=f'{SITE}?utm_source=facebook&utm_medium=organic_social&utm_campaign=fluid_listening_2026&utm_content={ident.lower()}'
            row={'id':ident,'date':day.isoformat(),'time':'18:30' if story or di==6 else '12:30',
                 'timezone':'America/New_York','week':wi+1,'theme':theme,'format':fmt,'headline':headline,
                 'short':short,'caption':caption+'\n\n'+utm+'\n\n#FluidEQ #WindowsAudio #Equalizer',
                 'visual':visual,'gate':gate,'kicker': 'COMING TO FLUIDEQ' if gate=='Preview' else ('FLUIDEQ 2.1' if gate=='2.1 live' else 'YOUR SOUND. YOUR WAY.'),
                 'status':'Prepared - not scheduled','url':utm,'files':[],
                 'alt':f'FluidEQ branded {fmt.lower()}: {headline} {short} FluidEQ logo, illustrative EQ curves and a headphone-profile badge. '+('Real FluidEQ visualizer image.' if visual=='scene' else 'Decorative listening artwork.'),
                 'fallback_caption':'Your sound, across Windows. Explore FluidEQ\'s free system-wide EQ, headphone corrections and optional Plus visualizers. Start with a familiar song and one small adjustment.\n\n'+utm+'\n\n#FluidEQ #WindowsAudio',
                 'fallback_file':('social/evergreen-fallback-story.png' if story else 'social/evergreen-fallback.png') if gate=='2.1 live' else '',
                 'release_check':'Public non-draft 2.1 release with a Windows installer; inspect release notes for this feature. Engine 1.23 update is required for per-ear EQ and De-esser.' if gate=='2.1 live' else 'Current feature; previews must remain future tense.' if gate=='Preview' else 'Public app / evergreen content.',
                 'story_prompt':'TELL US HOW YOU LISTEN' if story else ''}
            if 'each ear' in caption or 'De-esser' in caption:
                row['caption']=row['caption'].replace('\n\n'+utm,'\n\nPer-ear EQ and the De-esser need the offered FluidEQ Engine update.\n\n'+utm)
            pdf=BUILD/'pdfs'/f'{ident}.pdf'
            c=canvas.Canvas(str(pdf),pagesize=(540,960 if story else 675))
            if fmt=='Carousel':
                steps=CAROUSEL_STEPS[wi]
                slides=[(headline,short,'1 / 3'),(*steps[0],'2 / 3'),(*steps[1],'3 / 3')]
                for slide in slides: social_page(c,row,False,slide)
            else: social_page(c,row,story)
            c.save()
            count=3 if fmt=='Carousel' else 1
            row['files']=[f'social/{ident}-{n:02d}.png' for n in range(1,count+1)]
            rows.append(row)
    assert len(rows)==(END-START).days+1==61
    assert len({r['date'] for r in rows})==61
    assert all('2.1' not in r['caption'] for r in rows[:2])
    fallback=dict(rows[0],headline='Your sound, across Windows.',short='Free EQ. Headphone corrections. Optional Plus visualizers.',visual='wave',kicker='MAKE IT YOUR SOUND')
    c=canvas.Canvas(str(BUILD/'pdfs/evergreen-fallback.pdf'),pagesize=(540,675));social_page(c,fallback);c.save()
    c=canvas.Canvas(str(BUILD/'pdfs/evergreen-fallback-story.pdf'),pagesize=(540,960));social_page(c,fallback,True);c.save()
    c=canvas.Canvas(str(OUT/'print/FluidEQ-Postcards-6x4.pdf'))
    for design in PRINT_DESIGNS:
        print_page(c,design); print_page(c,design,back=True)
    c.save();add_print_boxes(OUT/'print/FluidEQ-Postcards-6x4.pdf')
    c=canvas.Canvas(str(OUT/'print/FluidEQ-Flyers-Letter.pdf'))
    for design in PRINT_DESIGNS: print_page(c,design,flyer=True)
    c.save();add_print_boxes(OUT/'print/FluidEQ-Flyers-Letter.pdf')
    create_calendar(rows)
    payload={'brand':'FluidEQ','page':PAGE,'page_id':'1348072861720283','start':START.isoformat(),'end':END.isoformat(),'timezone':'America/New_York','organic_only':True,'ad_budget':0,'release_date_assumption':'2026-11-01; tentative, verify before any live claim','publishing_state':'Prepared; see publishing-ledger.json for verified Meta queue receipts.','posts':rows}
    (OUT/'schedule/campaign.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')
    (BUILD/'campaign.json').write_text(json.dumps(payload,indent=2,ensure_ascii=False),encoding='utf-8')
    with (OUT/'schedule/FluidEQ-Content-Schedule.csv').open('w',encoding='utf-8-sig',newline='') as f:
        fields=['id','date','time','timezone','format','theme','headline','caption','gate','status','files','alt','fallback_caption','fallback_file','release_check','url']
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader()
        for r in rows: writer.writerow(dict(r,files=';'.join(r['files'])))
    lines=['FLUIDEQ ORGANIC POSTING COPY','October 26 - December 25, 2026 | America/New_York','No paid ads, boosts, purchases or paid scheduling subscriptions.','Times are initial test slots, not measured audience peaks.','2.1 claims are held until a public installer and matching feature are verified.','']
    for r in rows:
        lines.extend([f"{r['id']} | {r['date']} {r['time']} | {r['format']} | {r['gate']}",r['headline'],r['caption'],'Files: '+', '.join(r['files']),'Alt text: '+r['alt'],''])
    (OUT/'schedule/POSTING-COPY.txt').write_text('\n'.join(lines),encoding='utf-8')
    (OUT/'START-HERE.txt').write_text('''FluidEQ organic marketing kit

61 daily content slots, October 26 - December 25, 2026, America/New_York.
First two days promote current features. The next update gets previews, then
feature posts after its public release is verified. November 1 is a planning
assumption, not an announced release date. Hold launch claims if it slips.

Social PNGs: feed 1080 x 1350; Stories 1080 x 1920. Upload carousel images in order.
Every image includes the real FluidEQ logo, an illustrative EQ curve and a
headphone-profile badge. Decorative hardware art does not depict the software.
Scene and application screenshots are real existing FluidEQ captures; interface
details may vary. Plus visualizers are optional content; the core EQ is free.

Print: four 6 x 4 inch postcards with fronts and backs, and four US Letter flyers.
Each PDF has 0.125 inch bleed and a TrimBox; print at actual size using the trim.
The fourth design is for after the 2.1 release. QR codes lead to https://fluideq.com/.
PDF text/logo/QR are sharp vector or original assets; backgrounds are RGB raster.
These are digital-print masters, not a certified CMYK/PDF-X press proof.

The spreadsheet and JSON are a prepared calendar, not proof of native scheduling.
Only a verified receipt in publishing-ledger.json means a post is queued in Meta.
The runtime ledger is authoritative when a future run changes a post's status.
Use rolling queue batches within the date window Meta accepts. No paid service,
boost, ad campaign, purchase, or ad budget is authorized.

Weekly review: record reach, engagements, website link clicks and tracked visits
only when available. Do not infer downloads from likes or all link clicks.
Blank metrics mean unmeasured; no growth or conversion result is promised.

Sources: repository README.md and CHANGELOG.md, inspected October 25, 2026;
https://fluideq.com/ ; https://github.com/StartSWest/FluidEQ/releases .
2.1 descriptions are upcoming-feature evidence, not proof of public availability.
''',encoding='utf-8')
    ledger=OUT/'schedule/publishing-ledger.json'
    if not ledger.exists(): ledger.write_text(json.dumps({'page_id':'1348072861720283','receipts':[]},indent=2),encoding='utf-8')
    print(json.dumps({'days':len(rows),'feed':sum(r['format']!='Story' for r in rows),'stories':sum(r['format']=='Story' for r in rows),'social_pages':sum(len(r['files']) for r in rows),'output':str(OUT)}))


if __name__=='__main__': main()
