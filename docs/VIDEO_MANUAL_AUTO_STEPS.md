# Video Manual: Create Steps from Video (auto cut, subtitles, titles)

Status: built on branch `feature/dcp-json-send-live-count` (freyaAdmin2 + Kurachi). Not yet tested end to end in a
browser. No PR yet.

## What it does

On the step list page of a video manual project, **"Create steps from video"** takes one video and:

1. **Auto cut** — every spoken step marker at the start of a sentence starts a new step.
2. **Auto subtitle** — the transcript becomes subtitle cues for each step, in the spoken language.
3. **Auto title** — the words after the marker become the step title, e.g. `Step 2: remove the cover`,
   `ステップ2: フィルターを洗います`.

The user reviews the cuts (move, remove, add at current time, rename) and then creates all steps at once.

## Decisions (agreed with the user)

| Topic | Decision |
|---|---|
| Speech-to-text | Gemini `gemini-3.5-transcribe`, paid tier (pay per use, about $0.005/min). Voice only, no screen analysis. |
| Language | Auto-detected by Gemini. English, Japanese, or mixed. |
| Where audio is extracted | **In the browser** with ffmpeg.wasm (mono MP3, 16 kHz, 48 kbps). Render must not process video (it serves many factory devices). |
| Gemini call | Through Render as a **pass-through only** (keeps `GEMINI_API_KEY` secret). |
| When | Only at upload time, through the new button. Already-uploaded videos are not touched. |
| How cuts are made | The video is uploaded **once**. Each step is one clip pointing at the same asset with `trim` = step start. No file splitting, so cuts are exact. |
| Existing steps | New steps are appended after them. |
| Speech before the first marker | Becomes an `Introduction` step (if at least 1 s long). |
| Cut position | 0.3 s before the spoken "Step N" (the step video opens with the phrase). |
| Step description | Left empty (subtitles already carry the text). |
| No markers found | One step with the whole video plus subtitles, and a notice. |
| Max length | 30 minutes (Gemini limit with word timestamps). |
| Video fit | `fit: "contain"` (a portrait video gets side bars, not cropped). OK'd by the user. |
| Cache and draft retention | 15 days. |
| Draft scope | One draft per project **and** per user. |
| Resumable video upload | Deferred (see Later). |

## Step markers

Implemented in `findStepMarkers` (`src/components/videoManual/autoStepsUtils.js`). A marker counts only at the
**start of a sentence** (first word, previous word ends with `. ! ? 。 ！ ？`, or a pause of at least 0.4 s).

- English: `step 2`, `step two`, `step number 2` (number words up to twenty).
- Japanese: `ステップ` / `すてっぷ` / `手順` / `工程` followed by a number. The number can be in the same token
  (`ステップ1`) or the next one (`ステップ` + `1、`). Digits, full-width digits, kanji (`一`…`二十`) and some readings
  (`いち`, `さん`, …) are accepted.
- Deliberately **not** markers: `次に` (it appears inside steps), `一つ目` / `2つ目` (could mean "the second screw"),
  and single-kana readings `に し ご く` (`ステップに進む` uses `に` as a particle).
- Not triggered by `go back to step 1` (not at a sentence start).

## Flow

```
Browser (freyaAdmin2)                                 Render (Kurachi/server.js)          Gemini
---------------------                                 --------------------------          ------
pick video -> read duration (<= 30 min)
  |-- upload video (existing upload-asset route) ---> Firebase Storage + asset record
  |-- ffmpeg.wasm: extract MP3 ---------------------> POST /transcribe
                                                       sha256(audio) -> cache hit? return
                                                       else ------------------------------> transcribe
                                                       save to videoManualTranscripts <-----
  <--------------------------------------------------- { words, audioHash }
build cuts / titles / subtitles, user reviews
create --------------------------------------------> POST /steps/bulk (one save, deletes draft)
```

Every step of the way is saved to the draft (PUT `/auto-steps-draft`) so it can continue later.

## Saving the Gemini calls

- **Transcript cache** (`videoManualTranscripts`): key = SHA-256 of the MP3 + model. The result is saved
  **before** replying, so a client that lost its connection gets it from the cache next time. Requests for the same
  audio that arrive at the same time share one Gemini call (in-memory map). TTL index on `lastUsedAt`
  (15 days); reading a draft refreshes it.
- This depends on the browser producing the **same MP3 bytes** from the same video. Native ffmpeg was checked
  (same hash on repeated runs); ffmpeg.wasm has not been checked yet.
