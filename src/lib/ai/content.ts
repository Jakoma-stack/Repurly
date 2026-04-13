export type ContentDraft = {
  title: string;
  body: string;
  hashtags: string[];
  titleHint: string;
  callToAction: string;
};

export type GenerateContentDraftsArgs = {
  brandName: string;
  brandTone?: string | null;
  audience?: string | null;
  primaryCta?: string | null;
  secondaryCta?: string | null;
  hashtags?: string[] | null;
  brief: string;
  postFormat?: string | null;
  commercialGoal?: string | null;
  cadence?: string | null;
  preferredTimeOfDay?: string | null;
  campaignType?: string | null;
  audienceFocus?: string | null;
  messageAngle?: string | null;
  proofPoints?: string | null;
  avoidTopics?: string | null;
  count?: number;
};

const TITLE_MAX_LENGTH = 150;
const BODY_MAX_LENGTH = 5000;
const TITLE_HINT_MAX_LENGTH = 120;
const CTA_MAX_LENGTH = 140;
const HASHTAG_LIMIT = 5;

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function parseHashtags(input?: string[] | null) {
  return unique((input ?? []).map((item) => item.replace(/^#/, "").trim()).filter(Boolean));
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseLines(input?: string | null) {
  return unique(
    String(input ?? "")
      .split(/\n|•|-/)
      .map((item) => cleanSentence(item))
      .filter(Boolean),
  );
}

function trimTo(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trim()}...`;
}

function summarizeBrief(brief: string) {
  const normalized = brief
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? normalized;
  const summary = cleanSentence(firstSentence).replace(/^write\s+/i, "").replace(/^create\s+/i, "");

  if (!summary) {
    return "Stay tightly aligned to the selected campaign, audience, and message angle.";
  }

  return summary.length > 240 ? `${summary.slice(0, 237).trim()}...` : summary;
}

function stripMetaLines(body: string) {
  return body
    .split("\n")
    .filter((line) => !/^(tone|audience|title hint|format|campaign type|message angle)\s*:/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDraft(draft: Partial<ContentDraft> | null | undefined, args: GenerateContentDraftsArgs, index: number): ContentDraft {
  const hashtags = unique([
    ...parseHashtags(args.hashtags),
    ...((draft?.hashtags ?? []).map((tag) => String(tag ?? "").replace(/^#/, "").trim()).filter(Boolean)),
  ]).slice(0, HASHTAG_LIMIT);

  const callToAction = trimTo(
    draft?.callToAction?.trim() || args.primaryCta?.trim() || "Request a proposal.",
    CTA_MAX_LENGTH,
  );

  const title = trimTo(
    draft?.title?.trim() || `${args.brandName} LinkedIn draft ${index + 1}`,
    TITLE_MAX_LENGTH,
  );

  const titleHint = trimTo(
    draft?.titleHint?.trim() ||
      `${(args.campaignType || "campaign").trim()} · ${(args.commercialGoal || "campaign goal").trim()} · ${(args.postFormat || "text").trim()}`,
    TITLE_HINT_MAX_LENGTH,
  );

  const rawBody = draft?.body?.trim();
  const body = trimTo(
    stripMetaLines(
      rawBody ||
        [
          `Campaign: ${args.campaignType || "thought leadership"}`,
          `Audience: ${args.audienceFocus || args.audience || "B2B leaders"}`,
          "",
          summarizeBrief(args.brief),
          "",
          callToAction,
          "",
          hashtags.map((tag) => `#${tag}`).join(" "),
        ]
          .filter(Boolean)
          .join("\n"),
    ),
    BODY_MAX_LENGTH,
  );

  return {
    title,
    body,
    hashtags,
    titleHint,
    callToAction,
  };
}

function readOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const direct = (payload as { output_text?: unknown }).output_text;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const output = (payload as { output?: Array<{ content?: Array<{ text?: string; type?: string }> }> }).output;
  if (!Array.isArray(output)) return null;

  const text = output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((item) => item?.type === "output_text" || typeof item?.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("");

  return text || null;
}

