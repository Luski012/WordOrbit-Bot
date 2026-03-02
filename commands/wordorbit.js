const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wordorbit")
    .setDescription("AI WordOrbit Game")
    .addSubcommand(s => s.setName("start").setDescription("Start a random game"))
    .addSubcommand(s => s.setName("daily").setDescription("Start today's global word"))
    .addSubcommand(s => s.setName("stop").setDescription("Stop current game"))
    .addSubcommand(s => s.setName("stats").setDescription("View your stats"))
    .addSubcommand(s => s.setName("leaderboard").setDescription("Global leaderboard"))
    .addSubcommand(s =>
      s.setName("setchannel")
        .setDescription("Set the WordOrbit game channel")
        .addChannelOption(opt =>
          opt.setName("channel")
            .setDescription("Channel for WordOrbit games")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const manager = require("../utils/gameManager").instance;
    const sub = interaction.options.getSubcommand();

    if (sub === "start") return manager.start(interaction);
    if (sub === "daily") return manager.daily(interaction);
    if (sub === "stop") return manager.stop(interaction);
    if (sub === "stats") return manager.stats(interaction);
    if (sub === "leaderboard") return manager.leaderboard(interaction);
    if (sub === "setchannel") return manager.setChannel(interaction);
  }
};