/* ------------------------------------------------------------------------------------------
   Everything you can edit on the site lives in this file, and only here.
   Text marked TODO is a placeholder that still needs a real value from Bob.
   After adding a new Chinese character anywhere, run `npm run fonts` once.
   ------------------------------------------------------------------------------------------ */

export type PieceId = "software" | "design" | "mechatronics" | "internship" | "directions" | "me";

export interface Piece {
  id: PieceId;
  /** full name, used in the menu line */
  name: string;
  /** short name, used on the chips of a project */
  short: string;
  /** Chinese name, drawn on the piece */
  cn: string;
  /** the name in capitals on the long sides of the piece */
  big: string;
  color: string;
  /** the words after the chapter number, e.g. "02 / 06 · Graduated" */
  role: string;
  /** the chapter title, very large, in two lines: the piece floats on the seam between them. the second line is in the piece's colour */
  title: [string, string];
  /** one short line in 2D under the title. keep it to one or two sentences */
  desc?: string;
  /** one small line under that, in capitals. a few words at most */
  tools?: string;
}

/* The six pieces, in the order you meet them after "Me": software, design, mechatronics, internship, directions.
   Keep "me" last in this list and keep six entries: the 3D scene counts on it. */
export const PIECES: Piece[] = [
  {
    id: "software", name: "Software engineering", short: "Software", cn: "软件", big: "SOFTWARE ENGINEERING", color: "#e0b85a",
    role: "Graduated", title: ["SOFTWARE", "ENGINEERING"],
    desc: "The technical foundation for mechatronics: how to build and troubleshoot machines and electronics. And no sector scales like technology.",
    tools: "Full-stack · multiple languages",
  },
  {
    id: "design", name: "Product design", short: "Design", cn: "设计", big: "PRODUCT DESIGN", color: "#a488ff",
    role: "On every project", title: ["PRODUCT", "DESIGN"],
    desc: "From concept and name to logo and interface, I design every project myself, so it looks as considered as it works.",
  },
  {
    id: "mechatronics", name: "Mechatronics", short: "Mechatronics", cn: "机电", big: "MECHATRONICS", color: "#6cc4ff",
    role: "Next study", title: ["MECHA-", "TRONICS"],
    desc: "AI writes more of the code every year. Machines that move in the real world are far harder to replace. I want to build both.",
  },
  {
    id: "internship", name: "Cybersecurity intern", short: "Internship", cn: "实习", big: "CYBERSECURITY INTERN", color: "#ff6a55",
    role: "Internship", title: ["CYBERSECURITY", "INTERN"],
    desc: "You can\u2019t keep a lock shut until you know how it opens. Attacks are cheap, automated and constant, and people still want a person responsible for security.",
  },
  {
    id: "directions", name: "Directions", short: "Directions", cn: "方向", big: "DIRECTIONS", color: "#5fd6ab",
    role: "Where it leads", title: ["DIRECTIONS", "STILL OPEN"],
    desc: "A broad base keeps me adaptable, so I can master whatever field comes next. Long term: building my own company.",
  },
  {
    id: "me", name: "About me", short: "Me", cn: "我", big: "BOB CHUNG", color: "#efe8d6",
    role: "The piece that holds the rest", title: ["ABOUT", "ME"],
    desc: "Scroll turns the piece",
  },
];

/* The Directions piece draws these as branching paths, lighting one at a time. Keep them short, in capitals.
   The last one is drawn in gold: the long-term goal. Seven fit best. */
export const DIRECTIONS = ["SYSTEMS BUILDER", "CREATIVE TECHNOLOGIST", "CONTROL SYSTEMS ENGINEER", "CYBERSECURITY", "DATA ENGINEER", "ROBOTICS", "FOUNDER"];

/* The Me piece has four long sides and the scroll turns it, one side per stop. Side 1 is the name being built (drawn
   in faces.ts). Sides 2 to 4 come from here. `big` is large, `small` sits under it. With two `stats` the side is split in two */
export interface MeSide { label: string; big?: string; small?: string; stats?: [string, string][] }
export const ME_SIDES: MeSide[] = [
  { label: "Name", big: "bhccob", small: "Chun Ho Bob Chung · hcc is Chung Chun Ho, backwards" },
  { label: "Basics", stats: [["2006", "Born"], ["INTP-T", "Personality"]] },
  { label: "Sport", big: "National champion", small: "Powerlifting · Table tennis" },
  { label: "Languages", big: "4+", small: "Languages spoken" },
];

export interface Project {
  name: string;
  /** shown beside the number and under "Type", e.g. "Website" or "Mobile app" */
  kind: string;
  /** the project's own colour: the soft glow at the top of its page while it has no picture */
  brand: string;
  /** the one line in the list, and the large line on the project page. Keep it to one sentence. */
  desc: string;
  /** under "Role" on the project page */
  role: string;
  /** which pieces it was built from */
  uses: PieceId[];
  /** a link, shown under "Link" and on the Visit button. Leave "" and the page says "Coming soon" and has no button. */
  url: string;
  /** the words on the button after "Visit": "the website" or "the app" */
  link: string;
  /** one wide picture, a file in public/work. Leave "" for a soft glow in the brand colour. */
  picture: string;
  /** one short preview video, a file in public/work (mp4 or webm). Leave "" and the page simply has no video. */
  video: string;
}

