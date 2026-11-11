// Helpers for playing a manual back in the browser (step player).

// The video clips of a step, in timeline order, with a playable URL (public file when we know it).
export function getStepClips(step) {
  return (step?.edit?.timeline?.tracks || [])
    .flatMap((track) => track?.clips || [])
    .filter((clip) => clip?.asset?.type === "video" && Number.isFinite(Number(clip.start)) && Number.isFinite(Number(clip.length)))
    .map((clip) => ({
      src: step.assetSourceMap?.[clip.asset.src] || clip.asset.src,
      trim: Number(clip.asset.trim) || 0,
      start: Number(clip.start),
      end: Number(clip.start) + Number(clip.length),
    }))
    .sort((a, b) => a.start - b.start);
}

// Steps (project.steps) or, for a single-timeline project, one pseudo step built from its edit + per-clip descriptions.
export function getPlayableSteps(project) {
  if (project?.structure === "steps") return Array.isArray(project.steps) ? project.steps : [];
  if (!project?.edit) return [];
  const probe = { edit: project.edit, assetSourceMap: project.assetSourceMap || {} };
  const clips = getStepClips(probe);
  const subtitles = (project.settings?.stepDescriptions || [])
    .map((entry, index) => {
      const clip = clips.find((item) => Math.abs(item.start - Number(entry.start)) < 0.15);
      return clip && String(entry.description || "").trim() ? { id: `d${index}`, start: clip.start, end: clip.end, text: entry.description } : null;
    })
    .filter(Boolean);
  return [{ id: "project", title: project.title || "", ...probe, subtitles }];
}
