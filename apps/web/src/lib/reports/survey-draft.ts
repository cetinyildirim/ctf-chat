import type { SurveyQuestionStat, SurveyStatsDto } from '@sydt/shared';
import type { Locale } from '@/i18n/dict';
import type { PdfBlock } from './canvas-pdf';

export type ChartItem = { label: string; value: number };

export type ReportSection = {
  id: string;
  heading: string;
  /** Question text, shown apart from the analysis. */
  kicker?: string;
  /** Interpretation. Editable. */
  body: string;
  chart?: ChartItem[];
  answersLabel?: string;
  /** One response per line, kept apart from the analysis. */
  answers?: string;
  interpret?: boolean;
};

export type SurveyReportDraft = {
  title: string;
  meta: string;
  analysisLabel: string;
  sections: ReportSection[];
};

const STOP = new Set(
  've bir bu da de için ile çok daha olan olarak mı mi mu mü ne gibi kadar her ama veya ki en var yok değil ise diye hem hiç tüm bütün sonra önce ben biz siz onlar şu the and for that with this from are was were you your not'.split(
    ' ',
  ),
);

const copy = {
  tr: {
    title: (name: string) => `${name} — Anket Değerlendirme Raporu`,
    meta: (date: string) => `Oluşturulma: ${date} · SYDT`,
    analysis: 'Analiz',
    summary: '1. Özet',
    participation: '2. Katılım',
    conclusion: 'Sonuç ve değerlendirme',
    question: (n: number) => `Soru ${n}`,
    choices: 'Seçenek dağılımı',
    written: 'Yazılı yanıtlar',
    responded: 'Yanıtlayan',
    skipped: 'Yanıtlamayan',
    high: 'Katılım yüksek. Sonuçlar platformun geneli için temsil edici kabul edilebilir.',
    mid: 'Katılım orta düzeyde. Eğilim okunabilir; genelleme yaparken temkinli olunmalıdır.',
    low: 'Katılım düşük. Bulgular yalnızca yanıt verenlerin görüşünü yansıtır.',
    none: 'Bu anket için henüz yanıt yok. Yanıt geldikçe raporu yeniden oluşturun.',
    summaryIntro: (s: SurveyStatsDto, band: string) =>
      `«${s.title}» anketine ${s.eligibleUsers} uygun hesaptan ${s.totalResponses} kişi yanıt verdi. Katılım oranı %${s.responseRate}. ${band} Anket ${s.questions.length} sorudan oluşuyor.`,
    summaryEmptyQ: (n: number, text: string) => `Soru ${n} (${clip(text)}) yanıt almadı.`,
    summaryChoice: (n: number, text: string, option: string, pct: number) =>
      `Soru ${n} (${clip(text)}): öne çıkan seçenek «${option}» (%${pct}).`,
    summaryText: (n: number, text: string, count: number) =>
      `Soru ${n} (${clip(text)}): ${count} yazılı yanıt.`,
    participationNote:
      'Grafikteki sayılar, askıya alınmamış platform hesaplarına göredir. Yanıtlamayanlar ankete hiç girmemiş hesaplardır.',
    noAnswer: 'Bu soruya yanıt gelmedi. Dağılım veya tema çıkarılamadı.',
    concentrated: (label: string, count: number, pct: number) =>
      `Yanıtlar «${label}» seçeneğinde toplanıyor: ${count} işaret, pay %${pct}. Bu soruda belirgin bir çoğunluk var.`,
    close: (a: string, ap: number, b: string, bp: number) =>
      `«${a}» (%${ap}) ile «${b}» (%${bp}) birbirine yakın. Sonuç tek bir seçeneğe net üstünlük vermiyor.`,
    scattered: (label: string, pct: number) =>
      `En yüksek pay «${label}» (%${pct}), ancak oylar dağılmış durumda. Tek başına bir çoğunluk oluşmamış.`,
    tie: (labels: string, count: number, pct: number) =>
      `İlk sıra paylaşılmış: ${labels}. Her biri ${count} işaret (%${pct}). Görüş bu seçenekler arasında bölünmüş.`,
    notable: (list: string) => `Kayda değer diğer seçenekler: ${list}.`,
    unused: (list: string) => `Hiç işaretlenmeyen seçenekler: ${list}.`,
    blank: (n: number, pct: number) =>
      `Yanıtlayanların %${pct}'i (${n} kişi) bu soruyu boş bıraktı. Yorum, yanıt verenlerle sınırlı tutulmalı.`,
    multiAvg: (avg: string) =>
      `Çoklu seçim olduğu için bir kişi birden fazla seçenek işaretleyebildi. Kişi başına ortalama ${avg} işaret var. Yüzdeler kişi sayısına değil, toplam işaret sayısına göredir.`,
    textIntro: (n: number, avg: number) => `${n} yazılı yanıt incelendi. Ortalama uzunluk ${avg} karakter.`,
    frequent: (list: string) => `Birden fazla yanıtta geçen ifadeler: ${list}.`,
    textSamples: 'Ayrıntılı okuma için yanıtlar aşağıdaki kutudadır; analiz metnine karıştırılmadı.',
    conclusionBody:
      'Özet ve soru kartlarındaki analiz, kayıtlı dağılıma dayanır. Bu bölümü kurumun değerlendirmesi, kararı ve izleyen adımlarla değiştirin.',
  },
  en: {
    title: (name: string) => `${name} — Survey evaluation report`,
    meta: (date: string) => `Created: ${date} · SYDT`,
    analysis: 'Analysis',
    summary: '1. Summary',
    participation: '2. Participation',
    conclusion: 'Conclusion',
    question: (n: number) => `Question ${n}`,
    choices: 'Choice breakdown',
    written: 'Written answers',
    responded: 'Responded',
    skipped: 'Did not respond',
    high: 'Participation is high. The results can be treated as representative of the platform.',
    mid: 'Participation is moderate. A trend is visible and should be generalised with care.',
    low: 'Participation is low. Findings reflect only the people who responded.',
    none: 'This survey has no responses yet. Generate the report again once answers arrive.',
    summaryIntro: (s: SurveyStatsDto, band: string) =>
      `${s.totalResponses} of ${s.eligibleUsers} eligible accounts answered «${s.title}». Participation is ${s.responseRate}%. ${band} The survey has ${s.questions.length} questions.`,
    summaryEmptyQ: (n: number, text: string) => `Question ${n} (${clip(text)}) received no answers.`,
    summaryChoice: (n: number, text: string, option: string, pct: number) =>
      `Question ${n} (${clip(text)}): leading option «${option}» (${pct}%).`,
    summaryText: (n: number, text: string, count: number) =>
      `Question ${n} (${clip(text)}): ${count} written answers.`,
    participationNote:
      'The chart counts platform accounts that are not suspended. “Did not respond” means the account never submitted the survey.',
    noAnswer: 'This question received no answers, so no distribution or theme could be drawn.',
    concentrated: (label: string, count: number, pct: number) =>
      `Answers concentrate on «${label}»: ${count} selections, ${pct}%. This question has a clear majority.`,
    close: (a: string, ap: number, b: string, bp: number) =>
      `«${a}» (${ap}%) and «${b}» (${bp}%) are close. No single option has a clear lead.`,
    scattered: (label: string, pct: number) =>
      `The highest share is «${label}» (${pct}%), but the vote is spread out. There is no majority on its own.`,
    tie: (labels: string, count: number, pct: number) =>
      `The lead is shared: ${labels}. Each has ${count} selections (${pct}%). Opinion is split across these options.`,
    notable: (list: string) => `Other notable options: ${list}.`,
    unused: (list: string) => `Options with no selections: ${list}.`,
    blank: (n: number, pct: number) =>
      `${pct}% of respondents (${n} people) left this question blank. Read the result as limited to those who answered.`,
    multiAvg: (avg: string) =>
      `This is a multiple-choice question, so one person could select more than one option. The average is ${avg} selections per respondent. Percentages use the number of selections, not the number of people.`,
    textIntro: (n: number, avg: number) => `${n} written answers were reviewed. Average length is ${avg} characters.`,
    frequent: (list: string) => `Phrases that appear in more than one answer: ${list}.`,
    textSamples: 'The full answers sit in the box below and are kept out of this analysis.',
    conclusionBody:
      'The summary and each question card follow the recorded distribution. Replace this section with the organisation’s assessment, decision and next steps.',
  },
} as const;

