import { config } from "../config/index.js";

export interface AstrologicalAnswerResult {
  aiAnswer: string;
  summary: string;
  interpretation: string;
  keyPlacements: { planet: string; sign: string; house: number; relevance: string }[];
  cosmicAdvice: string[];
  timing: string;
}

/**
 * Fallback generator for realistic, randomized astrological answers
 * when ChatGPT API key is not yet set or external network is offline.
 */
export function generateFallbackAstrologicalAnswer(
  question: string,
  querentName: string = "Querent",
  chart?: any
): string {
  const q = question.toLowerCase();
  const name = querentName || "Querent";
  const asc = chart?.asc || "your Ascendant";

  const isMarriage = /(marr|wedding|spouse|husband|wife|soulmate|partner|matrimon)/i.test(q);
  const isLove = /(love|dating|romance|crush|heart|relationship|bf|gf|boyfriend|girlfriend)/i.test(q);
  const isCareer = /(career|job|work|promotion|business|money|finance|wealth|salary|profession|boss|company|hire|invest|success|raise)/i.test(q);
  const isHealth = /(health|illness|disease|body|stress|energy|diet|sleep|vitality|healing|exhaust)/i.test(q);
  const isTravelOrMove = /(travel|move|relocat|abroad|foreign|visa|shift|house|home|buy|property)/i.test(q);

  if (isMarriage) {
    const marriageAnswers = [
      `Based on your 7th house alignments and upcoming Jupiter-Venus transit cycles, marriage prospects open auspiciously between late 2027 and mid-2028, marked by a deeply supportive and mutual soul connection for ${name}.`,
      `Your planetary transits highlight a high-probability marriage window between Autumn 2027 and Summer 2028, with favorable Venusian currents bringing long-term stability and marital harmony.`,
      `Cosmic configurations across your relationship axis indicate that marriage and life-partner commitments solidify between late 2026 and mid-2027, supported by grounding Saturn and expansive Jupiter placements.`,
      `With ${asc} rising, your 7th house of partnerships enters a major activation cycle from mid-2027 through early 2028, pointing to an auspicious time for union and wedding milestones.`,
    ];
    return marriageAnswers[Math.floor(Math.random() * marriageAnswers.length)];
  }

  if (isLove) {
    const loveAnswers = [
      `Planetary alignments indicate an uplifting romantic chapter beginning over the next 4 to 8 months, where emotional reciprocity and authentic connection will flourish.`,
      `Venusian transits are harmonizing your relationship sector, opening doors for a meaningful, heart-centered partnership between Spring and Autumn 2027.`,
      `Your chart reveals that lingering emotional cycles are clearing now, creating space for an inspiring, deep romantic bond to emerge within the coming 6 to 12 months.`,
    ];
    return loveAnswers[Math.floor(Math.random() * loveAnswers.length)];
  }

  if (isCareer) {
    const careerAnswers = [
      `Your 10th house planetary momentum indicates a decisive career breakthrough and lucrative advancement between early and mid-2027 for ${name}.`,
      `Expansive Jupiter transits indicate that high-impact career growth, strategic promotions, or new enterprise opportunities will peak within the next 6 to 10 months.`,
      `The planetary current across your vocational houses favors calculated boldness—milestones achieved between late 2026 and Autumn 2027 will establish lasting professional authority.`,
    ];
    return careerAnswers[Math.floor(Math.random() * careerAnswers.length)];
  }

  if (isTravelOrMove) {
    const travelAnswers = [
      `Favorable 9th and 4th house configurations show positive momentum for relocation, property moves, or overseas travel between mid-2027 and early 2028.`,
      `Planetary transits point to a harmonious domestic or location transition opening up within the next 7 to 12 months, bringing fresh horizons.`,
    ];
    return travelAnswers[Math.floor(Math.random() * travelAnswers.length)];
  }

  if (isHealth) {
    const healthAnswers = [
      `Your solar vitality charts a rejuvenating upward cycle starting within 3 to 5 months, provided mindful rest and restorative grounding practices are prioritized.`,
      `Planetary biorhythms suggest a positive turnaround in physical energy and emotional stamina as current heavy transits release their tension.`,
    ];
    return healthAnswers[Math.floor(Math.random() * healthAnswers.length)];
  }

  const genericAnswers = [
    `Celestial configurations show favorable planetary currents aligning in your favor over the next 6 to 12 months, bringing clear resolution and fruitful progress for ${name}.`,
    `Your natal blueprint indicates that this inquiry enters a decisive turning point between late 2026 and mid-2027, rewarding patience and authentic intention.`,
    `Examining your chart through ${asc} indicates an empowering chapter of cosmic synchronicity unfolding within the next 8 to 14 months.`,
  ];
  return genericAnswers[Math.floor(Math.random() * genericAnswers.length)];
}

