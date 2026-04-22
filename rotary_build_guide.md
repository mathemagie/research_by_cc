# Rotary Phone Art — Build Guide

**Companion to:** [rotary.md](./rotary.md)
**Date:** April 22, 2026
**Purpose:** Practical, buildable specs for three rotary-phone art projects inspired
by the survey in `rotary.md`. Each project is scoped so a determined maker with
soldering skills could complete it in a weekend or two.

---

## How to pick a donor phone

Most of these builds assume a **Western Electric Model 500** (US, 1949–1980s) or an
equivalent European desk phone (e.g. GPO 746, Siemens FeTAp 611). Why:

- Heavy bakelite/ABS shell — plenty of room inside for a Pi or microcontroller.
- Standard carbon-mic handset with screw-off caps — easy to swap for a condenser mic.
- Electromechanical ringer + rotary dial that still pulse-dials reliably after 60 years.
- Cheap and widely available on eBay, estate sales, and thrift stores (~$20–60).

**Avoid** push-button "Trimline" phones and cordless units — they look the part but
lack the mechanical soul of a true rotary.

### Universal hardware you'll reuse across all three builds

| Part | Notes |
|---|---|
| Raspberry Pi Zero 2 W | Fits inside the phone body; has Wi-Fi. |
| USB sound card (tiny) | For clean audio in/out via the handset. |
| Electret mic capsule | Replaces the carbon mic inside the handset. |
| Small 8Ω speaker or piezo | Replaces the earpiece driver (or reuse original). |
| Hook-switch reader | The two leads under the cradle, wired to a GPIO pin. |
| Rotary dial reader | Two pairs of contacts: "off-normal" and "pulse". |
| 5V / 2A USB-C supply | Snake the cable through the original line cord. |

### Reading the rotary dial in software (shared code)

The dial produces *pulses* as it returns to rest — digit `N` produces `N` pulses
(with `10` for zero). A minimal Python reader on a Pi:

```python
import time
from gpiozero import Button

pulse = Button(17, pull_up=True, bounce_time=0.01)
off_normal = Button(27, pull_up=True)

count = 0

def on_pulse():
    global count
    count += 1

def on_dial_done():
    global count
    if count == 0:
        return
    digit = count % 10  # 10 pulses → 0
    count = 0
    print(f"dialed: {digit}")

pulse.when_pressed = on_pulse
off_normal.when_released = on_dial_done

while True:
    time.sleep(1)
```

Tune `bounce_time` if you get duplicate counts — old dials produce dirty contacts.

---

## Project 1 — Dial-a-Dataset

**Inspiration:** "Dial-a-dataset" bullet in rotary.md.
**What it does:** Lift the handset, dial a digit, hear one entry from a chosen
public dataset read aloud in the earpiece. Each digit maps to a different feed.

### Suggested digit map

| Digit | Dataset | Entry |
|---|---|---|
| 1 | NOAA daily weather archive | A random day's weather for a random US city |
| 2 | US Congressional Record | One speech excerpt, chosen at random |
| 3 | NASA APOD | The day's "Astronomy Picture" caption, read aloud |
| 4 | Wikipedia "On This Day" | One historical event from today's date |
| 5 | Project Gutenberg | A random paragraph from a random public-domain novel |
| 6 | USGS earthquake feed | The most recent magnitude-4+ event, narrated |
| 7 | NYC 311 complaints | One anonymized complaint from the past week |
| 8 | Climate datasets | One CO₂ or temperature anomaly reading |
| 9 | HN front page | The current top story's title and first comment |
| 0 | Operator | A short spoken "thank you for calling" + dataset index |

### Architecture

```
hook-switch lifted
      │
      ▼
   "ready" tone in earpiece
      │
      ▼
   dial digit ──► pick dataset ──► fetch entry (HTTPS)
                                        │
                                        ▼
                                  TTS (piper or espeak-ng)
                                        │
                                        ▼
                                earpiece audio out
      │
      ▼
  hook-switch replaced → stop playback
```

### Bill of materials (beyond the universal list)

- Pi Zero 2 W (Wi-Fi is mandatory)
- MicroSD card, 16 GB
- USB-C power supply
- Optional: small LiPo + charger board if you want it cordless

### Software stack

- `piper` for offline, natural-sounding TTS (or `espeak-ng` for minimal builds)
- `requests` / `httpx` for dataset APIs
- `sox` or `pygame.mixer` for playback mixing a dial tone under the voice
- A tiny config file mapping digits → data source URLs

### Subtle touches that matter

- Play ~400 ms of **dial tone** the instant the handset is lifted — silence
  breaks the illusion.
- Add a **line hiss** bed (−40 dB) under the TTS. The ear expects it.
- Handle **hook hang-up mid-call** — cut audio immediately; otherwise the magic
  dies. (This is a frequent bug in maker builds.)
- **Cache last response per digit** so offline fallback sounds natural.

---

## Project 2 — AI Operator (Claude on the Line)

**Inspiration:** "AI operator" bullet in rotary.md.
**What it does:** A conversational LLM answers when you lift the receiver and
dial `0`. The dial pacing and handset intimacy deliberately slow the interaction,
pushing it toward reflection rather than task-completion.

### Why a rotary phone is a good LLM interface

- **Attention commitment.** You cannot multitask while holding a heavy handset.
- **Private acoustic channel.** No one else in the room hears the reply.
- **Turn-taking feels natural.** The mechanical hang-up is an unambiguous "done."
- **No screen** removes the temptation to copy/paste and doomscroll.

### Architecture

