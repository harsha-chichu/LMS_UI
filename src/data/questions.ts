import type { Topic } from "@/lib/constants";
import type { Difficulty, Domain } from "@/types";

export interface BankQuestion {
  text: string;
  topics: string[];
}

type Bank = { [D in Domain]: Record<Difficulty, BankQuestion[]> };

/** Tags are checked against the domain's curated `TOPICS`. */
function tagger<D extends Domain>() {
  return (text: string, ...topics: Topic<D>[]): BankQuestion => ({ text, topics });
}

const ai = tagger<"ai-ml">();
const ds = tagger<"data-science">();
const be = tagger<"backend">();
const fe = tagger<"frontend">();
const sd = tagger<"system-design">();
const bh = tagger<"behavioral">();

/**
 * Fallback question bank, used when the LLM is unavailable and for the
 * landing demo. Keep wording lowercase to match the product voice.
 */
export const QUESTION_BANK: Bank = {
  "ai-ml": {
    easy: [
      ai("what is the difference between supervised and unsupervised learning?", "ml fundamentals"),
      ai("explain overfitting and two ways you would reduce it.", "ml fundamentals"),
      ai("what does a train / validation / test split protect you from?", "ml fundamentals", "evaluation"),
      ai("what is gradient descent, in plain words?", "ml fundamentals", "deep learning"),
      ai("when would you pick precision over recall as your main metric?", "evaluation"),
      ai("what is an embedding, and why are they useful?", "deep learning", "llms & rag"),
      ai("what does regularization do to a model?", "ml fundamentals"),
      ai("how does a decision tree decide where to split?", "ml fundamentals"),
      ai("what is the role of an activation function in a neural network?", "deep learning"),
      ai("what is a confusion matrix and what can you read from it?", "evaluation"),
    ],
    medium: [
      ai("explain the bias–variance tradeoff and how you would diagnose which one is hurting a model.", "ml fundamentals"),
      ai("how does attention work in a transformer, and why did it replace recurrence?", "deep learning", "llms & rag"),
      ai("a retrieval-augmented chatbot keeps citing the wrong document. how do you debug it?", "llms & rag"),
      ai("when would you fine-tune a model instead of improving the prompt or the retrieval?", "llms & rag"),
      ai("how would you evaluate an llm feature before shipping it?", "llms & rag", "evaluation"),
      ai("your model's offline metrics improved but the online a/b test is flat. what do you check?", "evaluation", "mlops & production"),
      ai("how would you handle a heavily imbalanced classification dataset?", "ml fundamentals"),
      ai("explain how you would detect and respond to data drift in production.", "mlops & production"),
      ai("what are the trade-offs between batch and online inference?", "mlops & production"),
      ai("how would you choose a chunking strategy for a document search system?", "llms & rag"),
    ],
    hard: [
      ai("design an evaluation pipeline for a customer-support llm that catches regressions before release.", "evaluation", "llms & rag"),
      ai("your rag system answers well in english but poorly in hindi. walk through how you'd fix it.", "llms & rag"),
      ai("how would you reduce the latency of an llm-backed feature by 5x without hurting quality?", "llms & rag", "mlops & production"),
      ai("explain how you would train a ranking model when your labels come from clicks.", "ml fundamentals", "evaluation"),
      ai("a model is fair on aggregate metrics but harms a small subgroup. how do you find and fix it?", "responsible ai", "evaluation"),
      ai("how would you decide between distilling a large model and serving it with quantization?", "deep learning", "mlops & production"),
      ai("design a feedback loop that turns user corrections into model improvements safely.", "mlops & production", "responsible ai"),
      ai("how would you debug a training run whose loss suddenly diverges after 40k steps?", "deep learning"),
      ai("what would make you distrust a benchmark result, and how would you verify it?", "evaluation"),
      ai("how would you build guardrails for an agent that can take actions on a user's account?", "responsible ai", "llms & rag"),
    ],
  },
  "data-science": {
    easy: [
      ds("what is the difference between mean and median, and when does it matter?", "statistics"),
      ds("explain a p-value to a product manager.", "statistics", "experimentation"),
      ds("what is the difference between correlation and causation? give an example.", "statistics", "causal inference"),
      ds("how would you handle missing values in a dataset?", "modeling"),
      ds("what is a/b testing and why do we randomize?", "experimentation"),
      ds("when would you use a bar chart versus a line chart?", "product analytics"),
      ds("what is a confidence interval?", "statistics"),
      ds("what is the central limit theorem and why does it matter?", "statistics"),
      ds("how would you detect outliers in a column of numbers?", "statistics", "modeling"),
      ds("what is the difference between a population and a sample?", "statistics"),
    ],
    medium: [
      ds("an a/b test shows a 2% lift but the result flips after a week. what happened?", "experimentation"),
      ds("how would you measure the success of a new onboarding flow?", "product analytics"),
      ds("daily active users dropped 10% overnight. how do you investigate?", "product analytics"),
      ds("how do you choose the sample size for an experiment?", "experimentation", "statistics"),
      ds("explain simpson's paradox with an example you could see at work.", "statistics", "causal inference"),
      ds("how would you build a churn prediction model and make it useful to the business?", "modeling"),
      ds("what are the risks of peeking at experiment results early?", "experimentation"),
      ds("how would you segment customers for a marketing campaign?", "modeling", "product analytics"),
      ds("how would you estimate the impact of a feature you couldn't a/b test?", "causal inference"),
      ds("what metrics would you put on a dashboard for a subscription product?", "product analytics"),
    ],
    hard: [
      ds("design an experimentation platform that handles network effects between users.", "experimentation"),
      ds("how would you estimate long-term retention impact from a two-week experiment?", "experimentation", "causal inference"),
      ds("walk through building a causal model for the effect of discounts on lifetime value.", "causal inference", "modeling"),
      ds("your forecasting model fails every holiday season. how do you fix it?", "modeling"),
      ds("how would you detect fraud when fewer than 0.1% of transactions are labelled?", "modeling"),
      ds("design a metric framework for a two-sided marketplace.", "product analytics"),
      ds("how would you correct for selection bias in observational data?", "causal inference", "statistics"),
      ds("how would you explain a model's predictions to a regulator?", "modeling"),
      ds("two teams report conflicting numbers for the same metric. how do you resolve it?", "product analytics"),
      ds("how would you design a pricing experiment without hurting trust?", "experimentation"),
    ],
  },
  backend: {
    easy: [
      be("what is the difference between a process and a thread?", "performance"),
      be("what happens when you type a url into a browser and press enter?", "apis"),
      be("explain rest and what makes an api restful.", "apis"),
      be("what is an index in a database and what does it cost?", "databases", "performance"),
      be("what is the difference between sql and nosql databases?", "databases"),
      be("what is idempotency and why does it matter for apis?", "apis", "reliability"),
      be("what are http status codes 401 and 403, and how do they differ?", "apis", "security"),
      be("what is caching and where can you add it in a web app?", "performance"),
      be("what is a race condition?", "distributed systems"),
      be("what does a load balancer do?", "reliability", "distributed systems"),
    ],
    medium: [
      be("how would you design rate limiting for a public api?", "apis", "security"),
      be("a query got 10x slower after a deploy. how do you find out why?", "databases", "performance"),
      be("explain database transactions and isolation levels with an example.", "databases"),
      be("how would you safely run a schema migration on a large table with no downtime?", "databases", "reliability"),
      be("how do you make a payment webhook handler reliable?", "apis", "reliability"),
      be("what are the trade-offs between a monolith and microservices?", "distributed systems"),
      be("how would you implement retries without overwhelming a failing service?", "reliability", "distributed systems"),
      be("how would you design authentication for a mobile app and a web app sharing one api?", "security", "apis"),
      be("explain eventual consistency and where you would accept it.", "distributed systems", "databases"),
      be("how would you structure logging and tracing across several services?", "reliability"),
    ],
    hard: [
      be("design a job queue that guarantees each job runs exactly once from the user's perspective.", "distributed systems", "reliability"),
      be("how would you shard a growing users table without downtime?", "databases"),
      be("your service has p99 latency spikes every few minutes. walk through the investigation.", "performance"),
      be("design a multi-region write path and explain how you handle conflicts.", "distributed systems", "databases"),
      be("how would you build an audit log that can't be tampered with?", "security"),
      be("explain how you would migrate a critical service to a new database live.", "databases", "reliability"),
      be("design backpressure for a pipeline that ingests 1m events per second.", "distributed systems", "performance"),
      be("how would you find a memory leak in a long-running production service?", "performance"),
      be("design an api versioning strategy for clients you can't force to upgrade.", "apis"),
      be("how would you make a distributed cron reliable?", "distributed systems", "reliability"),
    ],
  },
  frontend: {
    easy: [
      fe("what is the difference between let, const and var?", "javascript"),
      fe("explain the css box model.", "css & layout"),
      fe("what is the virtual dom and why does react use one?", "react & state"),
      fe("what is the difference between == and === in javascript?", "javascript"),
      fe("how does event bubbling work?", "javascript"),
      fe("what are semantic html elements and why use them?", "accessibility"),
      fe("what is a promise in javascript?", "javascript"),
      fe("how do flexbox and grid differ?", "css & layout"),
      fe("what does responsive design mean in practice?", "css & layout"),
      fe("what is the difference between localstorage and cookies?", "javascript"),
    ],
    medium: [
      fe("a page feels slow on mid-range phones. how do you find and fix the cause?", "performance"),
      fe("how would you manage state in a large react app?", "react & state", "architecture"),
      fe("explain server-side rendering versus static generation versus client rendering.", "architecture", "performance"),
      fe("how would you make a custom dropdown accessible?", "accessibility"),
      fe("what causes layout shift and how do you prevent it?", "css & layout", "performance"),
      fe("how would you structure a component library used by several teams?", "architecture"),
      fe("how do you prevent xss in a modern frontend?", "javascript"),
      fe("explain how you would implement optimistic updates and roll them back.", "react & state"),
      fe("how would you test a complex form?", "react & state"),
      fe("how does the browser's event loop affect ui responsiveness?", "javascript", "performance"),
    ],
    hard: [
      fe("design a real-time collaborative text editor's frontend architecture.", "architecture"),
      fe("how would you migrate a large app between frameworks incrementally?", "architecture"),
      fe("your bundle is 4mb. walk through cutting it in half.", "performance"),
      fe("design an offline-first web app that syncs when back online.", "architecture", "react & state"),
      fe("how would you render a list of 100,000 rows smoothly?", "performance"),
      fe("how would you build a design system that supports theming and dark mode at scale?", "css & layout", "architecture"),
      fe("debug a memory leak in a single-page app that's open all day.", "performance", "javascript"),
      fe("design the frontend for a dashboard with live data from websockets.", "architecture", "react & state"),
      fe("how would you measure and improve interaction to next paint?", "performance"),
      fe("design micro-frontends and explain when you would not use them.", "architecture"),
    ],
  },
  "system-design": {
    easy: [
      sd("what is horizontal versus vertical scaling?", "fundamentals"),
      sd("what is a cdn and when would you use one?", "fundamentals"),
      sd("explain the purpose of a message queue.", "messaging & real-time"),
      sd("what is a single point of failure?", "reliability"),
      sd("what is the cap theorem, briefly?", "data & storage", "fundamentals"),
      sd("what is database replication?", "data & storage"),
      sd("what is the difference between latency and throughput?", "fundamentals"),
      sd("why would you put a cache in front of a database?", "data & storage"),
      sd("what is a reverse proxy?", "fundamentals"),
      sd("what is a health check and why do services need one?", "reliability"),
    ],
    medium: [
      sd("design a url shortener.", "data & storage"),
      sd("design a rate limiter.", "reliability"),
      sd("design a notification system that sends email, sms and push.", "messaging & real-time"),
      sd("design the backend for a news feed.", "large-scale products"),
      sd("design a file upload service for large files.", "data & storage"),
      sd("design a leaderboard for a game with millions of players.", "data & storage", "large-scale products"),
      sd("design a web crawler.", "large-scale products"),
      sd("design a chat system for small groups.", "messaging & real-time"),
      sd("design a ride-sharing dispatch service at a high level.", "large-scale products", "messaging & real-time"),
      sd("design a key-value store.", "data & storage"),
    ],
    hard: [
      sd("design a global payments system that never double-charges.", "reliability"),
      sd("design a video streaming platform like youtube.", "large-scale products"),
      sd("design a distributed search engine for a large e-commerce catalog.", "data & storage", "large-scale products"),
      sd("design google docs-style real-time collaboration.", "messaging & real-time"),
      sd("design a metrics and alerting system for 10,000 services.", "reliability", "data & storage"),
      sd("design a ticket booking system for a stadium sale that sells out in seconds.", "reliability", "large-scale products"),
      sd("design a recommendation system serving 100m users.", "large-scale products"),
      sd("design a multi-tenant saas platform with strict data isolation.", "data & storage"),
      sd("design a feature-flag service with instant global rollout and rollback.", "reliability", "messaging & real-time"),
      sd("design an llm inference platform that serves many models efficiently.", "large-scale products"),
    ],
  },
  behavioral: {
    easy: [
      bh("tell me about yourself.", "about you"),
      bh("why do you want this role?", "about you"),
      bh("tell me about a project you're proud of.", "about you"),
      bh("how do you prioritize when you have too much to do?", "prioritization"),
      bh("describe your ideal team.", "about you"),
      bh("tell me about something you learned recently.", "growth & feedback"),
      bh("what kind of feedback helps you most?", "growth & feedback"),
      bh("how do you keep up with your field?", "growth & feedback"),
      bh("what are you looking for in your next role?", "about you"),
      bh("describe a typical week in your current job.", "about you"),
    ],
    medium: [
      bh("tell me about a time you disagreed with a teammate. what happened?", "conflict"),
      bh("describe a time you missed a deadline. what did you do?", "failure & mistakes", "prioritization"),
      bh("tell me about a time you received critical feedback.", "growth & feedback"),
      bh("describe a decision you made with incomplete information.", "prioritization"),
      bh("tell me about a time you had to learn something quickly.", "growth & feedback"),
      bh("describe a time you improved a process.", "leadership & influence"),
      bh("tell me about a mistake you made and how you handled it.", "failure & mistakes"),
      bh("describe a time you had to influence someone without authority.", "leadership & influence"),
      bh("tell me about a time you went beyond your role.", "leadership & influence"),
      bh("describe how you handled a difficult stakeholder.", "conflict"),
    ],
    hard: [
      bh("tell me about the hardest technical trade-off you've owned and how it played out.", "prioritization"),
      bh("describe a time you had to deliver bad news to leadership.", "conflict", "leadership & influence"),
      bh("tell me about a project that failed. what would you do differently?", "failure & mistakes"),
      bh("describe a time you changed a team's direction.", "leadership & influence"),
      bh("tell me about a conflict between two priorities you couldn't both satisfy.", "prioritization", "conflict"),
      bh("describe a time you had to let something go to ship on time.", "prioritization"),
      bh("tell me about a time you mentored someone through a hard problem.", "leadership & influence"),
      bh("describe a time you pushed back on a product requirement.", "conflict"),
      bh("tell me about a time your data contradicted a senior person's opinion.", "conflict", "leadership & influence"),
      bh("describe the most ambiguous project you've led.", "leadership & influence"),
    ],
  },
};

/** Generic follow-ups used by the mock evaluator. */
export const FALLBACK_FOLLOW_UPS = [
  "can you walk me through a concrete example from a project where you applied this?",
  "what trade-off would make you choose differently here?",
  "how would you measure whether your approach actually worked?",
  "what would you check first if this went wrong in production?",
  "what's the biggest risk with that approach, and how would you reduce it?",
];