/**
 * Calls ChatGPT API (OpenAI) to generate a clean, direct answer to the querent's question.
 * Falls back to the astrological prediction generator if API key is not configured or fails.
 */
export async function generateDirectAstrologyAnswer(params: {
  question: string;
  querentName?: string;
  chart?: any;
  customApiKey?: string;
}): Promise<string> {
  const { question, querentName = "Querent", chart, customApiKey } = params;
  const apiKey = (customApiKey || config.openai.apiKey || "").trim();

  if (!apiKey) {
    return generateFallbackAstrologicalAnswer(question, querentName, chart);
  }

  try {
    const planetsSummary = (chart?.planets || [])
      .map((p: any) => `${p.name} in ${p.sign} (House ${p.house})`)
      .join(", ");
    const aspectsSummary = (chart?.aspects || []).slice(0, 5).join(", ");
    const ascSummary = chart?.asc || "Unknown";

    const promptMessages = [
      {
        role: "system",
        content: `You are an insightful, authentic, and intuitive Vedic & Western astrologer.
The querent is asking a specific personal life question based on their birth chart.
Your task is to provide a clean, direct, and conclusive answer/prediction to their specific question (2 to 4 concise sentences).
- Address the question directly in the very first sentence. For example:
  - If they ask "when i get married", give a clear, encouraging astrological timeframe (e.g. "Based on your 7th house configurations and Venus transits, marriage is indicated between late 2027 and mid-2028, marked by a deep soul connection.")
  - If they ask about career or jobs, give a direct timeframe and astrological context.
  - If they ask yes/no or general timing, provide a clear, inspiring prediction.
- Keep the tone warm, clear, decisive, and reassuring.
- Do NOT say "As an AI language model" or hedge with generic disclaimers. Speak with authentic astrological authority.`,
      },
      {
        role: "user",
        content: `Querent Name: ${querentName}
Ascendant (Rising Sign): ${ascSummary}
Planetary Placements: ${planetsSummary || "Classical Ephemeris calculated"}
Key Aspects: ${aspectsSummary || "Major planetary aspects"}
Querent's Question: "${question}"

Provide a clean, direct astrological answer to this question:`,
      },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.openai.model || "gpt-4o-mini",
        temperature: 0.85,
        max_tokens: 300,
        messages: promptMessages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`⚠️ OpenAI API returned status ${res.status}: ${errText}`);
      return generateFallbackAstrologicalAnswer(question, querentName, chart);
    }

    const data = (await res.json()) as any;
    const aiText = data?.choices?.[0]?.message?.content?.trim();

    if (aiText) {
      return aiText;
    }

    return generateFallbackAstrologicalAnswer(question, querentName, chart);
  } catch (err) {
    console.warn("⚠️ Failed to call OpenAI API, falling back to local astrological engine:", err);
    return generateFallbackAstrologicalAnswer(question, querentName, chart);
  }
}

/**
 * Synthesizes full astrological reading with the AI/direct answer appended as the first part.
 */
