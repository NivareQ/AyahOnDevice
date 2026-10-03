# AyahOnDevice — attribution and provenance

## Quran text
Uthmani Quran source text and chapter metadata: Tanzil Project / Tanzil.net, carried through the bundled quran-json source data. The bundled Uthmani source JSON is retained verbatim. For AyahOnDevice presentation/search only, the routine opening Bismillah that the source prepends to the first numbered ayah of most surahs is segmented from that numbered ayah; the remaining ayah characters are not reconstructed from AI or normalized text. Al-Fatiha 1:1 remains the Bismillah, and At-Tawbah is not given an opening Bismillah.

## IndoPak display text
IndoPak Quran display data: DigitalKhatt / digitalkhatt-js source data. The source uses the Indo-Pak local Al-Fatiha segmentation (opening Bismillah as chapter furniture); AyahOnDevice aligns that presentation at runtime to the canonical Hafs 1:1–1:7 identities used by Finder, Saved, and translations. The IndoPak Bismillah string used for this presentation mapping is the exact pattern published by the same upstream `digitalkhatt-js` service at commit `78372d7a1e211bbab677cc0304384f278f508657`. The upstream MIT license notice is included at `THIRD_PARTY_LICENSES/DigitalKhatt-digitalkhatt-js-MIT.txt`.

## IndoPak font
Digital Khatt IndoPak font by Amine Anane / DigitalKhatt and Tarteel Inc. Font resource obtained from Quranic Universal Library (QUL): https://qul.tarteel.ai/resources/font/568. Upstream project: https://github.com/DigitalKhatt/indopakfont. Licensed under the SIL Open Font License 1.1; the complete license is bundled at `assets/fonts/DigitalKhattIndoPak-OFL-1.1.txt`. The WOFF2 shipped in AyahOnDevice was format-converted from the QUL-published OTF without renaming the font family.

## Translations
QuranEnc translations are republished under QuranEnc's stated re-publication conditions, with publisher/QuranEnc attribution and versions shown in the app. Bundled QuranEnc selections: Rowwad English v1.0.19, Noor International/Saheeh English v1.1.2, Hilali & Khan English v1.1.2, Rowwad Bengali v1.1.2, Abu Bakr Zakaria Bengali v1.1.1.

Pickthall and Yusuf Ali English editions are bundled as public-domain editions according to their source provenance.

## Familiar/context labels
`data/familiar-ayah.json` contains display-only familiar/context labels for selected ayat and passages. The labels do not alter Quran text, numbering, matching, similarity scores, exact-match behavior, or learned-recognition ranking. Each record includes provenance links where applicable. Opening-phrase labels are presented as familiar/popular aliases, not as revealed or canonical ayah titles.

## Local speech runtime
The local speech runtime is built from whisper.cpp / ggml code and an Emscripten WebAssembly toolchain. Relevant upstream license notices are bundled in `THIRD_PARTY_LICENSES/whisper.cpp-MIT.txt` and `THIRD_PARTY_LICENSES/Emscripten-LICENSE.txt`.

## Default local speech model
Default ASR model: `sadrapp/whisper-base-ar-quran-ggml`, pinned revision `fa7a13981ff68f2a1af37a33e2c35e1238d922d5`, file `ggml-model-q8_0.bin`, SHA-256 `72194195f7d280adebec57acf2c6e01e209484322ec1cec21c275a3c0b1e3d77`.

The model is downloaded separately when prepared; it is not stored in this repository. Its transcript is approximate search input and is never substituted for Quran text.