function campaignAngleSet(args: GenerateContentDraftsArgs) {
  const type = (args.campaignType || "").toLowerCase();
  const angle = cleanSentence(args.messageAngle || summarizeBrief(args.brief));
  const proofPoints = parseLines(args.proofPoints);
  const proofBlock = proofPoints.length ? proofPoints.join("; ") : "Use the concrete proof points in the brief.";

  if (type.includes("pain")) {
    return [
      {
        title: `${args.brandName}: the hidden cost behind the problem`,
        opener: `The visible problem is rarely the real problem for ${args.audienceFocus || args.audience || "this audience"}.`,
        middle: `${angle} Show why the pain compounds over time and where leaders usually underestimate the risk.`,
        closer: `Anchor the post in practical consequences and use proof such as: ${proofBlock}`,
      },
      {
        title: `${args.brandName}: what buyers usually misdiagnose`,
        opener: `A lot of teams describe the symptom, not the root cause.`,
        middle: `${angle} Explain what gets misdiagnosed and what a stronger operating choice looks like.`,
        closer: `Use a practical, governance-aware tone and keep the argument specific to this campaign.`,
      },
      {
        title: `${args.brandName}: the practical fix`,
        opener: `The answer is not usually more activity. It is a better decision pattern.`,
        middle: `${angle} Show one concrete practical change this audience can make now.`,
        closer: `Close with a commercially realistic next step tied to this campaign only.`,
      },
    ];
  }

  if (type.includes("proof")) {
    return [
      {
        title: `${args.brandName}: what credibility looks like in practice`,
        opener: `Credibility is built by delivery discipline, not by louder claims.`,
        middle: `${angle} Use proof points such as: ${proofBlock}`,
        closer: `Turn the proof into a clear reason to trust the approach.`,
      },
      {
        title: `${args.brandName}: why evidence matters`,
        opener: `Senior buyers want proof they can defend internally.`,
        middle: `${angle} Show what evidence, proof, or specifics matter most for this audience.`,
        closer: `Keep the message grounded, credible, and commercially clear.`,
      },
      {
        title: `${args.brandName}: a proof-led point of view`,
        opener: `The strongest positioning is usually the easiest positioning to evidence.`,
        middle: `${angle} Tie the post to practical examples or differentiators rather than abstract claims.`,
        closer: `Keep the CTA light but commercially relevant.`,
      },
    ];
  }

  if (type.includes("conversion")) {
    return [
      {
        title: `${args.brandName}: when this becomes commercially urgent`,
        opener: `Some problems stay theoretical until they begin to slow decisions, delivery, or revenue.`,
        middle: `${angle} Explain why this campaign matters now for ${args.audienceFocus || args.audience || "the target audience"}.`,
        closer: `Make the close commercially direct without becoming salesy.`,
      },
      {
        title: `${args.brandName}: what decision-makers need confidence in`,
        opener: `The real buying hurdle is usually confidence, not awareness.`,
        middle: `${angle} Show what a buyer needs to believe before taking the next step.`,
        closer: `Use proof points such as: ${proofBlock}`,
      },
      {
        title: `${args.brandName}: why external support can be the smarter move`,
        opener: `Hiring is not always the fastest or lowest-risk path.`,
        middle: `${angle} Show why the right external support can reduce delay, admin, or risk for this audience.`,
        closer: `Keep the CTA aligned to the chosen commercial goal.`,
      },
    ];
  }

  // default thought leadership / POV / educational mix
  return [
    {
      title: `${args.brandName}: a point of view for ${args.audienceFocus || args.audience || "senior buyers"}`,
      opener: `A useful point of view should make a difficult decision clearer, not louder.`,
      middle: `${angle} Give a senior, governance-aware argument tailored to this audience.`,
      closer: `Use proof points such as: ${proofBlock}`,
    },
    {
      title: `${args.brandName}: the practical lesson`,
      opener: `The most valuable lesson is usually the one that changes how a team actually operates.`,
      middle: `${angle} Turn the campaign into one practical lesson for this audience.`,
      closer: `Keep the recommendation concrete and commercially realistic.`,
    },
    {
      title: `${args.brandName}: the strategic reason this matters now`,
      opener: `Senior leaders rarely need more noise. They need clearer trade-offs.`,
      middle: `${angle} Explain why this issue matters strategically now and what better judgment looks like.`,
      closer: `Close with a relevant, restrained CTA.`,
    },
  ];
}

function buildFallbackDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  const count = Math.max(1, Math.min(args.count ?? 3, 6));
  const hashtags = parseHashtags(args.hashtags);
  const cta = args.primaryCta?.trim() || "Request a proposal.";
  const audience = args.audienceFocus?.trim() || args.audience?.trim() || "B2B leaders";
  const goal = args.commercialGoal?.trim() || "drive a qualified next step";
  const format = args.postFormat?.trim() || "text";
  const cadence = args.cadence?.trim() || "weekly";
  const preferredTimeOfDay = args.preferredTimeOfDay?.trim() || "morning";
  const briefSummary = summarizeBrief(args.brief);
  const proofPoints = parseLines(args.proofPoints);
  const avoidTopics = parseLines(args.avoidTopics);
  const angles = campaignAngleSet(args);

  return Array.from({ length: count }, (_, index) => {
    const pattern = angles[index % angles.length];
    const finalHashtags = unique([...(hashtags.length ? hashtags : ["linkedin", "b2b"]), args.brandName.replace(/\s+/g, "").toLowerCase()])
      .slice(0, HASHTAG_LIMIT);

    const proofSentence = proofPoints.length
      ? `Use specifics like ${proofPoints.slice(0, 3).join(", ")}.`
      : "Use concrete detail from the selected campaign brief.";
    const avoidSentence = avoidTopics.length
      ? `Avoid drifting into: ${avoidTopics.slice(0, 4).join(", ")}.`
      : "Do not drift outside the selected campaign.";

    return normalizeDraft(
      {
        title: pattern.title,
        titleHint: `${goal} · ${args.campaignType || "campaign"} · ${cadence} · ${preferredTimeOfDay} (${format})`,
        callToAction: cta,
        hashtags: finalHashtags,
        body: [
          pattern.opener,
          "",
          pattern.middle,
          "",
          briefSummary,
          "",
          proofSentence,
          avoidSentence,
          "",
          pattern.closer,
          "",
          cta,
          "",
          finalHashtags.map((tag) => `#${tag}`).join(" "),
        ].join("\n"),
      },
      args,
      index,
    );
  });
}

