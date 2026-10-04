function key(start, text) { return `${Number(start).toFixed(3)}|${String(text).trim().replace(/\s+/g, ' ')}`; }

export function attachStudyNotes(cues, notes) {
  if (!Array.isArray(notes?.entries)) return cues;
  const entries = new Map(notes.entries.map(note => [key(note.start, note.sourceText), note]));
  return cues.map(cue => {
    const note = entries.get(key(cue.start, cue.text));
    // Match both source text and time: a refreshed or imported caption must not
    // silently inherit an annotation written for a different lyric.
    if (!note?.ipa || !note?.ear || !note?.meaning) return cue;
    return { ...cue, displayText: note.displayText || cue.text, ipa: note.ipa, ear: note.ear, studyMeaning: note.meaning, kind: note.kind || 'lyric', reviewNote: note.reviewNote || '' };
  });
}