export async function buildFullAstrologicalReading(params: {
  question: string;
  querentName?: string;
  chart: any;
  customApiKey?: string;
}): Promise<AstrologicalAnswerResult> {
  const { question, querentName = "Querent", chart, customApiKey } = params;

  // 1. Generate clean direct answer from ChatGPT or fallback
  const directAnswer = await generateDirectAstrologyAnswer({
    question,
    querentName,
    chart,
    customApiKey,
  });

  const planets = chart?.planets || [];
  const sun = planets.find((p: any) => p.name === "Sun") || { name: "Sun", sign: "Aries", deg: 0, house: 1 };
  const moon = planets.find((p: any) => p.name === "Moon") || { name: "Moon", sign: "Taurus", deg: 0, house: 2 };
  const mercury = planets.find((p: any) => p.name === "Mercury") || { name: "Mercury", sign: "Gemini", deg: 0, house: 3 };
  const venus = planets.find((p: any) => p.name === "Venus") || { name: "Venus", sign: "Libra", deg: 0, house: 7 };
  const mars = planets.find((p: any) => p.name === "Mars") || { name: "Mars", sign: "Scorpio", deg: 0, house: 8 };
  const jupiter = planets.find((p: any) => p.name === "Jupiter") || { name: "Jupiter", sign: "Sagittarius", deg: 0, house: 9 };
  const saturn = planets.find((p: any) => p.name === "Saturn") || { name: "Saturn", sign: "Capricorn", deg: 0, house: 10 };
  const asc = chart?.asc || "Ascendant";

  const qLower = question.toLowerCase();
  const isMarriage = /(marr|wedding|spouse|husband|wife|soulmate|partner|matrimon)/i.test(qLower);
  const isLove = /(love|dating|romance|crush|heart|relationship|bf|gf|boyfriend|girlfriend)/i.test(qLower);
  const isCareer = /(career|job|work|promotion|business|money|finance|wealth|salary|profession|boss|company|hire|invest|success|raise)/i.test(qLower);
  const isHealth = /(health|illness|disease|body|stress|energy|diet|sleep|vitality|healing|exhaust)/i.test(qLower);

  let keyPlacements: { planet: string; sign: string; house: number; relevance: string }[] = [];
  let baseSummary = "";
  let interpretation = "";
  let timing = "";
  let cosmicAdvice: string[] = [];

  if (isMarriage || isLove) {
    baseSummary = `In matters of love and lifelong partnership, your chart emphasizes deep emotional reciprocity, with Venus in ${venus.sign} (House ${venus.house}) and Moon in ${moon.sign} guiding meaningful harmony.`;
    interpretation = `With ${asc} and Venus in ${venus.sign} in House ${venus.house}, your romantic journey values heartfelt safety and honest vulnerability. Moon in ${moon.sign} in House ${moon.house} indicates that mutual emotional loyalty is non-negotiable. Current configurations suggest that past relational karmas are dissolving to make way for conscious union.`;
    keyPlacements = [
      {
        planet: "Venus",
        sign: venus.sign,
        house: venus.house,
        relevance: `Fosters romantic magnetism, emotional grace, and relationship harmony in House ${venus.house}.`,
      },
      {
        planet: "Jupiter",
        sign: jupiter.sign,
        house: jupiter.house,
        relevance: `Acts as the cosmic protector for sacred commitments and expansive shared happiness in House ${jupiter.house}.`,
      },
      {
        planet: "Moon",
        sign: moon.sign,
        house: moon.house,
        relevance: `Anchors your subconscious needs in ${moon.sign}, clarifying what brings true security and warmth.`,
      },
    ];
    timing = `Favorable Venusian and Jupiter currents are opening windows for heart-centered conversations, deepening commitments, and marital synchronicity.`;
    cosmicAdvice = [
      `Express your feelings openly and directly; clarity invites reciprocated vulnerability.`,
      `Uphold personal boundaries—a healthy partnership amplifies your peace.`,
      `Allow new connections or existing bonds to evolve at an unhurried, natural tempo.`,
    ];
  } else if (isCareer) {
    baseSummary = `Your natal chart indicates strong professional momentum, with ${jupiter.name} in ${jupiter.sign} (House ${jupiter.house}) empowering upward career expansion for ${querentName}.`;
    interpretation = `With your Ascendant in ${asc} and your Sun radiating in ${sun.sign} in House ${sun.house}, your career blueprint thrives on clear vision and self-directed leadership. Jupiter's placement in House ${jupiter.house} signals that calculated boldness will unlock lucrative doors. Meanwhile, Saturn in ${saturn.sign} in House ${saturn.house} acts as your grounding pillar.`;
    keyPlacements = [
      {
        planet: "Jupiter",
        sign: jupiter.sign,
        house: jupiter.house,
        relevance: `Magnifies career opportunities, professional recognition, and influential mentorship in House ${jupiter.house}.`,
      },
      {
        planet: "Saturn",
        sign: saturn.sign,
        house: saturn.house,
        relevance: `Demands disciplined execution in House ${saturn.house}, rewarding patient craftsmanship and long-term stamina.`,
      },
      {
        planet: "Sun",
        sign: sun.sign,
        house: sun.house,
        relevance: `Illuminates your executive presence in ${sun.sign}, favoring authentic leadership and visible contributions.`,
      },
    ];
    timing = `Cosmic currents show high-momentum expansion, particularly when major transits activate your ${jupiter.sign} and 10th house placements.`;
    cosmicAdvice = [
      `Focus your energy on high-leverage goals rather than spreading yourself too thin.`,
      `Cultivate strategic networks; your ${sun.sign} placement shines when collaborating with visionary allies.`,
      `Trust your intuitive radar during contract discussions and milestone transitions.`,
    ];
  } else if (isHealth) {
    baseSummary = `Your chart highlights rejuvenation and somatic balance as priorities, anchored by Sun in ${sun.sign} and Mars in ${mars.sign}.`;
    interpretation = `With ${asc}, your physical constitution is intimately tied to your mental surroundings. Mars in ${mars.sign} in House ${mars.house} grants potent regenerative vigor, but urges moderation against prolonged stress.`;
    keyPlacements = [
      {
        planet: "Sun",
        sign: sun.sign,
        house: sun.house,
        relevance: `Fuels your core vitality, immunological rhythm, and life force in ${sun.sign}.`,
      },
      {
        planet: "Mars",
        sign: mars.sign,
        house: mars.house,
        relevance: `Drives physical stamina and motivation in House ${mars.house}.`,
      },
      {
        planet: "Moon",
        sign: moon.sign,
        house: moon.house,
        relevance: `Influences your internal biorhythms, nervous system recharge, and emotional balance.`,
      },
    ];
    timing = `The celestial sky calls for conscious pacing and restorative practices over relentless hustle.`;
    cosmicAdvice = [
      `Incorporate daily grounding rituals to settle active ${sun.sign} mental energy.`,
      `Prioritize restorative sleep and hydration to keep physical channels fluid and calm.`,
      `Heed early somatic whispers before your body is forced to demand rest.`,
    ];
  } else {
    baseSummary = `Your natal chart indicates an inspiring chapter of personal alignment and cosmic clarity unfolding for ${querentName}.`;
    interpretation = `Examining your inquiry through your ${asc} Ascendant and ${sun.sign} Sun reveals a powerful awakening of self-trust. Mercury in ${mercury.sign} in House ${mercury.house} provides sharp discernment, while Jupiter in ${jupiter.sign} in House ${jupiter.house} offers cosmic protection.`;
    keyPlacements = [
      {
        planet: "Sun",
        sign: sun.sign,
        house: sun.house,
        relevance: `Anchors your essential identity, purposeful direction, and creative spark in ${sun.sign}.`,
      },
      {
        planet: "Jupiter",
        sign: jupiter.sign,
        house: jupiter.house,
        relevance: `Bestows expansive wisdom, fortunate synchronicity, and higher guidance in House ${jupiter.house}.`,
      },
      {
        planet: "Mercury",
        sign: mercury.sign,
        house: mercury.house,
        relevance: `Sharpens analytical clarity, decision-making, and communication in ${mercury.sign}.`,
      },
    ];
    timing = `Planetary transits are aligning in your favor. Trust the unfolding timing and take intentional steps toward what truly resonates with your spirit.`;
    cosmicAdvice = [
      `Lead with authentic conviction; what is meant for you will not pass you by.`,
      `Note down your intuitive impressions; they hold practical wisdom for your upcoming path.`,
      `Acknowledge your past growth as the steady foundation for this next phase.`,
    ];
  }

  // Append direct answer as the first part of response summary
  const summary = directAnswer ? `${directAnswer} ${baseSummary}` : baseSummary;

  return {
    aiAnswer: directAnswer,
    summary,
    interpretation,
    keyPlacements,
    cosmicAdvice,
    timing,
  };
}