export function buildFallbackContentDrafts(args: GenerateContentDraftsArgs): ContentDraft[] {
  return buildFallbackDrafts(args);
}

async function generateWithOpenAi(args: GenerateContentDraftsArgs): Promise<ContentDraft[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const count = Math.max(1, Math.min(args.count ?? 3, 6));
  const briefSummary = summarizeBrief(args.brief);
  const prompt = [
    `You are writing LinkedIn-first B2B posts for ${args.brandName}.`,
    'Return strict JSON with the shape {"drafts":[{"title":"","body":"","hashtags":[""],"titleHint":"","callToAction":""}]}',
    'Use the selected campaign as the primary source of truth. The brief is not optional context; it is the controlling brief.',
    'Use only the selected brand context for tone, CTA, audience, positioning, and examples.',
    'Never mention, blend, or echo any other brand, product, workspace, or company unless the brief explicitly asks for it.',
    'Never drift into generic workflow or generic content-marketing messaging unless the chosen campaign specifically requires that angle.',
    'The three drafts must be three different angles inside one campaign lane:',
    'Draft 1 = authority / point of view',
    'Draft 2 = practical lesson / operational implication',
    'Draft 3 = strategic buyer-confidence or external-support angle',
    'If more drafts are requested, continue adding clearly distinct angles without repeating the first three patterns.',
    'Do not paste the brief verbatim into the body.',
    'Do not write generic filler such as "we need more content" unless the campaign explicitly asks for it.',
    'Do not use hype or generic agency phrasing.',
    'Keep the CTA aligned to the selected brand and selected campaign only.',
    'Never include internal labels like Tone:, Audience:, Format:, Campaign type:, or Title Hint: in the post body.',
    'Build the posts for this audience and message angle, not for the workspace in general.',
    `Brand: ${args.brandName}`,
    `Tone: ${args.brandTone ?? "clear, sharp, commercially realistic"}`,
    `Audience: ${args.audience ?? "B2B teams"}`,
    `Primary CTA: ${args.primaryCta ?? ""}`,
    `Secondary CTA: ${args.secondaryCta ?? ""}`,
    `Hashtags: ${(args.hashtags ?? []).join(", ")}`,
    `Commercial goal: ${args.commercialGoal ?? ""}`,
    `Preferred format: ${args.postFormat ?? "text"}`,
    `Planning cadence: ${args.cadence ?? "weekly"}`,
    `Preferred time of day: ${args.preferredTimeOfDay ?? "morning"}`,
    `Campaign type: ${args.campaignType ?? ""}`,
    `Audience focus: ${args.audienceFocus ?? ""}`,
    `Message angle: ${args.messageAngle ?? ""}`,
    `Proof points: ${args.proofPoints ?? ""}`,
    `Avoid topics: ${args.avoidTopics ?? ""}`,
    `Campaign brief summary: ${briefSummary}`,
    `Full brief: ${args.brief}`,
    `Draft count: ${count}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "repurly_content_drafts",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                drafts: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      body: { type: "string" },
                      hashtags: { type: "array", items: { type: "string" } },
                      titleHint: { type: "string" },
                      callToAction: { type: "string" },
                    },
                    required: ["title", "body", "hashtags", "titleHint", "callToAction"],
                  },
                },
              },
              required: ["drafts"],
            },
          },
        },
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const outputText = readOutputText(payload);
    if (!outputText) return null;

    const parsed = JSON.parse(outputText) as { drafts?: Array<Partial<ContentDraft>> };
    if (!parsed.drafts?.length) return null;

    return parsed.drafts.slice(0, count).map((draft, index) => normalizeDraft(draft, args, index));
  } catch {
    return null;
  }
}

export async function generateContentDrafts(args: GenerateContentDraftsArgs): Promise<ContentDraft[]> {
  const aiDrafts = await generateWithOpenAi(args);
  if (aiDrafts?.length) return aiDrafts;
  return buildFallbackDrafts(args);
}
