"use client";

import { useState, type ChangeEvent } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { LyricsResponse } from "@melune/api-client";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Admin LRC upload. The API parses timestamps server-side; this page only
 * reads the chosen UTF-8 file and shows the resulting line count so an
 * editor can confirm the upload before closing the panel.
 */
export default function AdminLyricsPage() {
  const { t } = useTranslation();
  const [songId, setSongId] = useState("");
  const [language, setLanguage] = useState("fa");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<LyricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    void file.text().then((text) => setContent(text));
  }

  async function upload() {
    if (!songId.trim() || !content.trim()) {
      setError(t("admin.lyrics.required"));
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await apiClient.uploadLyrics(songId.trim(), content, language));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.lyrics.uploadError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.nav.lyrics")}</h1>
        <p className="mt-2 text-sm text-muted">{t("admin.lyrics.intro")}</p>
      </header>

      <section className="glass-panel flex flex-col gap-5 rounded-3xl p-6">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-muted">{t("admin.lyrics.song")}</span>
          <input
            value={songId}
            onChange={(e) => setSongId(e.target.value)}
            placeholder="song id or slug"
            className="rounded-xl border border-border bg-background/60 px-4 py-2.5 text-foreground outline-none focus:border-primary"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-6">
          <label className="flex flex-col gap-2">
            <span className="text-muted">{t("admin.lyrics.language")}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-xl border border-border bg-background/60 px-4 py-2.5 text-foreground"
            >
              <option value="fa">فارسی</option>
              <option value="en">English</option>
              <option value="und">Undetermined</option>
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-2">
            <span className="text-muted">.lrc</span>
            <input
              type="file"
              accept=".lrc,.txt,text/plain"
              onChange={onFileChange}
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white"
            />
            {fileName && <span className="text-xs text-primary">{fileName}</span>}
          </label>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={9}
          dir="ltr"
          placeholder="[00:12.34]Your first lyric line"
          className="w-full rounded-xl border border-border bg-background/60 p-4 font-mono text-sm text-foreground outline-none focus:border-primary"
        />

        <div>
          <button
            onClick={upload}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Upload size={16} />
            {busy ? "…" : t("admin.lyrics.upload")}
          </button>
        </div>

        {result && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 size={16} />
            {t("admin.lyrics.success", { count: result.lines.length })}
          </p>
        )}
        {error && (
          <p className="flex items-center gap-2 text-sm text-rose">
            <AlertCircle size={16} />
            {error}
          </p>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <FileText size={14} />
        {t("admin.lyrics.hint")}
      </p>
    </main>
  );
}
