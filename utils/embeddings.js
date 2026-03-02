const { OpenAI } = require("openai");
const { load, save } = require("./storage");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const cacheFile = "./data/cache.json";
let cache = load(cacheFile);

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

async function getEmbedding(word) {
  if (cache[word]) return cache[word];

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: word
  });

  const embedding = response.data[0].embedding;
  cache[word] = embedding;
  save(cacheFile, cache);

  return embedding;
}

module.exports = { getEmbedding, cosineSimilarity };