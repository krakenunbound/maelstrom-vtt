// FG's 5E level up through the character wizard: what the next level in a class brings (its features, a subclass
// to choose, an Ability Score Improvement or a feat) and the choices applied. The sheet's dialog and the host read the
// same plan: the host checks the choices against it.
import { classInfo } from "./wizard.mjs";
import { hitDie, SKILLS } from "./rules.mjs";

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null ? Number(value) : fallback);
const rows = (node) => Object.entries(node && typeof node === "object" ? node : {}).filter(([, value]) => value && typeof value === "object");
const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
const STATS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const featureLine = (feature, className) => `${feature.name} (${feature.subclass || className} ${feature.level})`;

/**
 * @param {Record<string, any>} data the character's
 * @param {{ classes: any[]; subclasses: any[]; feats: any[] }} lib the campaign's records
 * @param {string} [packageKey] a class package's key or a class's name (a new one: multiclass)
 */
export function levelUpPlan(data, lib, packageKey = "") {
  const classes = rows(data?.packages).filter(([, item]) => same(item.packagetype, "class"));
  const wanted = String(packageKey ?? "").trim();
  const owned = classes.find(([key, item]) => key === wanted || same(item.name, wanted)) ?? (wanted ? null : classes[0] ?? null);
  const className = owned ? String(owned[1].name) : wanted;
  const cls = (lib.classes ?? []).find((record) => same(record.name, className));
  if (!cls) return null;
  const classLevel = owned ? (classes.length > 1 ? Math.max(1, Math.round(num(owned[1].level, 1))) : Math.round(num(data.level, 1))) + 1 : 1;
  const subName = String(owned?.[1]?.subclass ?? (classes.length <= 1 ? data.subclass ?? "" : "")).trim();
  const subclass = subName ? (lib.subclasses ?? []).find((record) => same(record.name, subName)) : null;
  const info = classInfo(cls, classLevel, subclass);
  const levelOf = (id) => Number(/^class:[^:]+:(\d+)/.exec(String(id))?.[1] ?? 0);
  const decisions = (info?.decisions ?? []).filter((item) => levelOf(item.id) === classLevel);
  const has = (kind) => decisions.some((item) => item.type === kind);
  const featDecision = decisions.find((item) => item.type === "feat");
  const subclasses = !subclass && has("subclass") ? (lib.subclasses ?? []).filter((record) => same(record.data?.class, cls.name)).map((record) => String(record.name)) : null;
  const known = new Set((Array.isArray(data.features) ? data.features : []).map((line) => String(line).toLowerCase()));
  return {
    className: String(cls.name),
    key: owned ? owned[0] : null,
    classLevel,
    // A class taken for the first time: its own die.
    die: owned ? Math.round(num(owned[1].hitdie, num(data.hitdice?.die, 8))) : hitDie(cls),
    features: (info?.features ?? []).filter((feature) => feature.level === classLevel && !known.has(featureLine(feature, cls.name).toLowerCase())).map((feature) => ({ name: feature.name, level: feature.level, subclass: feature.subclass })),
    subclasses: subclasses && subclasses.length ? subclasses : null,
    asi: has("asiorfeat"),
    // Expertise: so many skills the character is proficient in, doubled.
    expertise: decisions.filter((item) => item.type === "expertise").length,
    skills: rows(data.skills).filter(([key, skill]) => SKILLS[key] && num(skill.prof) === 1).map(([key]) => ({ key, label: SKILLS[key][0] })),
    feat: featDecision ? String(featDecision.category ?? "") || "any" : null,
    // The feats to choose from: the level's own kind (Fighting Style, Epic Boon), else General ones (a book's feats with
    // no kind: all); the improvement itself is the scores' choice; one taken and not repeatable, not again.
    feats: (lib.feats ?? [])
      .filter((record) => {
        const kind = String(record.data?.category ?? "");
        const want = featDecision && featDecision.category ? String(featDecision.category) : "General";
        const taken = (Array.isArray(data.feats) ? data.feats : []).some((name) => same(name, record.name));
        return (!kind || same(kind, want)) && !same(record.name, "Ability Score Improvement") && !(taken && !num(record.data?.repeatable));
      })
      .map((record) => String(record.name)),
  };
}

