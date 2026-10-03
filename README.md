# AyahOnDevice

**A NivareQ™ project**  
**Version 2.0 — Stable**

> **Identify any Ayah with fully local, on-device AI — from the Holy Quran.**

AyahOnDevice is a local-first Quran ayah identification app and reader. Voice recognition runs on the device; recognized speech is used only as approximate search input, while displayed Quran text comes from bundled Quran data rather than generated AI text.

## Highlights
- identify Quran ayat from a short spoken fragment;
- type or paste Arabic as an alternate search path;
- see exactly what the local speech model heard before matching;
- view exact phrase occurrences separately from fuzzy ranking;
- handle repeated ayat and tied interpretations without forcing a false single winner;
- optionally confirm a result so similar future searches can be re-ranked locally, with Undo and Reset;
- read the full Quran locally in Uthmani or IndoPak display;
- choose from five English and two Bengali translations;
- switch the complete app interface between English and বাংলা;
- use curated familiar/context labels for selected ayat and passages;
- keep Saved items, notes, History, recognition learning, and preferences on-device;
- export and restore a versioned personal backup;
- use nine themes;
- use WebGPU when available, with CPU/WASM fallback;
- cache the app shell, Quran data, and default voice model for offline use after preparation.

## Privacy and Quran-text integrity
Normal voice recognition is fully local and on-device: audio is not sent to a cloud speech service for transcription. The recognized transcript is only a search clue. **AI output never becomes displayed Quran text.** Search History, Saved data, notes, and learned recognition stay in local browser storage unless you explicitly export a backup file.

## Offline use
The first preparation of the default voice model may require an Internet connection. After the model and app resources are cached, use **Settings → Check offline availability** to verify that voice recognition and Quran reading are ready without Internet access.

## Deploy
This repository is the deployable static app; no build step is required. Serve the repository root over HTTPS. For GitHub Pages, publish the repository root from the `main` branch.

## Attribution and third-party notices
See [`ATTRIBUTION.md`](ATTRIBUTION.md) for Quran-data, translation, font, familiar-label, and local-model provenance. Third-party license notices are under [`THIRD_PARTY_LICENSES/`](THIRD_PARTY_LICENSES/) and beside the bundled font where required.

## License
Unless otherwise noted, original AyahOnDevice source code in this repository is licensed under the Apache License 2.0. See [`LICENSE`](LICENSE).

Third-party content and components are not relicensed under Apache-2.0. Quran text, translations, fonts, runtime components, model resources, and other third-party material remain subject to their respective upstream terms and attribution requirements.

The Apache License 2.0 does not grant rights to use NivareQ™ or AyahOnDevice names, logos, or branding except as permitted by the license or applicable law.
