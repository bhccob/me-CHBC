/**
 * The questions' words on a phone, shared by the 3D (world/void/Questions.ts) and the page (ui/journey/QaWords.tsx). A phone's
 * canvas draws one pixel to each of the page's (journey/quality.ts), a third of what its screen shows, so words drawn into it
 * come out soft; type set by the page over the 3D is sharp at any pixel ratio. Free of three, so the page can read it before
 * three.js has arrived.
 */

/** The pixels to a unit of the world the plates are drawn at. */
export const PPU_BIG = 400;
export const PPU_SMALL = 560;
/** A phone's question, answer and answer line, in the plates' pixels. */
export const PHONE_BIG = 118;
export const PHONE_SMALL = 84;
export const PHONE_LINE = 110;

/** The phone's type as the plates draw it, in units of the world, so that the page sets it the same size. */
export const PHONE_TYPE = {
  question: PHONE_BIG / PPU_BIG,
  questionLine: 0.92,
  questionTracking: -3 / PHONE_BIG,
  answer: PHONE_SMALL / PPU_SMALL,
  answerLine: PHONE_LINE / PHONE_SMALL,
  /** How far in from the plate's edge the words start. */
  inset: 8 / PPU_BIG,
} as const;

/** One question's words where the page sets them this frame, in CSS px. The gear, its number and the leader stay in the 3D. */
export interface QuestionText {
  shown: boolean;
  /** The page's pixels to one unit of the world where the question stands: what the type is sized by. */
  unit: number;
  /** The width the words wrap at. */
  width: number;
  /** Each plate's top left corner on the page, its opacity, and how far it has swept in from the left, 0 to 1. */
  titleX: number;
  titleY: number;
  titleA: number;
  titleReveal: number;
  answerX: number;
  answerY: number;
  answerA: number;
  answerReveal: number;
}

export const noQuestionText = (): QuestionText => ({ shown: false, unit: 0, width: 0, titleX: 0, titleY: 0, titleA: 0, titleReveal: 0, answerX: 0, answerY: 0, answerA: 0, answerReveal: 0 });