/**
 * The choices put on the character's data after its level is raised (rules.levelUp): the level's features, a
 * subclass (and its features to this level), +2 to one score or +1 to two (to 20 at most), or a feat.
 * @param {Record<string, any>} data the data after the level up
 * @param {NonNullable<ReturnType<typeof levelUpPlan>>} plan the plan made before it
 * @param {{ subclass?: string; asi?: Record<string, number>; feat?: string; expertise?: string[] }} choices
 * @param {{ classes: any[]; subclasses: any[]; feats: any[] }} lib
 */
export function applyLevelUp(data, plan, choices = {}, lib) {
  const next = structuredClone(data);
  const cls = (lib.classes ?? []).find((record) => same(record.name, plan.className));
  const features = new Set((Array.isArray(next.features) ? next.features : []).map(String));
  for (const feature of plan.features) features.add(featureLine(feature, plan.className));
  if (choices.subclass) {
    if (!plan.subclasses?.some((name) => same(name, choices.subclass))) throw new Error(`${choices.subclass} is not a ${plan.className} subclass to choose now.`);
    const sub = (lib.subclasses ?? []).find((record) => same(record.name, choices.subclass));
    const key = Object.entries(next.packages ?? {}).find(([, item]) => same(item.packagetype, "class") && same(item.name, plan.className))?.[0];
    if (key) next.packages[key] = { ...next.packages[key], subclass: sub.name };
    if (rows(next.packages).filter(([, item]) => same(item.packagetype, "class")).length <= 1) next.subclass = sub.name;
    for (const feature of classInfo(cls, plan.classLevel, sub)?.features ?? []) if (feature.subclass && feature.level <= plan.classLevel) features.add(featureLine(feature, plan.className));
  }
  next.features = [...features];
  const increases = Object.entries(choices.asi ?? {}).filter(([, n]) => num(n) > 0);
  if (increases.length) {
    if (!plan.asi) throw new Error(`${plan.className} ${plan.classLevel} has no Ability Score Improvement.`);
    if (choices.feat) throw new Error("An Ability Score Improvement or a feat, not both.");
    const total = increases.reduce((sum, [, n]) => sum + num(n), 0);
    if (total !== 2 || increases.some(([stat, n]) => !STATS.includes(stat) || num(n) > 2)) throw new Error("+2 to one score or +1 to two.");
    for (const [stat, n] of increases) {
      const score = num(next.abilities?.[stat]?.score, 10) + num(n);
      if (score > 20) throw new Error(`${stat[0].toUpperCase()}${stat.slice(1)} would pass 20.`);
      next.abilities[stat] = { ...next.abilities[stat], score };
    }
  }
  const expert = [...new Set((Array.isArray(choices.expertise) ? choices.expertise : []).map(String))];
  if (expert.length) {
    if (expert.length > plan.expertise) throw new Error(`${plan.className} ${plan.classLevel} gives ${plan.expertise ? `expertise in ${plan.expertise}` : "no expertise"}.`);
    for (const key of expert) {
      if (!plan.skills.some((skill) => skill.key === key)) throw new Error(`Expertise needs a skill the character is proficient in (${key}).`);
      next.skills[key] = { ...next.skills[key], prof: 2 };
    }
  }
  if (choices.feat) {
    if (!plan.asi && !plan.feat) throw new Error(`${plan.className} ${plan.classLevel} gives no feat.`);
    const feat = (lib.feats ?? []).find((record) => same(record.name, choices.feat));
    if (!feat) throw new Error(`No feat ${choices.feat} in this campaign's books.`);
    if (!plan.feats.some((name) => same(name, feat.name))) throw new Error(`${feat.name} is not a feat to take at ${plan.className} ${plan.classLevel}.`);
    next.feats = [...new Set([...(Array.isArray(next.feats) ? next.feats : []), feat.name])];
  }
  return next;
}