```
lift handset ──► dial tone
     │
     ▼
 dial "0"  ──► "Operator here. Go ahead."
     │
     ▼
 VAD-triggered mic capture (webrtcvad)
     │
     ▼
 Whisper (local, tiny.en) ──► transcript
     │
     ▼
 Claude API (Haiku 4.5 for latency, Sonnet 4.6 for depth)
     │  system prompt: "You are a patient, thoughtful phone
     │  operator. Keep replies under 45 seconds of speech.
     │  Ask one follow-up question."
     ▼
 piper TTS ──► earpiece
     │
     ▼
 loop until hook replaced
```

### Bill of materials

- Same as Project 1, plus:
- Quieter USB sound card with a clean preamp (HifiBerry Mini or cheap C-Media)
- Optional small mute button under the phone for "hold"

### Prompt-engineering notes

- Keep the system prompt short. Rotary users speak slowly; don't bloat latency.
- Enable **prompt caching** on the Claude API for the system prompt + any running
  conversation history — this is the single biggest latency and cost win.
- Cap replies at ~60–90 tokens so TTS doesn't run over the caller's attention span.
- Optional: have the operator ask permission before recalling prior calls
  ("Shall I pick up where we left off?"). Persist conversation per handset.

### Ethical guardrails

- Show a printed card near the phone stating it's an LLM and calls may be logged.
- Do not advertise this as a mental-health tool. Route obvious distress to a
  hard-coded list of hotlines, spoken aloud, and end the call gracefully.
- Store transcripts only if the user explicitly dials a "save" digit.

---

## Project 3 — Collective Wind Phone

**Inspiration:** "Collective wind phone" bullet in rotary.md, extending Sasaki's
original into an asynchronous networked piece.

**What it does:** A rotary phone where callers can either leave a short spoken
message to someone they've lost, or listen to a shuffled, anonymized message
left by a stranger. Two hands-free digits control the mode: `1` = speak, `2` =
listen.

### Why this is delicate

This is the hardest of the three builds — not technically, but ethically. Read
the original Wind Phone interviews before starting. The Sasaki piece works in
part because it is *private*, *unrecorded*, and *unshared*. A collective variant
reverses all three of those decisions, so every design choice must protect
callers from harm.

### Design rules (non-negotiable)

1. **No identifying content.** Automatically transcribe each message, scan for
   proper names / phone numbers / addresses, and reject messages containing them
   with a gentle re-prompt.
2. **Consent on every recording.** Speak a clear notice before the tone: *"Your
   message may be heard by a stranger. Press 1 to continue, hang up to cancel."*
3. **Moderation queue before anything is played.** No live loop. A human reviews
   every clip before it enters the shuffle pool.
4. **Right to delete.** Each recording gets a spoken confirmation code; callers
   can dial back and delete their own message with that code.
5. **Resource directory.** Digit `0` reads aloud local grief-support resources.

### Architecture

```
lift handset ──► intro message + consent
     │
     ▼
  dial "1" (speak):
     record up to 90 s ──► local encrypt ──► upload ──► moderation queue
     speak back a 4-digit delete code
     │
  dial "2" (listen):
     pull a random approved clip from server ──► play in earpiece
     │
  dial "0": read support resources
     │
  hang-up at any time ends the interaction cleanly
```

### Bill of materials

- Same as Projects 1/2
- Small backend server (a $5/mo VPS is plenty) running the moderation queue
- Object storage for encrypted audio (S3, R2, etc.)
- Optional: physical install in a decommissioned booth for public-art contexts

### Software stack

- `sox` or `arecord` for recording
- `whisper` (tiny) for on-device transcription + PII scan
- `age` or `libsodium` for at-rest encryption
- A tiny Flask/FastAPI backend with: `/upload`, `/random`, `/delete`
- A minimal web admin page for the human moderator

### What to build *before* you deploy publicly

1. A **dry-run mode** that records only to a local SD card and never uploads.
2. A **test-pool** of volunteer messages so the "listen" path has content on day
   one. An empty shuffle pool ruins the first caller's experience.
3. An **incident playbook** for what to do if someone leaves a message
   describing harm to themselves or others.

---

## Comparing the three projects

| Project | Difficulty | Cost | Standalone? | Ethical weight |
|---|---|---|---|---|
| Dial-a-Dataset | Low | ~$60 | Yes | Low |
| AI Operator | Medium | ~$70 + API usage | Mostly (needs Wi-Fi) | Medium |
| Collective Wind Phone | High | ~$70 + $5/mo VPS | No — server required | **High** |

A suggested path: **build Project 1 first** to validate your donor phone, wiring,
and rotary-reader code. Only then move on.

---

## Further reading and resources

- Main survey: [rotary.md](./rotary.md)
- [Arduino Rotary Phone — Make:](https://makezine.com/projects/arduino-rotary-phone/)
- [Turn a Rotary Phone into a Radio — Arduino Project Hub](https://projecthub.arduino.cc/carolinebuttet/turn-a-rotary-phone-into-a-radio-and-travel-through-time-24bbf8)
- [AIY Projects + Raspberry Pi Rotary Phone — Adafruit](https://blog.adafruit.com/2017/09/29/aiy-projects-and-the-raspberry-pi-powered-rotary-phone/)
- [Vintage Rotary Phone Jukebox — Adafruit](https://blog.adafruit.com/2018/01/26/turn-a-vintage-rotary-phone-into-a-jukebox-raspberry_pi-piday-raspberrypi/)
- [Antique Phone Resurrection Using Raspberry Pi — Adafruit](https://blog.adafruit.com/2022/10/14/antique-phone-resurrection-using-raspberry-pi-raspberry_pi-piday-raspberrypi/)
- [Wind Phone — Wikipedia](https://en.wikipedia.org/wiki/Wind_phone) (read before attempting Project 3)
- [For the Grieving, the Global 'Wind Phone' Movement — Colossal](https://www.thisiscolossal.com/2024/10/wind-phones/)
