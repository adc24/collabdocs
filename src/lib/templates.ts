import { fromText, EMPTY_CONTENT } from "./content";
import type { TemplateId, RichNode } from "./types";

export const templateData: Record<
  TemplateId,
  { title: string; description: string; color: string; content: RichNode }
> = {
  blank: {
    title: "Untitled document",
    description: "A fresh start for any idea",
    color: "paper",
    content: EMPTY_CONTENT,
  },
  project: {
    title: "Project brief",
    description: "Turn a vision into a plan",
    color: "lavender",
    content: fromText(
      "# Project brief\nA little clarity goes a long way.\n\n## The big picture\nWhat are we building, and why does it matter?\n\n## Goals & outcomes\n- Define what success looks like\n- Identify the people we’re building for\n- Agree on the outcomes that matter\n\n## Scope\nOutline what’s in, what’s out, and what comes next.\n\n## Milestones\n1. Discovery & research\n2. Design & exploration\n3. Build, test & launch\n\n## Open questions\nWhat do we need to figure out together?",
    ),
  },
  meeting: {
    title: "Meeting notes",
    description: "Less forgetting, more doing",
    color: "peach",
    content: fromText(
      "# Meeting notes\nGood conversations deserve a place to live.\n\n## At a glance\n**Date:** Add a date\n**Attendees:** Who’s in the room?\n\n## Agenda\n1. Check-in & updates\n2. Topics to discuss\n3. Decisions & next steps\n\n## Discussion\nCapture the things worth remembering.\n\n## Action items\n- What needs to happen? Who owns it?\n- When should we check back in?\n\n## Next meeting\nSame team, a little more progress.",
    ),
  },
  brainstorm: {
    title: "Brainstorm",
    description: "Give your ideas some room",
    color: "sage",
    content: fromText(
      "# A little room for big ideas\nNo bad ideas. Just starting points.\n\n## The challenge\nWhat problem are we trying to solve?\n\n## What if…\n- We started from scratch?\n- We made it ten times simpler?\n- We tried the unexpected?\n\n## Ideas worth exploring\nLet your thoughts wander here.\n\n## Connecting the dots\nWhich ideas work better together?\n\n## Our next step\nChoose one small experiment to move forward.",
    ),
  },
};
export const seedDocuments = [
  {
    title: "Website redesign",
    color: "lavender",
    owner: "abhay",
    hours: 2,
    starred: true,
    shared: true,
    content:
      "# A fresh perspective.\n# A better experience.\n**WEBSITE REDESIGN · PROJECT BRIEF**\n\n## A website that feels like us\nWe’re reimagining our digital home. Something simpler, more thoughtful, and unmistakably ours.\n\n## What we’re working toward\n- A clear, intuitive experience for everyone\n- A visual language with a little personality\n- A faster path from curiosity to connection\n\n## The plan\n1. Listen to our users\n2. Explore, sketch, and prototype\n3. Build something we’re proud of\n\n## Success looks like\nA thoughtful experience that makes the complex feel simple.",
  },
  {
    title: "Q3 product roadmap",
    color: "peach",
    owner: "abhay",
    hours: 4,
    starred: true,
    shared: true,
    content:
      "# Big ideas.\n# Clear direction.\n**Q3 PRODUCT ROADMAP**\n\n## A quarter of meaningful progress\nA shared plan for building things our customers will love.\n\n## July — Lay the foundation\n- Polish the onboarding experience\n- Make search feel effortless\n- Listen to our early adopters\n\n## August — Build together\n- Bring teams into the workspace\n- Ship our most-requested improvements\n\n## September — Make it shine\n- Fine-tune performance\n- Celebrate the little wins\n- Reflect, learn, and plan what’s next",
  },
  {
    title: "Monday team sync",
    color: "sage",
    owner: "reviewer",
    hours: 6,
    starred: false,
    shared: true,
    content:
      "# A good week\n# starts together.\n**TEAM SYNC · MEETING NOTES**\n\n## A quick check-in\nA few minutes to get on the same page, share what’s happening, and help each other move forward.\n\n## This week’s focus\n- Review the new website concepts\n- Finalize our Q3 priorities\n- Make space for customer feedback\n\n## Around the room\n**Abhay:** First design explorations are ready for feedback.\n**Reviewer:** Reviewing the latest product proposal.\n\n## Next steps\n1. Share feedback by Wednesday\n2. Pick our top three priorities\n3. Schedule a design review",
  },
  {
    title: "Ideas worth exploring",
    color: "blue",
    owner: "abhay",
    hours: 23,
    starred: false,
    shared: false,
    content:
      "# What if we\n# tried something new?\n**THE IDEA NOTEBOOK**\n\n## A place for possibility\nHalf-formed thoughts, happy accidents, and the occasional lightbulb moment. They all belong here.\n\n## A few things on my mind\n- A calmer way to organize everyday work\n- Little details that make people smile\n- Tools that get out of the way\n\n## Worth a closer look\nWhat would our product look like if we removed half the features and doubled the care?\n\n> The best way to have a good idea is to have lots of ideas.\n\n## One small experiment\nTry the simplest version first. See what happens.",
  },
  {
    title: "Brand voice & guidelines",
    color: "sand",
    owner: "reviewer",
    hours: 28,
    starred: false,
    shared: true,
    content:
      "# A little personality.\n# A lot of purpose.\n**OUR BRAND, IN WORDS**\n\n## Sound like a person\nWe’re warm, clear, and genuinely helpful. We talk with people, not at them.\n\n## Our voice\n- **Thoughtful:** Every word earns its place\n- **Approachable:** Simple without being simplistic\n- **Confident:** We know our craft, but stay curious\n\n## A few guiding principles\n1. Say what you mean\n2. Keep it human\n3. Make the next step obvious\n\n## Words we love\nTogether. Thoughtful. Simple. Possibility.\n\n## The takeaway\nWrite like you’re helping a friend do something great.",
  },
  {
    title: "Getting started with CollabDocs",
    color: "paper",
    owner: "abhay",
    hours: 48,
    starred: false,
    shared: false,
    content:
      "# Your ideas\n# are in good company.\n**WELCOME TO COLLABDOCS**\n\n## Make yourself at home\nThis is your space to think, write, and bring good ideas to life — on your own or together.\n\n## Start with a blank page\nCreate a document or choose a template. The rest is up to you.\n\n## Make it yours\nUse the toolbar to add headings, lists, and a little emphasis. Your changes save automatically.\n\n## Better together\nShare a document with reviewer@example.com, then switch demo accounts to see collaboration in action.\n\n## Bring your words along\nImport a .txt or .md file to pick up where you left off.\n\n> A little space for your next big idea.",
  },
];