export function draftSurveyReport(stats: SurveyStatsDto, locale: Locale): SurveyReportDraft {
  const c = copy[locale];
  const date = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());
  const band = stats.responseRate >= 70 ? c.high : stats.responseRate >= 40 ? c.mid : c.low;
  const skipped = Math.max(0, stats.eligibleUsers - stats.totalResponses);

  const sections: ReportSection[] = [
    {
      id: 'summary',
      heading: c.summary,
      body: stats.totalResponses === 0 ? c.none : [c.summaryIntro(stats, band), ...highlights(stats, c)].join('\n'),
    },
    {
      id: 'participation',
      heading: c.participation,
      body: c.participationNote,
      chart: [
        { label: c.responded, value: stats.totalResponses },
        { label: c.skipped, value: skipped },
      ],
    },
  ];

  stats.questions.forEach((question, index) => {
    sections.push(questionSection(question, index + 1, stats.totalResponses, c));
  });

  sections.push({ id: 'conclusion', heading: c.conclusion, body: c.conclusionBody });

  return { title: c.title(stats.title), meta: c.meta(date), analysisLabel: c.analysis, sections };
}

function highlights(stats: SurveyStatsDto, c: (typeof copy)[Locale]): string[] {
  return stats.questions.map((question, index) => {
    const n = index + 1;
    if (question.type === 'TEXT') {
      return c.summaryText(n, question.text, question.textAnswers.filter((answer) => answer.trim()).length);
    }
    const total = question.options.reduce((sum, option) => sum + option.count, 0);
    if (total === 0) return c.summaryEmptyQ(n, question.text);
    const top = [...question.options].sort((a, b) => b.count - a.count)[0]!;
    return c.summaryChoice(n, question.text, top.text, share(top.count, total));
  });
}

