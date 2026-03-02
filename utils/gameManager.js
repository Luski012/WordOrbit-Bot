const cron = require("node-cron");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getEmbedding, cosineSimilarity } = require("./embeddings");
const { load, save } = require("./storage");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const leaderboardFile = "./data/leaderboard.json";
const statsFile = "./data/stats.json";
const serversFile = "./data/servers.json";

let leaderboard = load(leaderboardFile);
let stats = load(statsFile);
let servers = load(serversFile);

class GameManager {
  constructor() {
    this.games = new Map();
    this.dailyWord = null;
    this.initDaily();
    this.startDailyReset();
  }

  async generateWord() {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONE single common English noun only. Lowercase. No punctuation." },
        { role: "user", content: "Give me a random word." }
      ],
      temperature: 1
    });

    return res.choices[0].message.content.trim().toLowerCase();
  }

  async initDaily() {
    this.dailyWord = await this.generateWord();
    console.log("🌍 Daily WordOrbit word:", this.dailyWord);
  }

  startDailyReset() {
    cron.schedule("0 0 * * *", async () => {
      this.dailyWord = await this.generateWord();
      console.log("🌍 Daily WordOrbit reset:", this.dailyWord);
    });
  }

  checkChannel(interaction) {
    const guildId = interaction.guildId;
    if (!servers[guildId]) return true;
    return servers[guildId].channel === interaction.channelId;
  }

  async setChannel(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: "Admin only command.", ephemeral: true });

    const channel = interaction.options.getChannel("channel");

    servers[interaction.guildId] = { channel: channel.id };
    save(serversFile, servers);

    interaction.reply(`✅ WordOrbit channel set to ${channel}`);
  }

  async start(interaction) {
    await interaction.deferReply();

    if (!this.checkChannel(interaction))
      return interaction.editReply("❌ This is not the configured WordOrbit channel.");

    if (this.games.has(interaction.channelId))
      return interaction.editReply("⚠️ Game already running here.");

    const secret = await this.generateWord();
    return this.createGame(interaction, secret, false);
  }

  async daily(interaction) {
    await interaction.deferReply();

    if (!this.checkChannel(interaction))
      return interaction.editReply("❌ This is not the configured WordOrbit channel.");

    if (this.games.has(interaction.channelId))
      return interaction.editReply("⚠️ Game already running here.");

    return this.createGame(interaction, this.dailyWord, true);
  }

  async createGame(interaction, word, isDaily) {
    const embedding = await getEmbedding(word);

    this.games.set(interaction.channelId, {
      secret: word,
      embedding,
      guesses: [],
      lastGuess: new Map(),
      daily: isDaily
    });

    setTimeout(() => {
      if (this.games.has(interaction.channelId)) {
        this.games.delete(interaction.channelId);
        interaction.channel.send(`⏰ Time's up! The word was **${word}**`);
      }
    }, 30 * 60 * 1000);

    interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(isDaily ? "🌍 WordOrbit Daily" : "🚀 WordOrbit")
          .setDescription("30 minutes. Guess any English word.")
          .setColor(0x5865F2)
      ]
    });
  }

  stop(interaction) {
    if (!this.games.has(interaction.channelId))
      return interaction.reply("No game running.");

    const word = this.games.get(interaction.channelId).secret;
    this.games.delete(interaction.channelId);

    interaction.reply(`Game stopped. Word was **${word}**`);
  }

  stats(interaction) {
    const user = interaction.user.id;
    const s = stats[user] || { wins: 0, streak: 0 };

    interaction.reply(`🏆 Wins: ${s.wins}\n🔥 Streak: ${s.streak}`);
  }

  leaderboard(interaction) {
    const sorted = Object.entries(leaderboard)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (!sorted.length)
      return interaction.reply("No wins yet.");

    const text = sorted.map(([id, w], i) => `${i+1}. <@${id}> - ${w}`).join("\n");

    interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏆 WordOrbit Leaderboard")
          .setDescription(text)
          .setColor(0xFFD700)
      ]
    });
  }

  async handleGuess(message) {
    if (!this.games.has(message.channel.id)) return;
    if (message.author.bot) return;

    const guess = message.content.toLowerCase().trim();
    if (!/^[a-zA-Z]+$/.test(guess)) return;

    const game = this.games.get(message.channel.id);

    const now = Date.now();
    const last = game.lastGuess.get(message.author.id) || 0;
    if (now - last < 2000) return;

    game.lastGuess.set(message.author.id, now);
    if (game.guesses.includes(guess)) return;
    game.guesses.push(guess);

    if (guess === game.secret) {
      this.games.delete(message.channel.id);

      leaderboard[message.author.id] = (leaderboard[message.author.id] || 0) + 1;
      stats[message.author.id] = stats[message.author.id] || { wins: 0, streak: 0 };

      stats[message.author.id].wins++;
      stats[message.author.id].streak++;

      save(leaderboardFile, leaderboard);
      save(statsFile, stats);

      return message.reply(`🏆 Correct! The word was **${game.secret}**`);
    }

    const guessEmbedding = await getEmbedding(guess);
    const similarity = cosineSimilarity(game.embedding, guessEmbedding);
    const percent = (similarity * 100).toFixed(2);

    message.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`🔎 **${guess}**\nSimilarity: **${percent}%**`)
          .setColor(0x00AEFF)
      ]
    });
  }
}

const manager = new GameManager();

module.exports = (client) => {
  client.on("messageCreate", message => manager.handleGuess(message));
};

module.exports.instance = manager;