/* Selected work, newest first. To add a project, add one object to this list. Nothing else needs to change.
   Each row opens a full-screen page about the project. Keep the text short. */
export const PROJECTS: Project[] = [
  {
    name: "Jontai Energy", kind: "Website", brand: "#3fbf7f", uses: ["software", "design", "me"],
    role: "Direction, design and build",
    url: "https://jontai-energy.vercel.app/",
    link: "the website",
    picture: "/work/jontai-energy.webp",
    video: "", // no preview video yet: put the file in public/work and its name here, e.g. "/work/name.mp4"
    desc: "A full website redesign for a solar energy company in Aruba.",
  },
  {
    name: "Locked", kind: "Mobile app", brand: "#8a5cf6", uses: ["software", "design"],
    role: "Concept, name, design and build",
    url: "https://lockedlifts.com/",
    link: "the app",
    picture: "/work/locked.webp",
    video: "", // no preview video yet: put the file in public/work and its name here, e.g. "/work/name.mp4"
    desc: "A gym tracker that logs a lift in seconds and suggests the weight for the next one.",
  },
  {
    name: "Lumo", kind: "Mobile app", brand: "#8fd96a", uses: ["software", "design"],
    role: "Concept, name, design and build",
    url: "https://lumogrocery.com/",
    link: "the app",
    picture: "/work/lumo.webp",
    video: "", // no preview video yet: put the file in public/work and its name here, e.g. "/work/name.mp4"
    desc: "A grocery list that guides you through the shop.",
  },
];

/* Contact links on the last page. Leave a value "" and that link is not shown.
   There is no email link on purpose: the message form already reaches Bob's inbox. */
export const CONTACT = {
  github: "bhccob", // GitHub username, without the @
  instagram: "bhccob", // Instagram username, without the @
  email: "", // left empty on purpose (see above). put an address here to show an Email link
};
/* The address the message form sends to is NOT here. It is a secret setting on Vercel: see .env.example. */

export const SITE = {
  handle: "bhccob",
  name: "Bob Chung",
  url: "https://bhccob.com",
  /* the browser tab and what a shared link shows. Wording by Claude, Bob may edit. */
  title: "Bob Chung · bhccob",
  description: "Bob Chung (bhccob): software engineering, product design, mechatronics and a cybersecurity internship, as the six pieces of a Lu Ban lock.",
};

/* the loader: a boot log with the name being cracked above it. `eyebrow` rewrites itself into HERO.eyebrow on the way in */
export const LOADER = {
  cn: "鲁班锁", eyebrow: "The Lock · boot", version: "bhccob v3",
  denied: "Access denied", granted: "Access granted",
  withSound: "Enter with sound", noSound: "Enter without sound", note: "best with headphones",
};

export const HERO = {
  cn: "鲁班锁",
  eyebrow: "Six pieces. Not yet a lock.",
  heading: "Bob Chung",
  lead: "Born and raised in Aruba, now based in Rotterdam. Chinese by heritage.",
};

export const WORK = {
  cn: "作品",
  eyebrow: "Six pieces found",
  heading: "Selected work",
  lead: "Every project is the lock built again, from only the pieces it needed.",
  more: "More coming. This list keeps growing.",
};

export const END = {
  cn: "合",
  eyebrow: "Assembled",
  big: ["LET'S", "TALK"],
  lead: "Now it is a lock. Drag it to turn it. Press it to take it apart.",
};

/* the message form drawn on the six pieces */
export const FORM = {
  title: ["SEND A", "MESSAGE"],
  hint: "Press a piece to write on it.",
  name: "YOUR NAME",
  email: "YOUR EMAIL",
  message: "YOUR MESSAGE",
  /* the reason piece: a dropdown. add, remove or reword the reasons freely (five fit best) */
  reason: "REASON",
  reasonNone: "Choose one",
  reasonHint: "PRESS TO CHOOSE",
  reasonHintPhone: "TAP TO CHANGE",
  reasons: ["A project", "A job or internship", "Working together", "A question", "Just saying hello"],
  send: "SEND",
  invalid: "Fill in your name, a valid email and a message.",
  sending: "Sending your message.",
  sent: "Sent. Thank you, I will write back.",
  /* after a message is sent the lock closes again, and the big words behind it change from LET'S TALK to these */
  thanks: ["THANK", "YOU"],
  thanksLabel: "Thank you",
  sentEyebrow: "Sent",
  sentLead: "Your message is sent. I will write back.",
  error: "It did not send. Please try again in a moment.",
  tooMany: "Too many messages from here. Please try again later.",
  back: "← Back to the lock",
  /* the button under the lock on the last page */
  open: "Send a message",
};