function questionSection(
  question: SurveyQuestionStat,
  index: number,
  totalResponses: number,
  c: (typeof copy)[Locale],
): ReportSection {
  if (question.type === 'TEXT') {
    const answers = question.textAnswers.map((answer) => answer.trim()).filter(Boolean);
    return {
      id: question.questionId,
      heading: c.question(index),
      kicker: question.text,
      interpret: true,
      body: analyzeText(answers, c),
      answersLabel: c.written,
      answers: answers.join('\n'),
    };
  }

  const total = question.options.reduce((sum, option) => sum + option.count, 0);
  const ranked = [...question.options].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'tr'));
  return {
    id: question.questionId,
    heading: c.question(index),
    kicker: question.text,
    interpret: true,
    body: analyzeChoice(question, ranked, total, totalResponses, c),
    chart: question.options.map((option) => ({ label: option.text, value: option.count })),
    answersLabel: c.choices,
    answers: ranked.map((option) => `${option.text} — ${option.count} (%${share(option.count, total)})`).join('\n'),
  };
}

function analyzeChoice(
  question: SurveyQuestionStat,
  ranked: SurveyQuestionStat['options'],
  total: number,
  totalResponses: number,
  c: (typeof copy)[Locale],
): string {
  if (total === 0) return c.noAnswer;
  const lines: string[] = [];
  const top = ranked[0]!;
  const topShare = share(top.count, total);
  const tied = ranked.filter((option) => option.count === top.count && option.count > 0);
  const second = ranked.find((option) => option.count < top.count && option.count > 0);

  if (tied.length > 1) lines.push(c.tie(tied.map((option) => `«${option.text}»`).join(', '), top.count, topShare));
  else if (second && topShare - share(second.count, total) <= 12) {
    lines.push(c.close(top.text, topShare, second.text, share(second.count, total)));
  } else if (topShare >= 55) lines.push(c.concentrated(top.text, top.count, topShare));
  else lines.push(c.scattered(top.text, topShare));

  const notable = ranked.filter((option) => option !== top && share(option.count, total) >= 15 && option.count < top.count);
  if (notable.length) {
    lines.push(c.notable(notable.map((option) => `«${option.text}» %${share(option.count, total)}`).join(', ')));
  }
  const unused = ranked.filter((option) => option.count === 0).map((option) => `«${option.text}»`);
  if (unused.length) lines.push(c.unused(unused.join(', ')));

  if (question.type === 'SINGLE') {
    const blank = Math.max(0, totalResponses - total);
    if (blank > 0 && totalResponses > 0) lines.push(c.blank(blank, share(blank, totalResponses)));
  } else if (totalResponses > 0) {
    lines.push(c.multiAvg((total / totalResponses).toFixed(1)));
  }
  return lines.join('\n');
}

function analyzeText(answers: string[], c: (typeof copy)[Locale]): string {
  if (!answers.length) return c.noAnswer;
  const avg = Math.round(answers.reduce((sum, answer) => sum + answer.length, 0) / answers.length);
  const lines = [c.textIntro(answers.length, avg)];
  const words = frequentWords(answers);
  if (words.length) lines.push(c.frequent(words.map((word) => `${word.word} (${word.n})`).join(', ')));
  lines.push(c.textSamples);
  return lines.join('\n');
}

function frequentWords(answers: string[]): { word: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    const seen = new Set<string>();
    for (const raw of answer.toLocaleLowerCase('tr').split(/[^a-z0-9çğıöşü]+/)) {
      if (raw.length < 4 || STOP.has(raw) || seen.has(raw)) continue;
      seen.add(raw);
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, n]) => ({ word, n }));
}

function share(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}

export function reportToPdfBlocks(draft: SurveyReportDraft): PdfBlock[] {
  const blocks: PdfBlock[] = [
    { kind: 'title', text: draft.title },
    { kind: 'meta', text: draft.meta },
  ];
  for (const section of draft.sections) {
    if (section.kicker) blocks.push({ kind: 'qhead', label: section.heading, text: section.kicker });
    else blocks.push({ kind: 'h2', text: section.heading });

    if (section.chart?.some((item) => item.value > 0)) blocks.push({ kind: 'chart', items: section.chart });

    const body = section.body.trim();
    if (body) {
      if (section.interpret) blocks.push({ kind: 'h3', text: draft.analysisLabel });
      for (const paragraph of body.split('\n')) {
        const text = paragraph.trim();
        if (text) blocks.push({ kind: 'p', text });
      }
    }

    const answers = section.answers?.trim();
    if (answers) {
      if (section.answersLabel) blocks.push({ kind: 'h3', text: section.answersLabel });
      blocks.push({ kind: 'answers', text: answers });
    }
  }
  return blocks;
}

export function reportFilename(title: string): string {
  const slug = title
    .toLocaleLowerCase('tr')
    .replace(/[^a-z0-9çğıöşü]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const day = new Date().toISOString().slice(0, 10);
  return `${slug || 'anket-raporu'}-${day}.pdf`;
}