- **Draft** (`videoManualAutoStepDrafts`, unique `{projectId, username}`): `file` fingerprint (name, size,
  lastModified, duration), `asset` ({assetId, url}), `audioHash`, `cuts` (user edits, saved 0.8 s after each
  change), `playlistId`, `updatedAt`.
  - Reopen with the upload and transcript done -> straight to the review using the uploaded video. No Gemini call.
  - Otherwise the user picks the **same file** again (a browser cannot reopen a local file after a reload). It is
    matched by name, size and lastModified, and only the missing part runs. A different file asks to start over.
- At most 2 Gemini transcriptions run at once on the server (more get 429); cache hits do not count.

## Closing and cleanup

| Action | Result |
|---|---|
| Close (continue later), Esc, backdrop, reload | Draft kept. An upload still running finishes and is saved into the draft. |
| Discard | Draft deleted, its video moved to the asset recycle bin if no step uses it. |
| Create N steps | Steps saved; the server deletes the draft. |
| Draft untouched for 15 days | Deleted by a lazy cleanup (at most hourly, triggered by GET draft), and its unused video is recycled. |

The user first chose "cancel = recycle the video" (option B). With resume, plain closing keeps the draft
instead, and **Discard** does option B.

## Files

**freyaAdmin2**
- `src/pages/VideoManualStepListPage.jsx`: the button, the modal, and a reload after create. Each step's thumbnail
  uses its own `trim` time.
- `src/components/videoManual/VideoManualAutoStepsModal.jsx`: the UI with stages
  `loading | resume | pick | processing | review | saving`. The review opens once both the upload and the
  transcript are ready (`pendingRef` + `finishIfReady`).
- `src/components/videoManual/autoStepsUtils.js`: marker detection, cuts, titles, subtitle cues, step edit JSON,
  time parsing and formatting.
- `src/utils/trimVideoFile.js`: `extractAudioFile`, `readVideoDuration` (shares the ffmpeg.wasm instance with
  the trimmer).
- `src/services/videoManualApi.js`: `transcribeVideoManualAudio`, `bulkCreateVideoManualSteps`,
  `fetch/save/deleteVideoManualAutoStepsDraft`.
- `src/i18n/translations.js`: Japanese strings (in the `ja` block after "Trim video before upload").

**Kurachi** (`server.js`, section "Video Manual: auto steps from voice", after the step PATCH route)
- `POST /api/video-manuals-studio/projects/:id/transcribe`: raw `audio/*` body (max 40 MB) ->
  `{ text, words: [{word, start, end}], audioHash, cached, model }`.
- `GET | PUT | DELETE /api/video-manuals-studio/projects/:id/auto-steps-draft` (`DELETE ?recycleAsset=1`).
- `POST /api/video-manuals-studio/projects/:id/steps/bulk`: `{ steps: [{ title, edit, assetSourceMap, subtitles }] }`.
- All routes use `vmssLoadEditableProject` (project must be step-based, and the user needs edit access).
- Env: `GEMINI_API_KEY` (already on Render), optional `VMSS_TRANSCRIBE_MODEL`.

## Gemini Transcribe API notes (checked November 2026)

- `ai.models.generateContent({ model: "gemini-3.5-transcribe", contents: [{ role: "user", parts: [{ inlineData:
  { mimeType: "audio/mp3", data } }] }], config: { audioTranscriptionConfig: { wordTimestamp: true } } })`,
  with `httpOptions: { apiVersion: "v1beta" }`.
- Response: `candidates[0].content.parts[].audioTranscription.{ text, words[] }`. Each word has
  `{ word, startOffset: "1.230s", endOffset }`.
- Word timestamps require VERBATIM mode (the default). They cannot be combined with `customVocabulary` or
  `mode: "SMART"`. With word timestamps the limit is 30 minutes (1 h without).
- No `languageCodes` means auto-detect, including mixed languages. A real English + Japanese test gave clean
  separate tokens (`ステップ`, `1、`).
- The free tier uses your data to improve Google products, so use the paid tier (billing on the key's project),
  and set a budget alert.

## Known risks / open items

- **Not tested end to end** in a browser yet (upload + ffmpeg.wasm + resume).
- **Auth** (pre-existing, whole video-manual API): `vmGetRequester` trusts a base64 JSON header built by the
  client, so a faked admin header could call `/transcribe` and spend Gemini credit. The cache, the concurrency
  limit and a budget alert limit the damage. A proper fix is a separate task.
- ffmpeg.wasm memory: about 2 GB per file; fine for normal manual videos.

## Later (agreed to do separately)

- **Resumable video upload**: upload directly from the browser to Firebase Storage with resumable uploads (keep
  the session so a reload resumes from where it stopped), which also takes large uploads off Render. This touches
  the existing asset pipeline (asset records, preview generation), so it is its own task.
- Optional: AI-written titles, or screen-based step detection for silent videos (voice-first was chosen to keep
  costs low).
