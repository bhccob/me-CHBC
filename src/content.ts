/* ------------------------------------------------------------------------------------------
   Everything you can edit on the site lives in this file, and only here.
   Text marked TODO is a placeholder that still needs a real value from Bob.
   After adding a new Chinese character anywhere, run `npm run fonts` once.
   ------------------------------------------------------------------------------------------ */

export type PieceId = "software" | "development" | "mechatronics" | "internship" | "directions" | "me";

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
  /** the words after the chapter number, e.g. "02 / 06 · The foundation" */
  role: string;
  heading: string;
  /** one line under the heading. left out on purpose (Bob, 2026-11-16: less clutter). add it and it shows again */
  tagline?: string;
  /** the short blocks under the heading: [title, text]. one block gets the full width, two sit side by side */
  facts?: [string, string][];
  /** one small line under the blocks: [label, what]. Keep it to a few words, it is meant to stay small */
  tools?: [string, string][];
}

/* The six pieces, in the order you meet them after "Me": software, development, mechatronics, internship, directions.
   Keep "me" last in this list and keep six entries: the 3D scene counts on it. */
export const PIECES: Piece[] = [
  {
    id: "software", name: "Software engineering", short: "Software", cn: "软件", big: "SOFTWARE ENGINEERING", color: "#e0b85a",
    role: "The foundation", heading: "Software engineering",
    facts: [
      ["Why I chose it", "Ideas are cheap. Most people with a good one wait for someone else to build it. I chose software so I never have to wait: I can take an idea from nothing to a working product myself."],
    ],
    tools: [["Stack", "Full-stack · multiple programming languages"]],
  },
  {
    id: "development", name: "Development", short: "Development", cn: "开发", big: "DEVELOPMENT", color: "#a488ff",
    role: "Games and apps · part of software engineering", heading: "Development",
    facts: [
      ["Why I chose it", "Games are where I started, and they are an honest test: nobody plays a boring game to be polite. Apps are the same. People open them every day or delete them. I want users who tell me the truth straight away."],
    ],
    tools: [["Games", "Godot · Roblox Studio"], ["Apps", "Expo · React Native · TypeScript"]], // the apps line is what Locked and Lumo are built with
  },
  {
    id: "mechatronics", name: "Mechatronics", short: "Mechatronics", cn: "机电", big: "MECHATRONICS", color: "#6cc4ff",
    role: "Next study", heading: "Mechatronics",
    facts: [
      ["Why I chose it", "Software alone is getting easier to replace, and AI already writes much of it. Machines that move in the real world are far harder to fake. Whoever can build both the code and the hardware stays needed. That is who I am becoming."],
    ],
  },
  {
    /* one internship so far. when there is a second, make the two blocks one per internship:
       facts: [["Cybersecurity", "..."], ["The second one", "..."]] and change `role` to "Two so far" */
    id: "internship", name: "Internship", short: "Internship", cn: "实习", big: "INTERNSHIP", color: "#ff6a55",
    role: "Cybersecurity", heading: "Internship",
    facts: [
      ["Why I chose it", "You cannot keep a lock shut until you know how it gets opened. Attacks are now cheap, automated and constant, and most companies are less secure than they think. AI can raise the alarm, but people still want a person responsible for what matters."],
    ],
  },
  {
    id: "directions", name: "Directions", short: "Directions", cn: "方向", big: "DIRECTIONS", color: "#5fd6ab",
    role: "Still open", heading: "Directions",
    facts: [
      ["Where it can lead", "A future-proof, well-paid career in tech. A broad base keeps me adaptable to any change, so I can master a new field quickly."],
      ["Long term", "Building my own company."],
    ],
  },
  {
    id: "me", name: "Me", short: "Me", cn: "我", big: "BOB CHUNG", color: "#efe8d6",
    role: "The piece that holds the rest", heading: "About me",
  },
];

/* The Directions piece draws these as branching paths, lighting one at a time. Keep them short, in capitals.
   The last one is drawn in gold: the long-term goal. Seven fit best. */
export const DIRECTIONS = ["SYSTEMS BUILDER", "CREATIVE TECHNOLOGIST", "CONTROL SYSTEMS ENGINEER", "CYBERSECURITY", "DATA ENGINEER", "ROBOTICS", "FOUNDER"];

/* The Me piece opens into six slips: [the word on the slip, the full sentence beside it] */
export const ME_SLIPS: [string, string][] = [
  ["NAME", "Chun Ho Bob Chung. Online I use bhccob, which is Bob around my Chinese initials in reverse, or the short form CHBC."],
  ["AGE", "Born in 2006. Twenty years old."],
  ["STUDENT", "Software engineering graduate, continuing into mechatronics."],
  ["PERSONALITY", "INTP-T. Practical and observant. I learn by doing, stay calm under pressure and prefer solving a problem to discussing it."],
  ["HOBBIES", "Lifting weights and running for balance. Former national champion in my category in both powerlifting and table tennis, which I also played abroad. Swimming diplomas A to F."],
  ["FUN FACT", "I speak more than four languages."],
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
    name: "Jontai Energy", kind: "Website", brand: "#3fbf7f", uses: ["software", "me"],
    role: "Direction, design and build",
    url: "https://jontai-energy.vercel.app/",
    link: "the website",
    picture: "/work/jontai-energy.webp",
    video: "", // no preview video yet: put the file in public/work and its name here, e.g. "/work/name.mp4"
    desc: "A full website redesign for a solar energy company in Aruba.",
  },
  {
    name: "Locked", kind: "Mobile app", brand: "#8a5cf6", uses: ["software", "development"],
    role: "Concept, name, design and build",
    url: "https://lockedlifts.com/",
    link: "the app",
    picture: "/work/locked.webp",
    video: "", // no preview video yet: put the file in public/work and its name here, e.g. "/work/name.mp4"
    desc: "A gym tracker that logs a lift in seconds and suggests the weight for the next one.",
  },
  {
    name: "Lumo", kind: "Mobile app", brand: "#8fd96a", uses: ["software", "development"],
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
  description: "Bob Chung (bhccob): software engineering, game and app development, mechatronics and a cybersecurity internship, as the six pieces of a Lu Ban lock.",
};

export const LOADER = { cn: "鲁班锁", eyebrow: "bhccob · Bob Chung", withSound: "Enter with sound", noSound: "Enter without sound", note: "Best with headphones" };

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
